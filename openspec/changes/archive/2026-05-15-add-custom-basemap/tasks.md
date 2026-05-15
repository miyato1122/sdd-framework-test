## 1. 依存追加と永続化レイヤー

- [x] 1.1 `package.json` の `dependencies` に `idb-keyval` を追加し、`npm install` で `package-lock.json` も更新する
- [x] 1.2 新規モジュール `src/customBasemapStore.js`（仮）を作成し、`idb-keyval` を用いたラッパとして `getCustomBasemaps()` / `saveCustomBasemap(record)`（同一 `id` があれば上書き、無ければ追加の upsert セマンティクス）/ `deleteCustomBasemap(id)` / `getSelectedBasemapId()` / `setSelectedBasemapId(id)` の各非同期関数をエクスポートする
- [x] 1.3 IndexedDB の key 名（`custom-basemaps`、`selected-basemap-id`）と、`CustomBasemap` レコードのフィールド（`id` / `label` / `tileUrl` / `attributionText` / `attributionUrl` / `minzoom` / `maxzoom` / `createdAt`）を定数化し、ストアモジュール内に集約する
- [x] 1.4 ストアの各関数で読み書き例外を try/catch し、`getCustomBasemaps()` 失敗時は空配列を、`getSelectedBasemapId()` 失敗時は `null` を返してアプリ初期化を継続できるようにする

## 2. 入力検証ユーティリティ

- [x] 2.1 新規モジュール `src/customBasemapValidation.js`（仮）を作成し、フォーム入力（生文字列）を受け取って `{ ok: true, value: CustomBasemap }` または `{ ok: false, errors: { fieldName: message } }` を返す `validateCustomBasemapInput(raw)` をエクスポートする
- [x] 2.2 名称: トリム後 1〜40 文字を検証する
- [x] 2.3 タイル URL: `new URL` パース可、`protocol === 'https:'`、`{z}`／`{x}`／`{y}` のすべてを含むことを検証する
- [x] 2.4 出典リンク URL: 空文字を許容し、空でなければ `http:`／`https:` のみ許容することを検証する
- [x] 2.5 minzoom／maxzoom: 空文字許容、空でなければ 0〜24 の整数、両方指定時は `minzoom ≤ maxzoom` を検証する
- [x] 2.6 出典文字列の組み立てユーティリティ `buildAttributionHtml({ text, url })` を実装し、HTML エスケープ（`&<>"'`）と属性エスケープを適用したうえで設計書の組み立てルール（text+url / text のみ / url のみ / 両方空）を返す

## 3. MapLibre スタイル復元（eager）

- [x] 3.1 `main.js` の冒頭で `getCustomBasemaps()` と `getSelectedBasemapId()` の結果を `await` し、その値で `style.sources`／`style.layers` を組み立てるよう、`new maplibregl.Map({ style })` の呼び出しを書き換える
- [x] 3.2 ユーザー追加レイヤーの source id は `custom_${uuid}`、layer id は `custom_${uuid}-layer` の命名規約とする
- [x] 3.3 ユーザー追加レイヤーは `style.layers` 配列内で、プリセット背景 4 つの直後・ハザード `hazard_flood-layer` の直前に挿入する
- [x] 3.4 `selected-basemap-id` が存在し当該レイヤーが定義済みの場合、そのレイヤーのみ `layout.visibility = 'visible'`、それ以外の背景レイヤー（プリセット 4 + 他カスタム）はすべて `'none'` で初期化する
- [x] 3.5 `selected-basemap-id` が無い／対象レイヤーが見つからない場合は `osm-layer` を可視に、他をすべて非可視にし、`setSelectedBasemapId('osm-layer')` で永続化値を補正する

## 4. BasemapSwitcherControl の刷新

- [x] 4.1 `BasemapSwitcherControl` を、プリセット 4 件と「現在の `customBasemaps` 配列」を内部状態として受け取る形へリファクタリングする
- [x] 4.2 ラジオ一覧の再描画関数 `renderRadios()` を作成し、プリセット 4 件→カスタム N 件（各行に末尾 `⋮` メニューボタン）→「背景地図を追加」ボタンの順で描画する
- [x] 4.3 ラジオ選択変更時の `change` ハンドラを、選択 ID 以外の全背景レイヤーを `visibility: 'none'`、選択 ID を `'visible'` に設定したうえで `setSelectedBasemapId(id)` を呼ぶ単一処理に統一する
- [x] 4.4 カスタム背景地図の各行に操作メニューボタン（`⋮`）を描画する。プリセット行には描画しない
- [x] 4.5 `⋮` クリックで「編集」「削除」の 2 項目を持つドロップダウンメニューを開閉する。ドキュメント外側クリックや Esc で閉じる
- [x] 4.6 「削除」選択時のハンドラ: 独自モーダル `confirmDelete(label): Promise<boolean>`（タスク 5.6 で実装）を `await` で呼び出し、`true` のとき `deleteCustomBasemap(id)` → `map.removeLayer(layerId)` と `map.removeSource(sourceId)` → `renderRadios()` 再実行 → 選択中だった場合は `osm-layer` にフォールバック（visibility 切替＋ `setSelectedBasemapId('osm-layer')`）。`false`（キャンセル／Esc 等）のときは何もしない
- [x] 4.7 「編集」選択時のハンドラ: 当該レコードを引数に `openForm({ mode: 'edit', record })`（タスク 5/6 で実装）を呼ぶ
- [x] 4.8 ドロップダウン内の「編集」ボタンには `data-action="edit"`、「削除」ボタンには `data-action="delete"` を付け、CSS で「編集」を青系（`#1253a4`）・「削除」を赤系（`#c0392b`）の文字色で表示する

## 5. 追加・編集フォーム UI

- [x] 5.1 `index.html` にカスタム背景地図フォーム用の `<dialog id="custom-basemap-form-dialog">` を追加し、名称・タイル URL・出典テキスト・出典リンク URL の各 input／textarea と、`<details>` 内に minzoom・maxzoom の input を配置する。ダイアログ要素にタイトル用 `<h2 data-role="title">` と送信ボタン `<button data-role="submit">` を置き、JS から差し替えられるようにする
- [x] 5.2 各フィールドに対応するエラーメッセージ表示用要素（`<p class="error" data-for="<field>">`）を入れ、初期状態では非表示にする
- [x] 5.3 「キャンセル」「送信」の 2 ボタンを置き、フォーム送信は JS から `preventDefault` してハンドリングする。送信ボタンの文言は JS が `追加` / `保存` を差し替える
- [x] 5.4 フォームを開く共通関数 `openForm({ mode, record? })` を実装する。`mode === 'add'`: 全フィールドを空にしタイル URL の `readonly` 属性を外す／タイトル `背景地図を追加`／送信ボタン `追加`。`mode === 'edit'`: 各フィールドに `record` の値を prefill し、minzoom／maxzoom 値があれば `<details open>` で展開／タイル URL に `readonly` 属性を付与／タイトル `背景地図を編集`／送信ボタン `保存`。最後に `dialog.showModal()` を呼ぶ
- [x] 5.5 `style.css` にダイアログ／フォーム／エラー表示／追加ボタン／`⋮` 操作メニューボタンとドロップダウン／`readonly` のタイル URL（色味を薄くするなど）のスタイルを追加し、左下コントロールがユーザー追加分の増減で破綻しない `max-width` と折り返しルールを設定する
- [x] 5.6 `index.html` に削除確認用 `<dialog id="custom-basemap-delete-dialog">` を追加し、`style.css` で画面中央モーダル（追加・編集フォームと同系統）として表示するスタイルを追加する。確認（削除）ボタンは赤系背景、キャンセルボタンは白背景にする
- [x] 5.7 `main.js` に `confirmDelete(label): Promise<boolean>` を実装する。ダイアログにメッセージをセットして `showModal()`、確認ボタン押下で `true`／キャンセル・Esc 等の close で `false` を resolve する。イベントリスナは解決後に必ず除去する

## 6. フォームと地図状態の接続

- [x] 6.1 `BasemapSwitcherControl` 内の「背景地図を追加」ボタン押下時に `openForm({ mode: 'add' })` を呼ぶ
- [x] 6.2 フォーム送信時に `validateCustomBasemapInput()` を呼び、`ok: false` のときは `errors` を該当エラー表示要素にセットしてダイアログを閉じない（追加・編集モード共通）
- [x] 6.3 ヘルパ関数 `buildSourceDef(record)` と `buildLayerDef(record, visible)` を実装する。`buildSourceDef` は `{ type: 'raster', tiles: [record.tileUrl], tileSize: 256, minzoom?, maxzoom?, attribution: buildAttributionHtml({ text, url }) }` を返す。`buildLayerDef` は `{ id, source, type: 'raster', layout: { visibility: visible ? 'visible' : 'none' } }` を返す
- [x] 6.4 **追加モード保存ハンドラ**: `id = crypto.randomUUID()` で `CustomBasemap` を構築 → `saveCustomBasemap(record)` → `map.addSource(sourceId, buildSourceDef(record))` → `map.addLayer(buildLayerDef(record, true), 'hazard_flood-layer')` → 他の背景レイヤーを `visibility: 'none'` に → `setSelectedBasemapId(layerId)` → `renderRadios()` 再描画して新行を `checked` に → `dialog.close()`
- [x] 6.5 **編集モード保存ハンドラ**: 既存 `id` を保持したまま新フィールド値で `CustomBasemap` を再構築 → `saveCustomBasemap(updated)` → 編集時点で `getSelectedBasemapId() === layerId` だったかを `wasSelected` に保存 → `map.removeLayer(layerId)` → `map.removeSource(sourceId)` → `map.addSource(sourceId, buildSourceDef(updated))` → `map.addLayer(buildLayerDef(updated, wasSelected), 'hazard_flood-layer')` → `wasSelected` であれば他の背景レイヤーは `visibility: 'none'` を維持し当該を `'visible'` → `renderRadios()` 再描画（ラベル更新） → `dialog.close()`
- [x] 6.6 ダイアログ閉じる際にフォーム入力値・エラーメッセージ・`dataset.mode` / `dataset.editingId` をリセットする

## 7. 既存仕様との回帰確認

- [x] 7.1 プリセット 4 種類のラベル・タイル URL・zoom 範囲（OSM maxzoom=19、gsi_std maxzoom=18、gsi_photo minzoom=2/maxzoom=18、gsi_blank minzoom=5/maxzoom=14）が `main.js` の修正後も既存仕様どおりであることをコード上で確認する
- [x] 7.2 各プリセットの出典文字列（`OpenStreetMap` リンク／`地理院タイル` リンク）が既存仕様どおりであることを確認する
- [x] 7.3 ハザード `OpacityControl`（左上）／指定緊急避難場所 `OpacityControl`（右上）／`GeolocateControl`／`TerrainControl` が引き続き正常に動作することを目視・操作で確認する
- [x] 7.4 ズーム 7 以上で現在地と最寄り避難場所をつなぐ `route-layer` のライン描画が動作することを確認する
- [x] 7.5 指定緊急避難場所のクリック時ポップアップ、ホバー時のカーソル変更が動作することを確認する

## 8. シナリオ単位の動作確認

- [x] 8.1 「初回アクセス時の初期表示は OSM」: シークレットウィンドウ等で IDB が空の状態から開き、OSM が選択されていることを確認する
- [x] 8.2 「カスタム背景地図の追加 → 選択 → リロードで復元」: 追加 → 選択 → リロードで、当該カスタムが選択された状態になることを確認する
- [x] 8.3 「プリセット選択もリロードで復元」: 航空写真を選択 → リロードで航空写真が選択された状態を維持することを確認する
- [x] 8.4 「URL 検証 NG（HTTPS でない）」: `http://...` 入力時にエラー表示が出て追加されないことを確認する
- [x] 8.5 「URL 検証 NG（{z}/{x}/{y} 不足）」: プレースホルダが欠けた URL でエラー表示が出ることを確認する
- [x] 8.6 「出典リンク URL の `javascript:` 拒否」: `javascript:alert(1)` 入力時にエラー表示が出て追加されないことを確認する
- [x] 8.7 「出典テキストの HTML エスケープ」: `<script>alert(1)</script>` を入力して追加し、attribution コントロールに script 要素が DOM 上に生成されず、エスケープされた文字列として表示されることを確認する
- [x] 8.8 「操作メニューの開閉」: カスタム行の `⋮` で「編集」「削除」が表示され、外側クリック／Esc で閉じることを確認する
- [x] 8.9 「カスタム削除（OK）」: メニュー「削除」で確認ダイアログが出て、OK を選ぶと一覧と地図から消え、リロード後も復元されないことを確認する
- [x] 8.9b 「カスタム削除（キャンセル）」: 確認ダイアログでキャンセルを選ぶと、一覧・地図・IDB のいずれも変化しないことを確認する
- [x] 8.9c 「メニュー配色」: ドロップダウン内の「編集」が青系、「削除」が赤系の文字色で表示されていることを確認する
- [x] 8.10 「選択中カスタムの削除 → OSM フォールバック」: 選択中カスタムを削除（確認 OK）すると OSM に切り替わり、IDB の `selected-basemap-id` も `osm-layer` になっていることを確認する
- [x] 8.11 「編集モードの prefill とタイル URL ロック」: メニュー「編集」を選び、各フィールドが現在値で prefill され、タイル URL 欄が `readonly` で書き換えられないことを確認する
- [x] 8.12 「名称編集の一覧反映」: 編集モードで名称を書き換えて保存し、ラジオ一覧のラベルが更新されることと表示順が変わらないことを確認する
- [x] 8.13 「出典編集の attribution 反映」: 編集モードで出典テキスト／リンク URL を書き換えて保存し、地図右下の出典が新しい値で組み立てられた文字列に変わることを確認する
- [x] 8.14 「選択中編集の選択状態維持」: 選択中のカスタムを編集して保存し、編集後も同じカスタムが選択された状態を維持していることを確認する
- [x] 8.15 「編集時のタイル再ダウンロード無し」: DevTools の Network で記録しながら、同じカスタムの出典のみを編集して保存し、保存直後に同じビューポートのタイル URL への新規 HTTP リクエストが発生しないことを確認する
- [x] 8.16 「編集内容のリロード復元」: 編集して保存した後にタブを閉じて開き直し、編集後の値で一覧と地図が表示されることを確認する
- [x] 8.17 「編集モードでの検証ルール適用」: 編集モードで名称を空にする／出典リンク URL を `javascript:alert(1)` にする等を試み、エラー表示が出て保存されないことを確認する
- [x] 8.18 「出典の自動切替」: ユーザー追加分選択時に attribution からプリセットの `OpenStreetMap`／`地理院タイル` 文字列が消え、ユーザー追加分の出典のみ表示されることを確認する
- [x] 8.19 「IDB 読込失敗フォールバック」: ブラウザ DevTools 等で IDB をクリア／壊した状態でリロードし、アプリが初期化を継続しプリセットのみで動作することを確認する
