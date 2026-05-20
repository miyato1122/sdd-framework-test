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
- [x] 5.1 クリーン環境健全性の確認
  - lockfile 再現環境で `npm run build` / `npm run dev` / `npm run preview` を実行し、いずれも成功することを確認する（build グリーン単独を合格としない・偽 green 回避）
  - 観測可能な完了: 3 コマンドの成功ログが取得され、クリーン環境で再現できる
  - _Depends: 4.1_

- [x] 5.2 実機スモークチェックリストの作成と検証
  - 受け入れ基準（機能：左下表示・4 種排他・即時反映・既定 OSM／表示品質：航空写真・白地図ズーム超過・地域外・タイル失敗継続／出典：OSM↔GSI 追従・旧出典残留なし・重畳出典維持・不正スキームでラベルのみ・markup 非注入／非回帰：ハザード・skhb・ナビ・3D 地形・既存コントロール・重畳視認性・PWA／アクセシビリティ：キーボード・読み上げ・選択状態・非重複）に対応したチェックリストを作成し、自動検証可能な範囲を確認する
  - UI/ライブラリ挙動は静的解析で断定せず、実機目視はユーザーへ依頼する（実装側はチェックリストを提供）
  - 観測可能な完了: 全受け入れ基準に対応したチェックリスト成果物が用意され、ユーザーへの実機目視確認依頼が明示される
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_
  - _Depends: 5.1, 3.2_

- [ ] 6. Phase 1 Foundation: 共有ユーティリティ（utilities）
- [x] 6.1 出典安全ビルダ buildAttribution を DOM API 経由へ作り替え
  - 入力 `{label, url?}` を任意の信頼／未信頼として扱う単一実装にする。`createElement('a')` ＋ `textContent = label` ＋ `setAttribute('href', url)`（＋ `target="_blank"`、`rel="noopener"`）で構築し `outerHTML` を返す
  - `url` を `new URL(url, location.href)` で解析し `protocol` が `http:`／`https:` 以外、または解析が throw する場合は `<span>` を `textContent` のみで構築して fail-closed（ラベルのみ）
  - 既存 BUILTIN 4 種の経路（Phase 0 で使用中）もこの新実装に通すこと。`<a>` 生成パスの戻り値文字列の見た目は Phase 0 と意味的に等価（同じリンク先・同じテキスト）を保つが、生成方法のみ DOM API 化される
  - 観測可能な完了: `label` に `<img onerror=…>` を含む入力でも `outerHTML` 出力が markup を含まず実体参照化されている／`url` に `javascript:` を渡すと `<a>` が生成されず `<span>` のみ返る／既存 4 種の出典文字列出力が Phase 0 と意味的に等価
  - _Requirements: 3.2, 3.5, 4.1, 4.2, 4.3, 4.5_
  - _Boundary: buildAttribution_

- [x] 6.2 入力検証 validateCustomBasemapInput の実装（フォーム＋復元の単一情報源）
  - フォーム値および永続化由来の生値の双方に対し、必須（`label`／`tileUrl`／`attributionLabel`、trim 後 1〜100 文字）、`tileUrl` の `new URL` 解析可・`protocol === 'https:'`・`{z}`／`{x}`／`{y}` 各 1 回以上、`attributionLinkUrl`（任意）の http(s) スキーム、ズーム整数 0〜24・`minzoom ≤ maxzoom` を検査
  - 戻り値は `{valid, errors: [{field, message}], normalized?}`。すべての違反項目を `errors` に蓄積する（早期 return しない）。`valid===true` のときのみ `normalized` を返す
  - 観測可能な完了: 同一関数を渡してフォーム入力と永続化由来値の双方を検査でき、各違反ルールに対し対応する `errors[].field`／`message` を返す（手動 ad-hoc 実行で確認）
  - _Requirements: 4.4, 8.1, 8.2, 8.3, 8.4, 10.4_
  - _Boundary: Validate_

- [x] 6.3 永続化（カスタム定義側）helper の実装
  - `loadCustomBasemaps()`／`saveCustomBasemaps(items)` を実装。キー `basemap-switcher:v1:customs`、値は `{ version: 1, items: BasemapDefPersistable[] }` の JSON
  - 例外（`QuotaExceededError`／`SecurityError`／無効 JSON／version 不一致）は捕捉して読込は `[]`、保存は `false` を返す（fail-closed）。`fetch`／`sendBeacon` 等の外部送信 API は一切呼ばない（Req 10.3）
  - 観測可能な完了: storage 利用不可（無効 JSON 注入・disabled localStorage 模擬）で load は `[]`、save は `false` を返し例外が外へ漏れない／成功時に round-trip で同 JSON が読み戻せる
  - _Requirements: 10.1, 10.3, 10.5_
  - _Boundary: Persistence (customs)_

- [ ] 7. Phase 1 Core: レジストリ二層化と切替の汎用化
- [x] 7.1 BUILTIN_BASEMAPS への改名と freeze
  - 既存 `BASEMAPS` を `BUILTIN_BASEMAPS` に改名し `Object.freeze`（各エントリも freeze）
  - 既存参照箇所（`setBasemap` 内の `BASEMAPS.find`、`BasemapSwitcherControl.onAdd` の forEach、初期 style 内の `BASEMAPS.find(b => b.id === 'osm')` を含む）をすべて新名へ置換
  - 観測可能な完了: 改名後に `npm run build` が成功し、Phase 0 と同様にアプリ起動・OSM 表示・4 種切替が成立する（機能変化なし）
  - _Requirements: 1.2, 1.6, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1_
  - _Boundary: BUILTIN_BASEMAPS_

- [x] 7.2 Registry Phase 1 関数群（getAllBasemaps／getBasemapById／addCustomBasemap）
  - モジュールスコープ `let customBasemaps = []` を導入。`getAllBasemaps()` は `[...BUILTIN_BASEMAPS, ...customBasemaps]`、`getBasemapById(id)` は両層から検索して該当エントリを返す
  - `addCustomBasemap(def)` は `crypto.randomUUID()` で id を生成し `custom_<UUID>` を付与、`buildAttribution({label: def.attributionLabel, url: def.attributionLinkUrl})` で `attribution` を内部構成、`source` は `{type:'raster', tiles:[def.tileUrl], tileSize:256, minzoom?, maxzoom?}` で組み立てた `BasemapDef` を `customBasemaps` 末尾に追加して返す
  - 観測可能な完了: 新規 def を `addCustomBasemap` に渡すと `getAllBasemaps()` 末尾に追加され `getBasemapById(returned.id)` で取得できる／既存 BUILTIN 4 種への影響なし
  - _Requirements: 7.4_
  - _Boundary: Registry_
  - _Depends: 6.1_

- [x] 7.3 setBasemap の対象を全レジストリへ拡張（opts.persist は signature のみ）
  - 既存 `setBasemap(id)` を `setBasemap(id, opts)` に拡張。対象 id を `getBasemapById(id)` で解決（組込み＋利用者）し、未知 id・同一 id は no-op を維持
  - `opts.persist` は本タスクでは signature と既定 `true` のみ用意（`saveSelectedBasemapId` の実呼出結線は Phase 2 の 11.3）
  - 観測可能な完了: 組込み id・カスタム id のいずれを渡しても `setBasemap` が単一最下背景＋出典追従を維持する（重畳・skhb・route・hillshade 不変）
  - _Requirements: 1.3, 1.4, 2.5, 3.3, 3.4, 5.1, 5.2, 5.4, 7.5, 8.5_
  - _Boundary: setBasemap_
  - _Depends: 7.2_

- [ ] 8. Phase 1 Core UI: 切替コントロール拡張と追加フォーム骨格
- [x] 8.1 BasemapSwitcherControl への renderList 導入と change ハンドラの局所更新化
  - fieldset 内の動的部分を一度クリアして `getAllBasemaps()` を順に radio + label で再構築する `renderList()` を追加。`currentBasemapId` に一致する radio を checked にする
  - `change` デリゲーションハンドラは `setBasemap(value)` を呼んだ後、**該当 input の `.checked = true` のみ局所更新**して `renderList()` は呼ばない（矢印キー移動中のフォーカス喪失を回避、設計レビュー C2 対応）
  - `renderList()` の呼び出しはレジストリ変動時（add／edit／delete／restore 完了）と削除フォールバック時のみに限定する
  - 観測可能な完了: 既存 4 種でキーボード矢印移動中にフォーカスが消失せず連続選択できる／`renderList()` を明示的に呼ぶと現在の選択が再構築後も維持される
  - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2, 6.3_
  - _Boundary: BasemapSwitcherControl_
  - _Depends: 7.2, 7.3_

- [ ] 8.2 切替コントロール末尾の「＋ 背景地図を追加」ボタン行
  - `renderList()` の末尾に `<div class="basemap-add-row"><button type="button">＋ 背景地図を追加</button></div>` を 1 個生成。click で `formDialog.open({mode:'create'})` を呼ぶ（FormDialog 参照は Switcher が保持）
  - 既存 4 種の radio 行・既存コントロール（OpacityControl・Geolocate／Terrain）の位置・配置に影響しない
  - 観測可能な完了: 一覧末尾に「追加」ボタンが表示され、クリック時に FormDialog が `showModal()` で開く（Phase 1 では create のみ）
  - _Requirements: 7.1, 7.2_
  - _Boundary: BasemapSwitcherControl_
  - _Depends: 8.1_

- [ ] 8.3 BasemapFormDialog（create 専用）骨格の実装
  - `document.body` 直下に `<dialog class="basemap-form-dialog">` を 1 個生成し、Switcher が参照保持。`open({mode:'create'})` で空フォーム表示・`showModal()` で開く・最初の input にフォーカス
  - 内部 form: label／tileUrl／attributionLabel／attributionLinkUrl／minzoom／maxzoom の各 `<label for><input>` ペア、各 input 下の `aria-live="polite"` エラー領域、`<button type="submit">保存</button>`／`<button type="button">取消</button>`
  - 取消／ESC／backdrop はフォーム値を破棄し `dialog.close()`、レジストリ・永続化に副作用なし（Req 7.6）。submit 経路の実装結線は 9.1 で行う（本タスクは骨格と open／close のみ）
  - 観測可能な完了: 「追加」ボタンから dialog が開き、ESC／取消／backdrop で何の副作用もなく閉じる
  - _Requirements: 6.5, 7.2, 7.3, 7.6_
  - _Boundary: BasemapFormDialog_
  - _Depends: 8.2_

- [ ] 8.4 (P) 切替コントロール追加行と dialog の最小スタイル
  - `style.css` に `.basemap-switcher .basemap-add-row > button` と `dialog.basemap-form-dialog`（form／label／input／submit／cancel／error 領域）の最小スタイルを追加。既存色味と調和、レスポンシブ崩れなし、地図操作を妨げない
  - 観測可能な完了: 追加ボタンと dialog が視覚的に既存コントロールと調和し、フォームの label／input が読みやすく整列する
  - _Requirements: 6.4_
  - _Boundary: style.css presentation_

- [ ] 9. Phase 1 Integration: 追加フローの結線
- [ ] 9.1 FormDialog submit → Validate → Registry → Persistence → Switcher.renderList の結線（add 経路）
  - submit ハンドラで `validateCustomBasemapInput(formValues)` を呼ぶ。`valid===false` のときは各 input 下の `aria-live` エラー領域に文言を表示しダイアログを閉じない／最初のエラー入力へフォーカスを移す
  - `valid===true` のときは `addCustomBasemap(normalized)` → `saveCustomBasemaps(updatedItems)`。保存失敗時は dialog 内 `aria-live` 警告で「保存できませんでした（当該セッションのみ反映）」を提示しつつ追加自体は採用（セッション内有効、Req 10.5）
  - 成功／警告いずれの経路でも `Switcher.renderList()` を呼んで一覧と末尾「追加」ボタンを再構築し、`dialog.close()`
  - 追加されたカスタム背景の radio を選択すると `setBasemap(custom_id)` で組込みと等価に切替・出典追従が起こる（Req 7.5／3.5）
  - 観測可能な完了: 不正入力 4 系（必須欠落／`{z}{x}{y}` 不在／非 https／ズーム不正）でダイアログが閉じず該当 input にエラーが表示される／有効入力では一覧末尾にエントリが追加され即時選択でき、選択時に出典が利用者入力のラベル＋リンクに更新される／永続化失敗を強制した場合に dialog 内警告が表示される
  - _Requirements: 3.5, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 10.5_
  - _Depends: 6.1, 6.2, 6.3, 7.2, 7.3, 8.1, 8.3_

- [ ] 10. Phase 1 Validation: 二段検証
- [ ] 10.1 クリーン環境健全性の確認（Phase 1）
  - lockfile 再現環境で `npm install`（Windows 環境特性のため `npm ci` を回避）／`npm run build`／`npm run dev`／`npm run preview` を実行し、いずれも成功することを確認（build グリーン単独を合格としない／偽 green 回避）
  - 観測可能な完了: 4 コマンドの成功ログが取得され、`dev`／`preview` が HTTP 200 で `map` div と script を配信する
  - _Depends: 9.1, 8.4_

- [ ] 10.2 Phase 1 実機スモークチェックリストの作成と検証
  - 受け入れ基準（既存 Req 1.1〜1.5・Req 2.x・Req 3.1〜3.4・Req 5.x・Req 6.1〜6.4 の非回帰、Req 3.5（カスタム選択時の利用者入力出典追従）、Req 4.x（出典・タイル定義の安全構築・https 限定・markup 非解釈）、Req 7（追加フォーム）、Req 8.1〜8.4（入力検証）、Req 10.1／10.3／10.5（定義の永続化・外部送信なし・保存失敗 UX））に対応する Phase 1 スモークチェックリストを作成
  - 含めるべき項目: 既存 4 種の切替・出典追従・重畳維持が Phase 0 と同等／追加した出典文字列が AttributionControl の DOM に markup として注入されない（`label` に `<img onerror=…>` を含む入力でエスケープされて表示）／キーボード矢印移動中に選択フォーカスが消えない／永続化のために再読込しても追加した背景が一覧に残る（選択復元は Phase 2 で結線）
  - 実機目視はユーザー実施（チェックリスト提供）
  - 観測可能な完了: チェックリスト成果物が作成され、ユーザーへの実機目視依頼が明示される
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 10.1, 10.3, 10.5_
  - _Depends: 10.1_

- [ ] 11. Phase 2 Core: 編集・削除と選択永続化の基盤
- [ ] 11.1 Registry の編集／削除／復元追加（updateCustomBasemap／removeCustomBasemap／addRestoredCustomBasemap）
  - `updateCustomBasemap(id, def)`: 対象エントリ（`custom_` 接頭辞のみ）を id 保持で差し替え（順序維持）、`buildAttribution` で `attribution` を再構築。組込み id は no-op
  - `removeCustomBasemap(id)`: 対象エントリを除去（組込み id は no-op）。戻り値 `boolean`
  - `addRestoredCustomBasemap(item)`: Persistence 由来の `{id, ...normalized}` を受け取り、保存済み id を**そのまま採用**してレジストリ末尾に追加（新 UUID を振らない）。id が `/^custom_[0-9a-f-]{36}$/` に適合しない場合は何もせず戻る（防御的、設計レビュー C1 対応）
  - 観測可能な完了: update／remove で組込みは変化しない／restore は同 id でラウンドトリップ可能（保存→読込→addRestored → `getBasemapById(id)` で取得可）
  - _Requirements: 9.3, 9.4, 10.2_
  - _Boundary: Registry_
  - _Depends: 7.2_

- [ ] 11.2 永続化（選択 id 側）helper の実装
  - `loadSelectedBasemapId()`／`saveSelectedBasemapId(id)` を実装。キー `basemap-switcher:v1:selectedId`、値は `{ version: 1, id: string }` の JSON。読込失敗は `null`、保存失敗は `false`（fail-closed）
  - 観測可能な完了: round-trip で同 id が読み戻せる／無効 JSON や disabled localStorage 模擬で load=`null`／save=`false`／外部送信なし
  - _Requirements: 10.6, 10.7_
  - _Boundary: Persistence (selectedId)_

- [ ] 11.3 setBasemap の opts.persist 結線
  - 7.3 で signature だけ追加した `opts.persist`（既定 `true`）を実結線。`true` のとき `saveSelectedBasemapId(id)` を呼ぶ、`false` のとき呼ばない（復元経路向け）
  - 観測可能な完了: `setBasemap(id)` 呼出後に `loadSelectedBasemapId()` が当該 id を返す／`setBasemap(id, {persist:false})` ではストレージが変化しない
  - _Requirements: 10.6_
  - _Boundary: setBasemap_
  - _Depends: 7.3, 11.2_

- [ ] 12. Phase 2 Core UI: 編集・削除フォームと a11y 仕上げ
- [ ] 12.1 Switcher: 利用者エントリのみ「編集」ボタンを併置（組込みは非表示）
  - `renderList()` 内で、各エントリの `id` が `custom_` 接頭辞のときのみ `<button type="button" class="basemap-edit-button" data-id="..." aria-label="…を編集">編集</button>` を radio + label の右側に併置
  - 組込み 4 種には編集ボタンを描画しない（Req 9.2）。`click` デリゲーションで `.basemap-edit-button` → `formDialog.open({mode:'edit', entry})` を呼ぶ
  - 観測可能な完了: 既存 4 種に編集ボタンが表示されない／追加したカスタムエントリには編集ボタンが表示され、クリックで dialog が edit モードで開く
  - _Requirements: 9.1, 9.2_
  - _Boundary: BasemapSwitcherControl_
  - _Depends: 8.1, 8.2_

- [ ] 12.2 BasemapFormDialog edit モードの実装
  - `open({mode:'edit', entry})` で `entry`（`NormalizedCustomBasemapInput` 相当＋`id`）をフォームに pre-fill、タイトルと submit ラベルを編集用に切替
  - submit 成功時は `updateCustomBasemap(id, normalized)` → `saveCustomBasemaps(...)`。失敗時は add と同様に dialog 内 `aria-live` 警告＋ダイアログ open 継続
  - 成功時のみ `Switcher.renderList()` → `dialog.close()`
  - 観測可能な完了: 編集ボタンから既存値が pre-fill された dialog が開く／有効入力での保存で当該エントリの値・出典が即時更新される／永続化失敗時には警告が表示され dialog が閉じない
  - _Requirements: 9.3, 10.5_
  - _Boundary: BasemapFormDialog_
  - _Depends: 8.3, 11.1_

- [ ] 12.3 BasemapFormDialog 削除フローと保存失敗 UX（C3 対応）
  - edit モード時のみ表示する `<button type="button">削除</button>` を追加。click で `window.confirm` で確認後 `removeCustomBasemap(id)` → `saveCustomBasemaps(...)`
  - 保存成功時: 選択中だったなら `setBasemap('osm')` → `Switcher.renderList()` → `dialog.close()`
  - 保存失敗時: dialog 内 `aria-live` 警告「削除を保存できませんでした（当該セッションのみ反映、次回読込で復活します）」を表示し、選択中だったなら `setBasemap('osm')` までは実施するが**ダイアログは閉じず**、利用者の明示操作（取消／再試行）に委ねる（add／edit と対称）
  - 観測可能な完了: 削除確認後、保存成功で一覧から除去・選択中なら OSM に戻る・dialog 閉じる／保存失敗時には警告が表示され dialog が閉じない／重畳レイヤ・既存機能の状態は削除前後で不変
  - _Requirements: 9.4, 9.5, 9.6, 10.5_
  - _Boundary: BasemapFormDialog_
  - _Depends: 12.2_

- [ ] 12.4 BasemapFormDialog の a11y 仕上げ
  - 各 input に `<label for>`、required 視覚表示、エラー領域 `aria-live="polite"`、submit 失敗時の最初のエラー input への自動フォーカス、submit 中フラグで重複送信防止、ESC／backdrop での確実な close
  - 観測可能な完了: キーボードのみで「開く→入力→保存→編集→削除→cancel／ESC」が完結する／スクリーンリーダで dialog タイトル・各 label・エラー文言が読み上げられる（実機目視はチェックリスト依頼）
  - _Requirements: 6.5_
  - _Boundary: BasemapFormDialog_
  - _Depends: 8.3, 12.2, 12.3_

- [ ] 12.5 (P) 編集ボタン・削除ボタン・aria-live エラー領域のスタイル
  - `style.css` に `.basemap-switcher .basemap-edit-button`（編集ボタンの最小サイズ・整列）、`dialog.basemap-form-dialog` 内の `button[type=button]`（取消・削除）と `aria-live` エラー領域の最小スタイルを追加
  - 観測可能な完了: 編集／削除ボタンが視覚的に区別でき（削除は破壊的操作と分かる）、エラー領域が利用者の目に明確に表示される
  - _Requirements: 6.4, 6.5_
  - _Boundary: style.css presentation_

- [ ] 13. Phase 2 Integration: 起動時復元の結線
- [ ] 13.1 restoreOnLoad の実装
  - `loadCustomBasemaps()` の各 item を `validateCustomBasemapInput` で再検証。通過分のみ `addRestoredCustomBasemap({id: item.id, ...normalized})` でレジストリに反映（新 UUID を振らない）。検証落ち item はスキップ
  - `loadSelectedBasemapId()` を `getBasemapById` で解決。`undefined`／`'osm'` のときは初期 osm を維持。それ以外で組込み／復元成功カスタムに該当する id のときは `setBasemap(id, {persist:false})`
  - いずれの失敗（読込失敗・検証失敗・id 不在）も致命化しない（OSM フォールバック）
  - 観測可能な完了: 永続化済みカスタムが起動時に一覧に再表示される／永続化済み選択 id が組込み or 有効カスタムなら起動時に当該背景が選択される／無効 selectedId や破損 item では OSM にフォールバックし他の有効 item は復元される
  - _Requirements: 1.6, 10.2, 10.4, 10.7, 10.8_
  - _Boundary: restoreOnLoad_
  - _Depends: 6.2, 11.1, 11.2, 11.3_

- [ ] 13.2 map.on('load') 内の登録順整理と Req 1.6 改訂の意味結線
  - `map.on('load')` 内のシーケンスを以下順に整理: 既存 OpacityControl×2 → `restoreOnLoad()`（新規）→ `map.addControl(new BasemapSwitcherControl(), 'bottom-left')`（既存）→ 既存 click／mousemove／render／terrain
  - これにより Switcher の初回 `renderList()` が復元後の `customBasemaps` と `currentBasemapId` を反映する（中間状態は addControl 前に閉じる）
  - 観測可能な完了: 起動時に永続化選択がある場合は OSM ではなく当該背景で初期表示され、Switcher の checked radio がそれを示す／永続化選択がない場合のみ OSM 表示（Req 1.6 改訂の意味通り）
  - _Requirements: 1.6, 10.7, 10.8_
  - _Depends: 13.1_

- [ ] 14. Phase 2 Validation: 二段検証
- [ ] 14.1 クリーン環境健全性の確認（Phase 2）
  - lockfile 再現環境で `npm install`／`npm run build`／`npm run dev`／`npm run preview` を実行し、いずれも成功することを確認（build グリーン単独を合格としない）
  - 観測可能な完了: 4 コマンドの成功ログが取得され、`dev`／`preview` が HTTP 200 で `map` div と script を配信する
  - _Depends: 13.2, 12.5_

- [ ] 14.2 Phase 2 実機スモークチェックリストの作成と検証
  - Phase 2 で新たに観測可能になる受け入れ基準（Req 1.6 改訂結線、Req 6.5、Req 8.5、Req 9.x、Req 10.6〜10.8）と Phase 1 → Phase 2 を通じた非回帰（Req 1〜6 全体）を含むチェックリストを作成
  - 含めるべき項目: 編集ボタンから dialog が pre-fill 表示→保存で即時反映／削除で選択中なら OSM フォールバック・非選択なら表示維持・既存機能不変／組込み 4 種に編集・削除ボタンが存在しない／任意背景を選択→再読込で当該背景が復元／永続化選択 key を DevTools で削除した後の再読込で OSM フォールバック／永続化済み item に破損データを差し込んだ後の再読込で破損のみ無視され他は復元／キーボードのみで「追加→編集→削除→cancel／ESC」が完結／カスタムタイルの取得失敗時に地図全体がクラッシュせず重畳・ナビが継続
  - 実機目視はユーザー実施（チェックリスト提供）
  - 観測可能な完了: チェックリスト成果物が作成され、ユーザーへの実機目視依頼が明示される
  - _Requirements: 1.6, 6.5, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.2, 10.4, 10.6, 10.7, 10.8_
  - _Depends: 14.1_

## Implementation Notes
- 完了: 2026-05-19 ユーザー実機スモークで全項目 PASS（差し戻し2点修正後に再確認）→ フィーチャー受け入れ・完了。OSM 出典の `©` 付与は任意フォローアップとして未実施（ユーザー受け入れ時点で不要判断）。
- スモーク差し戻し#1（cross-task 契約バグ）: BASEMAPS は `attribution` を `source` の **外**に持つ（1.2 の構造）。背景 source を addSource する全経路は `{ ...entry.source, attribution: entry.attribution }` でマージ必須。`setBasemap`(2.1) が `entry.source` のみ渡しており切替後に出典が消失（初期 OSM は 4.1 の merge で偶然表示されていたためマスクされた）。修正済。教訓: レジストリが属性を分離保持する場合、消費側の全注入点で同一マージ規約を守る／cross-task 検証で「契約形 vs 消費形」を突き合わせる。
- スモーク差し戻し#2（レイアウト）: コントロールは各オプションを `div.basemap-option` で包み、CSS `.basemap-option{display:flex;align-items:center}` で radio＋label を同一行に、fieldset 縦並びで 1 オプション 1 行。CSS の構造コメントも実 DOM に追従更新（stale コメント回避）。
- 5.1: 当 Windows 環境で `npm ci` は `@rolldown/binding-win32-x64-msvc/...node` の OS 書込拒否（既知特性）で失敗する。クリーン環境再現は `npm install`（lockfile 整合・全消去回避）を正準とする＝偽 green ではなく特性起因の限定を明示。検証実績: install EXIT0/脆弱性0、build EXIT0、preview/dev とも HTTP 200（map div＋script 配信）。dev/preview はバックグラウンド起動→node fetch で 200 確認→port 5173/4175 を taskkill 停止（背景タスクの "failed exit1" は taskkill の結果＝サーバ自体は起動成功）。最終検証（kiro-validate-impl）もこの方針。
- 2.1: main.js のブロックコメント／JSDoc 内に `hazard_*/skhb` のような **`*/` リテラルを書かない**（コメントが早期クローズしビルド構文エラー）。`hazard_ 各種` 等に言い換える。後続 3.1/4.1 の日本語コメント追記時も注意。`setBasemap` は hoisted 宣言で後方の `const map` を参照するが、呼出は実行時（3.1/4.1）のみで TDZ 非該当。
- 環境: subagent 追加利用枠が断続的に枯渇（リセット 17:20 Asia/Tokyo）。枯渇時は reviewer-prompt 許可のフォールバックでメインコンテキストにて kiro-review 手順を完全適用してレビューする（チェックを弱めない）。
- dist 方針: `npm run build` 実行で `dist/*` が再生成され git diff に出るが、これは検証生成物。per-task コミットには **source＋tasks.md のみ**ステージし `dist/*` は含めない（最終検証時にまとめて再生成・反映を判断）。
- 1.2→4.1 申し送り: OSM 出典は安全ビルダ経由で `<a href="https://www.openstreetmap.org/copyright" ...>OpenStreetMap contributors</a>` となり、既存初期スタイルの生文字列 `&copy; <a href="http://...">OpenStreetMap</a> contributors` から © グリフ脱落・http→https 昇格。Req 3.1 明示スコープ（contributors＋リンク）は充足だが、task 4.1 で初期スタイル `osm.attribution` との実整合時に OSM ラベルへ `© `（リテラル文字）前置の要否を人手判断する。
- 1.1: 既存 `main.js` は実際には **4 スペースインデント**（steering tech.md の「2 スペース」記述はこのファイルに不正確）。後続の main.js 変更は実ファイルの 4 スペースに合わせる。`buildAttribution` は imports と `const map = new maplibregl.Map(` の間（main.js 18–55 付近）に純関数として追加済み。検証は自動テスト基盤なしのため `npm run build` ＋ `node -e` ad-hoc 実行（一時ファイル／ログを残さない）。
- 2026-05-20 spec 再オープン（Path A、第2段）: 受け入れ済み 1〜5 は Phase 0 として保持（非回帰ベースライン）。6〜10 が Phase 1（追加・選択・安全出典・定義永続化）、11〜14 が Phase 2（編集・削除・選択復元・検証 UX 仕上げ）— `research.md` 第2段ギャップ分析 Option C と `design.md` の Implementation Ordering と整合。
- 設計レビュー Critical 反映: (C1) Registry を `addCustomBasemap`／`addRestoredCustomBasemap` に分割し復元時の id を保持（Phase 2 11.1／13.1）／(C2) Switcher の `change` ハンドラは局所 checked 更新のみで `renderList()` を呼ばず、`renderList()` は registry 変動時に限定（Phase 1 8.1）／(C3) FormDialog 削除の保存失敗 UX を add／edit と対称化（Phase 2 12.3）。
- 6.1 の `buildAttribution` DOM API 化は既存 BUILTIN 4 種にも適用するため、Phase 0 出典文字列の意味的同等性（リンク先・テキスト・スキーム fail-closed 挙動）を 10.2 スモークの非回帰観点に含める。MapLibre v5 サニタイザは多層防御の最後段に降格（[[reference_maplibre_v5_attribution_sanitizer]] — 唯一の防御に依存しない）。
- 新規 npm 依存ゼロ。`<dialog>`／`localStorage`／`crypto.randomUUID`／DOM API はすべてブラウザ標準（`research.md` 第2段 Synthesis の build-vs-adopt 決定）。
- 既存学習事項の継続適用: main.js は 4 スペースインデント／コメント内に `*/` リテラル禁止／Windows 環境では `npm install` を正準（[[project_windows_env_filelock]]）／`dist/*` は per-task コミットに含めない（最終検証時にまとめて再生成・反映を判断）／[[project_001_false_green_build]] によりクリーン環境 build 単独を合格としない／[[feedback_verify_ui_at_runtime]] により UI 挙動は実機目視チェックリスト依頼（10.2／14.2）。
