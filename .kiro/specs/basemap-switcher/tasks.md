# Implementation Plan

- [ ] 1. Core: 背景地図レジストリと出典安全ビルダ
- [x] 1.1 出典安全ビルダの実装
  - 型付き定数 `{label, url}` を受け、`new URL(url, location.href).protocol` が `http`/`https` のときのみ `rel="noopener"` `target="_blank"` 付きの最小 `<a>` 文字列を生成する
  - スキーム非適合（`javascript:` 等）は fail-closed でラベルテキストのみ返す
  - 利用者入力・外部由来データを引数に取らず補間しない（開発者統制下の定数のみ）
  - 観測可能な完了: 不正スキーム URL を渡すとラベルのみ、`https` URL を渡すとラベルと URL を分離した `<a>` 文字列を返すことを手動確認できる
  - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.4_
  - _Boundary: buildAttribution_

- [x] 1.2 背景地図レジストリ BASEMAPS の定義
  - 4 種（OSM / 地理院地図標準 / 航空写真 / 白地図）の id・日本語ラベル・raster source 定義（tiles・tileSize 256・per-source の minzoom/maxzoom）をレジストリとして定義する
  - ズーム/形式差を吸収: 航空写真は `.jpg`、白地図は maxzoom 14、地理院標準は maxzoom 18、OSM は既存値（maxzoom 19）を踏襲
  - 各 source の `attribution` を 1.1 のビルダ経由で設定し、OSM エントリは初期スタイルの既存 `osm` 定義と一致させる（既定＝OSM）
  - 観測可能な完了: 4 エントリが定義され、各エントリの source.attribution が 1.1 ビルダの出力文字列になっている
  - _Requirements: 1.2, 1.6, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1_
  - _Depends: 1.1_

- [ ] 2. Core: 背景切替ロジック
- [x] 2.1 背景切替関数 setBasemap の実装
  - 現アクティブ背景の layer を removeLayer、source を removeSource し、選択された source を addSource、`hazard_flood-layer` を beforeId に addLayer して常に最下（重畳より下）へ挿入する
  - 同一 id の再選択および BASEMAPS に無い id は no-op（不要な再生成・破壊を回避）
  - 背景以外（hazard_* / skhb / route / hillshade / 既存コントロール）に一切触れない
  - タイル取得失敗は MapLibre がタイル単位で許容し致命化しないため、本関数に追加のエラーハンドリングを設けない（設計上の非致命を維持）
  - 観測可能な完了: 任意 id 選択後に背景の source/layer が選択 1 種のみ存在し `hazard_flood-layer` の下に位置し、ハザード/skhb/route の表示状態が切替前後で不変
  - _Requirements: 1.3, 1.4, 2.5, 3.3, 3.4, 5.1, 5.2, 5.4_
  - _Depends: 1.2_

- [ ] 3. Core: 切替コントロール UI
- [x] 3.1 BasemapSwitcherControl（IControl）の実装
  - `maplibregl-ctrl maplibregl-ctrl-group` コンテナ内に `<fieldset>`＋支援技術用 `<legend>`＋`name="basemap"` の `<input type="radio">`＋`<label for>` を BASEMAPS 件数ぶん生成する
  - 既定（OSM）の radio を checked にし、change イベントで setBasemap を呼ぶ。onRemove でリスナ解放・DOM 除去。getDefaultPosition は `'bottom-left'`
  - ネイティブ radio によりキーボード操作・支援技術ラベル・選択状態提示を満たす
  - 観測可能な完了: コントロール DOM が生成され、各 radio 操作で setBasemap が呼ばれ、現在選択が checked で反映される
  - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2, 6.3_
  - _Depends: 1.2, 2.1_
  - _Boundary: BasemapSwitcherControl_

- [x] 3.2 (P) 切替コントロールの最小スタイル
  - `style.css` にコントロールの最小スタイルを追加し、既存コントロール（左上/右上/右下）と視覚的に調和させ、地図操作（パン・ズーム）を妨げない位置・サイズで配置し既存コントロールと重ならないようにする
  - DOM 構造・クラス名は design.md で固定のためタスク依存はなく、`main.js` 群とファイル競合しない（別ファイル `style.css`・presentation 境界）
  - 観測可能な完了: 左下に既存コントロールと重ならずに収まり、地図のパン/ズーム操作を阻害しない
  - _Requirements: 6.4_
  - _Boundary: style.css presentation_

- [ ] 4. Integration: 初期スタイル整合と load 登録への結線
- [x] 4.1 初期スタイル整合とコントロール登録
  - 初期スタイルの `osm` を BASEMAPS の OSM エントリと一貫させ（起動時の既定＝OSM、初期中心/ズーム/操作は現行維持）、`map.on('load')` 内の既存 addControl 群と同所に `map.addControl(new BasemapSwitcherControl(), 'bottom-left')` を登録する
  - 既存 OpacityControl（左上/右上）・Geolocate/Terrain（右下）の登録・位置を変更しない。`public/*`・`index.html`・ビルド設定は変更しない（PWA 既存挙動を維持）
  - 観測可能な完了: アプリ起動時に背景が OSM、左下に切替コントロールが表示され、既存コントロールの位置・挙動が不変
  - _Requirements: 1.1, 1.6, 5.3, 5.5_
  - _Depends: 1.2, 2.1, 3.1_

- [ ] 5. Validation: 二段検証
- [ ] 5.1 クリーン環境健全性の確認
  - lockfile 再現環境で `npm run build` / `npm run dev` / `npm run preview` を実行し、いずれも成功することを確認する（build グリーン単独を合格としない・偽 green 回避）
  - 観測可能な完了: 3 コマンドの成功ログが取得され、クリーン環境で再現できる
  - _Depends: 4.1_

- [ ] 5.2 実機スモークチェックリストの作成と検証
  - 受け入れ基準（機能：左下表示・4 種排他・即時反映・既定 OSM／表示品質：航空写真・白地図ズーム超過・地域外・タイル失敗継続／出典：OSM↔GSI 追従・旧出典残留なし・重畳出典維持・不正スキームでラベルのみ・markup 非注入／非回帰：ハザード・skhb・ナビ・3D 地形・既存コントロール・重畳視認性・PWA／アクセシビリティ：キーボード・読み上げ・選択状態・非重複）に対応したチェックリストを作成し、自動検証可能な範囲を確認する
  - UI/ライブラリ挙動は静的解析で断定せず、実機目視はユーザーへ依頼する（実装側はチェックリストを提供）
  - 観測可能な完了: 全受け入れ基準に対応したチェックリスト成果物が用意され、ユーザーへの実機目視確認依頼が明示される
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_
  - _Depends: 5.1, 3.2_

## Implementation Notes
- 2.1: main.js のブロックコメント／JSDoc 内に `hazard_*/skhb` のような **`*/` リテラルを書かない**（コメントが早期クローズしビルド構文エラー）。`hazard_ 各種` 等に言い換える。後続 3.1/4.1 の日本語コメント追記時も注意。`setBasemap` は hoisted 宣言で後方の `const map` を参照するが、呼出は実行時（3.1/4.1）のみで TDZ 非該当。
- 環境: subagent 追加利用枠が断続的に枯渇（リセット 17:20 Asia/Tokyo）。枯渇時は reviewer-prompt 許可のフォールバックでメインコンテキストにて kiro-review 手順を完全適用してレビューする（チェックを弱めない）。
- dist 方針: `npm run build` 実行で `dist/*` が再生成され git diff に出るが、これは検証生成物。per-task コミットには **source＋tasks.md のみ**ステージし `dist/*` は含めない（最終検証時にまとめて再生成・反映を判断）。
- 1.2→4.1 申し送り: OSM 出典は安全ビルダ経由で `<a href="https://www.openstreetmap.org/copyright" ...>OpenStreetMap contributors</a>` となり、既存初期スタイルの生文字列 `&copy; <a href="http://...">OpenStreetMap</a> contributors` から © グリフ脱落・http→https 昇格。Req 3.1 明示スコープ（contributors＋リンク）は充足だが、task 4.1 で初期スタイル `osm.attribution` との実整合時に OSM ラベルへ `© `（リテラル文字）前置の要否を人手判断する。
- 1.1: 既存 `main.js` は実際には **4 スペースインデント**（steering tech.md の「2 スペース」記述はこのファイルに不正確）。後続の main.js 変更は実ファイルの 4 スペースに合わせる。`buildAttribution` は imports と `const map = new maplibregl.Map(` の間（main.js 18–55 付近）に純関数として追加済み。検証は自動テスト基盤なしのため `npm run build` ＋ `node -e` ad-hoc 実行（一時ファイル/ログを残さない）。
