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

1. ライブラリのバージョンアップ（2026-05-14 完了）
   - `maplibre-gl` `^2.4.0` → `^5.24.0`
   - `maplibre-gl-gsi-terrain` `^0.0.2` → `^2.3.2`
   - `maplibre-gl-opacity` `^1.4.0` → `^1.8.0`
   - `@turf/distance` `^6.5.0` → `^7.3.5`
   - `vite` `^3.2.0` → `^8.0.12`
2. 新機能実装
  - 背景地図切り替え機能の実装（2026-05-15 完了）
    - 切替可能な背景地図：OSM／地理院地図（標準地図）／航空写真（シームレス写真）／白地図
    - 左下に独自 `IControl`（`BasemapSwitcherControl`）を配置し、ラジオで排他切替
    - 出典表示は MapLibre 標準 `AttributionControl` の自動集計に委ね、選択中の背景に応じて切り替わる
3. 既存機能修正
  - （検討中）
4. Nuxt構成への移行

## 検討結果

### git-spec

### cc-sdd

### tusmiki

### open-spec

`upgrade-packages-latest` change で依存パッケージ一括バージョンアップを実施。proposal → design → spec → tasks の流れで artifact を生成でき、`openspec status --json` でフェーズ進捗を機械的に追えるのが扱いやすかった。実装中に発生した `maplibre-gl-opacity@1.8.0` の `exports` 制約問題も、design の Open Questions で予め「最小限の互換修正は本 change 内で扱う」と方針を明示しておいたためスコープを膨らませずに対応できた。
