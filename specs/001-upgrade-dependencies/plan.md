# 実行計画: 依存ライブラリの最新化（package.json）

**Branch**: `001-upgrade-dependencies` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)
**Input**: 機能仕様 `specs/001-upgrade-dependencies/spec.md`

> 言語方針: 憲章 v1.1.0「成果物の言語」制約に従い日本語で記述。

## 要約

`package.json` の全依存をメジャーアップを含む最新安定版へ更新し、地図アプリの
既存機能を回帰させないことを保証する保守タスク。最大の技術的論点は
**MapLibre GL JS の v2→v5 メジャーアップ**であり、`main.js` が依存する内部 API
（`feature._geometry`・`geolocationControl._watchState`）と `addProtocol` 署名変更、
および `@turf/distance` v7 の named export 化への追従が必要。検証は憲章 II に従い
「ビルド成功＋手動スモーク＋純粋ロジックの自動テスト」で行う。

## 技術コンテキスト

**Language/Version**: JavaScript (ES Modules), ブラウザ実行 / Node.js v24.14.1（開発機）
**Primary Dependencies**（現状 → 目標、2026-05-18 npm registry 調査）:

| パッケージ | 現状 | 目標(latest) | 区分 |
|---|---|---|---|
| vite (dev) | `^3.2.0` | `^8.0.13` | メジャー×5 |
| maplibre-gl | `^2.4.0` | `^5.24.0` | メジャー×3（最大リスク） |
| @turf/distance | `^6.5.0` | `^7.3.5` | メジャー（export 形態変更） |
| maplibre-gl-opacity | `^1.4.0` | `^1.8.0` | マイナー（低リスク） |
| maplibre-gl-gsi-terrain | `^0.0.2` | `^2.3.2` | メジャー（API 追従要） |

**Storage**: なし（静的タイル/ベクトルタイルをネットワーク取得。`public/skhb` 同梱）
**Testing**: 現状なし → 純粋ロジックに最小ユニットテストを追加（憲章 II 準拠）。
地図描画系は憲章 II の手動スモーク手順で検証
**Target Platform**: モダンブラウザ（PWA: `public/sw.js` + `manifest.json`）
**Project Type**: フロントエンド単体（バニラ JS + Vite）。バックエンドなし
**Performance Goals**: 初回操作可能 < 3 秒、パン/ズーム 60fps（憲章 IV）
**Constraints**: 既存機能の回帰ゼロ、`package-lock.json` 再現性、Node
`^20.19.0 || >=22.12.0`（Vite 8 engines）を package.json / README に整合
**Scale/Scope**: 単一 SPA（`index.html` / `main.js` / `public/*`）。`style.css`
は未参照（本タスク対象外）

## 憲章チェック

*GATE: Phase 0 前に通過必須。Phase 1 設計後に再評価。*

| 原則 | 評価 | 根拠 |
|---|---|---|
| I. コード品質 | ✅ PASS | 変更は `package.json` / `package-lock.json` / `main.js`（破壊的変更箇所のみ最小修正）/ `README` に限定。内部 API 依存（`_geometry`・`_watchState`）を公開 API へ置換し品質は向上方向。デッドコード追加なし |
| II. テスト基準 | ✅ PASS | `@turf/distance` v7 化で影響を受ける純粋ロジック（最寄り施設選定 = `getNearestFeature` / `getCurrentSkhbLayerFilter`）に最小ユニットテストを追加。地図描画系はユニット化困難のため憲章 II が許容する「文書化された手動スモーク」で検証。`npm run build` をゲート化 |
| III. UX 一貫性 | ✅ PASS | 機能等価が受け入れ条件。手動スモークチェックリスト（contracts/）で全コントロール・状態の不変を確認 |
| IV. パフォーマンス要件 | ✅ PASS | アップグレード前後でバンドルサイズと初回操作時間/パン・ズーム体感を比較し非回帰を確認（quickstart に手順） |
| 成果物の言語 | ✅ PASS | 全成果物を日本語で記述（パッケージ名・コマンドは技術上の例外） |
| ワークフロー: Lint/フォーマット | ⚠ 既存ギャップ | Complexity Tracking 参照（正当化付きで本タスク範囲外に切り出し） |

ゲート違反による ERROR なし。Lint 不在は既存ギャップで本アップグレードに起因
せず、SDD 比較データの純度のため別タスク化（下記 Complexity Tracking で正当化）。

## プロジェクト構成

### ドキュメント

```text
specs/001-upgrade-dependencies/
├── plan.md              # 本ファイル
├── spec.md              # 機能仕様
├── research.md          # Phase 0 出力（バージョン/破壊的変更の調査と決定）
├── data-model.md        # Phase 1 出力（依存マトリクス＋非回帰挙動インベントリ）
├── quickstart.md        # Phase 1 出力（実施・検証・ロールバック手順）
├── contracts/
│   └── behavioral-equivalence.md   # 既存挙動の振る舞い契約＋手動スモーク
└── checklists/
    └── requirements.md  # 仕様品質チェックリスト（specify で作成済）
```

### ソースコード

```text
index.html              # PWA エントリ（manifest.json / sw.js 登録）
main.js                 # 地図ロジック全体（修正対象: import 文・内部 API 依存箇所）
package.json            # 依存・engines（修正対象）
package-lock.json        # ロック（再生成対象）
public/
├── manifest.json
├── sw.js               # 手書き ServiceWorker（PWA、Vite プラグイン非使用）
├── icon*.png
└── skhb/               # 指定緊急避難場所ベクトルタイル（同梱）
tests/                  # 新規: 純粋ロジックの最小ユニットテスト（憲章 II）
└── unit/
    └── nearest-feature.test.*   # getNearestFeature 等の回帰テスト
README.md               # 動作要件・検討結果(git-spec 節) を更新
```

**Structure Decision**: フロントエンド単体構成。ソースはリポジトリ直下の
`index.html` / `main.js` と `public/`。本タスクで `tests/unit/` を新設し、
`@turf/distance` 更新の影響を受ける純粋ロジックのみ自動テスト対象とする。

## 複雑性計測

> Constitution Check に正当化が必要な事項のみ記載

| 違反/逸脱 | なぜ必要か | より単純な代替が不可な理由 |
|---|---|---|
| Lint/フォーマット ツール導入を本タスクに含めない（憲章ワークフロー ゲート1 / 原則 I のツール強制を当面満たさない） | 本リポジトリは元来 Lint 未設定。これは依存アップグレードに起因しない既存ギャップ。本タスクの目的は「SDD フレームワーク比較データの取得（ライブラリ最新化題材）」であり、無関係なツール整備を混在させると比較データが汚染される | 「最新化と同時に Lint 導入」は変更範囲とリスクを拡大し、回帰の切り分けを困難にする。Lint 整備は独立フォローアップ（別 spec）として切り出すのが最小かつ妥当。本タスクでは既存コードの整形を退行させないことのみを保証する |
