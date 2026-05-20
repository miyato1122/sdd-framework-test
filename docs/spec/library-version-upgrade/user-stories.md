# ライブラリバージョンアップ ユーザストーリー

**作成日**: 2026-05-20
**関連要件定義**: [requirements.md](requirements.md)
**ヒアリング記録**: [interview-record.md](interview-record.md)
**コンテキストノート**: [note.md](note.md)

## 信頼性レベル凡例

- 🔵 **青信号**: 既存コード（`package.json` / `main.js` / `index.html`）・README・メモから直接取得した確実なストーリー
- 🟡 **黄信号**: 既存資料・メモから妥当に推測したストーリー
- 🔴 **赤信号**: 資料に明示的な根拠がない推測

---

## エピック1: 依存パッケージを安全に最新化する

### ストーリー 1.1: 最新化されたビルドが通る 🔵

**信頼性**: 🔵 *ユーザー指示 + package.json + メモ [[project_001_false_green_build]] より*

**私は** SDD 比較演習の実装者 **として**
**`package.json` の全パッケージを動作可能な最新版に揃えたうえで `npm run build` を成功させたい**
**そうすることで** 「依存更新」シナリオを各 SDD フレームワークで同条件比較できる

**関連要件**: REQ-001, REQ-002, REQ-003, REQ-101

**詳細シナリオ**:
1. `package.json` の現行版（vite 3.2 / maplibre-gl 2.4 / maplibre-gl-opacity 1.4 / maplibre-gl-gsi-terrain 0.0.2 / @turf/distance 6.5）を確認する。
2. 各パッケージの最新の安定版と相互依存関係を確認する。
3. 衝突がない最新の組み合わせで `package.json` を更新する。
4. `package-lock.json` を再生成し、`npm install` をエラーなく完了させる。
5. `npm run build` が exit 0 で完了し、`dist/` が生成される。

**前提条件**:
- Node.js が Vite 新版の要件を満たしている（[prep.md](prep.md) D1）。
- インターネット経由で npm レジストリにアクセスできる。

**制約事項**:
- TypeScript / Lint / Nuxt 等の追加導入はスコープ外（REQ-403）。
- `vite build --base=./` の指定は維持する（REQ-402）。

**優先度**: Must Have

---

### ストーリー 1.2: クリーン環境で再現可能な build である 🔵

**信頼性**: 🔵 *メモ [[project_001_false_green_build]] より*

**私は** 本リポジトリのレビュアー **として**
**`node_modules` と `package-lock.json` を削除した状態から `npm install && npm run build` を行ったときも成功することを確認したい**
**そうすることで** 「ローカルだけ通って lockfile 環境で落ちる」偽 green を避けられる

**関連要件**: REQ-002, REQ-003, NFR-302

**詳細シナリオ**:
1. `rm -rf node_modules package-lock.json` を実行する（Windows では同等の削除）。
2. `npm install` をエラーなく完了させる。
3. `npm run build` を exit 0 で完了させる。
4. 生成された `package-lock.json` を成果に含める。

**前提条件**:
- 開発者の作業ディレクトリで自由にクリーン化できる。
- Windows のファイルロック制約により失敗した場合はリトライ可能（NFR-301）。

**優先度**: Must Have

---

### ストーリー 1.3: 開発サーバーで地図が描画される 🔵

**信頼性**: 🔵 *main.js / index.html より*

**私は** 開発者 **として**
**`npm run dev` 起動後にブラウザで地図と各種コントロールが描画されることを目視確認したい**
**そうすることで** 「ビルドは通るが描画が壊れている」回帰を検知できる

**関連要件**: REQ-004, REQ-005, NFR-201, NFR-202

**詳細シナリオ**:
1. `npm run dev` を起動し、表示された URL をブラウザで開く。
2. OSM 背景地図が初期位置（lon=138, lat=37, zoom=5）で描画される。
3. 左上にハザード `OpacityControl`、右上に SKHB `OpacityControl`、右下に `GeolocateControl`、`TerrainControl`（既定位置）が表示される。
4. ハザード `OpacityControl` で各レイヤーをオンにすると、対応するハザードラスターが半透明で重なる。
5. SKHB `OpacityControl` で各レイヤーをオンにすると、対応する避難所ポイント（円）が表示される。
6. 円をクリックするとポップアップが表示され、名称・住所・対応災害種別が見える。
7. `mousemove` で円の上にカーソルを置くとカーソルが pointer に変わる。
8. `GeolocateControl` を有効にし、ズーム 7 以上にすると、現在地と最寄り避難所を結ぶ青いラインが描画される。
9. `TerrainControl` を ON にすると、地理院標高タイルによる 3D 地形と陰影図が表示される。

**前提条件**:
- ブラウザに位置情報の許可を与えられる（または手動で許可せず GeolocateControl オフのままでも他項目を確認できる）。
- 国土地理院／OSM のタイル CDN にアクセスできる。

**優先度**: Must Have

---

## エピック2: 破壊的変更への適応

### ストーリー 2.1: MapLibre メジャー更新の addProtocol 仕様変化に追随する 🟡

**信頼性**: 🟡 *main.js 行580 + MapLibre v4/v5 のリリース慣行から妥当な推測*

**私は** 実装者 **として**
**`maplibre-gl-gsi-terrain` を最新の `maplibre-gl` と互換のある版に揃え、3D 地形・陰影図機能を維持したい**
**そうすることで** メジャーアップ後も既存機能（terrain / hillshade）を失わずに済む

**関連要件**: REQ-005, REQ-102, REQ-301, EDGE-001

**詳細シナリオ**:
1. `maplibre-gl` の最新メジャーを採用候補とする。
2. `maplibre-gl-gsi-terrain` の対応版を確認する。
3. (a) 対応版があればそれを採用、(b) なければ `maplibre-gl` を一段戻して整合させる。
4. `useGsiTerrainSource(maplibregl.addProtocol)` 呼び出しがエラーなく動作することを確認する（初期ロード時の例外がないこと）。
5. `TerrainControl` で 3D 表示を ON にし、陰影が出ることを目視確認する。

**前提条件**:
- 採用判断と理由を記録する（REQ-302）。

**優先度**: Must Have
**備考**: 互換版がない場合は EDGE-001（一時無効化 + TODO 化）に分岐する判断をユーザーに確認する必要あり（[interview-record.md](interview-record.md) D6 残課題）。

---

### ストーリー 2.2: @turf/distance v7 への移行を最小差分で完了する 🔵

**信頼性**: 🔵 *main.js 行10 + メモ [[project_001_false_green_build]] より*

**私は** 実装者 **として**
**`@turf/distance` を v7 系最新へ更新したい**
**そうすることで** 最寄り避難所計算機能の依存を最新化できる

**関連要件**: REQ-001, REQ-405

**詳細シナリオ**:
1. `@turf/distance` を最新版に更新する。
2. 既存の `import distance from '@turf/distance'`（default import）を維持する。
3. `distance([lon, lat], feature.geometry.coordinates)` の呼び出しが破壊変更を受けていないか確認する（呼び出し形・戻り値の単位）。
4. ズーム 7 以上で GeolocateControl ON のとき、`route-layer` のラインが描画されることを目視確認する。

**優先度**: Must Have

---

### ストーリー 2.3: Vite メジャーアップで Node 要件を更新する 🔵

**信頼性**: 🔵 *ヒアリング Q6 = (i) で記載先確定*

**私は** 新規参画者 **として**
**Vite の新メジャーが要求する Node.js バージョンを `docs/tech-stack.md` から把握したい**
**そうすることで** ローカル環境を整えてから `npm install` できる

**関連要件**: REQ-103

**詳細シナリオ**:
1. Vite 新メジャーの要求 Node.js バージョンを確認する。
2. `docs/tech-stack.md` の「セットアップ手順」節に Node.js 最低バージョンを記載する（記載先確定済み）。
3. `package.json` の `engines.node` 追加はスコープ外。

**優先度**: Should Have

---

### ストーリー 2.4: `_watchState` 非公開 API 依存を恒久撤去する 🔵

**信頼性**: 🔵 *ヒアリング Q5 = (i)、main.js 行545 / 542-554*

**私は** 実装者 **として**
**`main.js` 行545 の `geolocationControl._watchState === 'OFF'` 直接参照を、`maplibre-gl` の公開イベント（`trackuserlocationend` 等）に置き換えたい**
**そうすることで** MapLibre メジャーアップ時の内部実装変更で route 描画が壊れるリスクを恒久的に取り除ける

**関連要件**: REQ-501, REQ-403（スコープ例外として明記済み）, EDGE-002

**詳細シナリオ**:
1. 採用版の `maplibre-gl` で `GeolocateControl` が発火する公開イベント（`trackuserlocationstart` / `trackuserlocationend` 等）を API ドキュメントで確認する。
2. `geolocationControl.on('trackuserlocationend', ...)` で `userLocation = null` をセットし、`route` source を空 FeatureCollection に戻す。
3. `render` リスナー内の `if (geolocationControl._watchState === 'OFF') userLocation = null;` を削除する。
4. `grep _watchState main.js` が 0 件であることを確認する。
5. ON → OFF 切り替えで青ライン（`route-layer`）が消えることを実機で目視確認する。

**前提条件**:
- 採用する `maplibre-gl` バージョンで対応イベントが提供されていること（v2.x 系でも `trackuserlocationend` は提供されており、v3/v4/v5 でも維持されている前提）。

**制約事項**:
- 本書き換えは REQ-403 のスコープ厳密化の **例外** として明示的に許可される（ヒアリング Q5）。他の refactor は含めない。

**優先度**: Must Have

---

## エピック3: 偽 green / UI 回帰を防ぐ検証

### ストーリー 3.1: クリーン環境でビルドを再現する 🔵

**信頼性**: 🔵 *メモ [[project_001_false_green_build]] より*

**私は** レビュアー **として**
**「ローカルで通る」と「クリーン環境で通る」を別物として扱いたい**
**そうすることで** 偽 green を防げる

**関連要件**: REQ-002, NFR-302

**詳細シナリオ**: ストーリー 1.2 と同じ。レビュー時の必須ゲートとして扱う。

**優先度**: Must Have

---

### ストーリー 3.2: UI 挙動を実機で確認する 🔵

**信頼性**: 🔵 *メモ [[feedback_verify_ui_at_runtime]] より*

**私は** レビュアー **として**
**バージョンアップ後の UI/インタラクションを実ブラウザで確認したい**
**そうすることで** 静的ソース解析だけでは検出できない描画・操作の回帰を防げる

**関連要件**: REQ-005, NFR-201, NFR-202

**詳細シナリオ**: ストーリー 1.3 のチェック項目を、`npm run preview`（`npm run build` 後）でも実施する。

**優先度**: Must Have

---

## ストーリーマップ

```
エピック1: 依存パッケージを安全に最新化する
├── 1.1 最新化された build が通る (🔵 Must Have)
├── 1.2 クリーン環境で再現可能 (🔵 Must Have)
└── 1.3 開発サーバーで地図が描画される (🔵 Must Have)

エピック2: 破壊的変更への適応
├── 2.1 MapLibre addProtocol 仕様変化に追随 (🟡 Must Have)
├── 2.2 @turf v7 を最小差分で導入 (🔵 Must Have)
├── 2.3 Vite メジャーアップで Node 要件更新 (🔵 Should Have)
└── 2.4 _watchState 非公開API依存を恒久撤去 (🔵 Must Have)

エピック3: 偽 green / UI 回帰を防ぐ検証
├── 3.1 クリーン環境ビルド再現 (🔵 Must Have)
└── 3.2 UI 実機確認 (🔵 Must Have)
```

## 信頼性レベルサマリー

- 🔵 青信号: 7 件 (87.5%)
- 🟡 黄信号: 1 件 (12.5%)
- 🔴 赤信号: 0 件 (0%)

**品質評価**: 高品質（ヒアリング Q1〜Q7 で多くの判断が確定。残る 🟡 はストーリー 2.1（`addProtocol` 仕様変化への追随）に集約）。
