# ライブラリバージョンアップ 要件定義書

## 概要

`package.json` に記載されている全パッケージ（`vite` / `maplibre-gl` / `maplibre-gl-opacity` / `maplibre-gl-gsi-terrain` / `@turf/distance`）を、**互いに整合する最新の安定版**へ更新する。更新後も既存アプリ（地図表示、ハザード重ね、SKHB レイヤー、ポップアップ、現在地取得、最寄り避難所ルート描画、3D 地形、PWA）の挙動を回帰させない。

本要件は README に記載された SDD フレームワーク検証シナリオ「1. ライブラリのバージョンアップ」に対応する。

## 関連文書

- **コンテキストノート**: [📝 note.md](note.md)
- **ヒアリング記録**: [💬 interview-record.md](interview-record.md)
- **ユーザストーリー**: [📖 user-stories.md](user-stories.md)
- **受け入れ基準**: [✅ acceptance-criteria.md](acceptance-criteria.md)
- **準備タスク**: [🔧 prep.md](prep.md)
- **技術スタック**: [docs/tech-stack.md](../../tech-stack.md)

## 信頼性レベル凡例

- 🔵 **青信号**: 既存コード（`package.json` / `main.js` / `index.html`）・README・メモから直接取得した確実な要件
- 🟡 **黄信号**: 既存資料・メモから妥当に推測した要件
- 🔴 **赤信号**: 資料に明示的な根拠がない推測

## 機能要件（EARS 記法）

### 通常要件

- **REQ-001**: システムは、`package.json` に記載された全ての依存パッケージを、現時点で動作可能な最新の安定版（または直近の動作互換版）に更新しなければならない 🔵 *ユーザー指示および README 検証内容1*
- **REQ-002**: システムは、更新後に `npm install` がエラーなく完了し、`package-lock.json` が再生成された状態を保持しなければならない 🔵 *npm の標準挙動・メモ [[project_001_false_green_build]] より*
- **REQ-003**: システムは、更新後に `npm run build` を実行し、`dist/` 配下に成果物が生成される状態を保持しなければならない 🔵 *package.json scripts より*
- **REQ-004**: システムは、更新後に `npm run dev` を実行して開発サーバーが起動し、ブラウザで地図が初期描画される状態を保持しなければならない 🔵 *既存挙動の維持要請*
- **REQ-005**: システムは、既存の機能セット（背景地図 OSM、6 種のハザードレイヤー、8 種の SKHB レイヤー、`OpacityControl` × 2、`GeolocateControl`、`TerrainControl`、陰影図、クリック時ポップアップ、最寄り避難所ルート描画、PWA 登録）を、バージョンアップ後も同等の見た目・操作で提供しなければならない 🔵 *main.js / index.html より*

### 条件付き要件

- **REQ-101**: 対象パッケージの最新版が他パッケージと依存衝突を起こす場合、システムは衝突を回避できる**最新の互換バージョン**（一段戻したバージョン等）を選択して採用しなければならない 🔵 *ヒアリング Q3 = (b) 互換性のため一段戻し許容*
- **REQ-102**: `maplibre-gl-gsi-terrain` の最新版が対象 `maplibre-gl` バージョンと非互換である場合、システムは **`maplibre-gl` のバージョンを互換可能な範囲で一段戻して採用** しなければならない（代替プラグイン採用や terrain 機能の無効化はとらない） 🔵 *ヒアリング Q4 = (a)*
- **REQ-103**: `vite` のメジャー更新により Node.js の最低バージョン要件が変わる場合、システムは新しい要件を満たす Node.js バージョンを **`docs/tech-stack.md` の「セットアップ手順」節** に追記しなければならない 🔵 *ヒアリング Q6 = (i)*

### 状態要件

- **REQ-201**: アプリが「ロード直後（`map.on('load')` 未発火）」状態にある場合、システムはコンソールへの警告・エラーを出力してはならない（タイル取得失敗を除く） 🟡 *MapLibre メジャーアップにより deprecation 警告が発生しやすい点からの妥当な推測*
- **REQ-202**: アプリが「`GeolocateControl` OFF」状態にある場合、システムはルート用 source `route` を空 FeatureCollection に保ち続けなければならない 🔵 *main.js 行543-554 の既存挙動*

### オプション要件

- **REQ-301**: システムは、`maplibre-gl` v5 系に更新する場合、`addProtocol` の新シグネチャ（Promise を返す `(params, abortController) => Promise<...>`）に合わせた `maplibre-gl-gsi-terrain` バージョンを採用してよい 🟡 *MapLibre v4/v5 のリリースノート慣行から妥当な推測*
- **REQ-302**: システムは、各パッケージのアップグレード差分とその採否理由を、コミットメッセージまたは `docs/spec/library-version-upgrade/` 配下のメモに記録してよい 🟡 *SDD 比較演習の目的から妥当な推測*

### 制約要件（更新範囲・非機能の前提）

- **REQ-401**: システムは、`package.json` の `"type": "module"` および `scripts`（`dev` / `build` / `preview`）を維持しなければならない 🔵 *package.json より*
- **REQ-402**: システムは、`vite build` を `--base=./` 付きで実行する設定を維持しなければならない（任意サブパス配信の前提） 🔵 *package.json scripts より*
- **REQ-403**: システムは、TypeScript・ESLint・Prettier・Vitest 等の**未導入ツールを本要件で新規導入してはならない**（スコープを「依存バージョン更新」に限定する）。ただし **REQ-501（`_watchState` の公開 API 書き換え）は例外として本要件のスコープ内** とする 🔵 *ヒアリング Q5 = (i) によりスコープ例外を確定*
- **REQ-404**: システムは、`maplibre-gl` 更新時の `attribution` HTML を、利用者入力ではなく既知のタイルプロバイダ文字列のみとし、生 HTML を新たに利用者入力経路から受け取らないこと 🔵 *メモ [[feedback_no_raw_html_user_input]] および [[reference_maplibre_v5_attribution_sanitizer]] より*
- **REQ-405**: システムは、`@turf/distance` v7 系への更新時、既存の `import distance from '@turf/distance'`（default import）を維持し、import 形式の変更が必要な場合のみ最小差分で修正すること 🔵 *main.js 行10 およびメモ [[project_001_false_green_build]] より*

### 追加要件（ヒアリングで追加）

- **REQ-501**: システムは、`main.js` の `GeolocateControl` トラッキング停止検知において、非公開プロパティ `geolocationControl._watchState` への直接参照を廃止し、`maplibre-gl` の **公開イベント**（例: `trackuserlocationend`、`trackuserlocationstart`）を用いた検知に置き換えなければならない。書き換え後も既存挙動（停止時に `userLocation = null` とし `route` source を空にする）を維持すること 🔵 *ヒアリング Q5 = (i)、main.js 行545 / 542-554 / EDGE-002 と整合*

## 非機能要件

### パフォーマンス

- **NFR-001**: バージョンアップ後、開発サーバー（`npm run dev`）のコールドスタート時間が現行比 2 倍を超えて悪化してはならない 🟡 *Vite メジャー更新で起動が高速化する傾向からの妥当な推測（悪化しないことが期待される）*
- **NFR-002**: 本番ビルド（`npm run build`）成果物の総サイズが現行比 2 倍を超えて増加してはならない 🟡 *演習として常識的な閾値*

### セキュリティ

- **NFR-101**: バージョンアップ後、`npm audit` の **high / critical** 警告が現行より増加してはならない 🟡 *依存更新の常識的な品質基準*
- **NFR-102**: `attribution` 等で MapLibre 内部のサニタイズに依存している経路は、本要件の範囲では新規に利用者入力を流し込まないこと（既存の固定文字列を維持） 🔵 *メモ [[reference_maplibre_v5_attribution_sanitizer]] より*

### ユーザビリティ

- **NFR-201**: バージョンアップ後、コントロールの配置（`GeolocateControl` = `bottom-right`、ハザード `OpacityControl` = `top-left`、SKHB `OpacityControl` = `top-right`、`TerrainControl` = 既定位置）が変わってはならない 🔵 *main.js 行421, 440, 455, 597 より*
- **NFR-202**: バージョンアップ後、地図上のクリック → ポップアップ、`mousemove` → カーソル変化、`render` → 最寄り避難所ライン描画、の各インタラクションが目視で同等に動作すること（実機確認必須） 🔵 *メモ [[feedback_verify_ui_at_runtime]] より*

### 移植性・運用

- **NFR-301**: バージョンアップ後、Windows 11 上で `npm install` がファイルロック起因の失敗なく完了すること（リトライ可） 🔵 *メモ [[project_windows_env_filelock]] より*
- **NFR-302**: バージョンアップ後の `package-lock.json` をコミット対象に含めること（クリーン環境再現の前提） 🔵 *メモ [[project_001_false_green_build]] の偽 green 防止より*

## Edge ケース

### エラー処理

- **EDGE-001**: `maplibre-gl-gsi-terrain` の最新版が `maplibre-gl` のターゲットバージョンに非対応で `addProtocol` 呼び出しが失敗する場合、ビルドは成功しても**初期ロードで例外**となる。本要件ではこのケースを検出し、互換版採用または当該機能の一時的な無効化 + 明示的な TODO 化で扱う 🟡 *main.js 行580 と v4/v5 API 変更からの妥当な推測*
- **EDGE-002**: `GeolocateControl` の `_watchState` という非公開 API を `main.js` 行545 が直接参照している。MapLibre のメジャーアップでプロパティ名が変わると `render` ループでルート描画が常時オン/オフ固定になる可能性がある。**本要件では REQ-501 として能動的に公開イベント API へ書き換える**（受動的な目視確認ではなくコード変更で恒久対処） 🔵 *ヒアリング Q5 = (i) により対処方針確定*

### 境界値

- **EDGE-101**: 直近 minor が出たばかりで安定報告のない版が最新の場合、**一段戻した直近の安定版**を採用する（最新 = 動作可能とは限らないため） 🔵 *ヒアリング Q3 = (b) と整合*
- **EDGE-102**: `package-lock.json` を削除せず `npm install` のみで更新すると、上限制約により最新版に到達しないことがある。本要件では `package-lock.json` を **削除 → 再生成** または `npm install <pkg>@latest` で明示的に最新を取りに行うこと 🟡 *npm 依存解決の常識から妥当な推測*

## スコープ外（明示的に除外）

- TypeScript 化 / ESLint・Prettier・Biome 等の導入 🔵 *REQ-403 より*
- Nuxt 構成への移行（README 検証内容4 として別要件） 🔵 *README より*
- 背景地図切替（README 検証内容2）への新規変更 🔵 *README およびメモ [[project_basemap_custom_reopen]] より別要件*
- 既存機能の挙動変更（README 検証内容3 として別要件） 🔵 *README より*
- PWA / Service Worker の機能追加 🟡 *タスク粒度の限定として妥当な推測*

## 信頼性レベル分布

| レベル | 件数 |
|--------|------|
| 🔵 青 | 27 |
| 🟡 黄 | 5 |
| 🔴 赤 | 0 |

**品質評価**: 高品質（ヒアリング Q1〜Q7 により判断点が確定。残る 🟡 は外部ライブラリ最新版選定の不確実性に集約）
