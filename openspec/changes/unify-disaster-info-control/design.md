## 背景

現在の `main.js` では `maplibre-gl-opacity` パッケージの `OpacityControl` クラスを 2 つインスタンス化し、`top-left`（災害想定区域 6 種）と `top-right`（指定緊急避難場所 8 種）にそれぞれ追加している。両コントロールはともに「`baseLayers` 設定によるレイヤーの排他選択 + 不透明度スライダー」という同一の仕組みで構築されており、選択切替時に `setLayoutProperty(layerId, 'visibility', ...)` 相当を通じてレイヤーの可視/不可視を制御する。

このアプリでの典型的な利用シーンは「特定の災害種別について、想定区域とそれに対応する避難所を併せて確認する」というものであり、災害想定区域と避難所は一対の情報として扱われる。にもかかわらず、現在の UI 配置は両者を画面の左右に分離しているため、意味的な関連が空間配置に反映されていない。本変更はこのギャップを埋める。

クリック・ホバー・現在地ライン描画（`main.js:1086-1205`）はいずれも `queryRenderedFeatures` で `skhb-*-layer` をフィルタしており、レイヤーの `visibility: 'none'` 状態のときは地物がレンダリングされず自然にクエリ対象から外れる。したがってこれらの後段処理は、レイヤーの可視状態を切り替える主体が `OpacityControl` か自作コントロールかに依存しない。

## ゴール / 非ゴール

**ゴール:**

- 災害想定区域 6 種と指定緊急避難場所 8 種の表示切替を、1 つのコントロールに統合する
- 統合コントロールを地図左上（`top-left`）に配置する
- 統合コントロール内では「災害想定区域」「避難所」の 2 セクションを縦並びで配置し、両者が同じ「災害情報」軸の情報であることを視覚的に表現する
- 各セクション内の挙動（排他選択でレイヤーの可視/不可視を切替）は、現行の `OpacityControl` と等価に保つ
- `maplibre-gl-opacity` パッケージ依存を本アプリから完全に取り除く

**非ゴール:**

- 災害種別（洪水・津波等）を 1 アクションで両セクションに反映する連動 UI（D 案）。本変更では災害想定区域と避難所の選択は独立操作のままとする
- レスポンシブ対応（縦に長くなったコントロールが狭い画面で地図領域を圧迫する問題）。別途検討
- 既存 `OpacityControl` の不透明度スライダー機能の継承。本変更では「ラジオによる表示/非表示切替のみ」に簡略化する
- セクションの折りたたみ・タブ切替 UI
- 地震・大規模な火事・内水氾濫・火山現象の避難所（想定区域に対応がないもの）の表示位置や順序の変更

## 設計判断

### 決定 1: 自作の統合コントロール `DisasterInfoControl` を実装し、`maplibre-gl-opacity` 依存を除去する

`maplibre-gl-opacity` の `OpacityControl` を 2 つ並べて CSS で見た目をくっつける案（B-1）も検討したが、以下の理由で自作（B-2）を採用する:

- セクション見出し（「災害想定区域」「避難所」）を 1 カードの中に自然に挟むには、ライブラリの DOM 構造の上から無理やり差し込むことになり、ライブラリ更新時に壊れやすい
- 本アプリで `OpacityControl` を使っているのはこの 2 箇所のみであり、依存パッケージを 1 つ減らせる
- 排他選択 + visibility 切替という機能は単純で、自作コストが小さい
- 既存 `BasemapSwitcherControl`（`main.js:513` 付近）が同様のパターン（自作 IControl）の前例として存在する

**代替案として却下した B-1（OpacityControl 2 個 + CSS）の問題点:** セクション間に見出しを差し込めない／カード間隙の CSS 調整がライブラリ実装に依存する／不透明度スライダーが残り続けるため UI 簡略化ができない。

### 決定 2: コントロールの DOM 構造は MapLibre 標準コントロール群と外観統一する

ルート要素は `div.maplibregl-ctrl.maplibregl-ctrl-group` を採用し、`BasemapSwitcherControl` および MapLibre 標準コントロール（`GeolocateControl` 等）と視覚的に揃える。これは `basemap-switching` 仕様の Requirement「コントロールが MapLibre 標準のコントロール外観に揃う」と同じ方針。

内部構造:

```
<div class="maplibregl-ctrl maplibregl-ctrl-group disaster-info-control">
  <section class="dic-section" data-role="hazard">
    <h3 class="dic-section-title">災害想定区域</h3>
    <label><input type="radio" name="dic-hazard" value="" checked> なし</label>
    <label><input type="radio" name="dic-hazard" value="hazard_flood-layer"> 洪水浸水想定区域</label>
    ... (合計 6 種)
  </section>
  <hr class="dic-separator">
  <section class="dic-section" data-role="shelter">
    <h3 class="dic-section-title">避難所</h3>
    <label><input type="radio" name="dic-shelter" value="" checked> なし</label>
    <label><input type="radio" name="dic-shelter" value="skhb-1-layer"> 洪水</label>
    ... (合計 8 種)
  </section>
</div>
```

セクション間の視覚的な区切りには `<hr class="dic-separator">` を用いる。セクション見出しはコントロール内の階層感を出すため `<h3>` を採用するが、地図上のコントロール内であり文書アウトラインへの影響は限定的であるため、必要に応じて `<div>` への置換も許容する（実装時の判断とする）。

### 決定 3: 「なし」を各セクションに 1 件追加して明示する

現行 `OpacityControl` では「選択を解除する」明示的な UI が存在せず、選択中のレイヤー名をもう一度クリックするか、別レイヤーに切り替えるしか方法がない（実装に依存）。自作するに当たり、各セクションの先頭に「なし」ラジオを設け、初期状態では両セクションで「なし」が選択された状態とする。これにより:

- 初回ロード時の状態（両系統ともレイヤー不可視）が UI 上で明示される
- ユーザーが任意に「全部消す」操作を 1 クリックで行える

### 決定 4: レイヤー可視切替は `map.setLayoutProperty(layerId, 'visibility', value)` を直接呼ぶ

各ラジオの `change` イベントで、当該セクションの全レイヤー ID に対して `visibility` を `'none'`、選択された ID に対してのみ `'visible'` を設定する。これは現行 `OpacityControl` と等価の操作であり、後段のクリック/ホバー/現在地ラインのロジック（`queryRenderedFeatures` 依存）と整合する。

不透明度スライダーは廃止する。理由:

- 災害想定区域・避難所いずれについても、本アプリで不透明度の細かい調整が必要なユースケースは特定されていない
- スライダー UI を残すと縦に長くなり、本変更の動機（左右分離の解消）と相反する縦圧迫を悪化させる
- 必要が出た場合は別 change で追加可能

### 決定 5: コントロール実装ファイルは独立ファイルに分離する

`main.js` がすでに 1,200 行を超えているため、`disasterInfoControl.js` として独立ファイルに切り出す。`BasemapSwitcherControl` は `main.js` 内に置かれているが、本変更で追加する `DisasterInfoControl` は最初から独立ファイルとする（既存 `BasemapSwitcherControl` を移動するのは別の話なのでスコープ外）。

エクスポートはクラス 1 つ（`DisasterInfoControl`）と、`main.js` が「災害想定区域 6 種」「避難所 8 種」の定義を渡すコンストラクタ API とする。レイヤー ID とラベルの一覧はコントロール内部にハードコードせず、`main.js` 側の地図定義と同じ場所で 1 箇所定義する（現行の `OpacityControl` 初期化と同形）。

### 決定 6: スタイルは `style.css` に追加し、`#opacity-control` ブロックは削除する

`style.css:8-57` の `#opacity-control` および range slider 関連スタイル（`maplibre-gl-opacity` 由来）は不要になるため削除する。`#opacity-control hr { display: none; }` の独自上書きも併せて削除。

新規スタイルは `.disaster-info-control` をルートに `BEM` 風の命名（`.dic-section`、`.dic-section-title`、`.dic-separator`）で追加する。

### 決定 7: 配置順序と既存コントロールとの非競合

`map.addControl(disasterInfoControl, 'top-left')` の 1 行で追加する。背景地図切替コントロール（左下）、GeolocateControl（右下）、TerrainControl（右下）、attribution（右下）と物理的に重ならないことは確認済み。`top-right` は本変更後、空き枠となる。

## リスク / トレードオフ

- **[縦の圧迫]** 6 + 8 + 2（「なし」）= 16 行に加えセクション見出し 2 行が左上に積み上がり、縦 800px 程度のノート PC では地図領域の半分以上を上方が占有する可能性がある → 本変更ではレスポンシブ度外視と合意済み。将来 C 案（折りたたみ／タブ）が必要になった場合のために、セクションは独立した `<section>` で囲み、後から `<details>` に置換しやすい構造にしておく
- **[既存テスト/手順との齟齬]** `basemap-switching` 仕様 / `dependency-baseline` 仕様 Scenarios が「右上 OpacityControl」を前提に書かれている → スコープに含めて本変更で更新する（モディファイ対象として proposal に明示済み）
- **[`maplibre-gl-opacity` を将来別レイヤーで使いたくなる可能性]** 依存削除すると後で再追加が必要になるリスク → ハザード / 避難所以外で不透明度コントロールが必要なケースは現時点で予定されていない。将来必要になれば `package.json` に再追加できる（破壊的な情報損失はない）
- **[`<h3>` の文書アウトライン汚染]** コントロール内に `<h3>` を置くとページのアウトラインに見出しが入ってしまう → 影響は地図アプリ単一ページ用途では限定的だが、気になる場合は `<div>` + `role="heading" aria-level="3"` 等の代替を実装時に検討してよい

## マイグレーション計画

本変更はランタイムでの永続データ移行は不要（ユーザーの選択状態はもともと永続化されていない。背景地図のみ IndexedDB に保存される別系統）。

**手順:**

1. `disasterInfoControl.js` を新規作成（コンストラクタ・onAdd・onRemove・getDefaultPosition・visibility 切替ロジック）
2. `style.css` に `.disaster-info-control` 関連スタイルを追加
3. `main.js` から `OpacityControl` の import と 2 箇所の `new OpacityControl(...)` / `addControl(..., 'top-right')` を削除
4. `main.js` で `DisasterInfoControl` を import し、`addControl(disasterInfoControl, 'top-left')` 1 行で追加
5. `style.css` の `#opacity-control` 関連スタイルを削除
6. `package.json` から `maplibre-gl-opacity` の `dependencies` 行を削除
7. `node_modules/` と `package-lock.json` を削除した上で `npm install` を実行し、`maplibre-gl-opacity` のツリーが消えていることを確認

**ロールバック:**

`git revert` で本変更コミットを取り消すか、依存削除前の状態のコミットに戻す。`maplibre-gl-opacity` パッケージは npm レジストリから消えていない限り再インストール可能。

## 未解決事項

- 「なし」ラジオを本当に明示するか、それとも現行 `OpacityControl` と同等に「選択しないと何も表示されない」暗黙の初期状態のみで足りるか（決定 3）。本提案では明示推奨だが、UX 上シンプル化の余地あり
- セクション間の区切りに `<hr>` ではなく単純な余白 + 太い区切り線を CSS で描画する選択肢もあり、視覚的に好ましい方を実装時に確認したい
- `<h3>` を使うか `<div role="heading">` を使うかは a11y / 文書アウトラインの観点から実装時に再検討の余地あり（決定 2 の末尾で言及）
- `maplibre-gl-opacity` のターゲットバージョン指定を `dependency-baseline` 仕様から削除した後、`README.md` の「検証内容 > ライブラリのバージョンアップ」セクションに痕跡を残すべきかどうか
