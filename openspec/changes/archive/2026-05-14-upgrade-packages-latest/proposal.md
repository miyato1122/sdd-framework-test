## Why

`package.json` の依存関係が 2 年以上更新されておらず、`maplibre-gl@^2.4.0` / `vite@^3.2.0` / `maplibre-gl-gsi-terrain@^0.0.2` などはいずれもメジャーバージョンが大きく進んでいる。古いままだとセキュリティパッチを受け取れず、新しい Node.js / OS 環境で `npm install` や `npm run build` が失敗する可能性があり、後続の検証タスク（新機能実装・Nuxt 移行など）の前提が崩れる。今のうちに「動作可能な最新バージョン」へ揃え、以降の作業を安定したベースから始められるようにする。

## What Changes

- `package.json` の `dependencies` / `devDependencies` を以下のターゲットバージョンへ更新する。
  - **BREAKING** `maplibre-gl` `^2.4.0` → `^5.24.0`（メジャー v2 → v5）
  - **BREAKING** `maplibre-gl-gsi-terrain` `^0.0.2` → `^2.3.2`（v2 系は `maplibre-gl` v4+ を要求）
  - **BREAKING** `vite` `^3.2.0` → `^8.0.12`（Node.js `^20.19.0 || >=22.12.0` を要求）
  - **BREAKING** `@turf/distance` `^6.5.0` → `^7.3.5`（メジャー v6 → v7、ESM 既定化）
  - `maplibre-gl-opacity` `^1.4.0` → `^1.8.0`（マイナー）
- `package-lock.json` をクリーン再生成し、ロックを v3 形式に揃える。
- `main.js` の import / 呼び出しを新 API 上で動作するよう必要箇所だけ調整する（既存挙動は変えない）。
- `README.md` の「検証内容 > ライブラリのバージョンアップ」項目を、対象バージョンと検証手順に対応した記述へ更新する。

非対象（Non-goals）:

- 新機能（背景地図切り替えなど）の追加。本変更は依存更新と最小限の互換修正のみ。
- Nuxt 構成への移行。別 change で扱う。
- TypeScript 化・モジュール分割などのリファクタリング。

## Capabilities

### New Capabilities
- `dependency-baseline`: プロジェクトの依存パッケージのターゲットバージョン、動作要件（Node.js バージョン等）、および更新後にビルド・ランタイム双方で満たすべき検証基準を定義するケイパビリティ。

### Modified Capabilities
<!-- 既存 specs は無いため、変更対象なし -->

## Impact

- **コード**: `package.json`, `package-lock.json`, `main.js`（必要に応じて `index.html` / `style.css`）。
- **API / ライブラリ**:
  - `maplibre-gl` v5 では `addProtocol` が Promise ベースに変更されているが、本リポジトリで直接利用しているのは `maplibre-gl-gsi-terrain` 経由のみ。同プラグイン v2 が v5 系に対応済みのため、利用側コードは原則そのまま動作する。
  - `@turf/distance` v7 はデフォルトエクスポートも引き続き提供されるため、`import distance from '@turf/distance'` はそのまま動作する。
- **ランタイム要件**: 開発 / ビルドに Node.js `>=20.19`（Vite 8 要件）。CI / 開発機の Node バージョンを確認する。
- **ビルド成果物**: `dist/` を再生成する必要がある（既存の `dist/` は古い Vite で生成されたもの）。
- **ブラウザ動作**: 既存の地図表示・ハザードマップ重ね合わせ・現在地→最寄り避難場所ライン・3D 地形コントロールがすべて従前どおり動作することを目視確認する。
