---
description: "Task list template for feature implementation"
---

# Tasks: ユーザー定義のオリジナル背景地図の追加

**Input**: Design documents from `/specs/003-custom-basemap/`
**Prerequisites**: plan.md（必須）, spec.md（必須・ユーザーストーリー）, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本プロジェクトは憲章 II（純粋ロジックは自動ユニットテスト必須・決定論的・実ネットワーク非依存）が MUST。`basemaps.js` の純粋ロジック（検証/生成/既定値）のみ自動テスト対象（**test-first**）。自作コントロール／フォーム描画・選択切替・出典自動追従・a11y・002 回帰はユニット化不可のため quickstart.md の手動スモークで検証する（憲章 II が許容する手動スモーク経路）。`npm run build`/`npm run test` はクリーンインストール環境で再検証（偽green回避）。

**Organization**: タスクはユーザーストーリー単位で分割し各ストーリーを独立に実装・テスト可能にする。**002（背景地図スイッチャー）への増分拡張**であり、利用者制約「新規ライブラリ追加なし（現行依存のみ）」を全タスクで厳守。002 の組み込み4種・既定OSM・出典自動表示・ハザード/skhb コントロールを**回帰させない**（FR-011）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 所属ユーザーストーリー（US1/US2/US3）。Setup/Foundational/Polish には付けない
- 説明には正確なファイルパスを含める

## Path Conventions

- 本リポジトリはルート直下フラット構成（`src/` なし）。アプリコード=ルートの `main.js`／既存 `basemaps.js`（拡張）／新規 `basemap-switcher.js`、テスト=`tests/unit/basemaps.test.mjs`、共有スタイル=`opacity-control.css`／`style.css`。
- plan.md「プロジェクト構成 > ソースコード」に従う。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存プロジェクト前提の確認（新規スキャフォールドなし）

- [X] T001 リポジトリルートで `npm install` 済みを確認し、本機能で `package.json`／`package-lock.json` を変更しない方針を確立する（新規依存ゼロ＝利用者制約・憲章 I）。クリーン環境で既存 `npm run test`／`npm run build` が green であることをベースラインとして確認（quickstart.md §0、偽green回避）
- [X] T002 [P] 既存の Lint/Format 設定で現行コードがクリーンに通ることを確認する（設定ファイルは変更しない。憲章ワークフローのゲート前提）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する純粋 API（`basemaps.js` 拡張）と自作スイッチャー基盤の確立

**⚠️ CRITICAL**: 本フェーズ完了まで US1/US2/US3 の実装に着手しない（純粋関数と自作コントロールが3ストーリー共通基盤。002 回帰禁止の土台）

- [X] T003 [P] `tests/unit/basemaps.test.mjs` に `contracts/basemaps-module.md` のテスト観点1〜7を追記する（既存002観点5件は維持＋各 `BASEMAPS` 要素 `isUserDefined===false`／`DEFAULT_USER_TILE_ZOOM==={tileSize:256,maxzoom:19}`／`validateCustomBasemapInput` 正常系＋全異常系（label/urlTemplate/attribution 各空・重複label（組み込み&追加済み）・URL解釈不能・`{z}{x}{y}`欠落・非http(s)スキーム・混在コンテンツhttpはok）／`createCustomBasemap` の source 形（tileSize:256/maxzoom:19/minzoom無）・`isUserDefined:true`・`isDefault:false`・id一意・`tiles[0]===urlTemplate`）。`node --test` で実ネットワーク非依存に記述し、**実装前に実行して FAIL することを確認**（憲章 II・test-first・SC-004）
- [X] T004 `basemaps.js` を後方互換に拡張する：各 `BASEMAPS` 要素へ `isUserDefined:false` を付与（既存フィールド・順序・値・公開API は不変）、`DEFAULT_USER_TILE_ZOOM` 定数、純粋関数 `validateCustomBasemapInput(input, existingLabels)`／`createCustomBasemap(input)` を `contracts/basemaps-module.md`・`research.md` R2/R3/R4 どおり副作用なし・id 生成は決定論的に実装する。`npm run test` で T003 が **PASS** に変わることを確認（依存: T003）
- [X] T005 `basemap-switcher.js` を新規作成する：MapLibre `IControl`（`onAdd`/`onRemove`）として、`BASEMAPS`／`buildBaseLayers()` から組み込み4種を `#opacity-control` の DOM 形状（ネイティブ `input[type=radio]`＋`label[for]`）で排他描画し、選択で対象背景レイヤーのみ可視へ即時切替するロジックを実装する（追加ボタンは未実装。既存 `opacity-control.css` を流用＝インライン不使用・憲章 III。依存: T004）
- [X] T006 `main.js` を結線変更する：bottom-left の背景用 `new OpacityControl({ baseLayers: buildBaseLayers() })`＋`addControl(...,'bottom-left')` を `basemap-switcher.js` の自作コントロールへ置換する。ハザード(top-left)/skhb(top-right) の `OpacityControl`、既存 `map.on('error')`／`.map-error-toast` は一切変更しない（FR-011・research R1′。依存: T005）

**Checkpoint**: 背景スイッチャーが自作コントロール化。組み込み4種の排他切替・既定OSM・出典自動表示・他コントロールが 002 と差異なし（quickstart.md §1 で回帰ゼロ確認可）。ユーザーストーリー着手可

---

## Phase 3: User Story 1 - オリジナル背景地図を追加して表示できる (Priority: P1) 🎯 MVP

**Goal**: 一覧最後尾の「追加」操作で開くフォームに表示名・タイル取得元・出典を入力して確定すると、ユーザー定義背景地図が一覧に追加され、選択するとその地図が背景表示される。

**Independent Test**: quickstart.md §2 — 末尾「追加」でフォーム表示、入力確定で一覧末尾に追加（表示中背景・現在選択は不変＝自動選択しない）、追加分を選ぶと背景＋出典が切替（US1 受入 AC1〜3）。

### Implementation for User Story 1

- [X] T007 [US1] `basemap-switcher.js` のラジオ一覧の最後尾に「＋ 背景地図を追加」ボタンを常時表示する（FR-001）
- [X] T008 [US1] `basemap-switcher.js` に追加フォーム（表示名／タイル取得元=URLテンプレート／出典 の入力欄＋確定／キャンセル）をインラインパネルとして実装し、追加ボタンで開閉する。表示中も地図のズーム/パンを妨げない（モーダル不可・全画面ブロック禁止＝FR-002/FR-012・憲章 III。依存: T007）
- [X] T009 [US1] `basemap-switcher.js`：確定時に `validateCustomBasemapInput` を呼び、`ok` のとき `createCustomBasemap` で BaseMap を生成して `onAdd(basemap)` コールバックを呼び、フォームを閉じる。現在選択・可視レイヤー・出典は変更しない（自動選択しない＝Clarifications Q4。詳細なエラー表示は US3。依存: T008, T004）
- [X] T010 [US1] `main.js`：`onAdd` コールバックを実装し `map.addSource(basemap.sourceId, basemap.source)`＋`map.addLayer({ id: '<id>-layer', source, type:'raster', layout:{visibility:'none'} }, 'hazard_flood-layer')`（osm-layer 直後・ハザード背面）。続けてコントロールのラジオ一覧末尾（追加ボタンの直前）へ当該エントリを追記する。current/可視/出典は不変（FR-004・Q4。依存: T009, T006）
- [X] T011 [US1] `basemap-switcher.js`：追加されたエントリを選択すると T005 の排他切替で当該レイヤーのみ可視となり背景が表示され、出典は既定 `AttributionControl` の自動集約で入力した出典へ更新される（追加の命令的コード不要。US1-AC3。依存: T010）
- [X] T012 [P] [US1] `style.css` に追加ボタン・追加フォームパネルの共有スタイルを追加する（`#opacity-control` の見た目に整合・インライン不使用＝憲章 III）
- [ ] T013 [US1] quickstart.md §2 の手動スモークで US1 を検証する：末尾「追加」→フォーム表示、正当な値で確定→一覧末尾に追加かつ表示中背景・現在選択不変、追加分を選択→背景＋出典が切替（US1-AC1/2/3。依存: T010, T011, T012）

**Checkpoint**: US1 単体で「追加して表示」が機能（MVP 成立）。共有スタイル適用と「自動選択しない」挙動を目視確認

---

## Phase 4: User Story 2 - 追加した背景地図が組み込み4種と一貫して切替・出典表示される (Priority: P2)

**Goal**: 追加分を組み込み4種と同一操作で選択でき、現在選択表示が追従し、ユーザー定義↔組み込みの双方向で出典が提供元へ自動切替される。

**Independent Test**: quickstart.md §2 ステップ5 — ユーザー定義→組み込み→ユーザー定義 と往復し、各状態で出典が選択中の提供元に一致、現在選択表示が正しく追従（US2 受入 AC1〜3・SC-002）。

### Implementation for User Story 2

- [X] T014 [US2] `basemap-switcher.js`：現在選択（チェック状態）が 組み込み↔ユーザー定義 の相互切替で正しく追従し、追加直後は不変であることを保証する（FR-007。依存: US1 完了）
- [X] T015 [US2] `main.js`：ユーザー定義ソースの `attribution` が組み込みと同様に既定 `AttributionControl` の可視ソース集約へ参加し、組み込みへ戻すと組み込み出典へ自動復帰すること（自前の出典差し替えコードを足さない）を確認・必要なら挿入位置を調整する（FR-006・research R4／002 R3。依存: T010）
- [ ] T016 [US2] quickstart.md §2 ステップ5 の手動スモークで US2 を検証する：ユーザー定義↔OSM/GSI 往復で双方向とも出典と提供元が一致（SC-002）、現在選択表示が追従（US2-AC1/2/3。依存: T014, T015）

**Checkpoint**: US1 と US2 が独立に動作。出典の双方向自動追従が 002 機構の再利用のみで成立

---

## Phase 5: User Story 3 - 不足・不正な入力を利用者に分かる形で拒否する (Priority: P3)

**Goal**: 必須欠落・不正タイルURL・表示名重複の入力は追加せず、何が不足/不正かを項目別に提示。キャンセルで一切変更せず元へ戻れる。

**Independent Test**: quickstart.md §3 — 必須空／URL解釈不能／`{z}{x}{y}`欠落／非http(s)／重複表示名 で各々追加されず項目別提示、混在コンテンツhttpは通過、キャンセルで不変（US3 受入 AC1〜4・SC-004）。

### Implementation for User Story 3

- [X] T017 [US3] `basemap-switcher.js`：確定時 `validateCustomBasemapInput` が `ok:false` のとき追加せず、`errors` を項目（表示名／タイル取得元／出典）に紐づけてインライン表示し、フォームは開いたままにする（無言失敗禁止＝FR-008・US3-AC1/2/3。依存: T009）
- [X] T018 [US3] `basemap-switcher.js`：キャンセル操作でフォームを閉じ、一覧・地図・出典・現在選択を一切変更しない（FR-009・US3-AC4。依存: T008）
- [X] T019 [P] [US3] `style.css` にエラーメッセージ提示用の共有スタイル（対象項目と視覚的に対応・可読コントラスト）を追加する（インライン不使用＝憲章 III）
- [ ] T020 [US3] quickstart.md §3 の手動スモークで US3 を検証する：各不足/不正で追加されず項目別提示、重複表示名で重複提示、混在コンテンツhttpは通過、キャンセルで不変（SC-004。純粋規則の網羅は T003/T004 で green 済み。依存: T017, T018, T019）

**Checkpoint**: US1〜US3 がそれぞれ独立に機能。検証規則は決定論ユニットテストで担保済み

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーに跨る回帰・非機能・品質確認

- [ ] T021 [P] quickstart.md §1 の回帰スモークを実施する：組み込み4種選択・初回/再読込の既定OSM・出典自動表示、ハザード/skhb/地形/現在地コントロールが 002 と差異なし（FR-011・SC-003：回帰ゼロ）
- [ ] T022 [P] quickstart.md §4 のアクセシビリティスモークを**実機で**実施する：キーボードで追加ボタン/フォーム到達・操作、ラジオのキーボード切替、`label[for]` のラベルクリック実挙動、フォーカス順・コントラスト。静的に断定しない（憲章 III・過去知見）
- [ ] T023 [P] quickstart.md §5 のタイル取得失敗スモークを実施する：到達不能なユーザー定義背景で `.map-error-toast` が出て地図操作継続・現在選択不変・無言で壊れない（FR-010・SC-005）
- [X] T024 クリーン環境の品質ゲートを実施する：`npm install`（`package.json`/`package-lock.json` 不変＝新規依存ゼロ）、`npm run test` 全 green、`npm run build` 成功（憲章 II・偽green回避のためクリーン環境で実行）
- [X] T025 [P] `basemaps.js`／`basemap-switcher.js`／`main.js` のコード品質確認：デバッグ `console`/デッドコードなし、単一責務維持、Lint/Format クリーン（憲章 I）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。即時開始可
- **Foundational (Phase 2)**: Setup 完了に依存。全ユーザーストーリーをブロック
- **User Stories (Phase 3+)**: いずれも Foundational 完了に依存。優先度順 P1→P2→P3（US2/US3 は US1 で追加された背景の存在を前提に検証するため US1 完了後が自然）
- **Polish (Phase 6)**: 対象ストーリー完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 後に着手可。他ストーリー非依存（単体で MVP 成立）
- **US2 (P2)**: Foundational 後に着手可。US1 が追加した背景を用いて独立にテスト（出典/選択の一貫性）
- **US3 (P3)**: Foundational 後に着手可。US1 のフォーム/確定（T008/T009）に検証フィードバックを上積み。独立にテスト（拒否/キャンセル）

### Within Each User Story

- 純粋ロジックはテスト先行（T003 FAIL → T004 PASS）。憲章 II
- 純粋関数（basemaps.js）→ コントロール/フォーム（basemap-switcher.js）→ 結線（main.js）→ 手動スモーク検証 の順
- ストーリー完了後に次優先度へ

### Parallel Opportunities

- T002 は Setup 内で [P]
- Foundational: T003 は [P]（テストファイル独立）。T004→T005→T006 は逐次依存
- US1: T012（style.css）は実装と並行可 [P]
- US3: T019（style.css）は [P]
- Polish: T021/T022/T023/T025 は [P]（別経路の検証・別ファイル）
- 体制が許せば Foundational 完了後に US1 を進めつつ、US2/US3 の純粋部は既に green のため UI 上積みを並行検討可

---

## Parallel Example: User Story 1

```bash
# US1 実装中、共有スタイルは別ファイルのため並行可:
Task: "T012 [US1] style.css に追加ボタン・フォームの共有スタイルを追加"
# 一方でロジック/結線を逐次:
Task: "T009 [US1] basemap-switcher.js 確定→validate→create→onAdd"
Task: "T010 [US1] main.js onAdd で addSource/addLayer＋一覧追記"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup を完了
2. Phase 2: Foundational を完了（純粋API＋自作コントロール基盤。002 回帰ゼロを Checkpoint で確認）
3. Phase 3: US1 を完了
4. **STOP & VALIDATE**: quickstart.md §2 で US1 を単体検証（追加→自動選択しない→選択で表示）
5. 問題なければデモ/共有（MVP）

### Incremental Delivery

1. Setup ＋ Foundational → 基盤確立（002 回帰ゼロ）
2. US1 追加 → §2 検証 → MVP デモ
3. US2 追加 → §2 ステップ5 検証（出典双方向）→ デモ
4. US3 追加 → §3 検証（拒否/キャンセル）→ デモ
5. Polish で回帰/a11y/失敗時/クリーン環境ゲートを締める

### Parallel Team Strategy

1. Setup＋Foundational をチームで完了（共通基盤・回帰土台）
2. 完了後: 開発者A=US1、Bは US3 の UI（純粋規則は green 済み）、C は US2 の検証準備、を並行
3. 各ストーリーは独立に完了・統合

---

## Notes

- [P] = 別ファイル・未完了依存なし。[Story] はトレーサビリティ用
- 純粋ロジックは test-first（実行して FAIL を確認してから実装）。描画/コントロール/a11y/回帰は quickstart.md 手動スモーク（憲章 II）
- 各タスク完了後にスコープを絞ってコミット（憲章ワークフロー）
- Checkpoint でストーリーを独立検証してから次へ
- 回避: 曖昧タスク・同一ファイル競合・002 を回帰させる変更（FR-011）・新規依存追加（利用者制約）

### 実装ステータス（/speckit.implement 実行・2026-05-18）

- **完了（コード＋自動検証）**: T001–T012, T014, T015, T017–T019, T024, T025。
  - `npm install` 成功・**`package.json`/`package-lock.json` 非変更**（新規依存ゼロ）。
  - `npm run test` = **18/18 PASS**（002 観点5＋003 観点8＋既存 nearest 5。test-first: T003 追加→T004 実装で green）。
  - `npm run build` = **成功**（>500kB 警告は maplibre-gl 由来の既存事項。003 で増悪なし）。
  - 変更: `basemaps.js`（後方互換拡張）/ `basemap-switcher.js`（新規 IControl）/ `main.js`（OpacityControl 置換・hazard/skhb/error 機構は不変）/ `style.css`（共有スタイル追記）/ `tests/unit/basemaps.test.mjs`。
- **未実施（人手の実機スモークが必須・自動エージェント不可）**: **T013, T016, T020, T021, T022, T023**。
  - quickstart.md §1〜§5 のブラウザ手動スモーク（US1/US2/US3 受入、FR-011 回帰、a11y、タイル失敗）。
  - 特に **T022（a11y）は実機確認必須**で静的断定しない（憲章 III・過去知見: 002 で label[for] 静的断定が実機 NG）。
  - 純粋規則（FR-008/SC-004 の検証ロジック）は T003/T004 のユニットテストで担保済みだが、UI 反映・選択切替・出典自動追従・回帰は実機目視が必要。

### 変更: 出典の生 HTML 非受理（Clarifications Q5・実装フィードバック・2026-05-18）

- **動機**: 出典が `AttributionControl` の `innerHTML` で描画されるため、生 HTML 入力は XSS 経路。出典を「表示名（必須）＋リンク URL（任意・http(s)）」へ分離し、システムが `escapeHtml`/`buildAttributionHtml` で安全構築する設計へ変更（research R7）。
- **SDD 波及（完了）**: spec（Clarifications Q5・FR-003/008・US1/US3・Edge・Key Entities・Assumptions）／data-model（CustomBasemapInput→attributionLabel+attributionUrl、ValidationResult）／contracts（basemaps-module 規則7/8・escapeHtml/buildAttributionHtml・観点更新／ui-switcher 入力欄・受入表）／research R7 を更新。
- **実装（完了・自動検証済み）**: `basemaps.js`（`escapeHtml`/`buildAttributionHtml`/`isHttpUrl` 追加、`validateCustomBasemapInput`・`createCustomBasemap` を新シグネチャへ）／`basemap-switcher.js`（フォーム＝出典の表示名＋出典リンク URL の2欄、`_submit` 更新）／`tests/unit/basemaps.test.mjs`（観点1-10へ再構成。HTML インジェクション無害化テスト含む）。**`npm run test` = 20/20 PASS**、**`npm run build` 成功**、`package-lock.json` 不変。
- **未実施（人手の実機スモーク）**: quickstart.md §2/§3（出典2欄入力・出典リンク URL 不正拒否・**生 HTML がエスケープされ無害化**される §3.5）を T013/T020/T021/T022 の実機確認時に併せて検証する。

