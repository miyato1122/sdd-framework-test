# Phase 1 データモデル: 依存ライブラリの最新化

本機能はアプリのデータエンティティを追加しない（保守タスク、spec に Key
Entities なし）。代わりに、本タスクの「モデル」は **(A) 依存アップグレード
マトリクス** と **(B) 非回帰挙動インベントリ**（=守るべき観測可能な振る舞いの
集合）である。

## A. 依存アップグレードマトリクス

| パッケージ | 種別 | 現状 | 目標 | 状態遷移 | 検証 |
|---|---|---|---|---|---|
| vite | devDep | `^3.2.0` | `^8.0.13` | 設定維持・engines 追加 | build/dev 成功 |
| maplibre-gl | dep | `^2.4.0` | `^5.24.0` | 内部API置換・スタイル確認 | スモーク全項目 |
| @turf/distance | dep | `^6.5.0` | `^7.3.5` | default→named import | unit テスト |
| maplibre-gl-opacity | dep | `^1.4.0` | `^1.8.0` | そのまま | スモーク（不透明度UI） |
| maplibre-gl-gsi-terrain | dep | `^0.0.2` | `^2.3.2` | addProtocol連携調整 / 不可なら据置or代替 | スモーク（地形/陰影） |
| (engines) | meta | 未設定 | `node ^20.19.0 \|\| >=22.12.0` | package.json 追加＋README整合 | ドキュメント整合 |

**不変条件**:
- `package-lock.json` が再生成され、`npm ci` 相当で再現可能（憲章: 再現性）。
- 既知の高～重大脆弱性 0（残存時は理由を記録）。

## B. 非回帰挙動インベントリ（守るべき観測可能挙動）

`main.js` 静的解析から抽出。各項目はアップグレード前後で同一であること。

| ID | 機能 | 観測点 | 関連 import / API |
|---|---|---|---|
| B1 | 初期地図表示 | 中心[138,37]/zoom5、minZoom5/maxZoom18、maxBounds 内、OSM 背景 | maplibre-gl |
| B2 | ハザード重ね合わせ | 6 種ハザード(洪水/高潮/津波/土石流/急傾斜/地滑り)を左上 OpacityControl で表示・不透明度操作 | maplibre-gl-opacity |
| B3 | 指定緊急避難場所(skhb) | 右上 OpacityControl で災害種別 8 レイヤー切替、ベクトルタイル円表示 | maplibre-gl / `public/skhb` |
| B4 | クリックポップアップ | skhb クリックで名称/住所/備考/対応災害の HTML ポップアップ（max 400px） | `Popup` |
| B5 | ホバーカーソル | skhb 上で `pointer`、外で既定 | `queryRenderedFeatures` |
| B6 | 現在地取得 | 右下 GeolocateControl、`trackUserLocation`、位置更新で `userLocation` 反映 | `GeolocateControl` |
| B7 | 最寄り施設ライン | zoom≥7 かつ現在地ありで、現在地↔最寄り skhb を青線(`#33aaff`,幅4)描画。OFF/zoom<7/未取得で消去 | `@turf/distance`, render |
| B8 | 最寄り選定ロジック | 表示中 skhb レイヤーの filter で対象抽出 → 距離最小の地物選定 | `getCurrentSkhbLayerFilter` / `getNearestFeature`（純粋寄り＝unit テスト対象） |
| B9 | 3D 地形・陰影 | 地理院標高タイルで `hillshade`（exaggeration 0.2、jisuberi 手前）＋ TerrainControl(3D トグル) | maplibre-gl-gsi-terrain |
| B10 | PWA | `manifest.json` 読込、`sw.js` ServiceWorker 登録、ビルド成果物が `--base=./` で動作 | index.html / vite |

**自動テスト対象**: B8（および B7 の距離計算部分）— `@turf/distance` v7 化の
影響を直接受ける純粋ロジック。それ以外（B1–B7,B9,B10 の地図描画/ブラウザ API
依存部）は contracts の手動スモークで検証（憲章 II の許容範囲）。
