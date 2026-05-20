# ライブラリバージョンアップ 設計ヒアリング記録

**作成日**: 2026-05-20
**対象フェーズ**: `/tsumiki:kairo-design` step4 既存情報ベースの差分ヒアリング

## ヒアリング実施可否について

本セッションでは設計フェーズの対話ヒアリングは**実施していない**。理由は以下の通り：

1. **AskUserQuestion ツール非搭載**: 本実行環境では `AskUserQuestion` ツールが利用不可（tool list / 遅延ツール一覧のいずれにも未登録）。`/tsumiki:kairo-design` step4 を仕様どおりの対話式で実行することは構造的に不可能。
2. **要件フェーズで設計判断点を解消済み**: 設計レベルで本来確認すべき主要論点（バージョン選定戦略、`_watchState` 撤去の是非、`gsi-terrain` 非対応時の対処、Node 要件の文書化先）は、`/tsumiki:kairo-requirements` の Q1〜Q7 テキストヒアリングで先行確定済み。本 design セッションで追加質問が必要な新規論点は無いと判断した。

## 要件フェーズの判断（設計に直接効くもの）

[interview-record.md](../../spec/library-version-upgrade/interview-record.md) の Q1〜Q7 から、設計レベルで参照したものを抽出する。

| 要件フェーズ Q | 回答 | 設計への影響 |
|---|---|---|
| Q1 動機 | フロー検証 | スコープを「最小差分」に固定。設計も「決定マトリクスでの選定戦略」に絞り、新規アーキテクチャ提案はしない（[architecture.md § システム概要](architecture.md)）|
| Q2 規模 | フル機能 | 出力は architecture.md / dataflow.md / design-interview.md の 3 ファイル（後述の「生成スキップ判断」参照）|
| Q3「動作可能な最新」| (b) 一段戻し許容 | [architecture.md § バージョン選定戦略](architecture.md) のフォールバック順序、[dataflow.md § 2.2 衝突時パス](dataflow.md) の決定木に反映 |
| Q4 gsi-terrain 非対応 | (a) maplibre-gl 一段戻し | [architecture.md § 標高タイルプラグイン](architecture.md) の互換性方針、[dataflow.md § 2.2 / § 5](dataflow.md) のエラー対応に反映 |
| Q5 `_watchState` | (i) 公開 API へ書き換え | [architecture.md § REQ-501 撤去の設計](architecture.md)、[dataflow.md § 3 GeolocateControl 停止検知フロー](dataflow.md) の前後比較に反映 |
| Q6 Node 記載先 | (i) docs/tech-stack.md | [architecture.md § ビルド・開発サーバー](architecture.md) の追記方針に反映 |
| Q7 優先順位 | 現状維持 | 設計上の Phase 分けは acceptance-criteria.md のテスト実施計画 Phase 1-3 をそのまま採用（[dataflow.md § 6 検証フロー](dataflow.md)）|

## 生成ファイルのスキップ判断

`/tsumiki:kairo-design` フル設計は通常 6 ファイル（architecture / dataflow / design-interview / interfaces.ts / database-schema.sql / api-endpoints.md）を生成する。本要件では以下の理由で 3 ファイルに絞った：

| ファイル | 生成可否 | 理由 |
|---|---|---|
| `architecture.md` | ✅ 生成 | バージョン選定戦略・REQ-501 の書き換え設計を文書化する必要 |
| `dataflow.md` | ✅ 生成 | install/build フロー、REQ-501 の前後差分、既存ランタイムの非回帰参照を整理 |
| `design-interview.md` | ✅ 生成 | 本ファイル。ヒアリング非実施の根拠と要件フェーズからの設計判断継承を記録 |
| `interfaces.ts` | ❌ 生成しない | 本リポジトリは Vanilla JS（TypeScript 未導入）。新規型定義の必要性なし。スコープ規律 REQ-403 から TypeScript 化はスコープ外 |
| `database-schema.sql` | ❌ 生成しない | バックエンド/データベースなし（[architecture.md § システム概要](architecture.md)）|
| `api-endpoints.md` | ❌ 生成しない | 内部 API なし。外部タイル CDN（OSM/GSI）は本要件で変更しない |

スキップは `/tsumiki:kairo-design` コマンド仕様の以下の許諾に基づく：
- 「インターフェース定義が不要なら生成しない」
- 「対象がデータベーススキーマが不要の場合は生成しない」
- 「対象にAPIではない場合、または既存のAPIを利用する場合は生成しない」

## 設計レベルで残る不確実性（実装フェーズで解消）

以下は本設計時点で確定できず、`/tsumiki:kairo-implement`（または TDD red/green）フェーズで実環境確認により解消する：

1. **採用 `maplibre-gl` 版が `trackuserlocationend` イベントを提供するか**: REQ-501 の書き換えに直接効く。設計では公開イベント `trackuserlocationend` 採用を既定としているが、採用版で名称・発火条件が異なる場合は実装時に最も近い公開 API へ差し替え（要件は「公開 API への置き換え」自体は確定済み）。
2. **各パッケージの実際の互換組み合わせ**: `npm install` の試行で初めて確定する。設計の決定マトリクスはどの順で試すかを定義しているのみ。
3. **`addProtocol` シグネチャの世代差**: 採用 `maplibre-gl` 版に応じて `maplibre-gl-gsi-terrain` の対応版が変わる。`addProtocol` の呼び出しは `useGsiTerrainSource(maplibregl.addProtocol)` を渡すだけのため、プラグイン側の対応版選定で吸収する設計とする。
4. **`npm audit` の絶対値**: 現行値の実測が必要。NFR-101「現行比退化なし」は実装直前に基準値を取る前提。
5. **パフォーマンス計測の現行値**: NFR-001/002 も同様、実装前に現行 dev コールドスタートと dist サイズを計測しておく必要がある（→ prep.md の「推奨」相当）。

これらは設計の正しさを揺るがすものではなく、「設計の値を埋める」段階の確認事項。

## ヒアリング結果サマリー

### 確認できた事項
- 設計レベルで独立した追加論点は無く、要件フェーズの Q1〜Q7 で必要な判断点はすべて確定済み
- 生成ファイルは architecture.md / dataflow.md / design-interview.md の 3 件に絞ることが妥当（言語・スタックの性質上）
- 実装時に確定すべき値は明示化済み（上記「残る不確実性」5 件）

### 設計方針の決定事項
- **アーキテクチャパターン**: 現状維持（Vanilla JS + Vite + MapLibre + プラグイン群）
- **バージョン選定**: 決定マトリクス（[architecture.md](architecture.md) § バージョン選定戦略 / [dataflow.md § 2.2](dataflow.md)）に従い、最新→一段戻しの順で試す
- **REQ-501 実装方法**: `trackuserlocationend` 公開イベントを既定とし、採用版で異なる場合は最も近い公開 API へ差し替え
- **検証フロー**: 受け入れ基準の Phase 1-3 をそのまま採用

### 残課題
- 上記「設計レベルで残る不確実性」5 件は実装フェーズに送る

### 信頼性レベル分布

**設計フェーズ開始時（要件フェーズ完了直後）**:
- 🔵 青信号: 60 件（要件4ファイル合計）
- 🟡 黄信号: 12 件
- 🔴 赤信号: 0 件

**設計フェーズ完了時（architecture.md + dataflow.md 追加）**:
- 🔵 青信号: 81 件（+21）
- 🟡 黄信号: 15 件（+3）
- 🔴 赤信号: 0 件

設計フェーズで追加された 🟡 はパフォーマンス閾値とプラグイン側のリリース対応状況に関するもの（実装時に実測で 🔵 化される性質）。

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **要件定義**: [requirements.md](../../spec/library-version-upgrade/requirements.md)
- **要件ヒアリング記録**: [interview-record.md](../../spec/library-version-upgrade/interview-record.md)
- **受け入れ基準**: [acceptance-criteria.md](../../spec/library-version-upgrade/acceptance-criteria.md)
- **準備タスク**: [prep.md](../../spec/library-version-upgrade/prep.md)
