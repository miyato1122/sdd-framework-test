# データモデル（Phase 1）: ユーザー定義のオリジナル背景地図の追加

本機能は永続ストレージを持たない（ユーザー定義背景地図はセッション内のみ・再読込で消失。spec Assumptions／Clarifications）。ここでの「エンティティ」は実行時の構成データ（`basemaps.js` のレジストリ＋実行時追加分）と地図状態を指す。**002 のデータモデルの増分拡張**であり、002 の `背景地図(BaseMap)`／`出典表記(Attribution)`／`切替コントロール状態` を継承し、ユーザー定義種別と入力・検証を追加する。

---

## エンティティ

### 1. 背景地図（BaseMap）※ 002 から継承＋拡張

002 と同一形状。**ユーザー定義種別を区別する `isUserDefined` を追加**。

| フィールド | 型 | 説明 | 検証ルール |
|-----------|----|------|-----------|
| `id` | string | レイヤー/論理識別子。レイヤー id は `${id}-layer` で導出 | 一意・非空。組み込みは `osm`/`gsi-*`。ユーザー定義は実行時生成（既存 id と衝突しない） |
| `label` | string | スイッチャー表示名（日本語可） | 非空。**全背景地図（組み込み4種＋追加済みユーザー定義）を通じて一意**（重複は追加拒否） |
| `sourceId` | string | スタイル `sources` のキー | 一意・非空 |
| `source` | object | MapLibre raster ソース定義 | `type:'raster'`, `tiles:[urlTemplate]`, `tileSize:256`, `attribution` 非空。ユーザー定義は `minzoom` 未指定／`maxzoom:19`（research R2） |
| `isDefault` | boolean | 初期可視か | レジストリ中 `true` はちょうど1件（`osm`）。ユーザー定義は常に `false` |
| `isUserDefined` | boolean | 利用者が実行時に追加したか | 組み込み4種=`false`、追加分=`true`（**003 で追加**） |

**組み込みインスタンス（4件・不変）**: 002 data-model のとおり（`osm`/`gsi-std`/`gsi-seamlessphoto`/`gsi-blank`、`isUserDefined:false`）。

**ユーザー定義インスタンス（0..N 件・セッション内）**: 下記「ユーザー入力」から生成。`isDefault:false`・`isUserDefined:true`。

### 2. ユーザー入力（CustomBasemapInput）※ 003 で新規

追加フォームが収集する生の入力。検証を通過すると BaseMap に変換される（research R3/R4）。

| フィールド | 型 | 説明 | 検証ルール（FR-008・Clarifications Q2/Q3/Q5） |
|-----------|----|------|-----------|
| `label` | string | 表示名 | trim 後 非空。既存全背景地図の `label` と非重複 |
| `urlTemplate` | string | タイル取得元 URL テンプレート | trim 後 非空。`new URL()` で解釈可能。`{z}`/`{x}`/`{y}` を全て含む。スキームが `http:`/`https:` のみ |
| `attributionLabel` | string | 出典の表示名（プレーンテキスト） | trim 後 非空。**生 HTML 不可**＝システムが HTML エスケープして用いる（Q5） |
| `attributionUrl` | string | 出典リンク URL | **任意**。空ならリンクなし。非空なら `new URL()` で解釈可能かつスキームが `http:`/`https:` のみ（`javascript:`/`data:` 等は不正。Q5） |

> 旧 `attribution`（単一・生文字列）は Q5 で廃止。利用者の生 HTML を `source.attribution` に流し込まず、`attributionLabel`（エスケープ）＋`attributionUrl`（検証済み）から**システムが安全に構築**する。

### 3. 検証結果（ValidationResult）※ 003 で新規

| フィールド | 型 | 説明 |
|-----------|----|------|
| `ok` | boolean | 全規則を満たすか |
| `errors` | `{ field: 'label'|'urlTemplate'|'attributionLabel'|'attributionUrl', message: string }[]` | 不成立の項目と理由（無言失敗禁止＝FR-008。利用者へ項目別提示） |

### 4. 出典表記（Attribution）※ 002 から継承＋安全構築（Q5）

002 と同一の機構（背景地図と 1:1、MapLibre 既定 `AttributionControl` が可視ソースから自動集約。002 R3、003 でも不変）。ユーザー定義背景の `source.attribution` は利用者の生入力ではなく、**`escapeHtml(attributionLabel)` と検証済み `attributionUrl` からシステムが構築した HTML**（URL ありなら `<a href target=_blank rel=noopener noreferrer>` リンク、なしならエスケープ済みテキストのみ）。組み込み4種の `attribution` は従来どおり内部定数（利用者入力ではない＝影響なし）。

### 5. 切替コントロール状態（BasemapSwitcher / 地図状態）※ 002 から継承＋拡張

| フィールド | 型 | 説明 | 検証ルール |
|-----------|----|------|-----------|
| `options` | BaseMap[] | 選択肢（組み込み4 ＋ 追加分 N） | レジストリ順＋追加順。末尾に「追加」操作（FR-001） |
| `position` | const | `'bottom-left'` | 固定（002 FR-001 と一貫） |
| `current` | string(id) | 現在選択中の背景 id | 常にちょうど1件が可視。初期=`osm`。**追加操作では不変**（Clarifications Q4） |
| `formOpen` | boolean | 追加フォーム展開中か | フォーム表示中も地図操作継続（FR-012） |

---

## 状態遷移

```
[初期/再読込] --(既定)--> current = osm（組み込み4のみ・ユーザー定義は0件。永続化なし）
（任意状態）--(末尾「追加」押下)--> formOpen = true（current/可視/出典は不変。FR-002）
formOpen --(キャンセル)--> formOpen = false（一覧・地図・出典は不変。FR-009/US3-AC4）
formOpen --(確定・検証NG)--> formOpen = true のまま＋errors 提示（追加されない。FR-008/SC-004）
formOpen --(確定・検証OK)--> レジストリに BaseMap 追加＋source/layer 追加（visibility:none）・formOpen=false
                              ただし current/可視/出典は不変（自動選択しない。Q4・FR-004後段）
current = X --(利用者が 追加済みY を選択)--> current = Y（Y のみ可視・出典は AttributionControl が自動追従。FR-005/006/007）
任意状態 --(タイル取得失敗:組み込み/ユーザー定義問わず)--> 地図操作継続＋失敗を可視化（current 不変。FR-010・002 R5 再利用）
```

不変条件:
- 背景レイヤーは常に**ちょうど1つ**が可視（自作コントロールの排他選択が保証。002 と同じ不変条件）。
- 表示中の出典 = `current` の提供元（既定 AttributionControl の可視ソース集約により保証。002 R3 と不変）。
- `label` は全背景地図で一意（重複追加は拒否。Q3）。
- ユーザー定義背景は**セッション内のみ**保持。再読込で消失し `current=osm` に戻る（永続化なし。002 と一貫）。
- 組み込み4種の選択・既定 OSM・出典自動表示は 003 追加機能の有無に関わらず不変（FR-011／回帰禁止）。
