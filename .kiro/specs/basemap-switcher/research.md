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
