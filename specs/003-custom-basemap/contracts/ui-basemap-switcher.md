# 契約: 背景地図スイッチャー（自作 IControl）＋追加フォーム UI 挙動（003）

002 の `OpacityControl` 転用スイッチャーを、`basemaps.js`（純粋）と結線する**自作 MapLibre `IControl`** へ置換して満たす UI 契約。新規依存なし。ハザード（top-left）・skhb（top-right）の `OpacityControl` は不変（FR-011）。

## 配置・構成契約（FR-001/002/007、002 と一貫）

- 自作コントロールを `map.addControl(ctrl, 'bottom-left')` で**地図左下**に常時表示（002 と同一配置・他コントロールと非衝突）。
- プラグイン描画 DOM 形状を踏襲: `#opacity-control` コンテナ配下に各背景の `input[type=radio]`＋`label[for]`、**一覧末尾に「＋ 背景地図を追加」ボタン**（FR-001）。
- スタイルは既存共有 `opacity-control.css`（`#opacity-control` / `.maplibregl-ctrl-bottom-left #opacity-control`）を流用。追加ボタン/フォーム用クラスは共有 `style.css` に集約。インライン不使用（憲章 III）。
- 排他選択（ラジオ）で**現在選択を識別可能**。組み込み4＋追加分すべて同一アフォーダンス（FR-007・憲章 III 一貫性）。

## 切替挙動契約（FR-004/005/011、Clarifications Q4）

- 起動・再読込直後: 組み込み4のみ・`osm-layer` 可視・ラジオは OSM 選択（`getDefaultBasemapId()`）。ユーザー定義は0件（永続化なし）。
- 選択肢（組み込み/追加分）を選ぶと当該背景レイヤーのみ可視、他背景は不可視へ即時切替。同一選択は無変化・無エラー。
- **追加操作では選択を変えない**: 追加成功後も `current`/可視レイヤー/出典は不変（Q4）。利用者が追加分を明示選択して初めて切替（FR-004 後段）。
- 組み込み4種の選択・既定 OSM 挙動は 003 によって**変化してはならない**（FR-011／回帰禁止）。

## 追加フォーム契約（FR-002/003/008/009/012）

- 末尾「追加」押下で**インラインパネル**を展開（モーダル不可＝全画面ブロック禁止・憲章 III）。`formOpen=true` でも地図のズーム/パンは継続（FR-012）。
- 入力欄: 表示名／タイル取得元（URL テンプレート）／出典の表示名（必須）／出典リンク URL（任意）。確定・キャンセル操作（FR-009）。生 HTML 入力欄は設けない（Q5）。
- 確定時 `validateCustomBasemapInput()` を呼び、`ok:false` なら**追加せず項目別エラーを表示**（`field` ∈ label/urlTemplate/attributionLabel/attributionUrl、無言失敗禁止＝FR-008/SC-004）、フォームは開いたまま。
- `ok:true` で `createCustomBasemap()` → `main.js` が `map.addSource`/`map.addLayer`（`visibility:'none'`、`'hazard_flood-layer'` の手前＝osm-layer 直後）→ ラジオ一覧末尾（「追加」ボタンの直前）に追記 → `formOpen=false`。選択は不変（Q4）。
- キャンセルで一覧・地図・出典・現在選択は不変、フォームを閉じる（US3-AC4）。

## 出典契約（FR-006、002 R3 再利用・不変）

- 出典は MapLibre 既定 `AttributionControl` が**可視ソースの `attribution` を集約**して表示（002 と同一機構）。
- ユーザー定義背景選択時=`buildAttributionHtml`（表示名エスケープ＋任意リンク）でシステム構築した安全 HTML、組み込み選択時=002 既定の提供元出典。切替で自動入替（追加の命令的コード不要）。生ユーザー入力は `source.attribution` に渡らない（Q5）。

## エラー挙動契約（FR-010・憲章 III、002 R5 再利用・不変）

- ユーザー定義含むタイル/ソース取得失敗は既存 `map.on('error')`＋`.map-error-toast` で**非ブロッキング可視化**。地図操作継続、`current` 不変、握りつぶさない。

## アクセシビリティ契約（憲章 III・要実機確認）

- ネイティブ `input[type=radio]`＋`label[for]` でキーボード到達・ラベルクリック切替。追加ボタン/フォーム入力もキーボード操作可・可読コントラスト。新規 UI は既存 a11y を後退させない。
- **`label[for]` 紐付け・キーボード挙動・フォーカス順は静的断定せず quickstart 手動スモークで実機確認**（過去知見: 002 で `label[for]` 根拠の断定が実機 NG）。

## 受け入れ対応表

| 受け入れ | 契約箇所 |
|---------|---------|
| US1-AC1（末尾「追加」押下→フォーム表示） | 配置・構成／追加フォーム |
| US1-AC2（入力確定→一覧追加・選択は不変） | 追加フォーム／切替挙動（Q4） |
| US1-AC3（追加分を選択→背景切替・現在選択表示） | 切替挙動／配置・構成 |
| US2-AC1/2/3（出典が提供元へ自動追従） | 出典契約 |
| US3-AC1（必須欠落で拒否・項目提示／出典URL任意） | 追加フォーム（検証 NG） |
| US3-AC2（不正タイルURL：解釈不能/座標欠落/非http(s)で拒否） | 追加フォーム（検証 NG）／basemaps-module R3 |
| US3-AC3（出典リンクURL不正で拒否） | 追加フォーム（検証 NG・Q5）／basemaps-module 規則8 |
| US3-AC4（重複表示名で拒否） | 追加フォーム（検証 NG・Q3） |
| US3-AC5（出典表示名の HTML がエスケープされ無害化） | 出典契約／basemaps-module `escapeHtml`/`buildAttributionHtml`（Q5） |
| US3-AC6（キャンセルで不変・復帰） | 追加フォーム（キャンセル） |
| FR-011（組み込み4・既定OSM・出典が不変） | 切替挙動／出典契約（回帰禁止） |
| エッジ：タイル失敗・フォーム中操作・狭幅非衝突 | エラー挙動／追加フォーム（非ブロッキング）／配置（領域分離） |
