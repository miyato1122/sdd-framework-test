## Context

本リポジトリは Vite 製の単一ページアプリで、`maplibre-gl` を中心としたハザードマップ + 指定緊急避難場所ビューアを実装している。`package.json` の依存は初版コミット時点のもので、`maplibre-gl@^2.4.0` / `vite@^3.2.0` / `maplibre-gl-gsi-terrain@^0.0.2` などが固定されている。

現状でも `npm install` 自体は通るが、

- 利用者の Node.js が新しい（例: v24）一方、Vite 3 は古い `esbuild` を引き、警告 / 実行時不整合の温床になる。
- `maplibre-gl-gsi-terrain` の `0.0.2` は MapLibre v2 系の旧 `addProtocol` 仕様に依存しており、最新版（v2.3 系）はメジャーバージョンが乖離している。
- `@turf/distance` も v6 系で型定義 / ESM サポートが古い。

後続の検証作業（新機能実装・Nuxt 移行）の前提として、依存を一度「最新かつ相互に整合する組み合わせ」に揃え、`main.js` の挙動を変えずにビルドとランタイム双方で動くことを保証する必要がある。

主要ステークホルダーはリポジトリオーナー（検証担当）一名であり、デプロイ運用はない（ローカル `npm run dev` と `npm run build` の成功確認が完了基準）。

## Goals / Non-Goals

**Goals:**

- `dependencies` / `devDependencies` をすべて 2026-05 時点の最新安定版に更新し、`npm install` がピア依存警告なしで完了する。
- `npm run build` が成功し、`dist/` 配下に成果物が生成される。
- `npm run dev` で起動した開発サーバー上で、地図表示・OSM 背景・ハザードマップ重ね合わせ・指定緊急避難場所レイヤー切替・現在地→最寄り避難場所ライン描画・3D 地形コントロールが従前どおり動作する。
- 既存の機能挙動・UI を変更しない（依存更新のための互換修正のみ）。
- 動作要件（Node.js バージョン等）を `README.md` に明示する。

**Non-Goals:**

- 新機能（背景地図切替など）の追加。
- ソースのリファクタリング（TypeScript 化・モジュール分割・命名統一など）。
- Nuxt や他フレームワークへの移行。
- CI / Lint / テスト基盤の整備。
- `public/skhb` のベクトルタイルデータの差し替え。

## Decisions

### 1. ターゲットバージョンは「2026-05 時点の最新安定版」に固定する

| パッケージ                  | 現行       | ターゲット | 種別      |
| --------------------------- | ---------- | ---------- | --------- |
| `maplibre-gl`               | `^2.4.0`   | `^5.24.0`  | major x3  |
| `maplibre-gl-gsi-terrain`   | `^0.0.2`   | `^2.3.2`   | rewrite   |
| `maplibre-gl-opacity`       | `^1.4.0`   | `^1.8.0`   | minor     |
| `@turf/distance`            | `^6.5.0`   | `^7.3.5`   | major x1  |
| `vite`                      | `^3.2.0`   | `^8.0.12`  | major x5  |

代替案として「LTS 寄りの 1 つ前のメジャー（例: Vite 5、MapLibre 4）に止める」も検討したが、

- 本リポジトリは検証用途で、長期 LTS を担う本番運用が存在しない。
- 後続の Nuxt 化検証では最新エコシステムが前提になりやすい。
- `maplibre-gl-gsi-terrain` v2 系がすでに `maplibre-gl` v4+ を要求しているため、結局メジャーを 1 つは跨ぐ。

ことから、一度に最新まで揃える方が後の負債が少ないと判断する。

### 2. `npm install` ではなく `package.json` を直接書き換えてからロックを再生成する

`npm install <pkg>@latest` を順に叩くと中間バージョンでピア依存衝突を起こしやすい。本変更では:

1. `package.json` の各バージョン指定をターゲット値（上表）に書き換える。
2. `node_modules/` と `package-lock.json` を削除する。
3. `npm install` を 1 回だけ実行して、整合したツリーを再構築する。

の手順を取る。これにより、ピア依存解決を npm の単一トランザクションに任せ、中間状態の不整合を回避する。

### 3. ランタイムコードの変更は「v5 API への必要最小限の追従」に限定する

`main.js` を精査した結果、`maplibre-gl` v2 → v5 の差分のうち本コードに直接影響する API は、調査時点で確認した範囲では存在しない:

- `maplibregl.Map` / `addControl` / `addSource` / `addLayer` / `getStyle` / `querySourceFeatures` / `queryRenderedFeatures` / `getSource` / `setData` / `on('load' | 'click' | 'mousemove' | 'render')` / `Popup` / `GeolocateControl` / `TerrainControl` — v5 でも同一シグネチャで提供される。
- `addProtocol` は v4 以降 Promise ベースに変更されたが、本コードでは `useGsiTerrainSource(maplibregl.addProtocol)` 経由でしか参照しておらず、`maplibre-gl-gsi-terrain` v2 が新 API に追従済み。
- `import 'maplibre-gl/dist/maplibre-gl.css'` の CSS パスは v5 でも維持されている。
- `@turf/distance` v7 は default export を継続提供しているため、`import distance from '@turf/distance'` はそのまま動作する。

そのため、原則として `main.js` は無変更で動くと想定する。検証で動かない箇所が見つかった場合のみ、その箇所をピンポイントで修正する（修正範囲は `tasks.md` の検証フェーズ内で扱う）。

代替案として「v5 移行に合わせて main.js 全体をリファクタする」も考えたが、非ゴールに反するため不採用。

### 4. Node.js 要件は README に明示する（`engines` は当面追加しない）

Vite 8 は Node.js `^20.19.0 || >=22.12.0` を要求する。`package.json` の `engines` フィールドで強制する案もあるが、

- 検証担当が単一でローカル運用のみ。
- `engines` を厳格化すると npm 8 系で warning だけだが、後段ツール（pnpm / yarn）でエラーになるケースがあり過剰。

ことから、README 側に「Node.js >= 20.19」を要件として記載するに留める。

## Risks / Trade-offs

- [maplibre-gl v2 → v5 の暗黙的破壊的変更] → `main.js` の主要な API は v5 でも提供されることを確認済みだが、スタイル仕様（`style.layers[].layout.visibility` の文字列値の扱いなど）に微細な差異がある可能性がある。`tasks.md` で「dev サーバー起動 + 主要操作の目視確認」を必須ステップとして組み込み、回帰を早期検知する。
- [vite 3 → 8 のビルド出力差] → `--base=./` の相対パス出力は v8 でもサポート継続。ただし `dist/` 内のアセット配置が変わる可能性があるため、`dist/index.html` を開いて読み込めることを確認する。
- [`maplibre-gl-gsi-terrain` v0 → v2 で内部実装が刷新] → API シグネチャ（`useGsiTerrainSource(maplibregl.addProtocol, options?)`）は現行コードと一致する。万一動作しない場合は `tileUrl` / `attribution` を明示する形に切り替える（design レベルでは対応案を持つだけ、tasks では検証時点で発生時のみ実施）。
- [Node.js バージョン不一致] → 検証担当の手元 Node が 20.19 未満の場合、Vite 8 のインストール段階で失敗する。`tasks.md` の冒頭で `node --version` を確認するステップを置く。
- [ロックファイル形式変更] → npm 7+ で `lockfileVersion: 3` に揃う。git diff が大きくなるが、レビュー観点では問題なし。
- [非互換が見つかった場合のロールバック] → 各依存はコミット単位で `package.json` / `package-lock.json` をひとつにまとめる方針なので、`git revert` で容易に戻せる。`node_modules/` は再インストールで再現する。

## Migration Plan

1. 事前確認: `node --version` が 20.19 以上であることを確認する。満たさない場合は Node を更新してから着手する。
2. `package.json` の依存バージョンを一括でターゲット値に書き換える。
3. `node_modules/` および `package-lock.json` を削除する。
4. `npm install` を実行し、警告・エラーが無いことを確認する。
5. `npm run dev` を起動し、ブラウザで以下を目視確認する:
   - 地図が表示される（OSM タイル）。
   - 左上 OpacityControl からハザードマップを ON/OFF できる。
   - 右上 OpacityControl から指定緊急避難場所レイヤーを切替できる。
   - 現在地許可後、ズーム >=7 で現在地と最寄り避難場所が線で結ばれる。
   - 右下に追加される `TerrainControl` で 3D 地形をトグルでき、陰影が描画される。
   - クリック / ホバー時のポップアップ・カーソル変更が動く。
6. `npm run build` を実行し、`dist/` が生成されることを確認する。`npm run preview` でビルド成果物を起動し、上記項目を再確認する。
7. `README.md` の検証内容欄に「ライブラリのバージョンアップ: 完了（YYYY-MM-DD）」と Node.js 要件を追記する。
8. 変更内容（`package.json` / `package-lock.json` / 必要に応じて `main.js` / `README.md`）をコミットする。

ロールバック: `git revert` で 1 コミット戻し、`rm -rf node_modules && npm install` で再構築する。

## Open Questions

- 検証中に v5 互換性で `main.js` の修正が必要になった場合、その修正範囲を本 change に含めるか、別 change として切り出すか。本 design では「最小限の互換修正」までは本 change 内で扱う方針とする。
- `dist/` を git 管理から外すか否かは別 change の検討事項とし、本変更では現状（git 管理されている）を維持して再生成のみ行う。
