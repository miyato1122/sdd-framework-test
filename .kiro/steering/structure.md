# Project Structure

## Organization Philosophy

**単一ファイル・フラット構成**。アプリの全ロジック（地図初期化、スタイル仕様のインライン定義、コントロール登録、イベントハンドラ、現在地・経路処理）を 1 つのエントリスクリプトに集約する。レイヤ分割やモジュール分割は行わず、スタイル仕様を「設定データ」として宣言的に埋め込み、その上に命令的な MapLibre API 呼び出しを重ねる。比較演習の題材として差分を読みやすく保つため、この素朴さは意図的に維持する。

## Directory Patterns

### Application Entry (root)

**Location**: `/`（`index.html` / `main.js` / `style.css`）
**Purpose**: Vite のエントリ。`index.html` が `main.js` を ESM 読込し、アプリ全体がここに存在する。
**Example**: `index.html` → `<script type="module" src="./main.js">`、`main.js` に Map 構築と全機能。

### Static Assets (served as-is)

**Location**: `/public/`
**Purpose**: Vite が無変換で配信する静的資産。PWA 資産（`manifest.json` / `sw.js` / アイコン）と自ホストベクトルタイル `skhb/{z}/{x}/{y}.pbf`。
**Example**: `skhb` ソースの tiles URL は配信元 origin 相対で `/skhb/...pbf` を参照。

### Build Output

**Location**: `/dist/`
**Purpose**: `npm run build` の生成物。手編集しない。原本は root と `public/`。

### SDD Framework Workspaces

**Location**: `.kiro/`（cc-sdd: steering / specs）、`/specs/`（git-spec 系成果物）
**Purpose**: 各 SDD フレームワークの作業領域。`.kiro/specs/` と root `/specs/` は別フレームワークの別物で、両者の重複改修を避ける。`.kiro/` 内部メタ（settings 等）はコード知識ではないため steering で詳細化しない。

## Naming Conventions

- **Files**: kebab-case / 小文字（`main.js`, `style.css`）。エントリは `index.html`。
- **Components**: UI コンポーネント層は持たない（フレームワークレス）。地図のソース/レイヤ ID は意味のドメイン接頭辞付き（`hazard_*` はハザード種別、`skhb` は避難場所、`osm` は背景、`route` は経路、`*-layer` は対応レイヤ）。
- **Functions**: 低キャメルケース。日本語コメントで意図を併記する既存慣習に合わせる。

## Import Organization

```js
// 1) ライブラリ本体 + 付随 CSS をペアで import
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// 2) プラグインも本体 + CSS をペアで
import OpacityControl from 'maplibre-gl-opacity';
import 'maplibre-gl-opacity/dist/maplibre-gl-opacity.css';
// 3) ユーティリティ（default import 慣習）
import distance from '@turf/distance';
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';
```

**Path Aliases**:
- なし。エイリアスは導入せず npm パッケージ名と相対パスのみで参照する。

## Code Organization Principles

- **設定 as データ**: 地図ソース/レイヤは Style Spec v8 のオブジェクトとして宣言。新規地図要素は既存 `sources` / `layers` の同パターンに追加し、新ファイルを作らない。
- **ドメイン接頭辞でレイヤ責務を分離**: 種別接頭辞（`hazard_` 等）で関連ソース/レイヤを束ね、属性 attribution を出典単位で共有。
- **外部タイル依存を前提に配置**: 外部公開タイル（国土地理院・OSM）＋自ホスト静的タイルのみ。サーバ実装・秘匿情報を構造に持ち込まない。
- **新コードは既存パターンに従えば steering 更新不要**: パターンを外れる構成変更（モジュール分割、ビルド設定追加、TypeScript 化、Nuxt 移行など）を行う時のみ steering を更新する。

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
