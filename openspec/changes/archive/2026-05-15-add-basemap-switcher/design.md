## Context

本リポジトリは Vite 製の単一ページアプリで、`main.js` 1 本に MapLibre v5 のスタイル定義・コントロール追加・イベントハンドラを直書きしている。背景タイルは現状 OSM 1 種類のみで、style.sources / style.layers の先頭に `osm` / `osm-layer` として固定配置されている。その上に重ねるハザード（6 種）・指定緊急避難場所（8 レイヤー）・現在地→最寄り避難場所ライン（route）が積まれ、左上・右上・右下にそれぞれ `OpacityControl` / `OpacityControl` / `GeolocateControl, TerrainControl` が配置されている。

本リポジトリは検証用途のローカル単一画面アプリであり、フレームワーク導入や CI/テスト基盤はない。レビュアーは事実上リポジトリオーナー 1 名で、検証完了基準は `npm run dev` および `npm run build` + `npm run preview` での目視確認である。

直近の依存更新（`upgrade-packages-latest`）で MapLibre v5 系を採用済み。v5 では `IControl` 実装は v2 系から後方互換に近い形で利用できる（`onAdd(map) -> HTMLElement` / `onRemove(map)` のシグネチャ、`addControl(control, position)` の挙動）。MapLibre 標準の `AttributionControl` は `style.sources[*].attribution` を、可視レイヤーが参照する source 単位で集計して右下に表示するため、source 定義に正しい attribution を持たせれば背景切替に応じて自動で出典が差し替わる。

## Goals / Non-Goals

**Goals:**

- 4 種類の背景地図（OSM / 地理院地図 std / 航空写真 seamlessphoto / 白地図 blank）をラジオで排他切り替えできる UI を、地図の左下に追加する。
- 切替に応じて MapLibre 標準の右下出典表示が、その背景地図に適した文字列に自動で差し替わる。
- 初期表示は OSM。既存挙動（中心 `[138, 37]`、ズーム 5、ハザード・skhb・3D 地形・現在地ライン等）はすべて従来どおり動作する。
- 新規パッケージ依存を増やさず、`maplibre-gl@^5.24.0` の標準 API のみで実装する。
- レイヤー描画順を破壊しない（背景は常に最下層、ハザード・route・skhb 等はその上）。

**Non-Goals:**

- `pale`（淡色地図）など、本変更で挙げた 4 種以外の背景タイルの追加。
- 背景地図の opacity 調整 UI（背景は常に 100% で表示）。
- `OpacityControl` 系の既存コントロールの仕様変更や移植。
- 出典表示位置のカスタマイズ（標準の右下を採用する）。
- Nuxt 化・TypeScript 化・モジュール分割などのリファクタリング。
- 国土地理院タイルのキャッシュ戦略最適化や PWA Service Worker への組込み。
- 白地図 z14 超のフォールバック描画（オーバーズーム描画を許容）。

## Decisions

### 1. 切替方式は「4 つの source/layer を持ち、`visibility` をラジオ排他で切り替える」（案 B）

| 候補 | 概要 | 採否 |
| --- | --- | --- |
| 案 A: 単一 source の `setTiles()` で URL を差し替える | source は 1 つ、タイル URL のみ動的変更 | 不採用 |
| 案 B: 4 つの source/layer を持ち、`visibility` を切替 | 各背景に対応する raster source/layer を 4 組宣言。可視は常に 1 つだけ | **採用** |
| 案 C: `map.setStyle()` で style 全体を差し替える | 背景切替のたびに style を丸ごと再構築 | 不採用 |

理由:

- 案 A は MapLibre の `source.attribution` が **ソース定義時に固定** され、`setTiles()` でタイル URL を変更しても attribution は更新されない。出典の自動追従ができないためカスタム attribution 管理が必要になり、要件「出典は表示している背景地図に適したものに変更」を満たすために余計な実装が増える。
- 案 A は `minzoom` / `maxzoom` も動的変更ができないため、白地図（z 5–14）と OSM / 地理院地図（z 0–18）でズーム範囲が異なる本要件と相性が悪い。
- 案 C は背景切替のたびに全レイヤー・イベントハンドラを再構築する必要があり、`main.js` の他機能（ハザード/skhb/route/terrain）への影響が大きすぎる。
- 案 B は MapLibre 標準 `AttributionControl` の挙動（可視レイヤーが参照する source の attribution を自動集計）と素直に噛み合い、追加コードなしで出典自動追従を実現できる。`OpacityControl` が `baseLayers` を「ラジオで visibility を排他切替」として扱う既存のパターンとも整合する。

### 2. UI は OpacityControl 流用ではなく、軽量な自作 `IControl` を実装する

| 候補 | 概要 | 採否 |
| --- | --- | --- |
| B-1: 既存 `OpacityControl` を `baseLayers` で再利用 | コードは最短だが opacity スライダーが付随表示される | 不採用 |
| B-2: 軽量な自作 `IControl` クラスを実装 | `<div>` + `<input type="radio">` × 4 + `<label>`。30 行程度 | **採用** |
| B-3: 外部ライブラリ（`maplibre-gl-basemaps` 等）を追加 | 新規依存・APIの細部不一致リスク | 不採用 |

理由:

- 背景地図は常時 100% 表示が前提であり、`OpacityControl` のスライダー UI は機能要件と無関係なノイズになる。
- 自作 `IControl` は `onAdd(map) { ... return container; }` / `onRemove() { container.remove(); }` のみで MapLibre の作法に沿って実装でき、依存追加なしで「ラジオ + ラベル」UI を素直に構成できる。
- 新規外部ライブラリは本リポジトリの方針（最小依存・検証用途）と合わず、メンテ負担が増える。

`IControl` 内部の動作:

- ラジオの `change` イベントで、選択された背景に対応する layer のみ `map.setLayoutProperty('<id>', 'visibility', 'visible')` とし、それ以外の 3 つの背景レイヤーに対して `'none'` を設定する。
- 内部状態は DOM 上のラジオ `checked` 状態を「単一の真実」として扱い、別途 JS 変数で重複保持しない。

### 3. レイヤー定義の位置・順序

style.layers の **最下層**（OSM の隣）に 4 つの背景 raster layer を集約し、その上に既存の hazard_*-layer / route-layer / skhb-*-layer / hillshade を従来どおり載せる。

```
style.layers (描画順 = 配列順):
  0  osm-layer            (visibility: 'visible')  ← 初期表示
  1  gsi_std-layer        (visibility: 'none')
  2  gsi_photo-layer      (visibility: 'none')
  3  gsi_blank-layer      (visibility: 'none')
  4  hazard_flood-layer   ... (以下既存と同順)
  ...
  N  skhb-8-layer
```

`hillshade` は既存どおり `map.addLayer({...}, 'hazard_jisuberi-layer')` で動的挿入される（hazard 群の手前）。本変更は背景レイヤー追加位置のみを扱い、`hillshade` の挿入位置指定はそのまま使う（背景レイヤーは hillshade よりさらに下になるので影響なし）。

### 4. 出典（attribution）は MapLibre 標準 `AttributionControl` に任せる

`main.js` で `AttributionControl` を明示追加していなくても、MapLibre v5 は **デフォルトでマップに自動付与** する。`source.attribution` を 4 ソースそれぞれに正しく設定すれば、可視レイヤーの source 由来の attribution のみが右下に表示される（visibility: 'none' のレイヤーが参照する source の attribution は集計対象外）。

各 source の attribution 値:

| source | attribution |
| --- | --- |
| `osm` | `&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`（既存維持） |
| `gsi_std` | `<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>` |
| `gsi_photo` | `<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>` |
| `gsi_blank` | `<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>` |

ハザード・skhb の既存出典は表示中レイヤーの source 経由で別途集計されるため、本変更で触らない。

### 5. 各 source の zoom 範囲

| source | URL | minzoom | maxzoom |
| --- | --- | --- | --- |
| `osm` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | 既存維持 | `19`（既存維持） |
| `gsi_std` | `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` | 既定（0） | `18` |
| `gsi_photo` | `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` | `2` | `18` |
| `gsi_blank` | `https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png` | `5` | `14` |

白地図は z14 を超えるとオーバーズーム描画（MapLibre が低ズームタイルを引き伸ばす）になるが、これは要件側で許容（Non-Goals 参照）。アプリの `maxZoom: 18` 設定自体は維持する。

### 6. ラベル文言とラジオ name 属性

ラジオの表示ラベル（日本語）と内部 value（layer id）の対応:

| value (layer id) | label |
| --- | --- |
| `osm-layer` | OSM |
| `gsi_std-layer` | 地理院地図 |
| `gsi_photo-layer` | 航空写真 |
| `gsi_blank-layer` | 白地図 |

ラジオの `name` 属性はコントロール内でユニークな文字列（例: `basemap-switcher`）。同一画面内に他のラジオ群が無いため衝突はないが、明示しておく。

## Risks / Trade-offs

- [国土地理院タイルへの外部依存] → 地理院タイル URL がメンテで一時的に応答不能になると該当背景は表示されないが、フォールバックは行わない（検証用途のため）。OSM への切替で回避可能。
- [白地図のオーバーズーム描画品質] → z14 超は MapLibre のタイル引き伸ばしによりぼやけて表示される。要件で許容済み。ユーザー混乱を最小化するため、ラジオラベルは「白地図（z14 まで）」のような注釈付きにする案もあるが、UI シンプルさを優先しラベルは「白地図」のみとする。
- [属性表示の差し替えタイミング] → MapLibre の AttributionControl は次フレームで再集計されるため、ラジオ切替後ごく短時間（1 フレーム以内）属性表示と背景が一致しない見え方になる可能性がある。実用上は知覚できないレベル。
- [`IControl` 実装の DOM クラス整合] → MapLibre のコントロールは `maplibregl-ctrl maplibregl-ctrl-group` クラスをコンテナに付与することで MapLibre 標準のカード見た目に揃う。実装ではこれを忘れない（CSS 追記を最小化するため）。
- [スタイル仕様の隣接変更] → 4 つの背景レイヤーを `style.layers` の先頭に挿入することで、配列インデックスが下流（hazard_*-layer 等）に対してずれる。既存コードでレイヤーを index 参照している箇所は無い（`getCurrentSkhbLayerFilter` は ID プレフィックスでフィルタしているため安全）ことを確認済み。
- [タイル取得 CORS / リファラ] → OSM・国土地理院ともに公開タイルで CORS は問題なし。ローカル `vite` dev サーバーから問題なくフェッチできる。

## Migration Plan

このアプリにバージョニングされた利用者はおらず、デプロイ運用もないため、伝統的な意味でのマイグレーションは不要。実装手順としては以下の順を採る:

1. `main.js` の `style.sources` に `gsi_std` / `gsi_photo` / `gsi_blank` を追加（attribution 付き）。
2. `style.layers` の `osm-layer` の直後に `gsi_std-layer` / `gsi_photo-layer` / `gsi_blank-layer` を追加（いずれも `layout: { visibility: 'none' }`）。
3. `main.js` 内に `BasemapSwitcherControl` クラスを定義（`IControl` 実装、`onAdd` / `onRemove`、ラジオ change ハンドラ）。
4. `map.on('load', ...)` 内、もしくはマップ初期化直後の任意の位置で `map.addControl(new BasemapSwitcherControl(), 'bottom-left')` を呼ぶ。
5. 必要に応じて `style.css` にコントロール用の最小スタイルを追加（カード余白・ラジオ行間。MapLibre 標準 `.maplibregl-ctrl-group` の見た目に揃える）。
6. `npm run dev` で起動し、4 背景の切替・出典差替・ハザード/skhb との重なり順・3D 地形・現在地ライン等を目視確認。
7. `npm run build` + `npm run preview` で同等確認。
8. `README.md` の検証内容欄「新機能実装：背景地図切り替え機能の実装」を完了済みに更新する。

ロールバック: `git revert` 1 コミットで初期状態（OSM のみ）に戻る。`node_modules/` 再生成不要。

## Open Questions

- 白地図のラベルに z14 までの注釈を付けるかは UI 簡潔性を優先して「白地図」のみとするが、利用者からの混乱フィードバックがあれば後続変更で見直す（本 change の範囲外）。
- 将来 `pale`（淡色地図）等を追加する場合は同じ仕組みで source/layer/ラジオを 1 行追加するだけで拡張できる構造とする。コントロール側の選択肢は配列ベースで宣言し、レイヤーを増やしたときに UI 側を最小修正で済むようにする実装ガイドラインとする。
