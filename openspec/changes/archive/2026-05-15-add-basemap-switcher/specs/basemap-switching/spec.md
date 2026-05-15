## ADDED Requirements

### Requirement: 背景地図を 4 種類からラジオで排他選択できる

システムは、地図の背景タイルとして以下の 4 種類の候補をユーザーに提供し、いずれか 1 つだけが表示されるラジオ排他選択を可能にしなければならない（SHALL）。同時に複数の背景地図が可視であってはならない（MUST NOT）。

| 表示ラベル | タイル提供元 / 種類 |
| --- | --- |
| OSM | OpenStreetMap 標準タイル |
| 地理院地図 | 国土地理院 標準地図（`std`） |
| 航空写真 | 国土地理院 シームレス写真（`seamlessphoto`） |
| 白地図 | 国土地理院 白地図（`blank`） |

#### Scenario: 初期表示は OSM である

- **WHEN** ページを新規に読み込み地図が描画される
- **THEN** 背景地図として OSM が表示されており、4 つの選択肢のうち OSM のラジオが選択状態（checked）になっている

#### Scenario: 背景地図を地理院地図に切り替えられる

- **WHEN** ユーザーが切替コントロールで「地理院地図」のラジオを選択する
- **THEN** 背景タイルが国土地理院 標準地図（`std`）に切り替わり、OSM・航空写真・白地図のレイヤーは非表示になっている

#### Scenario: 背景地図を航空写真に切り替えられる

- **WHEN** ユーザーが切替コントロールで「航空写真」のラジオを選択する
- **THEN** 背景タイルが国土地理院 シームレス写真（`seamlessphoto`）に切り替わり、他の 3 つの背景レイヤーは非表示になっている

#### Scenario: 背景地図を白地図に切り替えられる

- **WHEN** ユーザーが切替コントロールで「白地図」のラジオを選択する
- **THEN** 背景タイルが国土地理院 白地図（`blank`）に切り替わり、他の 3 つの背景レイヤーは非表示になっている

#### Scenario: 切替後に OSM へ戻せる

- **WHEN** OSM 以外を選択中の状態で、ユーザーが「OSM」のラジオを再選択する
- **THEN** 背景タイルが OSM に戻り、他の 3 つの背景レイヤーは非表示になっている

### Requirement: 背景地図切替コントロールは地図の左下に表示する

システムは、背景地図を切り替える UI コントロールを地図の左下（MapLibre の `bottom-left` 位置）に配置しなければならない（SHALL）。コントロールは MapLibre 標準の他コントロール（左上・右上・右下）と視覚的に競合してはならない（MUST NOT）。

#### Scenario: コントロールが左下に配置される

- **WHEN** 地図が描画完了している
- **THEN** 背景地図切替コントロールが地図ビューの左下に表示されており、左上の OpacityControl（ハザード）、右上の OpacityControl（指定緊急避難場所）、右下の GeolocateControl / TerrainControl と重なっていない

#### Scenario: コントロールが MapLibre 標準のコントロール外観に揃う

- **WHEN** コントロールが描画されている
- **THEN** コンテナ要素は MapLibre 標準のコントロールクラス（`maplibregl-ctrl maplibregl-ctrl-group`）を持ち、白い角丸カードに沿った外観で表示される

### Requirement: 出典表示は表示中の背景地図に追従して切り替わる

システムは、地図右下の出典（attribution）表示を、現在可視である背景地図ソースに応じた文字列に自動で切り替えなければならない（SHALL）。可視でない背景地図ソースの出典が表示されてはならない（MUST NOT）。

各背景地図の出典文字列は以下とする:

| 背景地図 | 出典文字列に含まれるリンク／文言 |
| --- | --- |
| OSM | `OpenStreetMap`（リンク先 `http://www.openstreetmap.org/copyright`） |
| 地理院地図 | `地理院タイル`（リンク先 `https://maps.gsi.go.jp/development/ichiran.html`） |
| 航空写真 | `地理院タイル`（リンク先 `https://maps.gsi.go.jp/development/ichiran.html`） |
| 白地図 | `地理院タイル`（リンク先 `https://maps.gsi.go.jp/development/ichiran.html`） |

#### Scenario: OSM 表示中は OSM の出典が表示される

- **WHEN** 背景地図として OSM が選択されており、ハザード・指定緊急避難場所など他レイヤーが非表示である
- **THEN** 地図右下の出典に `OpenStreetMap` のリンクが含まれ、`地理院タイル` のリンクは含まれない

#### Scenario: 地理院地図／航空写真／白地図 表示中は地理院タイルの出典が表示される

- **WHEN** 背景地図として地理院地図・航空写真・白地図のいずれかが選択されており、ハザード・指定緊急避難場所など他レイヤーが非表示である
- **THEN** 地図右下の出典に `地理院タイル` のリンクが含まれ、`OpenStreetMap` のリンクは含まれない

#### Scenario: ハザードや指定緊急避難場所と背景の出典が併記される

- **WHEN** 任意の背景地図に加え、ハザードマップまたは指定緊急避難場所のレイヤーが可視である
- **THEN** 背景地図に対応する出典に加え、可視であるハザードマップポータルサイトおよび／または国土地理院:指定緊急避難場所データの出典が同時に表示される

### Requirement: 背景地図切替後も既存機能が回帰なく動作する

システムは、背景地図のいずれを選択中であっても、以下の既存機能を従来どおり動作させなければならない（SHALL）。背景地図の切替が既存機能を破壊してはならない（MUST NOT）。

- 左上 `OpacityControl` によるハザードマップ（洪水・高潮・津波・土石流・急傾斜・地滑り）の表示切替
- 右上 `OpacityControl` による指定緊急避難場所（`skhb-1-layer` 〜 `skhb-8-layer`）の表示切替
- `GeolocateControl` による現在地取得と、ズーム 7 以上での「現在地 → 最寄り避難場所」ライン描画
- `TerrainControl` による 3D 地形のトグル、および `hillshade` レイヤーの描画
- 指定緊急避難場所地物に対するクリック時ポップアップ表示、ホバー時のカーソル変更

#### Scenario: 背景切替後もハザード重ね合わせが動作する

- **WHEN** 任意の背景地図を選択した状態で、左上 `OpacityControl` から任意のハザードマップを ON にする
- **THEN** 対応するハザードレイヤーが背景地図の上に半透明で表示され、再度 OFF にすると非表示に戻る

#### Scenario: 背景切替後も指定緊急避難場所の切替が動作する

- **WHEN** 任意の背景地図を選択した状態で、右上 `OpacityControl` から任意の指定緊急避難場所カテゴリを選択する
- **THEN** 対応する `skhb-*-layer` が背景地図の上に表示される

#### Scenario: 背景切替後も現在地ラインが描画される

- **WHEN** 任意の背景地図を選択した状態で、ブラウザの位置情報を許可しズームを 7 以上に拡大する
- **THEN** 現在地と、有効化中の `skhb-*-layer` 内で最も近い地物との間に青いライン（`route-layer`）が背景地図の上に描画される

#### Scenario: 背景切替後も 3D 地形が動作する

- **WHEN** 任意の背景地図を選択した状態で、右下に追加された `TerrainControl` を有効化する
- **THEN** 地理院標高タイルを用いた陰影（`hillshade`）と 3D 地形表示が反映され、背景タイルの上に陰影が乗る

### Requirement: 各背景タイルソースを規定の URL と zoom 範囲で定義する

システムは、背景地図用の各 raster source を以下の URL テンプレートと zoom 範囲で定義しなければならない（SHALL）。

| source id | URL テンプレート | minzoom | maxzoom |
| --- | --- | --- | --- |
| `osm` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | （既定） | `19` |
| `gsi_std` | `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` | （既定） | `18` |
| `gsi_photo` | `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` | `2` | `18` |
| `gsi_blank` | `https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png` | `5` | `14` |

白地図 source の `maxzoom` を超えるズームレベルでは、MapLibre 既定のオーバーズーム描画（低ズームタイルの引き伸ばし）を許容する。`gsi_blank` の `maxzoom` を 14 より高い値にしてはならない（MUST NOT）。

#### Scenario: 白地図は z14 を超えてもオーバーズームで表示される

- **WHEN** 背景に白地図を選択した状態で、地図のズームレベルを 15 以上に拡大する
- **THEN** ブラウザのネットワークログに `gsi_blank` の z15 以降のタイルリクエストが発生せず、画面には z14 までのタイルが引き伸ばされて表示される

#### Scenario: 各 source の URL が規定どおりである

- **WHEN** `main.js` の `style.sources` 定義を確認する
- **THEN** `osm` / `gsi_std` / `gsi_photo` / `gsi_blank` の各 source の `tiles` 配列に上表の URL テンプレートが、`maxzoom` / `minzoom` に上表の値が、それぞれ設定されている
