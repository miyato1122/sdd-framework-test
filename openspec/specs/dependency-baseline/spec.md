# dependency-baseline Specification

## Purpose

プロジェクトの依存パッケージのターゲットバージョン、動作要件（Node.js バージョン等）、および更新後にビルド・ランタイム双方で満たすべき検証基準を定義するケイパビリティ。

## Requirements

### Requirement: 依存パッケージのターゲットバージョンを最新安定版に固定する

本プロジェクトの `package.json` は、以下のターゲットバージョン（2026-05 時点の最新安定版）以上を SemVer のキャレット指定（`^`）で満たさなければならない（SHALL）。

| パッケージ                | フィールド          | 指定                |
| ------------------------- | ------------------- | ------------------- |
| `maplibre-gl`             | `dependencies`      | `^5.24.0`           |
| `maplibre-gl-gsi-terrain` | `dependencies`      | `^2.3.2`            |
| `maplibre-gl-opacity`     | `dependencies`      | `^1.8.0`            |
| `@turf/distance`          | `dependencies`      | `^7.3.5`            |
| `vite`                    | `devDependencies`   | `^8.0.12`           |

これらより古いバージョン指定が `package.json` に残っていてはならない（MUST NOT）。

#### Scenario: package.json がターゲット指定を満たす

- **WHEN** `package.json` の `dependencies` / `devDependencies` を確認する
- **THEN** 上記表のすべてのパッケージが、それぞれ指定された範囲指定で記載されている

#### Scenario: 旧バージョン指定が残っていない

- **WHEN** `package.json` に `maplibre-gl@^2`, `vite@^3`, `@turf/distance@^6`, `maplibre-gl-gsi-terrain@^0.0` のような旧範囲指定が存在するか確認する
- **THEN** いずれも存在しない

### Requirement: npm install がエラー・ピア依存衝突なしで完了する

クリーン状態（`node_modules/` と `package-lock.json` を削除した状態）から `npm install` を実行したとき、システムは依存解決を完了し、`ERESOLVE` / `peer dep` 不整合エラーを発生させてはならない（MUST NOT）。`npm install` 完了後、`package-lock.json` が `lockfileVersion: 3` で再生成されていなければならない（SHALL）。

#### Scenario: クリーンインストールが成功する

- **WHEN** `node_modules/` と `package-lock.json` を削除した上で `npm install` を実行する
- **THEN** 終了コード 0 で完了し、`ERESOLVE` を含むエラーが出力されない

#### Scenario: ロックファイルが v3 で再生成される

- **WHEN** `npm install` 完了後に `package-lock.json` を確認する
- **THEN** `lockfileVersion` フィールドの値が `3` である

### Requirement: 開発サーバーが起動し主要機能が回帰なく動作する

`npm run dev` を起動したとき、システムは Vite 開発サーバーを起動し、ブラウザ上で次の機能が更新前と同等に動作しなければならない（SHALL）:

- 初期マップ表示（OSM 背景タイル、中心 `[138, 37]`、ズーム 5）
- 左上 `OpacityControl` によるハザードマップ（洪水・高潮・津波・土石流・急傾斜・地滑り）の表示切替
- 右上 `OpacityControl` による指定緊急避難場所（`skhb-1-layer` 〜 `skhb-8-layer`）の表示切替
- `GeolocateControl` による現在地取得と、ズーム 7 以上での「現在地 → 最寄り避難場所」ライン描画
- `TerrainControl` による 3D 地形のトグル、および `hillshade` レイヤーの描画
- ベクトルタイル上の地物に対するクリック時ポップアップ表示・ホバー時カーソル変更

#### Scenario: dev サーバー起動と地図描画

- **WHEN** `npm run dev` で起動した開発サーバーをブラウザで開く
- **THEN** 画面に MapLibre の地図が描画され、OSM 背景タイルが読み込まれている

#### Scenario: ハザードマップの重ね合わせが切替できる

- **WHEN** 左上の OpacityControl から任意のハザードマップを ON にする
- **THEN** 対応するレイヤーが表示され、再度 OFF にすると非表示に戻る

#### Scenario: 現在地と最寄り避難場所のラインが描画される

- **WHEN** ブラウザの位置情報を許可し、地図ズームを 7 以上に拡大する
- **THEN** 現在地と、有効化中の `skhb-*-layer` 内で最も近い地物との間に青いライン (`route-layer`) が描画される

#### Scenario: 3D 地形コントロールが機能する

- **WHEN** 右下に追加された `TerrainControl` を有効化する
- **THEN** 地理院標高タイルを用いた陰影 (`hillshade`) と 3D 地形表示が反映される

### Requirement: 本番ビルドが成功し成果物がブラウザで表示できる

`npm run build` を実行したとき、システムは Vite v8 で `dist/` 配下に成果物を生成しなければならない（SHALL）。`npm run preview` でその成果物を提供したとき、開発サーバーと同じ主要機能が動作しなければならない（SHALL）。`--base=./` 指定により、生成された HTML / JS / CSS は相対パス参照になっていなければならない（SHALL）。

#### Scenario: ビルドが成功する

- **WHEN** `npm run build` を実行する
- **THEN** 終了コード 0 で完了し、`dist/index.html`、`dist/assets/` 配下にハッシュ付き JS / CSS が生成される

#### Scenario: preview サーバーで成果物が動作する

- **WHEN** `npm run preview` を起動しブラウザで開く
- **THEN** 地図が描画され、dev サーバーで確認した主要機能（ハザードマップ切替・現在地ライン・3D 地形）がすべて動作する

#### Scenario: 相対パスでアセットが解決される

- **WHEN** `dist/index.html` を直接開く、または任意のサブパスから配信する
- **THEN** JS / CSS / 画像アセットが `./assets/...` 形式の相対パスから読み込まれる

### Requirement: ランタイム環境要件を文書化する

本プロジェクトは Node.js のバージョン要件として `^20.19.0 || >=22.12.0` を必要とし、その旨を `README.md` に明示しなければならない（SHALL）。

#### Scenario: README に Node.js 要件が記載される

- **WHEN** `README.md` を確認する
- **THEN** Node.js のバージョン要件（`^20.19.0 || >=22.12.0` 以上）が明記されている

#### Scenario: 検証完了の記録が残る

- **WHEN** バージョンアップ作業完了後の `README.md` を確認する
- **THEN** 「検証内容 > ライブラリのバージョンアップ」項目に、完了日と適用したターゲットバージョンへの言及がある
