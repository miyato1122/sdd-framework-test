# 実行計画: ユーザー定義のオリジナル背景地図の追加

**Branch**: `003-custom-basemap` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-custom-basemap/spec.md`

**Note**: 本ファイルは `/speckit.plan` が記入する。実行ワークフローは `.specify/templates/plan-template.md` 参照。本計画は **002（背景地図スイッチャー）への増分拡張**であり、利用者制約「**新規ライブラリを追加せず現行依存のみで対応する**」を 002 から継承する。002 の確定設計（`basemaps.js` 純粋レジストリ＋既定 `AttributionControl` 追従＋`map.on('error')`）を再利用し、差分のみを設計する。Clarifications（spec・2026-05-18 Q1〜Q4）反映済み。

## 要約

背景地図スイッチャー（002・左下）の一覧末尾に「背景地図を追加」操作を設け、押下で開くインラインフォームに表示名・タイル取得元（XYZ URL テンプレート）・出典を入力すると、検証通過時にユーザー定義背景地図を実行時にレジストリ追加し、組み込み4種と同一操作で選択・出典自動表示できるようにする（セッション内のみ・永続化なし）。

**技術アプローチ（現行ライブラリのみ・002 増分）**:

1. `basemaps.js`（純粋・新規依存なし）に **入力検証 `validateCustomBasemapInput`／生成 `createCustomBasemap`／既定ズーム定数** を追加。各規則は Clarifications Q2/Q3 を機械判定化（URL 解釈可能・`{z}{x}{y}` 必須・`http(s)` 限定・表示名一意）。決定論ユニットテスト（憲章 II）。組み込み `BASEMAPS` に `isUserDefined:false` を後方互換追加。
2. 背景スイッチャーのみ、`maplibre-gl-opacity` の `OpacityControl`（**構築時固定 `baseLayers`・実行時追加 API なし**）から、プラグイン描画 DOM 形状（`#opacity-control`＋ネイティブ `radio`＋`label[for]`）を踏襲した**小さな自作 `IControl`** へ置換（research R1′）。一覧末尾の「追加」ボタン＋インラインフォーム＋排他選択を担う。既存共有 CSS をそのまま適用しスタイル二重化ゼロ。ハザード/skhb の `OpacityControl` 2 インスタンスは不変（FR-011）。
3. 追加確定時、002 と同手順で `map.addSource`/`map.addLayer`（`visibility:'none'`・osm-layer 直後＝ハザード背面）。出典は **002 R3 の既定 `AttributionControl` 自動集約をそのまま再利用**（命令的コード不要）。追加では選択を変えない（Q4）。
4. タイル取得失敗は **002 の `.map-error-toast`＋`map.on('error')` を再利用**（FR-010）。フォームはインライン（全画面ブロック禁止＝憲章 III、FR-012）。

## 技術コンテキスト

**Language/Version**: JavaScript (ES Modules, バニラ) / Node.js `^20.19.0 || >=22.12.0`（既存 `engines` 維持）
**Primary Dependencies**: `maplibre-gl@^5.24.0`、`maplibre-gl-opacity@^1.8.0`、`maplibre-gl-gsi-terrain@^2.3.2`、`@turf/distance@^7.3.5` — **いずれも既存。新規追加なし**（利用者制約・憲章 I）。URL 検証は標準 `URL` API
**Storage**: なし（ユーザー定義背景はセッション内のみ・再読込で消失。spec Assumptions／Clarifications）
**Testing**: `node --test`（`npm run test`）。`basemaps.js` の純粋ロジック（検証/生成/既定値）を決定論・実ネットワーク非依存で検証（憲章 II）。描画/コントロール/a11y/回帰は quickstart.md 手動スモーク
**Target Platform**: モダンブラウザ（デスクトップ一般ブロードバンド前提）。Vite ビルド（`npm run build --base=./`）。`public/sw.js` は既存 no-op（タイル取得影響なし）
**Project Type**: 単一フロントエンド地図アプリ（リポジトリルート直下のフラット構成、`src/` なし）
**Performance Goals**: 初回操作可能まで 3 秒以内（既定 OSM 不変＝後退なし）、パン/ズーム 60fps 目標、メインスレッド 100ms 超ブロックなし（軽量 DOM フォーム）（憲章 IV）
**Constraints**: 新規依存ゼロ／フレームワーク導入なし（バニラ ES モジュール維持）／`package-lock.json` 不変／全成果物日本語（憲章「成果物の言語」）／インラインスタイル不使用（共有 CSS 再利用）／ユーザー定義タイルは XYZ・システム既定ズーム（`tileSize:256`・`maxzoom:19`・`minzoom`無、research R2）
**Scale/Scope**: 既存4種＋実行時 0..N 件のユーザー定義背景。`main.js` への追記は最小（結線のみ）、純粋部は `basemaps.js` に集約、UI は自作 `IControl` 1点（bottom-left スイッチャー置換）＋インラインフォーム

## 憲章チェック

*GATE: Phase 0 研究の前に通過必須。Phase 1 設計後に再チェック。*

**初期チェック（Phase 0 前）**

| 原則 | 評価 | 根拠 |
|------|------|------|
| I. コード品質 | ✅ PASS | 新規依存ゼロ（利用者制約＝憲章「新規依存より既存優先」を満たす。URL 検証は標準 API）。純粋ロジックは単一責務 `basemaps.js` に集約、DOM 担当は自作コントロール/フォームへ分離（雑多モジュール回避）。デバッグ `console`/デッドコード非持込。Lint/Format は既存ツールで強制 |
| II. テスト基準 | ✅ PASS | 検証/生成/既定値の純粋ロジックを `tests/unit/basemaps.test.mjs` に追記し `node --test` で決定論的に検証（実タイル非依存）。`npm run build` 成功を必須ゲートとし**クリーン環境で再検証**（偽green回避）。描画/コントロール/a11y/002 回帰は quickstart.md に手動スモーク明記 |
| III. UX 一貫性 | ✅ PASS | 自作コントロールはプラグイン DOM 形状を踏襲し既存共有 `opacity-control.css`/`style.css` を再利用（インライン不使用・スタイル二重化なし）。ネイティブ `radio`＋`label[for]` でキーボード到達。フォームはインライン（全画面ブロック禁止）で地図操作継続（FR-012）。失敗は `map.on('error')` トースト再利用で無言破壊回避。bottom-left 配置は他コントロールと非衝突（002 R6）。**a11y は実機スモークで確認（静的断定しない）** |
| IV. パフォーマンス要件 | ✅ PASS | ラスタタイルは可視レイヤー分のみ遅延取得。新規依存ゼロでバンドル予算不変。既定 OSM 不変で初期表示性能の後退なし。フォームは軽量 DOM でメインスレッド 100ms 超ブロックなし。冗長要求・再描画を増やさない |
| 技術・アーキ制約 | ✅ PASS | バニラ ES モジュール維持（フレームワーク導入なし）。Node 要件不変。`package-lock.json` 不変。成果物は日本語 |

**判定: 初期チェック 全 PASS。未正当化の違反なし** → Phase 0 へ進行可。

**再チェック（Phase 1 設計後）**

Phase 1 設計（`basemaps.js` 純粋関数追加＋自作 `IControl` で bottom-left スイッチャー置換＋002 の source/layer 追加・既定 AttributionControl・error トースト再利用）は**新規依存・新規アーキ要素を導入せず**、上表の全項目を維持。002 スイッチャーの `OpacityControl`→自作コントロール置換は behavior 非回帰（組み込み4・既定 OSM・出典自動表示は不変＝FR-011）・共有 CSS 再利用・バニラ維持であり**憲章違反ではなく、002 R1 の意図的見直し**として `research.md` R1′ に根拠記録済み。**再チェックも全 PASS。`複雑性計測` への記載対象なし。**

## プロジェクト構成

### ドキュメント

```text
specs/003-custom-basemap/
├── plan.md              # 本ファイル（/speckit.plan 出力）
├── spec.md              # 機能仕様（/speckit.specify＋/speckit.clarify 出力）
├── research.md          # Phase 0 出力（/speckit.plan）
├── data-model.md        # Phase 1 出力（/speckit.plan）
├── quickstart.md        # Phase 1 出力（/speckit.plan）
├── contracts/           # Phase 1 出力（/speckit.plan）
│   ├── basemaps-module.md      # basemaps.js 公開IF（002維持＋003純粋関数追加）
│   └── ui-basemap-switcher.md  # 自作スイッチャー/追加フォームのUI挙動契約
├── checklists/
│   └── requirements.md  # /speckit.specify の品質チェックリスト
└── tasks.md             # Phase 2 出力（/speckit.tasks。/speckit.plan では作らない）
```

### ソースコード

```text
（リポジトリルート直下のフラット構成。src/ は無く、現行構成を維持する）

index.html                    # #map とエントリ。原則変更なし
main.js                       # 結線のみ最小追記:
                              #   - 背景 OpacityControl を自作スイッチャー(IControl)へ置換（bottom-left）
                              #   - 追加確定コールバックで map.addSource/addLayer（osm-layer 直後・visibility:none）
                              #   - 既存 map.on('error') / .map-error-toast はそのまま再利用（変更なし）
                              #   - ハザード(top-left)/skhb(top-right) の OpacityControl は不変（FR-011）
basemaps.js                   # 002 純粋レジストリに 003 純粋関数を後方互換追加:
                              #   validateCustomBasemapInput / createCustomBasemap /
                              #   DEFAULT_USER_TILE_ZOOM、BASEMAPS に isUserDefined 付与
basemap-switcher.js           # [新規] 自作 MapLibre IControl（DOM）。ラジオ描画＋末尾「追加」
                              #   ＋インライン追加フォーム＋排他選択。basemaps.js を結線
nearest.js                    # 既存（変更なし）
opacity-control.css           # 既存共有スタイル（自作スイッチャーも #opacity-control を流用）
style.css                     # 共有スタイル。追加ボタン/フォーム用クラスをここへ集約（インライン禁止）
public/sw.js                  # 既存 no-op（変更なし／タイル取得影響なし）

tests/unit/
├── nearest-feature.test.mjs  # 既存（変更なし）
└── basemaps.test.mjs         # 既存に 003 純粋ロジック観点を追記（検証/生成/既定値/isUserDefined）
```

**Structure Decision**: 現行のバニラ ES モジュール・フラット構成を維持（フレームワーク導入は憲章上の明示的決定であり本機能では行わない）。純粋ロジック（検証・生成・既定値）は副作用のない単一責務 `basemaps.js` に集約し決定論テスト（憲章 I/II）。DOM を伴うスイッチャー/フォームは `basemap-switcher.js`（自作 `IControl`）へ分離し、`main.js` は「コントロール登録」「追加時の source/layer 結線」「既存エラー機構の再利用」の薄い結線に留める。背景スイッチャーのみ自作コントロールへ置換する理由（`OpacityControl` が構築時固定で実行時追加・末尾ボタン非対応）は 002 R1 の意図的見直しとして `research.md` R1′ に記録。新規依存ゼロ・共有 CSS 再利用で 002 と視覚/操作一貫（憲章 III）。

## 複雑性計測

> **Constitution Check に正当化が必要な違反がある場合のみ記入**

憲章チェック（初期・Phase 1 後とも）で未正当化の違反は無く、新規依存・新規アーキテクチャ要素の導入もない。002 スイッチャーの自作コントロール置換は behavior 非回帰・共有資産再利用であり違反に当たらず、`research.md` R1′ で設計判断の見直しとして根拠記録済みのため、本セクションに記載する対象はない。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| （なし）  | （なし）   | （なし）                            |
