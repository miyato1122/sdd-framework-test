# ライブラリバージョンアップ コンテキストノート

**作成日**: 2026-05-20
**要件名（kebab-case）**: `library-version-upgrade`
**生成元コマンド**: `/tsumiki:kairo-requirements`

## 1. プロジェクトの位置づけ

- SDD フレームワーク（git-spec / cc-sdd / tsumiki / open-spec）比較演習用の素材プロジェクト（書籍「位置情報アプリケーション開発」応用編サンプル相当） 🔵 *README.md より*
- 本要件は README の検証内容 **「1. ライブラリのバージョンアップ」** に対応 🔵 *README.md より*

## 2. 現行スタック（変更前）

`package.json` 実測値：

| 種別 | パッケージ | 現行 | 区分 |
|------|------------|------|------|
| dev | `vite` | `^3.2.0` | ビルド／開発サーバー |
| dep | `maplibre-gl` | `^2.4.0` | 地図ライブラリ |
| dep | `maplibre-gl-opacity` | `^1.4.0` | 不透明度コントロール |
| dep | `maplibre-gl-gsi-terrain` | `^0.0.2` | GSI 標高タイル → terrain |
| dep | `@turf/distance` | `^6.5.0` | 地点間距離 |

🔵 *package.json より*

詳細は [docs/tech-stack.md](../../tech-stack.md) を参照。

## 3. 既存実装で使用している API（バージョンアップ時の影響面）

`main.js` から抽出。バージョン更新で破壊的変更が起きうる箇所：

- `import maplibregl from 'maplibre-gl'` / `'maplibre-gl/dist/maplibre-gl.css'` — v5 で CSS パスは維持。 🔵 *main.js 行2-3*
- `new maplibregl.Map({...})` — `version: 8` style、`tiles`/`tileSize`/`attribution` 指定の raster/vector ソース、`layers[].layout.visibility`、データ駆動 `circle-radius`（`interpolate`）など。 🔵 *main.js 行15-366*
- `maplibregl.Popup().setLngLat().setHTML(...).setMaxWidth().addTo(map)` — `setHTML` を使用（タイル属性データの文字列埋め込み） 🔵 *main.js 行476-515*
- `new maplibregl.GeolocateControl({ trackUserLocation: true })`、`geolocate` イベントの `e.coords.longitude/latitude`、内部状態 `_watchState` を参照 🟡 *main.js 行418-425, 545（`_watchState` は非公開API依存）*
- `new maplibregl.TerrainControl({ source, exaggeration })` 🔵 *main.js 行597-602*
- `maplibregl.addProtocol` を **関数として** `useGsiTerrainSource(maplibregl.addProtocol)` に渡している 🔴 *main.js 行580、v4/v5 で addProtocol のシグネチャが変わっており、v0.0.2 プラグインの内部実装次第で破壊的影響あり*
- `map.querySourceFeatures` / `map.queryRenderedFeatures` / `map.getStyle().layers` / `map.getSource('route').setData(...)` 🔵 *main.js 行390, 460, 372, 549, 573*
- `import distance from '@turf/distance'` — 既に default import を使用 🔵 *main.js 行10*

## 4. 既知の注意事項（メモ由来）

- **001 false-green build**: 前回（`001 / 8d092c7`）の「build 成功・unit PASS」主張は、lockfile 再現環境では当初から失敗しており **偽 green** と判定されている。`@turf` v7 は default export。本要件ではクリーン環境（`rm -rf node_modules package-lock.json` 後の `npm install`）での再現確認を必須とする。 🔵 *メモ [[project_001_false_green_build]] より*
- **MapLibre v5 出典サニタイズの弱さ**: v5 の attribution サニタイズは DOMPurify ではなく自前の弱い `DOM.sanitize`。タイル URL は無サニタイズ。アプリ側で `attribution` に渡す HTML を検証・構築すること。 🔵 *メモ [[reference_maplibre_v5_attribution_sanitizer]] より*
- **Windows ファイルロックの癖**: `.git reflog` や `node_modules` ネイティブファイルの書込が断続的に拒否される。`npm install` を優先し、ref 操作は reflog 無効化で回避。 🔵 *メモ [[project_windows_env_filelock]] より*
- **UI/挙動は実機で確認**: ソース静的解析だけで断定しない。MapLibre のバージョンアップは描画挙動・コントロール UI に影響しうるため、`npm run dev` での目視確認とユーザー確認を要件に組み込む。 🔵 *メモ [[feedback_verify_ui_at_runtime]] より*

## 5. ビルド・配信

- `vite build --base=./` で相対パス出力、`dist/` を静的配信。 🔵 *package.json scripts より*
- PWA は `index.html` から `manifest.json` / `sw.js` を登録。`sw.js` 本体は本リポジトリには未配置（実体は `public/` 配下のはず） 🟡 *index.html / 実ファイル状況より*

## 6. 関連実装・出力先

- 対象ファイル: `package.json`、`main.js`（必要に応じて）、`index.html`
- スペック出力先: `docs/spec/library-version-upgrade/`
- 参照: [docs/tech-stack.md](../../tech-stack.md)
- README の検証内容（演習シナリオ）: [README.md](../../../README.md)

## 7. このノートの位置づけ

`/tsumiki:kairo-tasknote` をサブエージェント経由で起動する代わりに、手動で記録した最小ノート。後続の `requirements.md` / `user-stories.md` / `acceptance-criteria.md` / `prep.md` はすべて本ノートを暗黙の前提として参照する。
