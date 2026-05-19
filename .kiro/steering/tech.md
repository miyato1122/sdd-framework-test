# Technology Stack

## Architecture

ビルドツール（Vite）でバンドルする **クライアント単体の静的 SPA / PWA**。サーバサイドは持たず、地図・データは外部公開タイル（国土地理院・OSM）と自ホストの静的ベクトルタイルに依存する。アプリのロジックは MapLibre GL JS への命令的 API 呼び出しと、スタイル仕様（Style Spec v8）をデータとしてインラインに埋め込む「設定 as データ」構成。

## Core Technologies

- **Language**: バニラ JavaScript（ES Modules、TypeScript 不使用）
- **Framework**: フレームワークレス。地図エンジンに MapLibre GL JS、バンドラに Vite
- **Runtime**: ブラウザ実行。開発/ビルドは Node.js（検証環境は Node v24 / npm 11、Windows）

## Key Libraries

開発パターンに影響する主要ライブラリのみ（全依存は列挙しない）:

- **maplibre-gl**: 地図描画の中核。Map / Popup / GeolocateControl / TerrainControl / addProtocol を使用。
- **maplibre-gl-gsi-terrain**: 地理院標高タイル→raster-dem 変換。`addProtocol` 経由のため maplibre-gl のメジャー互換と密結合（更新時は同調必須）。
- **maplibre-gl-opacity**: 重畳レイヤの切替・不透明度コントロール。
- **@turf/distance**: 2 点間距離計算（最寄り避難所判定）。default import で利用。

## Development Standards

### Type Safety

型システムなし（プレーン JS）。型注釈・tsconfig は導入しない方針。安全性はランタイム検証と実機確認で担保する。

### Code Quality

ESLint / Prettier 等の lint・整形設定は未導入。既存スタイル（日本語コメント主体、2 スペースインデント、ESM import）に合わせる。スタイル一括導入は steering で合意するまで行わない。

### Testing

自動テスト基盤なし。検証の合格判定は **「クリーン環境（lockfile 再現）での build/dev/preview 成功」＋「ブラウザ実機スモーク」** の二段。build グリーン単独を合格としない（過去に lockfile 環境で偽 green の前例あり）。UI・ライブラリ挙動は静的解析だけで断定せず、実機目視はユーザー実施・実装側はチェックリスト提供。

## Development Environment

### Required Tools

- Node.js（Vite が要求するバージョン以上）/ npm
- モダンブラウザ（WebGL2）。実機スモーク確認に必須

### Common Commands

```bash
# Dev:     npm run dev        # Vite 開発サーバ
# Build:   npm run build      # vite build --base=./（相対パス出力）
# Preview: npm run preview    # ビルド成果物のプレビュー
```

## Key Technical Decisions

- **相対パスビルド (`--base=./`)**: 任意のサブパス配信を許容するため。出力 HTML/asset 参照を相対に固定。
- **PWA を手書き資産で実現**: `public/manifest.json` と `public/sw.js` を Vite に手を入れず static 配信。プラグインに依存しない。
- **プラグイン peer 互換が更新の制約軸**: maplibre-gl のメジャー更新は `maplibre-gl-gsi-terrain` の `addProtocol` 世代と不可分。単独昇格は不可。
- **ユーザー入力の生 HTML 描画禁止**: Popup `setHTML` 等の innerHTML 経路に外部/利用者由来文字列を生で渡さない（ラベル/URL 分離・エスケープ・スキーム検証）。
- **Windows 環境特性への配慮**: npm install / git ref 操作がファイルロックで断続失敗し得る。先に実状態を診断し `npm install` を優先。

---
_Document standards and patterns, not every dependency_
