# Phase 0 調査: 依存ライブラリの最新化

**調査日**: 2026-05-18 / **情報源**: npm registry（`npm view`）＋ `main.js` 静的解析

> 注: 各破壊的変更の最終確証は実装フェーズの「ビルド＋手動スモーク＋ユニット
> テスト」で行う。本書は調査時点の判断と方針を確定するもの。

## 決定 1: 目標バージョン

- **Decision**: vite `^8.0.13` / maplibre-gl `^5.24.0` / @turf/distance `^7.3.5`
  / maplibre-gl-opacity `^1.8.0` / maplibre-gl-gsi-terrain `^2.3.2`（すべて
  registry の `latest`）。プレリリース/RC は対象外（spec 前提）。
- **Rationale**: 「動作する最新（メジャーアップ含む）」というユーザー指定
  （Q2:A）。Vite 8 engines は `node ^20.19.0 || >=22.12.0` で開発機 Node
  v24.14.1 と整合し、README「Vite 8 の要件に準拠」の記述とも一致。
- **Alternatives considered**: 非破壊レンジ据え置き案（Q2:B）はユーザーに
  却下済み。段階的メジャーアップ（v2→v3→v4→v5 を個別）も検討したが、最終形が
  同一かつ検証コストが増えるため一括アップ＋まとめて回帰検証を採用。

## 決定 2: @turf/distance v6 → v7（export 形態の変更）

- **調査**: v7 は ESM 化され `exports` マップを持つ。turf v7 系はモジュールを
  named export 化しており、`import distance from '@turf/distance'`（default）は
  v7 で解決できない可能性が高い。
- **Decision**: `main.js` の取り込みを **named import** へ変更する想定:
  `import { distance } from '@turf/distance';`。最終形はビルド/テストで確証。
- **影響箇所**: `main.js:10`（import）, `main.js:397` `distance(...)` 呼び出し
  （`getNearestFeature` 内、純粋ロジック）。
- **検証**: `tests/unit` の最寄り施設選定テストで距離計算の戻り値が従来と
  一致することを自動検証（憲章 II）。

## 決定 3: maplibre-gl v2 → v5（最大リスク）

`main.js` が使用する MapLibre API と移行方針:

| 使用箇所 | API | 区分 | 方針 |
|---|---|---|---|
| `new maplibregl.Map({...})` style v8 | 公開 | 低 | スタイル仕様 v8 は継続。基本そのまま。要スモーク |
| `GeolocateControl` / `addControl` | 公開 | 低 | 継続。配置/挙動をスモーク |
| `Popup().setLngLat().setHTML().setMaxWidth().addTo()` | 公開 | 低 | 継続。表示をスモーク |
| `TerrainControl` | 公開 | 低 | 継続。3D 地形トグルをスモーク |
| `querySourceFeatures` / `queryRenderedFeatures` | 公開 | 中 | 戻り値の `geometry` を使用すれば安定。要確認 |
| `maplibregl.addProtocol` | 公開だが署名変更 | 中 | v4 でプロトコルハンドラが Promise 返却型へ変更。`maplibre-gl-gsi-terrain` 2.x が新署名対応のため、原則ライブラリ側で吸収。決定4参照 |
| `feature._geometry.coordinates`（`main.js:568`） | **内部 API** | 高 | 公開の `feature.geometry.coordinates` へ置換（`getNearestFeature` 戻り値は既に `feature.geometry` を使用済みのため整合容易） |
| `geolocationControl._watchState`（`main.js:545`） | **内部 API** | 高 | 公開イベント（`trackuserlocationstart` / `trackuserlocationend`）で追跡状態を保持する方式へ置換 |

- **Decision**: 内部 API 依存 2 箇所を公開 API へ置換して機能等価を維持
  （メジャー跨ぎで内部 API は破壊リスクが最も高く、置換が「動作する」最短経路）。
  公開 API の破壊的変更は原則少ない見込みだが、スタイル/クエリ/コントロールは
  手動スモークで全数確認。
- **Rationale**: 憲章 I「不安定な内部に依存しない」とも整合。最小修正で堅牢化。
- **Alternatives considered**: 内部 API をそのまま使い続ける案 → v5 で
  `_geometry`/`_watchState` が変化/消滅した場合に静かに壊れるため不採用。

## 決定 4: maplibre-gl-gsi-terrain 0.0.2 → 2.3.2（API 追従）

- **調査**: 2.x は `type: module`、依存 `fast-png`。`main.js` は
  `useGsiTerrainSource(maplibregl.addProtocol)` を使用。2.x で
  `useGsiTerrainSource` の引数/戻り値仕様が変わっている可能性がある。
- **Decision**: maplibre-gl 5 と gsi-terrain 2.x を同時更新し、`addProtocol`
  連携はライブラリの最新仕様に合わせて呼び出しを調整（実装時に 2.3.2 の
  シグネチャを確認し、必要なら `useGsiTerrainSource` の呼び出し形を修正）。
- **Fallback（spec FR-006）**: 2.3.2 が最新 maplibre-gl と非互換、または
  地形データ提供が機能しない場合は (a) 互換最新版へ据え置き、または
  (b) 機能等価な代替（標高タイルソースを手動定義）に置換し、判断と根拠を
  research/README に記録。
- **検証**: 3D 地形コントロールと陰影図（hillshade）の表示を手動スモーク。
- **実装確認結果（2026-05-18）**: 2.3.2 の型定義は
  `useGsiTerrainSource(addProtocol: typeof maplibregl.addProtocol, options?): RasterDEMSourceSpecification`
  で **旧コードと同一署名**。peerDep は maplibre-gl `^5.0.0`（導入 v5.24.0 と
  一致）。`main.js` の `useGsiTerrainSource(maplibregl.addProtocol)` 呼び出しは
  **無変更で互換**。フォールバック（FR-006）発動なし。

## 決定 5: maplibre-gl-opacity 1.4.0 → 1.8.0（※実装時に破壊的変更を検出）

- **当初想定**: 低リスク・そのまま更新。
- **実検出（2026-05-18, ビルドで判明）**: 1.8.0 は `exports` を `"."` のみへ
  再編し、`build/` へ配置変更。**CSS サブパス（旧 `dist/maplibre-gl-opacity.css`）
  は廃止・エクスポート対象外**となり、`main.js` の
  `import 'maplibre-gl-opacity/dist/maplibre-gl-opacity.css';` がビルド失敗の原因。
- **Decision（FR-005 対応、2 段階）**:
  1. （誤）当初「公式 README 同様 CSS import を削除すれば JS がスタイルを
     注入する」と判断 → ビルドは通ったが**実際は CSS 未適用**で UX 回帰
     （手動スモークで「文字が横にギリギリ／末尾に不要な線」を検出）。
  2. （正）1.8.0 同梱の `build/maplibre-gl-opacity.css` は exports 非公開で
     import 不可だが**ファイル自体は同梱**。その内容（1.4.0 と機能的に同一）
     を `opacity-control.css` としてアプリ内にローカル同梱し `main.js` から
     import。アップグレード前と同一のスタイルを復元。
- **追加のアプリ調整**: 本アプリの 2 つの OpacityControl は baseLayers のみ
  使用するため末尾の区切り `<hr>` が空で残り「不要な下線」に見える。
  ユーザー要望により `#opacity-control hr{display:none}` で非表示化（必要なら
  解除可能）。
- **教訓**: 「事前調査の精度限界は実装時のビルド/テストで吸収」だけでは
  不足し、**ビルドが通っても見た目の回帰は手動スモークでしか検出できない**
  （憲章 II が手動スモークを必須とする根拠を裏付け）。
- **検証**: ビルドで `#opacity-control{width:150px…}` と `hr{display:none}` が
  バンドルされることを確認済。最終的な見た目（C2/C3）は手動スモーク（人手）。

## 決定 7: バンドルサイズ増（憲章 IV / SC-001 体感）

- **計測（2026-05-18）**: JS バンドル 820,724 B → **1,087,540 B**（+266,816 B /
  +約32.5%、gzip 約 295 kB）。CSS は 71,205 B → 約 69.8 kB でほぼ同等。
- **原因**: `maplibre-gl` v2→v5 の機能増（地形/グローブ等）に伴うライブラリ
  本体の規模増。当方の追加コード起因の回帰ではない。
- **判断**: 地図ライブラリの仕様上不可避で、ユーザー指定（Q2:A・メジャーアップ
  含む最新化）の範囲内。許容とし本書に理由を記録（憲章 IV の「後退時は理由
  明示」を満たす）。体感性能（初回操作 < 3 秒・パン/ズーム）の最終確認は
  手動スモーク（人手）に委ねる。

## 決定 6: Vite 3 → 8（ビルド/ランタイム）

- **Decision**: `npm run build`（`vite build --base=./`）/ `npm run dev` の
  スクリプトは維持。`--base=./` は v8 でも有効。PWA は手書き `public/sw.js` の
  ため Vite プラグイン非依存で影響小。`engines` を package.json に
  `"node": "^20.19.0 || >=22.12.0"` として明示し README と整合（spec FR-007）。
- **Rationale**: Vite 8 engines と README 記述が一致。開発機 Node v24 で充足。
- **検証**: クリーン環境で `npm install`→`npm run build`→`npm run dev` 成功、
  生成物の相対パス（`--base=./`）動作、PWA(sw 登録)が回帰しないこと。

## 未解決の NEEDS CLARIFICATION

なし（spec の Q1/Q2 で動機・スコープ確定済み。技術的不確定点はすべて
「実装時にビルド＋スモーク＋ユニットテストで確証する」方針で吸収）。
