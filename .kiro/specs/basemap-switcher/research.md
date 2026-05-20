# Research & Design Decisions

## Summary
- **Feature**: `basemap-switcher`
- **Discovery Scope**: Extension（既存単一ファイル MapLibre アプリへの機能追加。light discovery 適用）
- **Key Findings**:
  - GSI ラスタ XYZ タイルは申請不要・CORS 開放（`Access-Control-Allow-Origin: *`）で Web 表示可。`std` z0–18 png／`seamlessphoto` z2–18 **.jpg**／`blank` z5–14 png・**日本域のみ**。出典は「出典：国土地理院ウェブサイト」＋ GSI ページリンク。
  - maplibre-gl 5.24.0 の `IControl`（onAdd/onRemove）は現行サポート方式。AttributionControl は **使用中（used）ソースの attribution のみ**集約し、`metadata`/`visibility`/`style` 系イベントで自動再描画。v5 は出典を `DOM.sanitize`（DOMPurify）経由の innerHTML で描画。
  - 可視 visibility トグルのみだと4ソースが "used" 扱いのまま残り得るため、出典の決定的差し替え（Req 3.3）には**アクティブな背景地図のソース/レイヤを単一に保つ add/remove 方式**が確実。
  - steering: structure.md =「単一ファイル・設定 as データ・新ファイルを作らない」、security.md =「innerHTML 経路へ未信頼データを生で渡さない／ラベル・URL 分離／リンクは http(s) スキーム allow-list」、tech.md =「バニラ JS・型/ lint 不導入・二段検証（クリーン環境＋実機スモーク）」。

## Research Log

### GSI タイルエンドポイントと利用条件
- **Context**: 地理院地図(標準)・航空写真・白地図を背景に追加するための URL・ズーム・形式・出典・ライセンスの確定。
- **Sources Consulted**: 地理院タイル一覧 `https://maps.gsi.go.jp/development/ichiran.html`、国土地理院コンテンツ利用規約 `https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html`、ライブ HTTP 検証（2026-05-19）。
- **Findings**:
  - `std`: `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` z0–18 PNG。
  - `seamlessphoto`: `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` z2–18 **JPEG**。
  - `blank`: `https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png` z5–14 PNG・**日本域のみ**。
  - 申請不要、CORS `*`、レート制限なし（通常の対話的タイル取得は許容範囲）。出典表記「出典：国土地理院ウェブサイト」＋ GSI リンク。ライセンスは政府標準利用規約準拠で maplibre-gl（BSD-3-Clause）と非干渉。
- **Implications**: 背景地図レジストリに per-source の `minzoom`/`maxzoom` と拡張子（`.jpg`/`.png`）差を保持。`blank` は `maxzoom:14` 設定で z>14 を overzoom（最深タイル引き伸ばし）させ空白を回避。アプリ既存 `maxBounds`（日本域）が `blank` の地域制限と整合し Req 2.3 を補強。

### MapLibre IControl / AttributionControl 機構
- **Context**: 左下カスタムコントロールの実装方式と、背景に追従する出典差し替えの確実な実現方式。
- **Sources Consulted**: MapLibre IControl / AttributionControl 公式 API、`attribution_control.ts` 実装挙動の確認。
- **Findings**: `IControl`（onAdd が DOM 要素を返す）は v5 でも唯一の公式拡張方式。`map.addControl(ctrl,'bottom-left')` で位置指定可。AttributionControl は `tileManager.used` が真のソースのみ attribution を集約・重複排除し ` | ` 連結、`DOM.sanitize` を通して innerHTML 反映。可視レイヤ・ズーム整合で `used` が決まるが、4ソース常駐＋visibility トグルだと `used` が残るケースがあり出典が綺麗に切り替わらない懸念。
- **Implications**: 背景地図は**常に1ソースのみ存在**（切替時に旧 source/layer を remove → 新 source/layer を add）。これにより未使用ソースが消え AttributionControl が自動で当該背景＋重畳の出典のみ表示。重畳（hazard/skhb）ソースは常駐のため出典は維持（Req 3.4, 5.x）。

### 既存コードの統合点（main.js）
- **Context**: 改修範囲・後方互換・レイヤ順序の特定。
- **Findings**: 初期 style に `osm` source＋`osm-layer`（最下レイヤ）。重畳の先頭は `hazard_flood-layer`（visibility:none でも常駐）。`map.on('load')` 内で OpacityControl×2（左上/右上）、Geolocate/Terrain（右下）を登録。Map options は `attributionControl` 未指定＝既定 AttributionControl が自動で存在（右下）。`hillshade` は load 内で `hazard_jisuberi-layer` の手前に追加。
- **Implications**: 背景レイヤは `addLayer(layer, 'hazard_flood-layer')` で常に最下（重畳より下）へ挿入し Req 5.4 を保証。出典位置は既定のまま（内容のみ変更、Req 3 は位置非変更）。改修は `main.js`＋既存 `style.css` のみ、新ファイル無し（structure.md 準拠）。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 単一アクティブソース add/remove ＋ ネイティブ attribution（採用） | 背景は常に1 source/layer。切替で remove→add。出典は各 source の `attribution` を AttributionControl が自動集約 | 出典差し替えが決定的（Req 3.3）。出典の自前描画ゼロで XSS 面最小。タイル取得は常時1系統 | 切替時のレイヤ順序維持が必要（beforeId 固定で対処） | structure.md「設定 as データ」と整合 |
| 4ソース常駐＋visibility トグル＋自前 attribution（不採用） | 4 source/layer 常駐し visibility 切替、出典はカスタムで明示管理 | 切替が軽い（add/remove なし） | `used` 残留で出典が混在し得る／出典自前構築で innerHTML 経路リスク増／既定 AttributionControl と二重化 | Req 3.3・Req 4 の充足が難化 |
| maplibre-gl-opacity の baseLayers 流用（不採用） | 既存プラグインの baseLayers で背景を排他切替 | 新規 UI コード最小 | 不透明度スライダ/見た目に UX 拘束、bottom-left 専用化や a11y 制御が困難。discovery で案B（カスタム）を選定済 | brief の意思決定に反する |
| `map.setStyle` 丸ごと差し替え（不採用） | 背景ごとに style 全体を差し替え | ソース分離が明快 | 重畳/skhb/terrain/route/イベント配線が消失し再構築、回帰大 | 題材に不適 |

## Design Decisions

### Decision: 背景地図切替の状態管理＝単一アクティブソース add/remove
- **Context**: Req 1.3（排他）、Req 3.3（切替で旧出典を残さない）、Req 5.4（重畳より下）を決定的に満たす必要。
- **Alternatives Considered**:
  1. 4ソース常駐＋visibility トグル — AttributionControl の `used` 残留で出典が非決定的。
  2. setStyle 丸ごと差し替え — 既存機能の回帰リスク大。
- **Selected Approach**: 背景地図レジストリ（const 配列）を定義し、`setBasemap(id)` で「現背景 layer/source を remove → 選択 source を add → `addLayer(layer,'hazard_flood-layer')` で最下に add」。初期は既存どおり `osm` が存在＝既定（Req 1.6）。
- **Rationale**: 出典はネイティブ AttributionControl が「使用中ソースのみ集約」する性質を利用して自動追従。自前出典描画を排し XSS 面を最小化。structure.md の「設定 as データ＋既存パターン追加・新ファイル無し」に合致。
- **Trade-offs**: 切替ごとに source/layer 再生成コストはあるが、対話操作頻度では無視可能。レイヤ順序維持のため beforeId を固定参照（`hazard_flood-layer` は常駐）。
- **Follow-up**: 切替直後に重畳/skhb/hillshade/route が保持されること、出典が「当該背景＋重畳」のみであることを実機スモークで確認。

### Decision: 出典は型付き定数からの安全ビルダで構築
- **Context**: Req 4.1–4.4、security.md（ラベル/URL 分離・http(s) allow-list・markup 非解釈）、spec 003 の継承。
- **Alternatives Considered**:
  1. 各 source に生 HTML 文字列を直書き — 既存 osm と同形だが Req 4.3 の分離要件・将来安全性に弱い。
  2. 型付き `{label, url}` ＋ `buildAttribution()` で http(s) 検証後に最小 `<a>` を構成（fail-closed: 不正スキームはラベルのみ）。
- **Selected Approach**: 案2。レジストリは出典を `{label, url}` で保持。`buildAttribution` が `new URL(url).protocol` を `/^https?:$/` で検証し、通過時のみ `<a href>` 文字列、非通過時はラベルのみ返す。利用者入力・外部データは一切介在しない開発者統制下の定数。
- **Rationale**: MapLibre v5 の DOMPurify サニタイズに加え、入力源を信頼定数に限定し分離・スキーム検証を満たす多層防御。security.md と spec 003 パターンに連続。
- **Trade-offs**: 生文字列直書きより数行増えるが、Req 4 と steering を決定的に満たし回帰検証が容易。
- **Follow-up**: 単体相当の手動確認（不正スキーム url を渡すとラベルのみになる）をチェックリスト化。

### Decision: 切替 UI は IControl ＋ ネイティブ radio
- **Context**: Req 1.1/1.2/1.5、Req 6.1–6.4。
- **Selected Approach**: `BasemapSwitcherControl`（IControl）を main.js 内に定義。`maplibregl-ctrl maplibregl-ctrl-group` のコンテナに `<fieldset>` ＋ `name="basemap"` の `<input type="radio">`＋`<label>` を4件。`addControl(ctrl,'bottom-left')`。選択は radio の checked で提示、change で `setBasemap`。
- **Rationale**: ネイティブ radio はキーボード操作・支援技術ラベル・選択状態提示を標準で満たし（Req 6）、カスタム ARIA ウィジェットより堅牢・小型。adopt（ネイティブフォーム）＞ build（自前 a11y）。
- **Trade-offs**: 見た目調整は `style.css` で最小 CSS を追加（既存のアプリ級 override CSS と同居）。
- **Follow-up**: 既存コントロール（左上/右上/右下）と重ならない位置・サイズを実機目視（tech.md の実機スモーク方針）。

## Risks & Mitigations
- **R1: 切替時のレイヤ順序崩れ（背景が重畳の上に来る）** — `addLayer(layer, 'hazard_flood-layer')` で常に最下挿入。`hazard_flood-layer` は初期 style 常駐で beforeId が安定。実機スモークで重畳視認性確認（Req 5.4）。
- **R2: 出典が切替前後で混在/残留** — 単一アクティブソース方式で未使用ソースを除去し AttributionControl 自動更新。実機で「OSM↔GSI」往復時の出典文言を目視（Req 3.3）。
- **R3: `blank` の z>14・地域外で空白** — source `maxzoom:14`＋既存 `maxBounds`（日本域）で overzoom 表示、操作は非破綻（Req 2.2/2.3）。
- **R4: タイル取得失敗で地図全体が停止** — MapLibre はタイル単位で失敗を許容（致命化しない）。切替側に追加処理は不要、設計で非致命を明記（Req 2.5）。
- **R5: 偽 green（build のみ通過）** — tech.md の二段検証。実装フェーズはクリーン環境 build/dev/preview ＋ 実機スモークチェックリスト必須、build 単独を合格としない。

## References
- [地理院タイル一覧](https://maps.gsi.go.jp/development/ichiran.html) — GSI std/seamlessphoto/blank の URL・ズーム・形式
- [国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html) — 出典表記義務・申請不要範囲
- [MapLibre IControl](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/IControl/) — カスタムコントロール契約
- [MapLibre AttributionControl](https://maplibre.org/maplibre-gl-js/docs/API/classes/AttributionControl/) — 使用中ソース集約・サニタイズ挙動
- `.kiro/steering/structure.md` / `security.md` / `tech.md` — 単一ファイル・出力経路・検証方針

---

# Gap Analysis — 第2段（カスタム背景地図の追加・編集・削除・永続化）

- **日付**: 2026-05-19
- **対象**: 改訂 `requirements.md`（Req 1–10）と実装・受け入れ済み `main.js` のギャップ
- **動機（演習）**: 実装・受け入れ済みフィーチャーへの仕様追加・変更フローの検証。再オープンに伴う既存承認 AC（特に Req 1–6）の非回帰と、セキュリティ不変条件の反転（利用者入力 → 出典/タイル定義）が中心論点。

## ⚠️ 重要な前提の訂正（設計に必須）

1. **MapLibre v5 のサニタイズは DOMPurify ではない**。本 research.md 上部（行 8・62）および brief.md は「v5 は `DOM.sanitize`/DOMPurify 経由」と記載しているが、v5.0.0〜v5.24.0 の実装は**自前の `DOM.sanitize()`**（`src/util/dom.ts`）。挙動は限定的なブロックリスト: `<script>` 除去／`on*` 属性除去／`href`・`src`・`xlink:href` の値に `javascript:`・`data:` を含む場合に除去。**`<iframe>`/`<object>`/`<style>` は除去せず、HTML エンティティの正規化もしない。タイル URL は一切サニタイズしない**。⇒ 利用者入力に対し MapLibre のサニタイズを唯一の防御にできない。Req 4.2/4.5/8 は**アプリ側の検証＋安全構築**を主防御とする（v5 サニタイザは多層防御の最後の網に降格）。
2. **既存 `buildAttribution()` は利用者入力に対して安全でない**（行 39–55）。`return \`<a href="${url}" target="_blank" rel="noopener">${label}</a>\`;` は `label` を HTML エスケープせず、`url` を属性値エスケープしない。入力が**開発者定数のみ**だから現状安全なだけで、Req 7/10 で利用者入力・永続化由来値が流入すると `"` による href 属性ブレイクアウトや `label` への markup 注入が成立する（格納型 XSS）。本関数は信頼定数経路と未信頼経路を分離して作り直す必要がある（Req 4.2/4.5）。

## Requirement-to-Asset Map

| Req | 既存資産 | 区分 | ギャップ内容 |
|---|---|---|---|
| 1 選択と切替 | `BasemapSwitcherControl`/`setBasemap`/radio | 拡張+制約 | AC3「他の3種」→「他の背景地図」改訂で挙動自体は包含。リストが可変になり onAdd 一回生成では不足（再描画機構が無い） |
| 1.6 初回 OSM | `currentBasemapId='osm'`＋初期 style 固定 osm | 制約 | 「永続化選択が無い時のみ OSM」へ意味変更。初期 style に osm 常駐のため復元時に osm→他へ差し替える経路が必要 |
| 2 表示品質 | per-source minzoom/maxzoom 方式 | 再利用 | カスタムは利用者指定ズーム。未指定時の既定・範囲外挙動は設計判断（タイル取得失敗の非致命は既存どおり） |
| 3 出典追従 | AttributionControl 自動集約＋add/remove | 再利用 | v5 で add/remove 時の再集約は確実（調査確認済）。カスタムも同経路で追従可。ただし出典文字列構築が未信頼化（→Req4） |
| 4 安全構築 | `buildAttribution()` | **要改修(致命)** | 上記訂正2。未信頼ラベル/URL の HTML/属性エスケープ、タイル URL の https 限定（`new URL` 検証）、markup 非解釈。AttributionControl は文字列入力のため DOM ノード渡し不可＝**安全な文字列生成**が必須 |
| 5 非回帰 | OpacityControl×2/Geolocate/Terrain/skhb/route/hillshade/Popup | 制約 | 触れない。特に Popup の生 HTML 補間（行 850–884）は別課題で**本スコープ外＝修正しない**。編集/削除が重畳状態に副作用しないこと（Req 9.6） |
| 6 a11y | fieldset/legend/native radio/label[for] | 拡張 | 追加フォーム（Req 6.5）にキーボード操作・AT ラベル・取消を新規付与。実機目視はユーザー実施（tech.md） |
| 7 追加 | IControl DOM-API 構築パターン | 新規 | 一覧末尾の追加操作要素、入力フォーム、確定時の即時反映、取消時の非変更。可変レジストリと再描画が前提 |
| 8 入力検証 | なし | 新規 | 必須欠落／`{z}{x}{y}` 欠如／非 https／ズーム不正のフォーム提示と追加抑止（fail-closed）。検証ユーティリティ無し |
| 9 編集/削除 | なし | 新規 | 利用者追加分のみ CRUD。組込み4種は対象外。選択中削除→OSM フォールバック（`setBasemap` 流用余地）。既存機能維持 |
| 10 永続化 | **なし**（localStorage 不使用） | 新規 | 定義＋選択 id の保存/復元、復元時の未信頼再検証、保存失敗フェイルクローズ、外部送信なし。復元は `map.on('load')`（style 完了後）で実施・順序は重畳より下 |

タグ凡例: 再利用=ほぼ流用可 / 拡張=既存を可変・追記 / 制約=既存方針が設計を縛る / 新規=対応資産なし / 要改修=既存資産が新要件に反する。

## 既存統合点（第2段で新たに重要な点）

- `setBasemap(id)` は「旧 layer/source remove → 選択 source add → `addLayer(layer,'hazard_flood-layer')` で最下挿入」。**カスタム source/layer にもそのまま適用可**（id を `osm`/`gsi_*` から拡張）。`hazard_flood-layer` は初期 style 常駐で beforeId が安定（調査: beforeId は存在チェック必須、非存在で throw）。
- AttributionControl は使用中 source の `attribution` のみ集約し add/remove 由来の `styledata`(dataType:'style') で確実に再集約（調査確認）。カスタム背景の出典追従は既存方式で成立。**ただし `attribution` に渡す文字列の安全性はアプリ責務**。
- `BASEMAPS` は `ReadonlyArray` const、`onAdd` で1回 `forEach` 生成。**追加/編集/削除で都度再描画する機構が無い**（リスナ解放は既存 `onRemove` パターンを踏襲して再構築時のリークを防ぐ必要）。
- 永続化資産は皆無。初期 style の `osm` source/layer は固定リテラルでなく `BASEMAPS.find('osm')` 参照のため、復元時に「初期 osm を撤去し復元背景を add」する `setBasemap` 同型の起動シーケンスを `map.on('load')` 内（既存 addControl 群と同所）に置ける。

## Implementation Approach Options

### Option A: `main.js` 内で既存資産を拡張（in-place）
`BASEMAPS` を可変レジストリ（組込み不変＋利用者可変）化、`BasemapSwitcherControl` をレジストリ変更で再描画、フォーム/編集/削除を同コントロール内に追加、永続化 read/write＋復元時再検証ヘルパを追加、`buildAttribution` を未信頼経路対応に改修、復元シーケンスを `map.on('load')` に追加。
- ✅ structure.md「単一ファイル・新ファイル無し・設定 as データ」に整合（steering 更新不要）。`setBasemap`/AttributionControl/IControl パターンを最大限再利用。
- ❌ `main.js` が相応に増大。コントロールが CRUD/フォームを抱え単一責務が緩む。受け入れ済み Req 1–6 への回帰面が広い。

### Option B: 新規モジュールへ分離
レジストリ／永続化／フォームを別ファイルへ抽出。
- ✅ 関心分離・テスト容易。
- ❌ structure.md の単一ファイル方針に反し **steering 更新＋設計レビューが前提**（friction 大）。題材の意図的素朴さを崩す。SDD 検証として「steering 変更フロー」も併せて回す意図が別途あるときのみ妥当。

### Option C: in-place ＋ 段階分割（推奨）
Option A の構造のまま2フェーズに分割。
- **Phase 1**: 可変レジストリ化＋追加・選択（Req 7）＋ `buildAttribution` 未信頼対応＋安全構築（Req 4）＋定義の永続化と復元時再検証（Req 10 のうち定義系）。
- **Phase 2**: 編集・削除（Req 9）＋選択状態の永続化・復元（Req 10.6–8、Req 1.6 改訂の結線）＋入力検証 UX 仕上げ（Req 8）。
- ✅ 受け入れ済み Req 1–6 への回帰をフェーズ境界でスモーク隔離。tech.md の二段検証・本演習の「段階検証」志向に整合。各フェーズが独立して実機スモーク可能。
- ❌ 計画コスト増。フェーズ間でレジストリ/状態モデルの一貫設計が必要。

## Effort & Risk

- **総合 Effort: L（1–2 週間）** — CRUD UI・永続化・復元時再検証・出典構築改修・起動時復元の複数新規能力を、稼働中の受け入れ済み機能上で単一ファイル制約下に集約するため。
- **総合 Risk: High** — 理由: (1) セキュリティ不変条件の反転（格納型 XSS 面の新設）と既存 `buildAttribution` の要改修、(2) 受け入れ済み・実装済み Req 1–6 の回帰面、(3) 先行成果物が抱える「v5=DOMPurify」誤前提の是正が設計の主防御方針を左右する。
- 個別目安: Req 7=M / Req 8=S–M / Req 9=M / Req 10=M（永続化＋復元時再検証＋起動シーケンス）/ Req 4 改修=S–M（影響は重大だがコードは局所）/ Req 1.6 結線=S。

## Recommendations for Design Phase

- **推奨アプローチ**: Option C（in-place ＋ 2 フェーズ）。Option B は structure.md 改定を要するため、steering 変更フローも検証したい場合の代替として明記。
- **主要設計判断（design で確定）**:
  - 信頼定数経路と未信頼経路を分離した出典構築。AttributionControl は文字列入力のため、未信頼ラベルの HTML エスケープ＋ URL の `new URL` 検証＋属性値エスケープで**安全な文字列**を生成（DOM ノード渡し不可）。v5 サニタイザは多層防御の最後段のみ。
  - 可変レジストリと状態モデル（組込み不変／利用者可変・永続）。`currentBasemapId` と永続「選択 id」の整合、復元不能時 OSM フォールバック（Req 1.6/10.8）。
  - 起動時復元シーケンス: `map.on('load')` 内・style 完了後に addSource→addLayer、beforeId は動的解決＋存在チェック、初期 osm 撤去と重畳より下挿入の決定的順序（復元と overlay/terrain 生成のレース回避）。
  - 永続化スキーマ（バージョニング・破損/容量超過時フェイルクローズ・キー命名・外部送信なし）と「復元時 valid とみなす検証規則」。
  - フォーム UX（IControl 内のパネル/モーダル、Req 6.5 の a11y、Req 7.6 取消セマンティクス）。
- **Research Needed（design で解消）**:
  - RN1: 未信頼出典の安全文字列生成の確定（エスケープヘルパ仕様・href 構築規則）。
  - RN2: 永続化スキーマ／マイグレーション／破損・quota ハンドリング。
  - RN3: 組込み×利用者エントリの id 衝突・再描画時のリスナ解放（既存 `onRemove` 踏襲）。
  - RN4: 復元と初期 osm/overlay/terrain 生成の決定的順序。
  - RN5: フォーム/編集/削除の UX 形態と a11y・取消挙動。
- **非回帰の守り**: Req 5（OpacityControl×2/Geolocate/Terrain/skhb/route/hillshade）と Popup 生 HTML（**スコープ外＝不修正**）に触れない。検証は tech.md の二段（クリーン環境 build/dev/preview ＋ 実機スモーク）。build 単独を合格としない。

---

# Design Synthesis（第2段、2026-05-20）

設計合成（Generalization / Build vs Adopt / Simplification）の結論。`design.md` と本ログを単一の真実とする。

## Generalization
- 「組込み」と「利用者」は同じ `BasemapDef` 形を共有。Registry を結合ビュー `getAllBasemaps()` で一元化し、`setBasemap`／Switcher／FormDialog／AttributionControl は origin を区別せず動作。組込み専有の責務は「edit/delete 不可」のみ（id 接頭辞 `custom_` で判定）。
- 入力検証と復元時再検証は単一関数 `validateCustomBasemapInput` に集約（Req 8 と Req 10.4 を同一規則で）。
- フォームは create／edit／delete を `mode` で切替える単一コンポーネント `BasemapFormDialog` に集約。

## Build vs Adopt
- 永続化: ブラウザ標準 `window.localStorage`（新規依存ゼロ）。バージョン接頭辞付きキー（`basemap-switcher:v1:*`）で進化に備える。
- モーダル UI: ネイティブ HTML `<dialog>`（focus trap・ESC 既定動作・モーダル背景を標準提供）。polyfill 不要（tech.md のモダンブラウザ前提）。
- 出典文字列の安全構築: ブラウザ DOM API（`createElement` ＋ `textContent` ＋ `setAttribute` → `outerHTML`）。手動の HTML エスケープも DOMPurify 等の依存追加も不要。
- ID: `crypto.randomUUID()`（ブラウザ標準）。
- 採用拒否: ライブラリ（lodash.escape／DOMPurify／モーダル系）はすべて DOM API ＋ ネイティブ要素で代替可。tech.md の「新規依存ゼロ」「枯れた素材」方針に整合。

## Simplification
- レジストリは独立クラス／モジュールにせず、`main.js` 内の関数群＋モジュールスコープ変数 `customBasemaps` に閉じる（structure.md 単一ファイル方針・第2段ギャップ分析 Option C 推奨）。
- `buildAttribution` を信頼／未信頼で分岐させず単一実装（DOM API 経由は両方に安全）。Req 4.1 は呼び出し側コメントで意図を明示。
- 編集／削除 UI を Switcher 本体に並置せず、ダイアログ内に集約（Switcher 行は「編集」ボタン 1 つだけに留め視認性確保）。
- 永続化スキーマは `version: 1` のみ。マイグレーションフレームワークは導入しない（version 不一致＝フェイルクローズ）。
- 復元時の再保存は行わない（無効分の自動掃除は次の利用者操作時の save に委ねる。起動時の余計な書込みを避ける）。

## 設計反映の境界
これらの合成決定はすべて `design.md` 本体に取り込み済み。`research.md`（本ログ）は出所と理由の保管庫。
