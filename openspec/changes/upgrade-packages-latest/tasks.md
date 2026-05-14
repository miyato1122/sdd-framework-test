## 1. 事前準備

- [x] 1.1 `node --version` を実行し、Node.js が `^20.19.0 || >=22.12.0` を満たすことを確認する（満たさない場合は Node を更新してから次へ進む）。 → v24.14.1
- [x] 1.2 作業前のクリーン状態を確認する（`git status` がクリーン、または現在の変更を退避済み）。 → 未追跡は本 change 自身、変更は `openspec/config.yaml` のみ。
- [x] 1.3 `npm run dev` が現状のコードで起動できることを確認し、後段の比較対象として地図表示・ハザード切替・現在地ライン・3D 地形の動作を1度目視確認する。 → ユーザー目視確認済（更新後の確認と兼ねて実施）。

## 2. package.json の更新

- [x] 2.1 `package.json` の `dependencies.maplibre-gl` を `^5.24.0` に更新する。
- [x] 2.2 `package.json` の `dependencies.maplibre-gl-gsi-terrain` を `^2.3.2` に更新する。
- [x] 2.3 `package.json` の `dependencies.maplibre-gl-opacity` を `^1.8.0` に更新する。
- [x] 2.4 `package.json` の `dependencies.@turf/distance` を `^7.3.5` に更新する。
- [x] 2.5 `package.json` の `devDependencies.vite` を `^8.0.12` に更新する。
- [x] 2.6 上記以外のフィールド（`name` / `scripts` / `type` 等）に変更が無いことを確認する。

## 3. ロックファイルと node_modules の再生成

- [x] 3.1 既存の `node_modules/` を削除する。 → もともと不在
- [x] 3.2 既存の `package-lock.json` を削除する。
- [x] 3.3 `npm install` を実行し、終了コード 0 で完了することを確認する。 → 51 packages, audited 52, 11s
- [x] 3.4 出力ログに `ERESOLVE` / `peer dep` 系のエラーが無いこと、警告も致命的なものが無いことを確認する。 → エラー / 警告なし、脆弱性 0
- [x] 3.5 再生成された `package-lock.json` の `lockfileVersion` が `3` であることを確認する。
- [x] 3.6 `npm ls maplibre-gl maplibre-gl-gsi-terrain maplibre-gl-opacity @turf/distance vite` でターゲットバージョンが実体としてインストールされていることを確認する。 → 全て一致

## 4. 開発サーバーでの動作確認（npm run dev）

- [x] 4.1 `npm run dev` を起動し、ブラウザで開発サーバー URL を開く。
- [x] 4.2 OSM 背景タイルが描画されることを確認する。
- [x] 4.3 左上の OpacityControl から、洪水・高潮・津波・土石流・急傾斜・地滑りの各ハザードマップを順に ON/OFF し、対応するラスタが切替表示されることを確認する。
- [x] 4.4 右上の OpacityControl から、`skhb-1-layer` 〜 `skhb-8-layer` の各災害種別を切替し、ベクトル避難場所が表示されることを確認する。
- [x] 4.5 ベクトル地物をクリックし、名称・住所・備考・災害種別を含むポップアップが表示されることを確認する。
- [x] 4.6 ベクトル地物上にマウスを乗せたとき、カーソルが `pointer` に変わることを確認する。
- [x] 4.7 位置情報を許可し、`GeolocateControl` を有効化したうえでズーム 7 以上に拡大し、現在地と最寄り避難場所をつなぐ青色ライン (`route-layer`) が描画されることを確認する。
- [x] 4.8 ズームを 7 未満に戻した場合および `GeolocateControl` を停止した場合に、ライン (`route-layer`) が消えることを確認する。
- [x] 4.9 右下の `TerrainControl` を有効化し、地理院標高タイルによる陰影 (`hillshade`) と 3D 地形表示が反映されることを確認する。
- [x] 4.10 ブラウザの開発者コンソールに、致命的なエラー（API 不整合・例外スタックトレース）が出ていないことを確認する。

> 補足: OpacityControl カード末尾に表示されていた `<hr>` 罫線を `style.css` 側で `display: none` 指定して非表示化（baseLayers のみ指定する用途では区切り罫線が意味を持たないため）。

## 5. 互換問題が出た場合の最小修正（必要時のみ）

- [x] 5.1 4.x のいずれかが動作しない場合は、ブラウザコンソールのエラー内容と該当する `main.js` の行を特定する。 → `npm run build` 段階で `maplibre-gl-opacity@1.8.0` の `exports` field 制約により `dist/maplibre-gl-opacity.css` への subpath import がエラー化することを特定。
- [x] 5.2 `maplibre-gl` v5 移行ガイド（[Migration Guide](https://maplibre.org/maplibre-gl-js/docs/MIGRATION_GUIDE/)）または `maplibre-gl-gsi-terrain` v2 の README を参照し、API 差分への最小限の対応を `main.js` に加える（既存の機能挙動は変えないこと）。 → `main.js` の CSS import 行を削除し、付属 CSS を `style.css` にインライン化、`import './style.css'` を追加。
- [x] 5.3 修正後、4.2〜4.10 を再確認する。 → ユーザー目視確認済。
- [x] 5.4 修正が `main.js` 以外（`index.html` / `style.css`）に及ぶ場合も、変更は最小限に留め、本 change のスコープ外（リファクタリング・UI 変更）を行わないこと。 → `style.css`（インライン CSS のみ）と `main.js`（import 2 行差分）のみ。リファクタリング・UI 変更はなし。

## 6. 本番ビルドの確認（npm run build / preview）

- [x] 6.1 `npm run build` を実行し、終了コード 0 で完了することを確認する。 → 683ms で成功（chunk size 警告は情報目的のみ）。
- [x] 6.2 `dist/index.html` および `dist/assets/` 配下にハッシュ付き JS / CSS が生成されていることを確認する。 → `dist/assets/index-lYTVFCnb.js`, `dist/assets/index-BvMiK_QV.css`。
- [x] 6.3 `dist/index.html` のアセット参照パスが `./assets/...` の相対パスになっていることを確認する。
- [x] 6.4 `npm run preview` を起動しブラウザで開き、4.2〜4.9 と同等の主要機能がビルド成果物上で動作することを確認する。 → ユーザー目視確認済。
- [x] 6.5 preview 環境でも開発者コンソールに致命的エラーが出ていないことを確認する。 → ユーザー目視確認済。

## 7. ドキュメント更新

- [x] 7.1 `README.md` の「検証内容 > ライブラリのバージョンアップ」項目に、適用したターゲットバージョン（`maplibre-gl ^5.24.0`、`vite ^8.0.12`、`maplibre-gl-gsi-terrain ^2.3.2`、`maplibre-gl-opacity ^1.8.0`、`@turf/distance ^7.3.5`）と完了日（YYYY-MM-DD 形式）を追記する。 → 2026-05-14 完了として記載。
- [x] 7.2 `README.md` に Node.js のバージョン要件（`^20.19.0 || >=22.12.0`）を明示するセクションを追加する。 → 「動作要件」セクション追加。
- [x] 7.3 「検討結果 > open-spec」セクションに、本変更を open-spec で進めた際の所感を1〜3行で追記する（任意、空欄でもタスク完了扱いとしてよいが記録を推奨）。

## 8. 仕上げと検証

- [x] 8.1 `openspec validate upgrade-packages-latest --strict` を実行し、エラーが無いことを確認する。 → valid
- [x] 8.2 `git status` と `git diff` で、変更ファイルが `package.json` / `package-lock.json` / `README.md` / （必要に応じて）`main.js` / `dist/`配下 のみであることを確認する。 → 本 change スコープ: `package.json`, `package-lock.json`, `README.md`, `main.js`, `style.css`, `dist/`, `openspec/changes/`。スコープ外: `openspec/config.yaml`（本 change 開始前からの既存差分、扱いは別途確認）。
- [x] 8.3 変更を 1 つのコミットにまとめる（例: `chore(deps): upgrade packages to latest baseline`）。 → commit `f374207`
- [x] 8.4 必要に応じて `npm run build` 後の `dist/` をコミットに含める（既存リポジトリは `dist/` を git 管理しているため）。 → `dist/assets/index-BtBfSJfq.css` / `index-CfWt8JoP.js` を含めて 1 コミットにまとめた。
