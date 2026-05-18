# データモデル（Phase 1）: 背景地図の切り替え

本機能は永続ストレージを持たない（選択状態はセッション内のみ・spec Assumptions）。ここでの「エンティティ」は実行時の構成データ（`basemaps.js` のレジストリ）と地図状態を指す。

---

## エンティティ

### 1. 背景地図（BaseMap）

利用者が選択し地図の下地として表示される地図。`basemaps.js` のレジストリ要素。

| フィールド | 型 | 説明 | 検証ルール |
|-----------|----|------|-----------|
| `id` | string | レイヤー/論理識別子（例: `osm`, `gsi-std`, `gsi-seamlessphoto`, `gsi-blank`） | 一意・非空。レイヤー id は `${id}-layer` で導出 |
| `label` | string | スイッチャー表示名（日本語） | 非空。例: `OSM` / `地理院地図（標準地図）` / `航空写真` / `白地図` |
| `sourceId` | string | スタイル `sources` のキー | 一意・非空 |
| `source` | object | MapLibre raster ソース定義 | `type:'raster'`, `tiles:[url]`, `tileSize:256`, `minzoom/maxzoom` は R2 表に一致, `attribution` 非空 |
| `isDefault` | boolean | 初期可視か | レジストリ中で `true` はちょうど1件（OSM） |

**インスタンス（4件・FR-002）**

| id | label | tiles | minzoom | maxzoom | isDefault |
|----|-------|-------|---------|---------|-----------|
| `osm` | OSM | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | （既存）maxzoom 19 / tileSize 256 | — | **true** |
| `gsi-std` | 地理院地図（標準地図） | `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` | 5 | 18 | false |
| `gsi-seamlessphoto` | 航空写真 | `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` | 2 | 18 | false |
| `gsi-blank` | 白地図 | `https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png` | 5 | 14 | false |

### 2. 出典表記（Attribution）

背景地図と 1:1 で対応し、提供元規約を満たすために表示する文言（ソース定義 `attribution` に内包）。

| フィールド | 型 | 説明 | 検証ルール |
|-----------|----|------|-----------|
| `provider` | enum | `OpenStreetMap` \| `国土地理院` | 背景地図種別と一致 |
| `text` | string(HTML) | 表示する出典文字列 | OSM=OpenStreetMap contributors＋copyrightリンク / GSI=「地理院タイル（国土地理院）」＋一覧ページリンク（FR-007・R4） |
| `refUrl` | url | 規約/一覧参照先 | GSI=`https://maps.gsi.go.jp/development/ichiran.html` |

> 出典の表示・切替は MapLibre 既定 AttributionControl が可視ソースから自動集約（R3）。本エンティティは独立管理せずソース `attribution` として保持する。

### 3. 切替コントロール状態（BasemapSwitcher / 地図状態）

| フィールド | 型 | 説明 | 検証ルール |
|-----------|----|------|-----------|
| `options` | BaseMap[] | 選択肢（4件） | レジストリ順 |
| `position` | const | `'bottom-left'` | 固定（FR-001） |
| `current` | string(id) | 現在選択中の背景 id | 常にちょうど1件が可視。初期=`osm`（FR-004） |

---

## 状態遷移

```
[初期/再読込] --(既定)--> current = osm（OSM 可視, GSI3種 visibility:none）
current = X --(利用者が Y を選択, X≠Y)--> current = Y（Y 可視・他背景 none、出典は AttributionControl が自動追従）
current = X --(利用者が X を選択)--> current = X（変化なし・エラーや崩れなし。FR/US1-AC3）
任意状態 --(タイル取得失敗)--> 地図操作継続＋失敗を可視化（current は不変。FR-010・R5）
```

不変条件:
- 背景レイヤーは常に**ちょうど1つ**が可視（OpacityControl baseLayers が保証）。
- 表示中の出典 = `current` の提供元（AttributionControl の可視ソース集約により保証）。
- `current` はセッション内のみ保持。再読込で `osm` に戻る（永続化なし）。
