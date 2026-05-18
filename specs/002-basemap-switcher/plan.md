# 実行計画: 背景地図の切り替え（ベースマップスイッチャー）

**Branch**: `002-basemap-switcher` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-basemap-switcher/spec.md`

**Note**: 本ファイルは `/speckit.plan` が記入する。実行ワークフローは `.specify/templates/plan-template.md` 参照。本計画は利用者制約「**新規ライブラリを追加せず現行依存のみで対応する**」を前提とする。

## 要約

地図の左下に背景地図切替コントロールを設け、利用者が「OSM／地理院地図（標準地図）／航空写真／白地図」の4種を排他選択でき、選択中の提供元に応じて出典表記が自動で切り替わるようにする。

**技術アプローチ（現行ライブラリのみ）**: 新規依存を一切追加しない。

1. 既存依存 `maplibre-gl-opacity` の `OpacityControl({ baseLayers })` を**背景地図スイッチャーに転用**し、`map.addControl(ctrl, 'bottom-left')` で左下に配置。`baseLayers` はラジオ描画で排他切替＋現在選択の表示を満たす（FR-001/002/003/008）。
2. GSI ラスタソース3種（std / seamlessphoto / blank）と対応ラスタレイヤーを既存インラインスタイルへ追加。`osm-layer` を既定可視、GSI 3種を `visibility: 'none'` で起動（FR-004）。
3. 出典は MapLibre 組込み `AttributionControl`（明示追加なしの既定動作）が**可視レイヤーのソースの `attribution` のみを集約**する挙動を利用。各ソースに規約準拠の `attribution` を付与するだけで、背景切替に追従して OSM↔国土地理院 が自動で入れ替わる（FR-005/006/007、追加の命令的コードほぼ不要）。
4. 背景地図定義は単一責務モジュール `basemaps.js`（純粋データ＋純粋関数）へ分離し、`main.js` から取り込む。`node --test` で決定論的ユニットテスト（ネットワーク非依存）を追加（憲章 I/II）。
5. タイル取得失敗が無言で握りつぶされないよう `map.on('error', …)` で非ブロッキングに利用者へ可視化（FR-010・憲章 III）。

## 技術コンテキスト

**Language/Version**: JavaScript (ES Modules, バニラ) / Node.js `^20.19.0 || >=22.12.0`（既存 `engines` 維持）
**Primary Dependencies**: `maplibre-gl@^5.24.0`、`maplibre-gl-opacity@^1.8.0`（背景スイッチャーに転用）、`maplibre-gl-gsi-terrain@^2.3.2`、`@turf/distance@^7.3.5` — **いずれも既存。新規追加なし**（利用者制約・憲章 I）
**Storage**: なし（選択状態はセッション内のみ・永続化はスコープ外。spec Assumptions）
**Testing**: `node --test`（`npm run test`）。決定論的・実ネットワーク非依存（憲章 II）。地図描画経路は手動スモークを quickstart.md に文書化
**Target Platform**: モダンブラウザ（デスクトップ一般ブロードバンド前提）。Vite ビルド（`npm run build --base=./`）、PWA（`public/sw.js` は no-op の fetch ハンドラのみ＝タイル取得への影響なし）
**Project Type**: 単一フロントエンド地図アプリ（リポジトリルート直下のフラット構成、`src/` なし）
**Performance Goals**: 初回操作可能まで 3 秒以内（既定 OSM は不変のため後退なし）、パン/ズーム 60fps 目標、メインスレッド 100ms 超ブロックなし（憲章 IV）
**Constraints**: 新規依存ゼロ／フレームワーク導入なし（バニラ ES モジュール維持）／`package-lock.json` 不変／全成果物日本語（憲章「成果物の言語」）／白地図タイルは z5–14 提供のため z15–18 はオーバーズーム描画
**Scale/Scope**: 背景地図4種＋出典の動的表示。`main.js` への追記は最小限、定義は `basemaps.js` に集約。新規 UI 1点（左下スイッチャー）

## 憲章チェック

*GATE: Phase 0 研究の前に通過必須。Phase 1 設計後に再チェック。*

**初期チェック（Phase 0 前）**

| 原則 | 評価 | 根拠 |
|------|------|------|
| I. コード品質 | ✅ PASS | 新規依存ゼロ（利用者制約＝憲章「新規依存より既存を優先」を満たす）。背景定義を単一責務 `basemaps.js` に分離し雑多モジュール化を回避。デバッグ `console`/デッドコードは持ち込まない。Lint/Format は既存ツールで強制 |
| II. テスト基準 | ✅ PASS | `basemaps.js` の純粋ロジック（レジストリ整合・URL/zoom・baseLayers 構成）を `node --test` で決定論的にテスト。実タイル取得はモック/非依存。`npm run build` 成功を必須ゲート。描画経路の手動スモークを quickstart.md に明記 |
| III. UX 一貫性 | ✅ PASS | 既存 `OpacityControl` 規約・共有 CSS（`opacity-control.css`/`style.css`）を再利用しインラインスタイル不使用。ネイティブ `radio` でキーボード到達可。切替中も地図操作可。`map.on('error')` で失敗を可視化（無言破壊の禁止）。左下は空き（ハザード=top-left、skhb=top-right、Geolocate=bottom-right）で衝突なし |
| IV. パフォーマンス要件 | ✅ PASS | ラスタタイルは可視レイヤー分のみ遅延取得（不可視 GSI 背景は未要求）。新規依存ゼロでバンドル予算不変。既定 OSM 不変で初期表示性能の後退なし。冗長要求・再描画を増やさない |
| 技術・アーキ制約 | ✅ PASS | バニラ ES モジュール維持（フレームワーク導入なし）。Node 要件不変。`package-lock.json` 不変。成果物は日本語 |

**判定: 初期チェック 全 PASS。未正当化の違反なし** → Phase 0 へ進行可。

**再チェック（Phase 1 設計後）**

設計（`basemaps.js` レジストリ＋ `OpacityControl` 転用＋既定 AttributionControl 追従＋ `map.on('error')`）は新規依存・新規アーキ要素を導入せず、上表の全項目を維持。**再チェックも全 PASS。`複雑性計測` への記載対象なし。**

## プロジェクト構成

### ドキュメント

```text
specs/002-basemap-switcher/
├── plan.md              # 本ファイル（/speckit.plan 出力）
├── spec.md              # 機能仕様（/speckit.specify 出力）
├── research.md          # Phase 0 出力（/speckit.plan）
├── data-model.md        # Phase 1 出力（/speckit.plan）
├── quickstart.md        # Phase 1 出力（/speckit.plan）
├── contracts/           # Phase 1 出力（/speckit.plan）
│   ├── basemaps-module.md      # basemaps.js の公開インターフェース契約
│   └── ui-basemap-switcher.md  # 左下スイッチャー/出典のUI挙動契約
├── checklists/
│   └── requirements.md  # /speckit.specify の品質チェックリスト
└── tasks.md             # Phase 2 出力（/speckit.tasks。/speckit.plan では作らない）
```

### ソースコード

```text
（リポジトリルート直下のフラット構成。src/ は無く、現行構成を維持する）

index.html                    # #map とエントリ。原則変更なし
main.js                       # 地図初期化・コントロール登録。本機能で最小限の追記
                              #   - GSI 3ソース/3レイヤーをインラインスタイルに追加
                              #   - 背景用 OpacityControl を 'bottom-left' に追加
                              #   - map.on('error') による失敗の可視化
basemaps.js                   # [新規] 背景地図レジストリ（純粋データ＋純粋関数）。main.js が import
nearest.js                    # 既存（変更なし）
opacity-control.css           # OpacityControl 共有スタイル（背景スイッチャーも流用）
style.css                     # 共有スタイル（微調整が要る場合のみここ。インライン禁止）
public/sw.js                  # 既存 no-op（変更なし／タイル取得影響なし）

tests/unit/
├── nearest-feature.test.mjs  # 既存（変更なし）
└── basemaps.test.mjs         # [新規] basemaps レジストリの決定論的ユニットテスト
```

**Structure Decision**: 現行のバニラ ES モジュール・フラット構成を維持する（フレームワーク導入は憲章上の明示的決定事項であり本機能では行わない）。背景地図の定義・構成生成は副作用のない単一責務モジュール `basemaps.js` に分離し（憲章 I：雑多モジュール禁止／II：純粋ロジックの決定論的テスト）、`main.js` 側は「レジストリの取り込み」「ソース/レイヤー登録」「コントロール配置」「エラー可視化」の薄い結線に留める。UI は既存 `maplibre-gl-opacity` の規約を踏襲し新規依存ゼロ（利用者制約・憲章 I）。

## 複雑性計測

> **Constitution Check に正当化が必要な違反がある場合のみ記入**

憲章チェック（初期・Phase 1 後とも）で未正当化の違反は無く、新規依存・新規アーキテクチャ要素の導入もないため、本セクションに記載する対象はない。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| （なし）  | （なし）   | （なし）                            |
