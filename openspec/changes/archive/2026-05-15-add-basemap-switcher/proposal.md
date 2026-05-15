## Why

現状、地図の背景タイルは OSM 1 種類に固定されており、利用シーンに応じて見やすい背景を選ぶことができない。地形把握や災害想定の確認では地理院地図・航空写真・白地図のほうが適している場面が多く、ユーザーが用途に合わせて背景を切り替えられるようにすることで、本リポジトリが題材としているハザードマップ＋指定緊急避難場所ビューアとしての実用性を高める。今回はリポジトリの「新機能実装：背景地図切り替え機能」の検証タスクとしても位置づけられる。

## What Changes

- 地図の左下（`bottom-left`）に背景地図切り替え用の独自 `IControl`（仮称 `BasemapSwitcherControl`）を追加し、4 種類の背景地図をラジオで排他選択できるようにする。
  - OSM（既存・初期表示）
  - 地理院地図（国土地理院 標準地図 `std`、z 0–18）
  - 航空写真（国土地理院 シームレス写真 `seamlessphoto`、z 2–18、拡張子 `.jpg`）
  - 白地図（国土地理院 `blank`、z 5–14。z14 超はオーバーズーム描画を許容）
- MapLibre スタイルに `gsi_std` / `gsi_photo` / `gsi_blank` の 3 つの raster source とそれぞれに対応する 3 つの raster layer を追加する。レイヤー描画順は既存 `osm-layer` と同じ位置（ハザード・skhb・route より下）に揃え、初期状態は `osm-layer` のみ `visibility: 'visible'`、他 3 つは `'none'` とする。
- 出典（attribution）表示は MapLibre 標準 `AttributionControl` の自動集計（可視レイヤーが参照する source の `attribution` を表示）に委ねる。これにより背景切替に応じて出典文字列が自動で差し替わる。追加の出典管理コードは書かない。
- ハザード重ね合わせ・指定緊急避難場所レイヤー・現在地→最寄り避難場所ライン・3D 地形コントロールなど既存機能は無変更で従来どおり動作させる。
- `README.md` の「検証内容 > 新機能実装：背景地図切り替え機能の実装」に完了の旨を追記する。

非対象（Non-goals）:

- 淡色地図（`pale`）など本提案で挙げた 4 種以外の背景の追加。
- 背景地図の opacity（透過率）調整 UI。背景は常に 100%。
- Nuxt 構成への移行、TypeScript 化、モジュール分割などのリファクタリング。
- 既存ハザード/指定緊急避難場所 UI の改修。

## Capabilities

### New Capabilities
- `basemap-switching`: 地図の背景タイルを複数候補からユーザーが排他選択できる機能と、その UI コントロールの配置・初期状態・出典表示の整合性を定義するケイパビリティ。

### Modified Capabilities
<!-- 既存 `dependency-baseline` spec の「初期マップ表示（OSM 背景タイル）」シナリオは初期表示が OSM である点で本提案と整合するため、要件レベルの変更は行わない。 -->

## Impact

- **コード**: `main.js`（style.sources / style.layers への追加、`BasemapSwitcherControl` クラスの定義、`map.addControl(..., 'bottom-left')` の追加）。
- **CSS**: 必要に応じて `style.css` に `BasemapSwitcherControl` 用のごく小さなスタイル（カードの padding、ラジオの行間など）を追加する程度で、既存 `#opacity-control` 系のスタイルは触らない。
- **HTML**: `index.html` の変更は不要。
- **依存関係**: 新規パッケージの追加なし。`maplibre-gl@^5.24.0` の標準 API（`IControl` 実装、`map.setLayoutProperty('layer-id', 'visibility', ...)` 等）のみで実装する。
- **外部リソース**: 国土地理院タイル（`cyberjapandata.gsi.go.jp/xyz/...`）への HTTPS リクエストが新たに発生する。利用規約上の出典表記は本変更で適切に追加される。
- **ビルド/ランタイム**: ビルド成果物のサイズはコントロール定義（数十行）と CSS の追記のみで誤差レベル。実行時は背景切替の都度、対応する raster source のタイルが追加でフェッチされる（既存ハザード重ね合わせと同種の負荷プロファイル）。
- **既存挙動の互換性**: 初期表示・初期ズーム・既存コントロール位置・ハザード/skhb の動作・3D 地形は無変更。`dependency-baseline` spec のシナリオはすべて引き続き満たす。
