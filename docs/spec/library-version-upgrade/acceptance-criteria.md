# ライブラリバージョンアップ 受け入れ基準

**作成日**: 2026-05-20
**関連要件定義**: [requirements.md](requirements.md)
**関連ユーザストーリー**: [user-stories.md](user-stories.md)
**ヒアリング記録**: [interview-record.md](interview-record.md)
**コンテキストノート**: [note.md](note.md)

## 信頼性レベル凡例

- 🔵 **青信号**: 既存コード（`package.json` / `main.js` / `index.html`）・README・メモから直接取得した確実な基準
- 🟡 **黄信号**: 既存資料・メモから妥当に推測した基準
- 🔴 **赤信号**: 資料に明示的な根拠がない推測

---

## REQ-001 / REQ-002 / REQ-003: 全パッケージ最新化と build 成功 🔵

**信頼性**: 🔵 *ユーザー指示 + package.json + メモ [[project_001_false_green_build]] より*

### Given（前提条件）
- 現行 `package.json` 5 パッケージ（vite / maplibre-gl / maplibre-gl-opacity / maplibre-gl-gsi-terrain / @turf/distance）。
- 開発者が `node_modules` と `package-lock.json` を削除済み。
- Node.js が Vite 新版の要件を満たしている（[prep.md](prep.md) 参照）。

### When（実行条件）
- 開発者が `package.json` の dependencies / devDependencies を更新後、`npm install` → `npm run build` を順に実行する。

### Then（期待結果）
- `npm install` が exit 0 で完了する。
- `package-lock.json` が再生成される。
- `npm run build` が exit 0 で完了する。
- `dist/` 配下に成果物（少なくとも `index.html`、`assets/*.js`、`assets/*.css`）が生成される。

### テストケース

#### 正常系

- [ ] **TC-REQ-001-01**: 全パッケージ最新化での install 成功 🔵
  - **入力**: 更新後の `package.json`（`vite` / `maplibre-gl` / `maplibre-gl-opacity` / `maplibre-gl-gsi-terrain` / `@turf/distance` がすべて最新の互換版）
  - **期待結果**: `npm install` 終了コード 0、`package-lock.json` 再生成、`ERESOLVE` 等のエラーが出力されない
  - **信頼性**: 🔵 *メモ [[project_001_false_green_build]] より*

- [ ] **TC-REQ-001-02**: build 成功 🔵
  - **入力**: TC-REQ-001-01 直後の状態
  - **期待結果**: `npm run build` 終了コード 0、`dist/index.html` と `dist/assets/` 配下のバンドルが存在する
  - **信頼性**: 🔵 *package.json scripts より*

- [ ] **TC-REQ-002-01**: クリーン環境からの再現 build 🔵
  - **入力**: `node_modules` および `package-lock.json` を削除した直後の状態
  - **期待結果**: `npm install && npm run build` が共に exit 0 で完了
  - **信頼性**: 🔵 *メモ [[project_001_false_green_build]] より*

#### 異常系

- [ ] **TC-REQ-001-E01**: 単体最新化で依存衝突を再現できること 🟡
  - **入力**: わざと相互非整合な単体最新の組み合わせを `package.json` に書き込む
  - **期待結果**: `npm install` が `ERESOLVE`/`peer dep` 警告またはエラーを出すか、ビルドが失敗する。これを観測したら REQ-101 に従って組み合わせを調整する
  - **信頼性**: 🟡 *npm 依存解決の常識から妥当な推測*

#### 境界値

- [ ] **TC-REQ-001-B01**: 最新の直前版へのフォールバック 🟡
  - **入力**: 真の最新が他依存と衝突する場合、一段戻したバージョン（latest-1）
  - **期待結果**: install / build が共に成功し、`requirements.md` の REQ-101 / EDGE-101 を満たす
  - **信頼性**: 🟡 *EDGE-101 と整合する妥当な推測*

---

## REQ-004 / REQ-005: 既存機能の維持と dev 起動 🔵

**信頼性**: 🔵 *main.js / index.html より*

### Given（前提条件）
- TC-REQ-001-02 が成功している。
- 開発者がブラウザで `npm run dev` の URL を開ける。

### When（実行条件）
- `npm run dev` → ブラウザで対象 URL を開く → 各 UI を操作する。

### Then（期待結果）
- 初期状態: OSM 背景 / 既定位置 / 各コントロール（左上ハザード OpacityControl、右上 SKHB OpacityControl、右下 GeolocateControl、TerrainControl）が表示される。
- ユーザーが各 UI を操作したとき、`main.js` のロジックどおりにインタラクションが動作する。

### テストケース

#### 正常系

- [ ] **TC-REQ-005-01**: 開発サーバー起動と初期描画 🔵
  - **入力**: `npm run dev`
  - **期待結果**: ブラウザで OSM 背景地図が `center=[138,37], zoom=5` で描画される。コンソールにエラー無し（タイル取得失敗除く）
  - **信頼性**: 🔵 *main.js 行15-21*

- [ ] **TC-REQ-005-02**: ハザード OpacityControl 動作 🔵
  - **入力**: ハザード OpacityControl（左上）でいずれかのレイヤーを選択
  - **期待結果**: 対応するハザード raster がマップに半透明（`raster-opacity: 0.7`）で重畳される
  - **信頼性**: 🔵 *main.js 行430-440*

- [ ] **TC-REQ-005-03**: SKHB OpacityControl 動作 🔵
  - **入力**: SKHB OpacityControl（右上）で `skhb-1-layer`〜`skhb-8-layer` のいずれかを選択
  - **期待結果**: 対応する避難所ポイント（circle）が表示される。`filter: ['get', 'disasterN']` により、選んだ災害種別のみが表示される
  - **信頼性**: 🔵 *main.js 行188-363, 443-455*

- [ ] **TC-REQ-005-04**: クリックポップアップ 🔵
  - **入力**: skhb レイヤーの circle 上を左クリック
  - **期待結果**: `Popup` が `feature.geometry.coordinates` 位置に表示され、名称・住所・備考・8 種の災害タグが描画される
  - **信頼性**: 🔵 *main.js 行458-516*

- [ ] **TC-REQ-005-05**: mousemove カーソル変化 🔵
  - **入力**: skhb レイヤーの circle 上にマウスカーソルを移動
  - **期待結果**: `map.getCanvas().style.cursor === 'pointer'` になる
  - **信頼性**: 🔵 *main.js 行518-540*

- [ ] **TC-REQ-005-06**: 最寄り避難所ルート描画 🔵
  - **入力**: GeolocateControl ON、ズーム 7 以上
  - **期待結果**: 現在地と最寄り skhb 地物を結ぶ `route-layer`（line-color #33aaff, line-width 4）が描画される
  - **信頼性**: 🔵 *main.js 行542-577, 178-185*

- [ ] **TC-REQ-005-07**: TerrainControl で 3D 地形 🔵
  - **入力**: TerrainControl を ON
  - **期待結果**: 地理院標高タイルから生成された terrain が有効化され、`hillshade` レイヤーが `hazard_jisuberi-layer` の手前に描画される
  - **信頼性**: 🔵 *main.js 行579-602*

- [ ] **TC-REQ-005-08**: PWA Service Worker 登録 🔵
  - **入力**: `index.html` を HTTPS（または `localhost`）で開く
  - **期待結果**: コンソールに `ServiceWorker registration failed` が出力されない（実体 `sw.js` が存在する前提）。MapLibre の更新による影響無し
  - **信頼性**: 🔵 *index.html 行14-17*

#### 異常系

- [ ] **TC-REQ-005-E01**: ズーム < 7 では route 非描画 🔵
  - **入力**: GeolocateControl ON、ズーム 5
  - **期待結果**: `route` source が空 FeatureCollection を維持し、青ラインが描画されない
  - **信頼性**: 🔵 *main.js 行548-554*

- [ ] **TC-REQ-005-E02**: GeolocateControl OFF では route 消去 🟡
  - **入力**: GeolocateControl を OFF に戻す
  - **期待結果**: `userLocation` が `null` になり、`route` source が空 FeatureCollection に戻る
  - **信頼性**: 🟡 *main.js 行545 の `_watchState` は非公開 API。MapLibre 更新で名称変更があると挙動が変わるリスクあり（EDGE-002）*

#### 境界値

- [ ] **TC-REQ-005-B01**: ズーム境界 7 ちょうど 🟡
  - **入力**: GeolocateControl ON、ズーム = 7 ちょうど
  - **期待結果**: `route-layer` が描画される（条件 `map.getZoom() < 7` から外れる）
  - **信頼性**: 🟡 *main.js 行548 の境界条件から妥当な推測*

---

## REQ-101 / REQ-102 / EDGE-001: 互換性と addProtocol 仕様変化 🟡

**信頼性**: 🟡 *main.js 行580 と MapLibre v4/v5 のリリース慣行からの妥当な推測*

### Given（前提条件）
- `maplibre-gl-gsi-terrain` の最新版と `maplibre-gl` の最新版の互換性確認が必要。

### When（実行条件）
- 採用バージョン組み合わせでアプリを起動する。

### Then（期待結果）
- 初期ロード時に `useGsiTerrainSource(maplibregl.addProtocol)` 起因の例外が発生しない。
- TerrainControl を ON にしたとき、地形と陰影が描画される。

### テストケース

- [ ] **TC-REQ-102-01**: addProtocol 呼び出し成功 🟡
  - **入力**: 採用組み合わせで `npm run dev`
  - **期待結果**: コンソールに `addProtocol`/`maplibre-gl-gsi-terrain` 由来の例外が出力されない
  - **信頼性**: 🟡

- [ ] **TC-REQ-102-02**: 互換版がない場合の判断記録 🟡
  - **入力**: `maplibre-gl-gsi-terrain` が最新 `maplibre-gl` に未対応のケース
  - **期待結果**: (a) 一段戻した `maplibre-gl` を採用、または (b) terrain を一時無効化 + コミットメッセージ/ノートに TODO を記録、のいずれかが選択され、その理由が `requirements.md` / コミットログに残る
  - **信頼性**: 🟡 *REQ-102 / REQ-302 と整合*

---

## REQ-501: `_watchState` を公開イベント API に置き換え 🔵

**信頼性**: 🔵 *ヒアリング Q5 = (i)、main.js 行545 / 542-554 / EDGE-002*

### Given（前提条件）
- 採用版の `maplibre-gl` で `GeolocateControl` が `trackuserlocationend` / `trackuserlocationstart` 等の公開イベントを発火することを確認済み（プラグインの API ドキュメントから事前確認）。

### When（実行条件）
- 開発者が `main.js` 行545 の `geolocationControl._watchState === 'OFF'` 直接参照を削除し、公開イベントベースの停止検知に置き換える。

### Then（期待結果）
- 置き換え後のコードに `_watchState` への直接参照が残っていない。
- GeolocateControl を ON → OFF と切り替えた後、`userLocation` が `null` に戻り、`route` source が空 FeatureCollection になる（既存挙動を維持）。

### テストケース

- [ ] **TC-REQ-501-01**: `_watchState` 非参照の静的確認 🔵
  - **入力**: 修正後の `main.js`
  - **期待結果**: `grep _watchState main.js` が 0 件
  - **信頼性**: 🔵

- [ ] **TC-REQ-501-02**: GeolocateControl OFF で route が消える（公開イベント経由） 🔵
  - **入力**: 開発サーバーで GeolocateControl ON → 数秒待機 → OFF
  - **期待結果**: 青ライン（`route-layer`）が描画停止し、`map.getSource('route').serialize().data.features` が `[]` になる
  - **信頼性**: 🔵 *REQ-501 / 既存挙動維持*

- [ ] **TC-REQ-501-03**: ズーム < 7 や userLocation 未取得時の早期 return 維持 🔵
  - **入力**: GeolocateControl ON、ズーム 5
  - **期待結果**: route が空のまま（REQ-501 の書き換えが既存の早期 return 条件を壊していない）
  - **信頼性**: 🔵

---

## REQ-405: @turf/distance v7 import 形式 🔵

**信頼性**: 🔵 *main.js 行10 + メモ [[project_001_false_green_build]] より*

- [ ] **TC-REQ-405-01**: default import の維持 🔵
  - **入力**: `import distance from '@turf/distance'` を維持した状態で v7 を採用
  - **期待結果**: build 成功 + 開発サーバーで `distance(...)` 呼び出し時に runtime エラーが発生しない
  - **信頼性**: 🔵 *メモ [[project_001_false_green_build]] および main.js 行10*

---

## 非機能要件テスト

### NFR-001 / NFR-002: パフォーマンス 🟡

**信頼性**: 🟡 *常識的な閾値からの妥当な推測*

- [ ] **TC-NFR-001-01**: dev コールドスタート時間 🟡
  - **測定項目**: `npm run dev` 実行 → 初回バンドル完了までの時間
  - **目標値**: 現行比 2 倍を超えない
  - **信頼性**: 🟡

- [ ] **TC-NFR-002-01**: build 成果物サイズ 🟡
  - **測定項目**: `dist/` の合計サイズ
  - **目標値**: 現行比 2 倍を超えない
  - **信頼性**: 🟡

### NFR-101 / NFR-102: セキュリティ 🔵 / 🔵

- [ ] **TC-NFR-101-01**: `npm audit` 退化なし 🟡
  - **検証内容**: `npm audit --omit=dev` の high/critical 件数
  - **期待結果**: 現行値以下
  - **信頼性**: 🟡 *依存更新で改善が期待されるが必須ではない閾値*

- [ ] **TC-NFR-102-01**: attribution への利用者入力混入なし 🔵
  - **検証内容**: `main.js` の `attribution` 設定箇所が固定文字列のままであること
  - **期待結果**: 利用者入力経路（クエリ・フォーム・LocalStorage 等）から `attribution` に渡る経路が存在しない
  - **信頼性**: 🔵 *メモ [[reference_maplibre_v5_attribution_sanitizer]] および [[feedback_no_raw_html_user_input]]*

### NFR-201 / NFR-202: コントロール配置と実機確認 🔵

- [ ] **TC-NFR-201-01**: コントロール配置維持 🔵
  - **検証内容**: GeolocateControl=bottom-right、ハザード OpacityControl=top-left、SKHB OpacityControl=top-right、TerrainControl=既定位置
  - **期待結果**: バージョンアップ後も同位置に配置
  - **信頼性**: 🔵 *main.js 行421, 440, 455, 597*

- [ ] **TC-NFR-202-01**: 実機 UI 確認チェックリスト完了 🔵
  - **検証内容**: TC-REQ-005-01〜B01 を実ブラウザで手動実施
  - **期待結果**: すべてパス
  - **信頼性**: 🔵 *メモ [[feedback_verify_ui_at_runtime]]*

### NFR-301 / NFR-302: Windows / lockfile 🔵

- [ ] **TC-NFR-301-01**: Windows での install 完走 🔵
  - **検証内容**: Windows 11 上で `npm install` が EPERM/EBUSY 等のファイルロック起因で失敗しないこと（失敗時はリトライ許容）
  - **信頼性**: 🔵 *メモ [[project_windows_env_filelock]]*

- [ ] **TC-NFR-302-01**: lockfile コミット 🔵
  - **検証内容**: 再生成された `package-lock.json` がコミット対象に含まれる
  - **信頼性**: 🔵 *メモ [[project_001_false_green_build]]*

---

## Edge ケーステスト

- [ ] **TC-EDGE-001-01**: 初期ロード時の `addProtocol` 例外検出 🟡
  - **条件**: 採用組み合わせで開発サーバー起動 + ブラウザ console 監視
  - **期待結果**: `useGsiTerrainSource` 経由の例外が出ない。出る場合は EDGE-001 の対処に従う
  - **信頼性**: 🟡

- [ ] **TC-EDGE-002-01**: `_watchState` 直接参照を恒久撤去（REQ-501 と統合） 🔵
  - **条件**: REQ-501 の書き換え後、改めて GeolocateControl を ON → OFF と切り替える
  - **期待結果**: TC-REQ-501-02 と同等。`_watchState` ではなく公開イベントで停止検知できているため、MapLibre 内部実装変更の影響を受けない
  - **信頼性**: 🔵 *ヒアリング Q5 = (i) により対処方針確定*

---

## テストケースサマリー

### カテゴリ別件数

| カテゴリ | 正常系 | 異常系 | 境界値 | 合計 |
|---------|--------|--------|--------|------|
| 機能要件 | 13 | 2 | 2 | 17 |
| 非機能要件 | 6 | 0 | 0 | 6 |
| Edge ケース | 0 | 2 | 0 | 2 |
| **合計** | **19** | **4** | **2** | **25** |

### 信頼性レベル分布

- 🔵 青信号: 19 件 (76%)
- 🟡 黄信号: 6 件 (24%)
- 🔴 赤信号: 0 件 (0%)

**品質評価**: 高品質。残る 🟡 はパフォーマンス閾値と `npm audit` 観測など、外部要素の影響を受ける項目に集約。

### 優先度別テストケース

- **Must Have**: 21 件（TC-REQ-001 系、TC-REQ-005 系、TC-REQ-501 系、TC-NFR-201/202、TC-NFR-302、TC-EDGE-001/002）
- **Should Have**: 4 件（TC-NFR-001/002、TC-NFR-101-01、TC-NFR-301-01）

---

## テスト実施計画

### Phase 1: 依存整合性と build（自動）
- TC-REQ-001-01 / TC-REQ-001-02 / TC-REQ-001-E01 / TC-REQ-001-B01 / TC-REQ-002-01 / TC-REQ-405-01 / TC-REQ-501-01
- 実施タイミング: 依存更新コミット直後

### Phase 2: dev サーバーと UI 実機確認（手動）
- TC-REQ-005-01〜TC-REQ-005-B01、TC-REQ-501-02 / TC-REQ-501-03、TC-NFR-201-01、TC-NFR-202-01、TC-EDGE-002-01
- 実施タイミング: Phase 1 グリーン後

### Phase 3: クリーン環境再現と非機能（自動 + 手動）
- TC-NFR-001-01 / TC-NFR-002-01 / TC-NFR-101-01 / TC-NFR-301-01 / TC-NFR-302-01 / TC-EDGE-001-01
- 実施タイミング: Phase 2 グリーン後、レビュー前
