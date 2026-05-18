# sdd-framework-test

SDDフレームワークを検証するめのリポジトリです

## 対象フレームワーク

- git-spec
- cc-sdd
- tusmiki
- open-spec

## 検証アプリ

書籍「」の応用編のサンプルコード

## 動作要件

- Node.js `^20.19.0 || >=22.12.0`（Vite 8 の要件に準拠）

## 検証内容

1. ライブラリのバージョンアップ
2. 新機能実装
  - 背景地図切り替え機能の実装
3. 既存機能修正
  - オリジナル背景地図追加機能追加
4. Nuxt構成への移行

## 検討結果

### git-spec

**題材**: 検証内容 #1「ライブラリのバージョンアップ」を Spec Kit(git-spec) で実施
（2026-05-18）。spec/plan/tasks は `specs/001-upgrade-dependencies/`。

**実施手順**: `/speckit-constitution`（憲章 v1.1.0 制定・全成果物を日本語化）→
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`。
各段で git 拡張フック（constitution 前に git.initialize 必須、specify 前に
git.feature でブランチ自動作成、各後段で任意 commit）が挿入される。

**バージョン更新結果**（メジャーアップ含む最新化）:

| パッケージ | 旧 | 新 |
|---|---|---|
| vite | ^3.2.0 | ^8.0.13 |
| maplibre-gl | ^2.4.0 | ^5.24.0 |
| @turf/distance | ^6.5.0 | ^7.3.5 |
| maplibre-gl-opacity | ^1.4.0 | ^1.8.0 |
| maplibre-gl-gsi-terrain | ^0.0.2 | ^2.3.2 |

**遭遇した破壊的変更と対処**:

- `@turf/distance` v7: default export 廃止 → named import 化。純粋ロジックを
  `nearest.js` に分離しユニットテスト化（憲章 II 準拠）。
- `maplibre-gl` v2→v5: 内部 API 依存を公開 API へ置換（`feature._geometry`
  → `feature.geometry`、`geolocationControl._watchState` → 公開イベント
  `trackuserlocationend`）。
- `maplibre-gl-opacity` 1.8.0: `exports` 再編で CSS サブパス廃止。当初 import
  削除のみで対応したが**スタイル未適用で UX 回帰**（文字詰まり・末尾の不要な
  線）を手動スモークで検出。1.8.0 同梱 CSS を `opacity-control.css` として
  アプリ内にローカル同梱し import 復元、末尾 hr は非表示化。**事前調査で
  「低リスク」と誤判定し、ビルド成功後も見た目回帰が残った**のが反省点。
- `maplibre-gl-gsi-terrain` 2.3.2: 型署名が旧コードと同一・peerDep
  maplibre-gl `^5.0.0` 一致のため**無変更で互換**（フォールバック不要）。

**自動検証結果**: `npm run build` 成功（vite 8）、ユニットテスト 5/5、
`npm audit` 脆弱性 0、`npm install`→build は決定論的（同一ハッシュ）で再現。
JS バンドルは 820KB→1,088KB（maplibre v5 の規模増、Q2:A の範囲内で許容）。
※ 地図描画の手動スモークと体感性能は人手検証が必要（自動化不可）。

**git-spec 所感**:

- 良: テンプレ override（`.specify/templates/overrides/`）、フック
  （`extensions.yml`）、憲章（`constitution.md`）がすべてリポジトリ内ファイルで
  プロジェクト単位に閉じており、調整が宣言的。spec→plan→tasks→implement の
  追跡性（FR/SC↔タスク）が高い。
- 注意: 生成系がコピー済み override を読まずデフォルト構造で再生成し見出しが
  英語に退行する事故が発生（要・全文読込）。事前調査の精度限界は実装時の
  ビルド/テストで吸収する前提が必要（opacity の破壊的変更を取りこぼした）。
- 環境: Windows で `npm ci` がネイティブ `.node` のファイルロックで失敗。
  `npm install`（lockfile から）で代替・再現性は確保。

### cc-sdd

### tusmiki

### open-spec
