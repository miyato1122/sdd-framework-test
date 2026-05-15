## MODIFIED Requirements

### Requirement: 依存パッケージのターゲットバージョンを最新安定版に固定する

本プロジェクトの `package.json` は、以下のターゲットバージョン（2026-05 時点の最新安定版）以上を SemVer のキャレット指定（`^`）で満たさなければならない（SHALL）。

| パッケージ                | フィールド          | 指定                |
| ------------------------- | ------------------- | ------------------- |
| `maplibre-gl`             | `dependencies`      | `^5.24.0`           |
| `maplibre-gl-gsi-terrain` | `dependencies`      | `^2.3.2`            |
| `@turf/distance`          | `dependencies`      | `^7.3.5`            |
| `vite`                    | `devDependencies`   | `^8.0.12`           |

これらより古いバージョン指定が `package.json` に残っていてはならない（MUST NOT）。

`maplibre-gl-opacity` は本変更で自作の災害情報統合コントロールに置き換えられたため、`package.json` の `dependencies` から削除しなければならない（SHALL）。`package.json` の `dependencies` または `devDependencies` に `maplibre-gl-opacity` が残っていてはならない（MUST NOT）。

#### Scenario: package.json がターゲット指定を満たす

- **WHEN** `package.json` の `dependencies` / `devDependencies` を確認する
- **THEN** 上記表のすべてのパッケージが、それぞれ指定された範囲指定で記載されている

#### Scenario: 旧バージョン指定が残っていない

- **WHEN** `package.json` に `maplibre-gl@^2`, `vite@^3`, `@turf/distance@^6`, `maplibre-gl-gsi-terrain@^0.0` のような旧範囲指定が存在するか確認する
- **THEN** いずれも存在しない

#### Scenario: maplibre-gl-opacity 依存が削除されている

- **WHEN** `package.json` の `dependencies` および `devDependencies` を確認する
- **THEN** `maplibre-gl-opacity` のエントリが存在しない

### Requirement: 開発サーバーが起動し主要機能が回帰なく動作する

`npm run dev` を起動したとき、システムは Vite 開発サーバーを起動し、ブラウザ上で次の機能が更新前と同等に動作しなければならない（SHALL）:

- 初期マップ表示（OSM 背景タイル、中心 `[138, 37]`、ズーム 5）
- 左上の災害情報統合コントロールによるハザードマップ（洪水・高潮・津波・土石流・急傾斜・地滑り）の表示切替
- 左上の災害情報統合コントロールによる指定緊急避難場所（`skhb-1-layer` 〜 `skhb-8-layer`）の表示切替
- `GeolocateControl` による現在地取得と、ズーム 7 以上での「現在地 → 最寄り避難場所」ライン描画
- `TerrainControl` による 3D 地形のトグル、および `hillshade` レイヤーの描画
- ベクトルタイル上の地物に対するクリック時ポップアップ表示・ホバー時カーソル変更

#### Scenario: dev サーバー起動と地図描画

- **WHEN** `npm run dev` で起動した開発サーバーをブラウザで開く
- **THEN** 画面に MapLibre の地図が描画され、OSM 背景タイルが読み込まれている

#### Scenario: ハザードマップの重ね合わせが切替できる

- **WHEN** 左上の災害情報統合コントロールの災害想定区域セクションで任意のハザードマップを選択する
- **THEN** 対応するレイヤーが表示され、「なし」に戻すと非表示に戻る

#### Scenario: 現在地と最寄り避難場所のラインが描画される

- **WHEN** ブラウザの位置情報を許可し、地図ズームを 7 以上に拡大する
- **THEN** 現在地と、有効化中の `skhb-*-layer` 内で最も近い地物との間に青いライン (`route-layer`) が描画される

#### Scenario: 3D 地形コントロールが機能する

- **WHEN** 右下に追加された `TerrainControl` を有効化する
- **THEN** 地理院標高タイルを用いた陰影 (`hillshade`) と 3D 地形表示が反映される
