# Phase 2 実機スモークチェックリスト — basemap-switcher（第2段最終）

本書は **basemap-switcher 第2段の全実装完了状態（Phase 0／Phase 1／Phase 2 = タスク 1〜14 全 [x]）** に対する**ブラウザ実機目視**チェックリストです。tech.md／プロジェクト方針により UI・ライブラリ挙動は静的解析で断定せず、**実機目視はユーザーが実施**します（実装側＝本チェックリスト＋自動検証 = 14.1 のクリーン環境健全性まで完了済み）。

Phase 1 スモーク（`phase1-smoke-checklist.md`）と重複する非回帰項目は最小限に絞り、Phase 2 で**初めて観測可能になる挙動**＋**ユーザー報告の永続化不動作問題の解消確認**を中心に検証します。

## 前提・起動手順

- 14.1 で `npm install` / `npm run build` / `npm run dev` / `npm run preview` を ALL GREEN 確認済（Windows 環境特性により `npm ci` 不可・`npm install` lockfile 整合を正準）。
- 実機確認はモダンブラウザ（WebGL2／ネイティブ `<dialog>` 対応）で実施。
- 起動: リポジトリルートで `npm run dev`（または `npm run build` 後 `npm run preview`）→ 表示された `http://localhost:<port>/` を開く。
- 各項目の判定欄に PASS / FAIL（FAIL は所見を併記）を記入。1 件でも FAIL があれば該当タスクへ差し戻し。

## 0. 事前準備: 永続化のクリア（テストの独立性確保）

- [ ] DevTools → Application → Storage → Local Storage → 当該 origin → 既存の `basemap-switcher:v1:customs` ／ `basemap-switcher:v1:selectedId` キーを**全削除**してからリロード。以降の項目を実施。

## 1. **【最重要】ユーザー報告の永続化不動作の解消確認（Req 10.1／10.2／10.7／10.8）**

- [ ] 1.1 ＋ボタンから `MyMap` を有効入力（表示名=`MyMap`、タイル URL=`https://tile.openstreetmap.org/{z}/{x}/{y}.png`、出典テキスト=`Test`）で追加 → 一覧末尾に `MyMap` 行が現れる。
- [ ] 1.2 DevTools → Application → Local Storage で `basemap-switcher:v1:customs` キーに `{"version":1,"items":[{"id":"custom_...","label":"MyMap",...}]}` が保存されている（Phase 1 で確認した write 側）。
- [ ] 1.3 **`MyMap` を選択**（地図表示が当該タイルに切替・出典欄に `Test` 表示）→ DevTools で `basemap-switcher:v1:selectedId` キーに `{"version":1,"id":"custom_..."}` が保存されている（Phase 2 新規: 11.2／11.3）。
- [ ] 1.4 **ブラウザを再読込（F5）** → 一覧末尾に `MyMap` 行が**再表示**される（Req 10.2、Phase 1 と同じ期待）。
- [ ] 1.5 **再読込後の表示中背景が `MyMap`**（OSM ではなく）になっている／Switcher の checked radio も `MyMap`（Req 10.7、Phase 2 新規結線）。**← これが Phase 1 で動かなかった項目**
- [ ] 1.6 さらに別の背景（例: 地理院地図(標準)）を選択 → 再読込 → 地理院標準が復元（組込み id も復元対象、Req 10.7）。

## 2. **【最重要】Req 1.6 改訂結線（永続化選択なきときのみ OSM）**

- [ ] 2.1 DevTools で `basemap-switcher:v1:selectedId` キーのみ削除（customs は残す）→ リロード → 表示は OSM（永続化選択なき初回フォールバック、Req 1.6 改訂版／Req 10.8）。一覧は `MyMap` 等のカスタムが残っている。
- [ ] 2.2 DevTools で `basemap-switcher:v1:selectedId` キーの値を `{"version":1,"id":"custom_does_not_exist"}` に書き換え → リロード → 表示は OSM フォールバック（解決不能 id → 致命化せず OSM、Req 10.8）。
- [ ] 2.3 永続化値の破損: `basemap-switcher:v1:customs` の items 配列の 1 要素の `tileUrl` を `http://invalid`（非 https）に書き換えて再読込 → **破損 item のみ無視**され他の有効 item は復元（Req 10.4 復元時再検証／validateCustomBasemapInput）。

## 3. **カスタム背景地図の編集（Req 9.1／9.2／9.3／10.5）**

- [ ] 3.1 一覧の各エントリを目視: **組込み 4 種（OSM／地理院標準／航空写真／白地図）には編集ボタンが表示されない**（Req 9.2）。
- [ ] 3.2 利用者追加分（`MyMap` 等）には**「編集」ボタン**が併置されている（Req 9.1、style.css 12.5 で控えめなトーン）。
- [ ] 3.3 編集ボタン押下 → ダイアログが**「カスタム背景地図を編集」タイトル**で開き、**全 6 フィールドが現在値で pre-fill** されている（Req 9.3／12.2）。
- [ ] 3.4 表示名を `MyMap → MyMapEdited` に変更して保存 → ダイアログが閉じ、一覧の当該エントリのラベルが `MyMapEdited` に更新される（即時反映、Req 9.3）。
- [ ] 3.5 編集後、再読込 → `MyMapEdited` が永続化されている（編集結果が save される、Req 10.1）。
- [ ] 3.6 編集ダイアログで不正入力（タイル URL を `http://` 等）→ 保存ボタンでエラー表示し**ダイアログ閉じず**追加変更されない（Req 8.1〜8.4・add 経路と同様）。
- [ ] 3.7 編集対象が**現在選択中**の場合の地図表示更新: ラベルや出典の変更は一覧表示には即時反映されるが、**地図表示中のタイル／出典は当該 radio を選び直すまで更新されない**（known limitation・design 12.2 の `setBasemap` 同 id no-op 仕様）。実機で MyMapEdited を再選択 → 地図表示が新しい設定で更新される。

## 4. **カスタム背景地図の削除（Req 9.4／9.5／9.6／10.5）**

- [ ] 4.1 編集ダイアログ内に**「削除」ボタン**（赤系、左寄せ）が表示されている（12.3／12.5）。create モードでは非表示。
- [ ] 4.2 削除ボタン押下 → `window.confirm` で確認ダイアログ表示。**取消**選択で何も起きず元のダイアログ表示維持。
- [ ] 4.3 削除確認 OK → ダイアログ閉じ、当該エントリが一覧から消える（Req 9.4）。
- [ ] 4.4 **削除前に当該エントリが選択中だった場合**: 削除後の表示中背景が**OSM に自動フォールバック**（Req 9.5、Switcher の checked も OSM に切替）。重畳ハザード／skhb／現在地ナビ等は不変（Req 9.6）。
- [ ] 4.5 削除後再読込 → 当該エントリが完全に消えている（永続化反映、Req 10.1）。
- [ ] 4.6 保存失敗 UX: DevTools Console で `localStorage.setItem = () => { throw new Error('Quota'); }` を実行 → 編集ダイアログから削除 → ダイアログ内 aria-live 領域に「削除を保存できませんでした（当該セッションのみ反映、次回読込で復活します）」が表示され**ダイアログ閉じない**（C3 一貫性／Req 10.5）。一覧では削除が in-memory で反映されている（再読込で復活することも警告どおり）。

## 5. **a11y 仕上げ（Req 6.5）**

- [ ] 5.1 マウスを使わず**キーボードのみ**で以下が完結する: 矢印キーで「追加」ボタン or 「編集」ボタンへ移動 → Enter で dialog 開く → Tab で input 移動 → 入力 → Enter / Tab で「保存」「取消」「削除」ボタン到達 → Enter で実行 → ダイアログが ESC で閉じる。
- [ ] 5.2 検証エラー発生時: 保存ボタン押下 → エラー表示後、フォーカスが**最初のエラー入力**へ自動的に移っている（showFieldErrors）。
- [ ] 5.3 dialog タイトル・各 label・aria-live エラー文言がスクリーンリーダ／ブラウザ読み上げで読み上げられる。
- [ ] 5.4 削除確認 `window.confirm` も AT で読み上げられ操作可能。
- [ ] 5.5 矢印キーで radio 連続移動中、選択フォーカスが**消失しない**（C2 修正の検証、Phase 1 と同様の挙動が Phase 2 でも維持）。

## 6. **Phase 1 / Phase 0 非回帰**

- [ ] 6.1 Phase 1 で実証済の挙動が Phase 2 でも維持されている（既存 4 種切替・出典追従・追加フローの基本動作・重畳維持・既存コントロール位置）。
- [ ] 6.2 タイル取得失敗時の非回帰: カスタム背景の tileUrl を意図的に到達不能な URL（`https://invalid.example.com/{z}/{x}/{y}.png`）で追加して選択 → 地図が**クラッシュしない**、重畳ハザード／現在地ナビ／3D 地形が継続動作（Req 8.5）。
- [ ] 6.3 PWA（manifest・Service Worker）のインストール／オフライン挙動が Phase 0 と同等。

## 受け入れ判定

全項目 PASS → **basemap-switcher 第2段の全実装完了として受け入れ**。`/kiro-validate-impl basemap-switcher` で feature 全体の最終検証を実行できる状態。
1 件でも FAIL → 該当タスクへ差し戻し（commit hash と所見を併記）。

特に **項目 1.5（再読込後の選択復元）** はユーザー報告の永続化不動作問題への直接対応であり、ここが PASS することが本フェーズの主要受け入れ条件です。
