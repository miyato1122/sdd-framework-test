# 研究メモ（Phase 0）: 背景地図の切り替え

対象の不明点を解消し、設計判断を確定する。出典は公式情報を基に確認済み。

---

## R1. 背景地図スイッチャーの実装方式（新規依存なし）

- **Decision**: 既存依存 `maplibre-gl-opacity` の `OpacityControl({ baseLayers: {...} })` を背景地図切替に転用し、`map.addControl(ctrl, 'bottom-left')` で左下に配置する。`baseLayers` は排他（ラジオ）描画で、選択でレイヤー可視を切り替え、現在選択をラジオ選択状態で示す。
- **Rationale**: 利用者制約「現行ライブラリのみ」かつ憲章 I「新規依存より既存依存を優先」。本アプリは既に同コントロールを2インスタンス（ハザード=top-left、skhb=top-right）運用しており、規約・スタイル（`opacity-control.css`）・操作感を一貫させられる（憲章 III）。3つ目を bottom-left に足すのは確立パターンの素直な拡張。
- **Alternatives considered**:
  - 自前の独自 HTML コントロールを新規実装 → 依存は増えないがコード量・アクセシビリティ実装・スタイル二重化が増え憲章 I/III に不利。既存規約から逸脱。却下。
  - MapLibre 公式の追加プラグイン導入 → 新規依存となり利用者制約・憲章 I 違反。却下。

## R2. GSI タイル仕様（公式タイル一覧で確認済み）

- **Decision**: 以下の公開 XYZ ラスタタイルを使用する。
  | 背景 | source 種別 | tiles URL | 形式 | 提供 zoom | source 設定 |
  |------|------------|-----------|------|----------|------------|
  | 地理院地図（標準地図） | raster | `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` | PNG | 5–18 | `minzoom:5, maxzoom:18, tileSize:256` |
  | 航空写真（全国最新写真シームレス） | raster | `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` | JPG | 2–18 | `minzoom:2, maxzoom:18, tileSize:256` |
  | 白地図 | raster | `https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png` | PNG | 5–14 | `minzoom:5, maxzoom:14, tileSize:256` |
  既存 `osm` ソース（`https://tile.openstreetmap.org/{z}/{x}/{y}.png`）はそのまま流用。
- **Rationale**: 公式タイル一覧（https://maps.gsi.go.jp/development/ichiran.html）で URL・拡張子・zoom 範囲を確認。アプリは `minZoom:5 / maxZoom:18`。std/seamlessphoto は全域カバー。**白地図は z5–14 のみ提供** → source の `maxzoom:14` を設定すれば MapLibre が z15–18 を z14 タイルのオーバーズーム（拡大）描画するため、最大ズームでも破綻せず操作継続可能（FR-003/エッジケース）。
- **Alternatives considered**: 白地図を z14 までに地図 maxZoom を制限 → 他背景の高ズーム体験を損ね既定 OSM 体験も変わるため却下（オーバーズームで十分）。

## R3. 出典の自動切替（MapLibre 既定 AttributionControl の挙動）

- **Decision**: 出典は MapLibre 組込みの既定 `AttributionControl`（明示追加しない＝MapLibre が自動付与）に委ねる。各ソースに規約準拠の `attribution` 文字列を持たせ、**可視レイヤーが使用するソースの attribution のみが集約表示される**挙動を利用して、背景切替に追従させる。
  - OSM ソース attribution（既存・維持）: `&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`
  - GSI std/seamlessphoto/blank の attribution（共通）: `<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル（国土地理院）</a>`
- **Rationale**: MapLibre の AttributionControl は「実際に使用（=可視レイヤーが参照）されているソース」の attribution を集約する。背景は `OpacityControl` の baseLayers により常に1つだけ可視なので、選択中背景の出典のみが表示され、切替時に OSM↔国土地理院 が自動入替（FR-005/006）。**追加の命令的コードがほぼ不要**で新規依存ゼロ。重畳中のハザード等の出典も併記されるが、これは正しい挙動。
- **検証方法（憲章 II：描画経路は手動スモーク）**: 自動切替は描画依存のためユニット化不可。quickstart.md の手動スモークで「4種それぞれで出典が提供元一致」「切替で即時入替」を確認する（SC-002/003）。
- **Alternatives considered**:
  - 自前で出典 DOM を背景選択時に差し替え → 命令的コード増・二重管理。MapLibre 既定挙動で足りるため却下。
  - `AttributionControl` を明示生成して `customAttribution` 管理 → 必要なく、既定挙動と二重化。却下。

## R4. 出典の表記内容と利用規約（FR-007 準拠）

- **Decision**: GSI タイルの出典は「**地理院タイル（国土地理院）**」表記とし、公式タイル一覧ページ（https://maps.gsi.go.jp/development/ichiran.html）へのリンクを付す。OSM は現行表記（OpenStreetMap contributors ＋ copyright リンク）を維持。
- **Rationale**: 公式規定で「出典は『国土地理院』または『地理院タイル』等と記載し、一覧ページへのリンクを付す」「国土地理院コンテンツ利用規約（https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html）に従う」とされている。本アプリは既に同系の GSI 出典表記（skhb・ハザード）を採用しており表記様式も一貫（憲章 III）。
- **Alternatives considered**: データ名（電子国土基本図 等）を個別表記 → 規約上は提供元表記＋リンクで十分。表記の複雑化を避け却下。

## R5. タイル取得失敗時の扱い（FR-010・憲章 III）

- **Decision**: `map.on('error', (e) => …)` を1箇所追加し、タイル/ソース取得失敗を**非ブロッキングに利用者へ可視化**（短時間の控えめな通知。地図操作は継続）。失敗を握りつぶさず、かつ全画面ブロックやレイアウト破壊をしない。
- **Rationale**: 憲章 III「失敗が地図を無言で壊した状態にしてはならない」。MapLibre は失敗タイルを単に未描画にしパン/ズームは継続できるが、利用者が状況を認識できない（無言）。最小限の error ハンドラで FR-010・SC-005・エッジケースを満たす。`console` デバッグ出力ではなくユーザー可視のアフォーダンスにする（憲章 I：デバッグ console を main に残さない）。
- **Alternatives considered**: 何もしない（MapLibre 既定） → 無言破壊で憲章 III/FR-010 違反。却下。モーダルでブロック → 憲章 III「全画面ブロック禁止」。却下。

## R6. 既存 OpacityControl 2 インスタンスとの共存・スタイル

- **Decision**: 背景用に3つ目の `OpacityControl` を追加。スタイルは既存 `opacity-control.css`（`#opacity-control` セレクタ）を共用。`#opacity-control hr { display:none }` の既存ルールにより baseLayers のみ利用時の余分な区切り線も従来どおり非表示で見た目一貫。
- **Rationale**: 既に複数インスタンスが同一スタイルで運用されている（`#opacity-control` は複数要素に適用される既知の運用）。背景スイッチャーも同様に共有スタイルへ乗せることでインラインスタイル不使用（憲章 III）。配置 bottom-left は他コントロール（top-left/top-right/bottom-right）と非衝突（エッジケース：狭幅でも領域分離）。
- **Alternatives considered**: 背景用に別 CSS ファイル新設 → スタイル分散で憲章 III の「共有スタイル再利用」に反する。却下。

## R7. テスト戦略（憲章 II）

- **Decision**: `basemaps.js` の純粋部分（背景レジストリの整合、`buildBaseLayers()` 等の構成生成）を `tests/unit/basemaps.test.mjs` で `node --test` により決定論的に検証（実タイル取得なし）。テスト観点：4種の id/label/source 定義が存在、既定が OSM、白地図 source の maxzoom=14、各 attribution 文字列が提供元準拠（OSM=OpenStreetMap、GSI=地理院タイル＋一覧リンク）、`baseLayers` マップが期待形。
- **Rationale**: 憲章 II「純粋ロジックは自動ユニットテスト」「決定論的・実ネットワーク非依存」。描画/コントロール挙動は手動スモーク（quickstart.md）で補完。`npm run build` 成功を必須ゲート。
- **Alternatives considered**: E2E/ブラウザ自動テスト導入 → 新規依存・スコープ過大（利用者制約）。却下。

---

**結論**: spec の `[NEEDS CLARIFICATION]` は無く、本研究で全設計不明点を解消。新規依存ゼロで FR-001〜010・SC-001〜006 を満たす設計が確定。Phase 1 へ進行可。
