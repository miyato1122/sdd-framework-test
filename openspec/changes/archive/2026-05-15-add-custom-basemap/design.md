## Context

現在の地図アプリは MapLibre GL JS の単一ページ実装で、`main.js` の中で `style.sources` と `style.layers` にプリセット 4 種類の背景タイル（OSM・地理院標準・航空写真・白地図）を **静的に焼き込み**、`BasemapSwitcherControl`（IControl 実装）が `setLayoutProperty('<id>', 'visibility', ...)` で排他切替している（`main.js:425` 付近）。
本変更は、この前提を「実行時に背景レイヤーが増減・再生成し得る」「ページリロードを跨いだ状態が保持される」モデルへと拡張する。データ層（IndexedDB）と UI 層（追加／編集兼用フォーム・操作メニュー `⋮`・追加ボタン）が新規に加わるため、ランタイム挙動の不変条件と既存機能との干渉ポイントを事前に整理しておく必要がある。

主要なステークホルダ:

- アプリ利用者（防災情報を別角度で確認したい人）: 独自タイルを足して再アクセス後も維持できることを期待。
- 開発者（このリポジトリのメンテナ）: プリセットの仕様回帰がないこと、依存追加が最小であること。
- タイル提供元: 出典が必ず表示されること。

## Goals / Non-Goals

**Goals:**

- 名称・タイル URL・出典テキスト・出典リンク URL・（任意で）minzoom/maxzoom を入力するフォームから、任意個のユーザー独自背景地図を追加できる。
- 追加された背景地図はブラウザの IndexedDB に永続化され、ページ再アクセス時にラジオ一覧へ復元される。
- 「最後に選択していた背景地図」もブラウザに永続化し、リロード後に同じ地図が選択された状態で表示される。
- ユーザー追加分は一覧上の操作メニュー（`⋮`）から個別に**編集・削除**できる。編集対象は名称・出典テキスト・出典リンク URL・minzoom・maxzoom とし、タイル URL は変更不可とする。
- 出典欄はテキストとリンク URL の 2 入力に分離し、ユーザー入力 HTML を直接 DOM 出力経路に流さない（XSS リスクの設計的排除）。
- プリセット 4 種類の挙動（URL／zoom 範囲／出典／初期視覚）と、ハザード重ね合わせ・指定緊急避難場所・現在地ライン・3D 地形の既存仕様は維持する。

**Non-Goals:**

- ベクタータイル（vector source）のユーザー追加は対象外。raster XYZ タイルのみ対応。
- カスタム背景地図の **タイル URL** の編集は対象外（URL を変えたい場合は新規追加で対応）。名称・出典・zoom 範囲の編集は対象内。
- 複数デバイス間での同期、エクスポート・インポート機能。
- API キー／ヘッダ／署名付き URL を必要とするタイルサービスのサポート（タイル URL の単純テンプレート置換のみ）。
- タイル URL の到達性チェック（リクエスト発行による事前検証）。失敗は MapLibre 側のタイル取得エラーに委ねる。
- ユーザーが大量（数百件規模）に追加するケースの最適化（想定は数件 〜 十数件）。

## Decisions

### 決定 1: 永続化先は IndexedDB、ラッパとして `idb-keyval` を採用

**選んだ案**: `idb-keyval` パッケージ（~600B gz、依存ゼロ）を `dependencies` に追加し、key/value で 2 つのレコードを管理する。

| key | 型 | 内容 |
| --- | --- | --- |
| `custom-basemaps` | `CustomBasemap[]` | ユーザー追加背景地図の定義配列 |
| `selected-basemap-id` | `string` | 現在選択中レイヤー ID（プリセット／ユーザー追加問わず） |

**`CustomBasemap` のフィールド**:

```
{
  id: string,                  // crypto.randomUUID() で生成
  label: string,               // 必須・1〜40 文字
  tileUrl: string,             // 必須・{z}/{x}/{y} を含む https URL
  attributionText: string,     // 任意・最大 200 文字
  attributionUrl: string,      // 任意・http(s) のみ
  minzoom: number | null,      // 任意・0〜24
  maxzoom: number | null,      // 任意・0〜24
  createdAt: number            // Date.now()
}
```

**検討した代替**:

- **localStorage**: 同期 API で楽だが、5 MB 制限・文字列のみで構造化データの取り回しが弱い。永続性とコストはほぼ同じだが将来拡張で詰む。
- **生 IndexedDB**: 依存ゼロにできるが、open/transaction/onerror 周りで 30 行以上の定型コードが必要。今回は素直に薄ラッパを採用する。

**なぜ key を 2 つに分けるか**: 更新頻度が違う（custom list はユーザー追加・削除時のみ、selection は選択操作のたび）。一方を更新するときに他方を読み書きしないで済むのと、片方の破損が片方に波及しにくい。

### 決定 2: 復元はマップ生成前に eager、ランタイム追加は lazy のハイブリッド

`main.js` を ES Module として、トップレベル `await idbGet('custom-basemaps')` を 1 回実行し、復元対象を `style.sources` / `style.layers` に注入してから `new maplibregl.Map({ style })` を呼ぶ。`selected-basemap-id` も同じく読み込み、対応レイヤーのみ `visibility: 'visible'` で初期化する。

ページ稼働後にユーザーがフォームで追加した分は `map.addSource()` / `map.addLayer(layer, beforeId)` で動的に登録する。

**検討した代替**:

- **完全 lazy**（map 作成後に追加）: 初期表示が一瞬 OSM になってから custom に切り替わる視覚チラつきが出る。
- **完全 eager**（追加分も style まるごと再構築）: `map.setStyle()` は重く、既存のハザード／skhb の表示状態がリセットされる。

→ 復元は eager、追加は lazy で、両方の利点を取る。

### 決定 3: 背景レイヤーの挿入位置は `hazard_flood-layer` の **直前**

ユーザー追加レイヤーは、プリセット 4 つの背景レイヤーの直後・ハザードレイヤー群の直前に並ぶようにする。`map.addLayer(layer, 'hazard_flood-layer')` の第 2 引数（beforeId）で位置を指定する。
これにより、背景としての可視位置が常にハザード／指定緊急避難場所／route／hillshade の下に来ることが保証される。

**検討した代替**:

- 末尾追加（beforeId 省略）: route や hillshade よりも上に描画され、背景の役割を果たさなくなる。
- `gsi_blank-layer` の直後に明示挿入: 同様に有効。ただし将来プリセットを足したときに beforeId を毎回更新する必要があり、ハザード基準のほうが破綻しにくい。

### 決定 4: 排他切替はプリセット・ユーザー追加を区別しない統一モデル

ラジオの `value` を **レイヤー ID** とする統一ルールを維持する。

| 種別 | レイヤー ID 形式 | 例 |
| --- | --- | --- |
| プリセット | 既存どおり | `osm-layer`, `gsi_std-layer`, ... |
| ユーザー追加 | `custom_${uuid}-layer` | `custom_a1b2c3d4-...-layer` |

選択時の処理は「**全背景レイヤーを `visibility: 'none'`、選択 ID だけ `visible`、IDB に selectedId を書き込み**」の一本道。プリセットとカスタムを If 分岐しないので、追加・削除によって切替コードが破綻しない。

`BasemapSwitcherControl` は内部に「現在のレイヤー ID 一覧」を保持し、これに対してラジオの再生成（追加・削除時）と排他切替を行う。

### 決定 5: 出典は 2 入力に分離し、アプリ側で `<a>` を組み立てる

フォームの出典欄は 2 つ:

- `attributionText`（テキスト・必須でなくて良い）
- `attributionUrl`（http/https のみ・任意）

レンダリングは:

```
text あり & url あり → `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${escHtml(text)}</a>`
text あり & url なし → `${escHtml(text)}`
text なし & url あり → `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`
両方なし         → 空文字（attribution 出力なし）
```

`escHtml` は `&<>"'` をエンティティ化、`escAttr` は属性用エスケープ。URL は `new URL(value)` でパースしつつ `protocol` が `http:` または `https:` 以外を拒否することで `javascript:` 系スキームを排除する。

**検討した代替**:

- HTML をそのまま受け付けて DOMPurify でサニタイズ: 追加依存（数十 KB）、フォームに HTML を書かせる UX も微妙。
- 完全プレーンテキスト: リンクが貼れず実用性が下がる。

→ 2 入力分離が依存ゼロ・XSS 面で最も堅い。

### 決定 6: 入力検証ルール

- **label**: 1〜40 文字、両端トリム、空文字不可。既存ラベル（プリセット含む）との重複は **許容**（ID は別のため）。
- **tileUrl**:
  - `new URL(value)` がスローしないこと。
  - `protocol` が `https:` のみ許可（`http:` は MapLibre が動く HTTPS ページから読むとミックスコンテンツで失敗するため、最初から弾く）。
  - 文字列に `{z}`、`{x}`、`{y}` がすべて含まれること（順序不問・大小区別あり）。
- **attributionUrl**: 空文字または `http:`/`https:` の有効 URL。
- **minzoom / maxzoom**: 空文字または `0`〜`24` の整数。両方指定された場合は `minzoom ≤ maxzoom`。
- 検証 NG はフォーム上で当該フィールドにメッセージを表示し、追加処理に進まない。

### 決定 7: 編集・削除はカスタム行の操作メニュー（`⋮`）から提供する

各カスタム行の右端に `⋮` ボタンを表示し（プリセット行には表示しない）、クリックで「編集 / 削除」のドロップダウンメニューを開く。

**「削除」選択時**:

1. 該当 ID の Source・Layer を `map.removeLayer` / `map.removeSource` で破棄。
2. `custom-basemaps` 配列から該当 ID を除外し IDB を更新。
3. ラジオ一覧を再描画。
4. **削除対象が現在選択中であった場合**は、`osm-layer` を選択状態へフォールバックし `selected-basemap-id` も `osm-layer` に更新。

**「編集」選択時**: 別途「決定 10」のフローに従う。

**削除確認**: 「削除」選択時には独自の `<dialog id="custom-basemap-delete-dialog">` を `showModal()` で画面中央に表示する。ダイアログには対象背景地図の名称を含む確認メッセージ、キャンセルボタン、確認（削除）ボタンを置く。ユーザーが「削除」を確定した場合のみ実際の削除処理（手順 1〜4）を実行し、キャンセル／Esc／バックドロップ等で閉じられた場合は何も変更しない。

実装は `confirmDelete(label): Promise<boolean>` を返す関数として独立させ、追加・編集フォームと同じ `<dialog>` の体験（モーダル中央表示、バックドロップ暗転、Esc で閉じる）を共有する。確認ボタン（破壊的アクション）は赤系（`#c0392b`）の背景で塗り、キャンセルボタンと視覚的に差別化する。

**検討した代替**:

- **`window.confirm()`**: 依存ゼロでアクセシビリティも自動だが、追加・編集フォームと外観が揃わず体験が不統一。
- **要素を背景の上に絶対配置（モーダルなし）**: フォーカストラップやバックドロップが自前実装になり手間が増える。`<dialog>` のネイティブ機能を使う方が筋がよい。

**UI 配色**: ドロップダウンの「編集」項目は青色（`#1253a4`、フォーム送信ボタンと同系）、「削除」項目は赤色（`#c0392b`）で表示し、破壊的操作を視覚的にも区別する。

**検討した代替**:

- **削除のみ `×` ボタン、編集は行クリック**: 編集導線が見つけづらく、行クリックの誤発火（ラジオ選択と取り違え）リスクがある。
- **編集・削除を 2 つのボタンとして並置**: 横幅を圧迫し、左下コントロールが拡張に弱い形になる。
- **`⋮` メニュー（採用）**: ボタン 1 個で済み、将来項目（例: 複製・エクスポート）も入れやすい。

### 決定 8: フォーム UI は `<dialog>` 要素・追加と編集で同一フォームを再利用

ネイティブ `<dialog>` を使う。`showModal()` で背景フォーカスを止め、Esc で閉じる挙動を OS 標準に任せられる。詳細設定（minzoom/maxzoom）は `<details>` で折りたたみ、初期状態では非表示。

`<dialog>` は最新の Chromium / Firefox / WebKit でフルサポート。本リポジトリは MapLibre GL JS をモダンブラウザ前提で使っているため要求環境と整合する。

**追加モード／編集モード**: 同じ `<dialog>` 要素を 2 モードで使い分ける。状態は `dialog.dataset.mode` と `dialog.dataset.editingId` で持つ:

| 要素 | 追加モード | 編集モード |
| --- | --- | --- |
| ダイアログタイトル | `背景地図を追加` | `背景地図を編集` |
| 名称入力 | 空 | 既存値を prefill |
| タイル URL 入力 | 空、編集可 | 既存値を prefill、**`readonly` 属性を付与し編集不可** |
| 出典テキスト・リンク URL | 空 | 既存値を prefill |
| minzoom/maxzoom（`<details>` 内） | 空 | 既存値を prefill。値があれば `<details open>` で初期展開 |
| 送信ボタン文言 | `追加` | `保存` |

モード切替は 1 つの「フォームを開く」関数で行う:

```
openForm({ mode: 'add' })
openForm({ mode: 'edit', record: customBasemap })
```

これにより、追加と編集でフィールド構成・検証ルールが必ず同じになる（検証ロジックも同一の `validateCustomBasemapInput()` を共有）。タイル URL の値は編集モードでもフォームから読み取って検証に渡すため、`readonly` でも検証は通る（既存値が有効である前提）。

### 決定 9: 復元失敗時の挙動

- `custom-basemaps` の読み込みで例外（IDB 不可・スキーマ不整合）→ コンソール警告のうえ、空配列として扱い、プリセットのみで起動。
- `selected-basemap-id` が指すレイヤーが存在しない（カスタムを別タブで削除した等）→ `osm-layer` にフォールバックし `selected-basemap-id` を上書き保存。
- IDB そのものが利用不可（プライベートモードの古いブラウザ等）→ 起動はするが追加機能は無効化し、フォームから「保存できません」エラーを返す。

### 決定 10: 編集保存は同一 ID で source/layer を作り直す統一フロー

MapLibre の raster source は `attribution` / `minzoom` / `maxzoom` の事後変更 API を持たないため、編集対象がこれらのうちいずれかであっても、内部的には source を作り直す必要がある。一方で**タイル URL は決定 8 により編集対象外**としたため、`tiles` 配列は不変。`removeSource → addSource` してもブラウザのタイルキャッシュからそのまま再描画され、ネットワーク再取得は発生しない。

このため、編集保存時は項目（名称のみ／出典のみ／zoom のみ／複合）を問わず常に同じシーケンスを実行する:

```
編集フォーム送信
  ↓ validate (validateCustomBasemapInput を再利用)
  ↓ IDB 更新 (saveCustomBasemap で id 既存上書き)
  ↓ 編集対象 ID が現在 map.getStyle().layers 内に存在するか確認
  ↓ あれば:
      const wasSelected = (await getSelectedBasemapId()) === layerId
      map.removeLayer(layerId)
      map.removeSource(sourceId)
      map.addSource(sourceId, buildSourceDef(updatedRecord))
      map.addLayer(buildLayerDef(updatedRecord, wasSelected), 'hazard_flood-layer')
  ↓ ラジオ一覧を再描画（label と attribution が更新される）
```

- **選択状態の保持**: 編集前に当該レイヤーが選択中だったかを事前に判定し、addLayer 時の `layout.visibility` を `'visible'` で復元する。選択中でなければ `'none'`。
- **ラベル衝突なし**: ID は変えないので排他切替コードは何も意識しなくて良い。
- **「名称だけ変更」最適化はしない**: 分岐を増やさず一律 source 再生成にすることで、コードパスが 1 本になり保守性が上がる。タイルキャッシュが効くため UX 上の差はない。

**検討した代替**:

- **項目別の分岐実装**（名称のみ → ラジオ再描画、出典／zoom → source 再生成）: コードが 2 本になり、将来「項目を追加した」際に分岐の更新漏れが起こりやすい。
- **タイル URL も編集可能にして、URL 不変／変更で再生成有無を切り替える**: タイル URL を変えると別のタイルプロバイダになり、概念的にもはや別物のため避けた（決定 8）。

## Risks / Trade-offs

- **タイル URL のミックスコンテンツ／CORS 不許可** → MapLibre がタイル取得に失敗してもアプリ自体は動く。URL の事前到達性確認は行わず、ユーザー側で URL の正しさを把握している前提とする（HTTPS 縛りでミックスコンテンツは最低限予防）。
- **出典 URL を絶対値で `http(s)` 限定にしているため、相対パスや独自スキームは登録不可** → 想定 UC からは外れる制約と判断。
- **ユーザー入力された label に長い文字列が入ると左下コントロールが縦に伸びる** → 40 文字制限で抑制。さらに CSS で `max-width` + 折り返しを設定。
- **`custom_${uuid}-layer` 形式の ID 衝突** → `crypto.randomUUID()` を採用するため実質衝突しない。
- **IDB 書き込み中にユーザーがリロード** → 書き込みは小さいので所要時間はミリ秒オーダー、被害は最後の 1 操作の損失に限定される。トランザクションは `idb-keyval` のデフォルト挙動に従う。
- **既存 spec の「初期表示は OSM」Scenario が書き換わる（**BREAKING**）** → 本変更で archived 後、main spec が「最後に選択した背景地図（無ければ OSM）」に上書きされる。プリセットだけ使うユーザーの体験は実質的に変わらない（初回アクセス時は OSM、明示的に切り替えた後は維持されるだけ）。
- **トップレベル `await` を main.js で使う** → ES Module 前提なら問題なし。ビルド設定（Vite）はモダンターゲットで通る想定。万一ターゲットが古い場合は `(async () => { ... })()` で包む。
