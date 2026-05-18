# 契約: `basemaps.js` モジュール公開インターフェース（003 拡張）

`basemaps.js` は副作用のない単一責務モジュール（憲章 I）。MapLibre/DOM/ネットワークに依存しない純粋データ＋純粋関数のみ。`main.js` が取り込み、決定論的にユニットテスト可能（憲章 II）。**002 の公開 API を維持したまま 003 の純粋関数を追加**する（破壊的変更なし）。

## 既存 API（002・維持）

- `BASEMAPS: ReadonlyArray<BaseMap>` — 組み込み4件。**003 で各要素に `isUserDefined:false` を追加**（既存フィールド・順序・値は不変＝後方互換）。
- `getDefaultBasemapId(): string` — `'osm'`（不変）。
- `buildBaseLayers(): Record<string,string>` — `{ '<id>-layer': '<label>' }`（不変）。

> `BaseMap` 形状は 002 contracts と同一＋`isUserDefined: boolean`。組み込みは `false`。

## 追加 API（003・新規）

### `DEFAULT_USER_TILE_ZOOM: Readonly<{ tileSize: number, maxzoom: number }>`

ユーザー定義ラスタソースのシステム既定（research R2）。`{ tileSize: 256, maxzoom: 19 }`。`minzoom` は未指定（0 相当）。

### `validateCustomBasemapInput(input, existingLabels): ValidationResult`

入力 `{ label, urlTemplate, attributionLabel, attributionUrl }` を検証（FR-008・Clarifications Q2/Q3/Q5）。

- 引数: `input: {label:string, urlTemplate:string, attributionLabel:string, attributionUrl:string}`、`existingLabels: string[]`（組み込み＋追加済みの全 `label`）。
- 返値: `{ ok: boolean, errors: {field, message}[] }`（`field` ∈ `label`|`urlTemplate`|`attributionLabel`|`attributionUrl`）。
- **契約条件（規則・research R3/R7）**:
  1. `label` trim 後 非空。さもなくば `field:'label'`。
  2. `label` trim 値が `existingLabels`（各 trim）と重複しない。重複なら `field:'label'`。
  3. `urlTemplate` trim 後 非空 → `field:'urlTemplate'`。
  4. `urlTemplate` が `new URL()` で解釈可能。不可なら `field:'urlTemplate'`。
  5. `urlTemplate` が `{z}`・`{x}`・`{y}` を全て含む。欠落なら `field:'urlTemplate'`。
  6. `urlTemplate` のスキームが `http:`/`https:`。それ以外（`javascript:`/`data:` 等）は `field:'urlTemplate'`。
  7. `attributionLabel` trim 後 非空 → `field:'attributionLabel'`（生 HTML 可否は問わない＝後段でエスケープするため）。
  8. `attributionUrl` は **任意**: trim 後 空なら検証スキップ（OK）。非空なら `new URL()` で解釈可能かつスキームが `http:`/`https:`。不可/非 http(s) は `field:'attributionUrl'`。
  - すべて満たすとき `ok:true`／`errors:[]`。1つでも不成立なら `ok:false` かつ該当 `errors` 列挙（無言失敗禁止＝FR-008、混在コンテンツ http はスキーム上 OK）。

### `escapeHtml(s): string`

任意文字列を HTML 文脈へ安全に埋め込むためエスケープ（純粋）。

- **契約条件**: `&`→`&amp;`（最初に置換）、`<`→`&lt;`、`>`→`&gt;`、`"`→`&quot;`、`'`→`&#39;`。`null`/`undefined` は空文字列扱い。べき等ではない（再適用で二重エスケープ＝呼び出しは1回）。

### `buildAttributionHtml(label, url): string`

出典の表示名（必須・エスケープ対象）と任意 URL から安全な出典 HTML を構築（純粋・research R7）。

- **契約条件**:
  - `label` は `escapeHtml(trim(label))` でテキスト化（タグは無効化＝生 HTML 不可）。
  - `url` trim が空 → エスケープ済みテキストのみを返す（リンクなし）。
  - `url` trim が非空 → `<a href="ESC_URL" target="_blank" rel="noopener noreferrer">ESC_LABEL</a>`。`ESC_URL`=`escapeHtml(trim(url))`（属性値の `"`/`&`/`<`/`>` を無害化）。
  - 入力に `<script>` 等を含んでも出力にタグとして現れない（HTML インジェクション不可）。`url` の妥当性（http(s)）は呼び出し前に `validateCustomBasemapInput` で担保される前提。

### `createCustomBasemap(input, idSeed): BaseMap`

検証通過済み入力から BaseMap 形状を生成（research R4/R7）。

- **契約条件**:
  - `id`/`sourceId` は `user-<idSeed>`。既存 `BASEMAPS` の id および追加済みと衝突しない。レイヤー id は `${id}-layer`。
  - `label` = `trim(input.label)`。
  - `source` = `{ type:'raster', tiles:[trim(input.urlTemplate)], tileSize:256, maxzoom:19, attribution: buildAttributionHtml(input.attributionLabel, input.attributionUrl) }`（`minzoom` 未指定）。
  - `isDefault:false`、`isUserDefined:true`。
  - 純粋（同 input・同 idSeed → 同出力）。

## 非機能契約

- 例外を除き副作用なし（DOM/ネットワーク/グローバル参照なし）。`node --test` で実ネットワーク非依存に検証可能（憲章 II）。
- 002 の公開シンボル・形状・順序を後方互換に維持（`isUserDefined` 追加のみ）。
- セキュリティ: ユーザー入力は `source.attribution` へ生のまま流さない。必ず `escapeHtml`/`buildAttributionHtml` 経由（Q5）。

## 対応するユニットテスト観点（`tests/unit/basemaps.test.mjs` に追記）

1. （002 既存5観点は維持）＋ 各組み込み要素が `isUserDefined===false`。
2. `validateCustomBasemapInput`: 正常系（`attributionUrl` 有り／空 双方）で `ok:true`。
3. 必須空（label/urlTemplate/attributionLabel 各々）で該当 `field` の error。`attributionUrl` 空は error にならない。
4. 重複 `label`（組み込み・追加済み双方）で `label` error。
5. `urlTemplate` 不正：解釈不能／`{z}{x}{y}` 欠落／非 `http(s)` で各々 `urlTemplate` error。混在コンテンツ http は `ok:true`。
6. `attributionUrl` 不正：解釈不能／非 `http(s)`（`javascript:` 等）で `attributionUrl` error。`https`/`http` は OK。
7. `escapeHtml`: `&<>"'` を各実体参照へ（`&` 先頭）。
8. `buildAttributionHtml`: URL 有り→`<a href target=_blank rel=noopener noreferrer>`、URL 空→テキストのみ、`<script>` 入力→出力にタグなし（エスケープ）。
9. `createCustomBasemap`: `source` が `tileSize:256/maxzoom:19/minzoom無`、`attribution===buildAttributionHtml(...)`、`isUserDefined:true`、`isDefault:false`、`id==='user-<seed>'` 一意、`tiles[0]===trim(urlTemplate)`。
10. `DEFAULT_USER_TILE_ZOOM` が `{tileSize:256, maxzoom:19}`。
