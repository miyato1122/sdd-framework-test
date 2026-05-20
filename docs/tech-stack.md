# プロジェクト技術スタック定義

## 🔧 生成情報
- **生成日**: 2026-05-20
- **生成ツール**: `/tsumiki:init-tech-stack`
- **生成方式**: 既存コード（`package.json` / `main.js` / `index.html`）からの逆生成（インタラクティブヒアリングは AskUserQuestion 非搭載のためスキップ）
- **プロジェクトタイプ**: Web アプリケーション（地図系 SPA / PWA）
- **チーム規模**: 個人開発（SDD フレームワーク比較演習用の素材）
- **開発期間**: 短期（演習スコープ、フレームワーク横断比較）

## 🎯 プロジェクト要件サマリー
- **位置づけ**: SDD フレームワーク（git-spec / cc-sdd / tsumiki / open-spec）の比較演習素材。書籍「位置情報アプリケーション開発」応用編のサンプル相当。
- **パフォーマンス**: 軽負荷（個人検証・ローカル実行が主）。タイル取得は外部 CDN 依存。
- **セキュリティ**: 基本レベル。ただし `attribution` に外部入力相当の HTML 文字列を渡しており、ユーザー定義背景地図を許容する場合は別途エスケープが必要（既存メモ参照）。
- **既存連携**: 国土地理院ハザードタイル・OpenStreetMap タイル等の外部 raster ソースに依存（新規構築＋外部 API 連携）。
- **学習コスト許容度**: バランス重視（演習対象として段階的なバージョン更新・Nuxt 移行を想定）。
- **ホスティング**: 静的ホスティング（`vite build --base=./` の相対パス出力、PWA 配信）。
- **予算**: コスト最小化（演習用途）。

## 🚀 フロントエンド（現行）
- **フレームワーク**: なし（Vanilla JS、`main.js` 単一エントリ）
- **言語**: JavaScript（ES Modules、`"type": "module"`）。**TypeScript 未導入**
- **ビルド/開発サーバー**: Vite `^3.2.0`（`vite` / `vite build --base=./` / `vite preview`）
- **地図ライブラリ**: MapLibre GL JS `^2.4.0`（+ CSS）
- **地図プラグイン**:
  - `maplibre-gl-opacity` `^1.4.0`（重ねハザードレイヤーの不透明度コントロール）
  - `maplibre-gl-gsi-terrain` `^0.0.2`（地理院標高タイル → terrain ソース）
- **地理演算**: `@turf/distance` `^6.5.0`
- **状態管理**: なし（MapLibre インスタンスのローカル状態のみ）
- **ルーティング**: なし（単一画面）
- **スタイル**: 素の `style.css`（現状空ファイル）+ インラインスタイル
- **PWA**: `manifest.json` + Service Worker（`sw.js`）を `index.html` から登録

### 採用理由（現状追認）
- 書籍サンプルをそのまま素材化したため、フレームワーク非依存の Vanilla + Vite 構成。
- MapLibre GL JS は OSS / 商用利用可で、ハザードマップ等の raster タイル重畳に十分。
- SDD 各フレームワークの差分が見えるよう、意図的にミニマム構成を維持。

## ⚙️ バックエンド
- **構成**: バックエンドサービスなし（完全静的 SPA）。
- **データ取得**: ブラウザ → 外部タイル CDN（OSM / 国土地理院）への直接 GET のみ。
- **認証**: なし。
- **キャッシュ**: Service Worker（`sw.js`）と CDN 任せ。

## 💾 データベース
- **構成**: 永続化レイヤーなし。
- **クライアント状態**: なし（リロードで初期化）。
- **ファイルストレージ**: `public/` 配下の静的アセット（PWA マニフェスト / アイコン等）。

## 🛠️ 開発環境
- **パッケージマネージャー**: `npm`（`package-lock.json` 在り。`pnpm` / `yarn` は未導入）
- **ランタイム**: Node.js（バージョン明示なし。Vite 3 系の最低要件 Node 14.18+ / 16+ を満たすこと）
- **コンテナ**: 未導入（Docker / Compose なし）
- **OS 環境メモ**: Windows 11 での開発実績あり。`.git reflog` / `node_modules` ネイティブファイルの書込が断続的に拒否される事象を確認済み（個別メモ参照）。

### 品質ツール（現状）
- **リンター / フォーマッター**: 未導入（ESLint / Prettier / Biome いずれも未設定）
- **型チェック**: 未導入（TypeScript なし）
- **ユニットテスト**: 未導入（`vitest` / `jest` どちらも未設定）
- **E2E テスト**: 未導入（Playwright 等なし）
- **CI**: 未導入（`.github/workflows/` なし）

### 配布
- **ビルド出力**: `dist/`（既に存在）
- **`base`**: `./` 相対指定（任意のサブパス配信が可能）

## 🔒 セキュリティ
- **HTTPS**: 配信側依存（静的ホスティング側で必須）
- **CORS**: タイル CDN 側設定に依存（アプリ側からの送出なし）
- **入力検証**: 現状ユーザー入力なし。**ただし基底レイヤーやユーザー定義背景地図を将来許容する場合**、`attribution` に渡す HTML を生のまま受け取らないこと（ラベル/URL を分離してエスケープ＋スキーム検証）。
  - MapLibre v5 系の出典サニタイズは DOMPurify ではなく自前の弱い `DOM.sanitize`、タイル URL は無サニタイズ。アプリ側検証を主防御に据えること。

## 📊 品質基準（演習目標）
- バージョン更新後も `vite build` が成功し、`dist/` を静的サーブして地図が描画されること。
- 各 SDD フレームワークで「同じ仕様変更（バージョン更新 / 背景地図切替 / 既存機能修正 / Nuxt 移行）」を実装した際の手数・差分の質を比較できる状態にすること。
- 偽 green を避ける（過去事例: `001` で lockfile 再現環境では build NG だった主張がそのまま受け入れられた）。クリーン環境での再検証を必須とする。

## 📁 現状ディレクトリ構造（実測）
```
./
├── .claude/                 # Claude Code / tsumiki 設定
├── .git                     # gitfile（worktree）
├── .gitignore
├── README.md                # 検証対象フレームワークと演習シナリオ
├── dist/                    # vite build 成果物
├── docs/                    # ← このファイルを配置
│   └── tech-stack.md
├── index.html               # エントリ HTML（PWA manifest + sw.js 登録）
├── main.js                  # 全ロジック（MapLibre 初期化・レイヤー定義・距離計算）
├── package.json             # 依存と scripts (dev/build/preview)
├── package-lock.json
├── public/                  # 静的アセット（manifest.json / アイコン等の置き場）
└── style.css                # 空
```

> Vanilla 構成のため、推奨テンプレ（`src/components` 等）には**意図的に従っていない**。SDD 演習の比較材料として現行構造を維持する。

## 🔄 演習で予定されている技術変更（README 由来）
README の「検証内容」を技術スタック観点で展開：

1. **ライブラリのバージョンアップ**
   - Vite `3.2` → `6.x`
   - MapLibre GL JS `2.4` → `5.x`（出典サニタイズ仕様の差異あり、上記セキュリティ節参照）
   - `@turf/distance` `6.5` → `7.x`（v7 は default export、過去 `001` で破壊的変更を踏み損ねている）
   - `maplibre-gl-opacity` / `maplibre-gl-gsi-terrain` も対応版へ
2. **新機能実装**: 背景地図切替（basemap-switcher）。Path A で実装済みだが、ユーザー定義背景地図の追加を再オープン中。
3. **既存機能修正**: 検討中。
4. **構成移行**: Vanilla + Vite → **Nuxt 構成への移行**（フレームワーク導入とディレクトリ再編を含む）。

これらは tsumiki の `kairo-requirements` / `kairo-design` / `kairo-tasks` での仕様化対象。本ファイルは「変更前の現行スタック」を示す基準点として扱う。

## 🚀 セットアップ手順（現行）
### 1. 依存導入
```bash
npm install
```

### 2. 主要コマンド
```bash
npm run dev      # Vite dev server
npm run build    # vite build --base=./ → dist/
npm run preview  # ビルド成果物をローカル確認
```

## 📝 カスタマイズ方針
- **このファイルは「現状の追認」であり、新規スタック選定ではない**。
- バージョン更新 / Nuxt 移行 / 新機能追加が発生した時点で、本ファイルを差分更新する（履歴は下の更新履歴に追記）。
- tsumiki 後続コマンド（`kairo-*`, `tdd-*`, `direct-*`）は本ファイルを暗黙の前提として参照する。

## 🔄 更新履歴
- 2026-05-20: 初回生成（`/tsumiki:init-tech-stack` による既存コード逆生成。AskUserQuestion 非搭載のためヒアリングはスキップし、`package.json` / `main.js` / `index.html` / `README.md` から推定）
