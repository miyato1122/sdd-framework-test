# 契約: `basemaps.js` モジュール公開インターフェース

`basemaps.js` は副作用のない単一責務モジュール（憲章 I）。`main.js` が取り込み、決定論的にユニットテスト可能（憲章 II）。MapLibre には依存しない純粋データ＋純粋関数のみ。

## 公開 API

### `BASEMAPS: ReadonlyArray<BaseMap>`

背景地図レジストリ（4件、定義順）。各要素:

```text
BaseMap {
  id: string                 // 'osm' | 'gsi-std' | 'gsi-seamlessphoto' | 'gsi-blank'
  label: string              // 日本語表示名（スイッチャー用）
  sourceId: string           // スタイル sources のキー
  source: {                  // MapLibre raster ソース定義（純粋オブジェクト）
    type: 'raster',
    tiles: string[],         // XYZ テンプレ URL
    tileSize: 256,
    minzoom?: number,
    maxzoom?: number,
    attribution: string      // 提供元規約準拠の HTML 文字列
  }
  isDefault: boolean         // ちょうど1件が true（'osm'）
}
```

**契約条件**
- `BASEMAPS.length === 4`、`id` は一意。
- `isDefault === true` はちょうど1件、その `id === 'osm'`。
- `gsi-blank` の `source.maxzoom === 14`（R2：白地図は z5–14 提供）。
- `osm` の `attribution` は `OpenStreetMap` と `copyright` リンクを含む。
- `gsi-*` の `attribution` は「地理院タイル」または「国土地理院」と `maps.gsi.go.jp/development/ichiran.html` リンクを含む（FR-007）。

### `getDefaultBasemapId(): string`

レジストリから既定背景の `id` を返す（= `'osm'`）。`isDefault` が一意でない場合は例外（不変条件の番人）。

### `buildBaseLayers(): Record<string, string>`

`OpacityControl({ baseLayers })` にそのまま渡せる `{ '<id>-layer': '<label>' }` マップを返す。順序は `BASEMAPS` 準拠。

**契約条件**: キー数 = 4、各キー = `${basemap.id}-layer`、値 = `basemap.label`。

## 非機能契約
- 例外を除き副作用なし（DOM/ネットワーク/グローバル参照なし）→ `node --test` で実ネットワーク非依存に検証可能（憲章 II）。
- 出力は安定（同入力同出力）。`BASEMAPS` は凍結相当（読み取り専用前提）。

## 対応するユニットテスト観点（`tests/unit/basemaps.test.mjs`）
1. `BASEMAPS` が4件・`id` 一意・`isDefault` 一意で `osm`。
2. 各 `source.tiles[0]` が R2 の URL と一致、`gsi-blank.source.maxzoom===14`。
3. `attribution` 文字列が提供元準拠（OSM/GSI それぞれ必須文字列・リンクを含む）。
4. `getDefaultBasemapId() === 'osm'`。
5. `buildBaseLayers()` が4キー・`'<id>-layer'`→`label` 形・順序一致。
