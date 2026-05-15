## 1. 事前準備

- [x] 1.1 `main.js` 全体を読み、`style.sources` / `style.layers` / `map.on('load', ...)` 配下のコントロール登録順を確認する
- [x] 1.2 design.md の決定事項（4 source 追加・visibility 排他切替・bottom-left 配置・標準 AttributionControl 任せ）を読み返し、影響箇所をリストアップする

## 2. スタイル定義の拡張（背景 source / layer 追加）

- [x] 2.1 `main.js` の `style.sources` に `gsi_std` を追加する（URL: `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png`、`maxzoom: 18`、`tileSize: 256`、`attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'`）
- [x] 2.2 `main.js` の `style.sources` に `gsi_photo` を追加する（URL: `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg`、`minzoom: 2`、`maxzoom: 18`、`tileSize: 256`、attribution は 2.1 と同一）
- [x] 2.3 `main.js` の `style.sources` に `gsi_blank` を追加する（URL: `https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png`、`minzoom: 5`、`maxzoom: 14`、`tileSize: 256`、attribution は 2.1 と同一）
- [x] 2.4 `style.layers` の `osm-layer` の直後に `gsi_std-layer` / `gsi_photo-layer` / `gsi_blank-layer` を順に追加する（いずれも `type: 'raster'`、対応する source 参照、`layout: { visibility: 'none' }`）
- [x] 2.5 既存 `osm-layer` の宣言に `layout: { visibility: 'visible' }` を明示追加する（後で参照しやすくするため、ラジオ動作と整合させる）

## 3. 背景地図切替コントロールの実装

- [x] 3.1 `main.js` に `BasemapSwitcherControl` クラスを定義する（`onAdd(map)` / `onRemove()` を実装、`onAdd` で `<div class="maplibregl-ctrl maplibregl-ctrl-group">` を生成し `id="basemap-switcher"` を付与）
- [x] 3.2 コントロール内部に 4 つの選択肢 `[{ id: 'osm-layer', label: 'OSM' }, { id: 'gsi_std-layer', label: '地理院地図' }, { id: 'gsi_photo-layer', label: '航空写真' }, { id: 'gsi_blank-layer', label: '白地図' }]` を配列で宣言し、ループで `<label><input type="radio" name="basemap-switcher" value="<id>"> <ラベル></label>` を生成する
- [x] 3.3 初期表示として `osm-layer` のラジオに `checked` 属性を付与する
- [x] 3.4 ラジオの `change` イベントで、選択された value（layer id）のみ `map.setLayoutProperty(id, 'visibility', 'visible')`、他 3 つには `'none'` を設定する処理を実装する
- [x] 3.5 `onRemove` でコンテナの `remove()` と `this._map = undefined` を行う

## 4. コントロールの地図への追加

- [x] 4.1 `map.on('load', ...)` 内、もしくは `map` 初期化直後の任意の安定した位置で `map.addControl(new BasemapSwitcherControl(), 'bottom-left')` を 1 回だけ呼ぶ
- [x] 4.2 既存の他コントロール（左上・右上 OpacityControl、右下 GeolocateControl / TerrainControl）の登録順序・位置に変更を加えていないことを確認する

## 5. スタイル（CSS）の最小調整

- [x] 5.1 `style.css` を確認し、必要があれば `#basemap-switcher` 用にカードの padding（例: `padding: 8px 10px`）とラジオの行間（例: `display: block; line-height: 1.6`）を追加する。既存 `#opacity-control` 系のスタイルは変更しない
- [x] 5.2 dev サーバーで MapLibre 標準のカード見た目（角丸・白背景）に揃っていることを目視確認し、必要な微調整のみ反映する

## 6. 動作確認（dev サーバー）

- [x] 6.1 `npm run dev` を起動し、初期表示で OSM が表示され、左下のラジオで OSM が選択状態であることを確認する
- [x] 6.2 「地理院地図」「航空写真」「白地図」を順に選択し、それぞれのタイルに切り替わることを目視確認する
- [x] 6.3 ブラウザ DevTools のネットワークタブで、選択中の背景に対応するドメイン（`tile.openstreetmap.org` または `cyberjapandata.gsi.go.jp`）にのみタイルリクエストが発生していることを確認する
- [x] 6.4 右下の出典表示が、選択中の背景に応じて `OpenStreetMap` または `地理院タイル` に切り替わることを確認する
- [x] 6.5 白地図選択中にズーム 15 以上へ拡大し、ネットワークタブで z15 以降のタイルリクエストが発生せず、画面ではオーバーズーム描画になっていることを確認する
- [x] 6.6 ハザード（左上）・指定緊急避難場所（右上）・現在地ライン・3D 地形コントロールが、いずれの背景地図選択中でも従来どおり動作することを確認する
- [x] 6.7 ハザードや指定緊急避難場所を ON にした状態で、右下出典が背景＋ハザード（または skhb）出典の両方を併記することを確認する

## 7. ビルド成果物の確認

- [x] 7.1 `npm run build` を実行し、終了コード 0 で `dist/` 配下に成果物が生成されることを確認する
- [x] 7.2 `npm run preview` を起動し、6.1〜6.7 の主要動作確認項目を成果物環境でも再確認する

## 8. README 更新

- [x] 8.1 `README.md` の「検証内容 > 2. 新機能実装 > 背景地図切り替え機能の実装」を、完了日と切替可能な 4 種類（OSM／地理院地図／航空写真／白地図）に言及する記述に更新する

## 9. OpenSpec 検証

- [x] 9.1 `openspec status --change add-basemap-switcher --json` で全 artifact が `done` になっていることを確認する
- [x] 9.2 上記 6 / 7 の動作確認で `basemap-switching` spec の全 Scenario（5 + 2 + 3 + 4 + 2 = 計 16 シナリオ）に対応する観察が取れたことをセルフレビューする
