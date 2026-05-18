---
description: "Task list template for feature implementation"
---

# Tasks: 背景地図の切り替え（ベースマップスイッチャー）

**Input**: Design documents from `/specs/002-basemap-switcher/`
**Prerequisites**: plan.md（必須）, spec.md（必須・ユーザーストーリー）, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本プロジェクトは憲章 II（純粋ロジックは自動ユニットテスト必須・決定論的・実ネットワーク非依存）が MUST。`basemaps.js` の純粋ロジックのみ自動テスト対象（test-first）。地図描画・コントロール挙動はユニット化不可のため quickstart.md の手動スモークで検証する（憲章 II が許容する手動スモーク経路）。

**Organization**: タスクはユーザーストーリー単位で分割し、各ストーリーを独立に実装・テスト可能にする。利用者制約「新規ライブラリ追加なし（現行依存のみ）」を全タスクで厳守。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 所属ユーザーストーリー（US1/US2/US3）。Setup/Foundational/Polish には付けない
- 説明には正確なファイルパスを含める

## Path Conventions

- 本リポジトリはルート直下フラット構成（`src/` なし）。アプリコード=ルートの `main.js` / 新規 `basemaps.js`、テスト=`tests/unit/`、共有スタイル=`opacity-control.css` / `style.css`。
- plan.md「プロジェクト構成 > ソースコード」に従う。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存プロジェクト前提の確認（新規スキャフォールドなし）

- [X] T001 リポジトリルートで `npm install` 済みを確認し、本機能で `package.json` / `package-lock.json` を変更しない方針を確立する（新規依存ゼロ＝利用者制約・憲章 I）
- [X] T002 [P] 既存の Lint/Format 設定で現行コードがクリーンに通ることを確認する（設定ファイルは変更しない。憲章ワークフローのゲート前提）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存する背景地図レジストリ（純粋モジュール）の確立

**⚠️ CRITICAL**: 本フェーズ完了まで US1/US2/US3 の実装に着手しない（`basemaps.js` が3ストーリー共通基盤）

- [X] T003 `tests/unit/basemaps.test.mjs` を新規作成し、`contracts/basemaps-module.md` のテスト観点1〜5（4件・id一意・isDefault一意でosm／各 source.tiles と gsi-blank.maxzoom=14／attribution が提供元準拠／`getDefaultBasemapId()==='osm'`／`buildBaseLayers()` の形・順序）を `node --test` で決定論的（実ネットワーク非依存）に記述する。**実装前に実行して FAIL することを確認**（憲章 II・test-first）
- [X] T004 `basemaps.js` を新規作成し、`contracts/basemaps-module.md` の公開API（`BASEMAPS` 4件＝osm/gsi-std/gsi-seamlessphoto/gsi-blank、`getDefaultBasemapId()`、`buildBaseLayers()`）を `data-model.md`／`research.md` R2・R4 の値どおり副作用なしで実装する。`npm run test` で T003 が **PASS** に変わることを確認（依存: T003）

**Checkpoint**: `basemaps.js` 契約充足・ユニットテスト green。ユーザーストーリー着手可

---

## Phase 3: User Story 1 - 背景地図を切り替えられる (Priority: P1) 🎯 MVP

**Goal**: 地図左下の切替コントロールで「OSM／地理院地図（標準地図）／航空写真／白地図」を排他選択し、背景が即時切り替わる。

**Independent Test**: quickstart.md #2・#3・#6 — 4択を順に選び各背景へ即時変化、現在選択が表示、同一再選択で無変化・無エラー（US1 受入 AC1〜3）。

### Implementation for User Story 1

- [X] T005 [US1] `main.js` 冒頭で `./basemaps.js` を import し、`BASEMAPS` の GSI 3種（gsi-std/gsi-seamlessphoto/gsi-blank）の `source` をインラインスタイル `sources` に追加、対応する3つの `${id}-layer`（type:'raster', layout:`visibility:'none'`）を `osm-layer` の直後に追加する（FR-002/003、研究 R2）
- [X] T006 [US1] `main.js` の `map.on('load', …)` 内で `new OpacityControl({ baseLayers: buildBaseLayers() })` を生成し `map.addControl(ctrl, 'bottom-left')` で左下に追加する（FR-001/008、研究 R1。依存: T005）

**Checkpoint**: US1 単体で背景4種の排他切替が機能（MVP 成立）。`opacity-control.css` 共有スタイル適用を目視確認

---

## Phase 4: User Story 2 - 出典表記が背景地図に応じて自動で切り替わる (Priority: P2)

**Goal**: 背景切替に追従して出典が提供元（OSM↔国土地理院）へ自動入替する。

**Independent Test**: quickstart.md #2・#3・#5 — 各背景で出典が提供元一致、切替時に即入替（US2 受入 AC1〜3、SC-002/003）。

### Implementation for User Story 2

- [X] T007 [US2] `basemaps.js` の各 `source.attribution` が規約準拠（OSM=OpenStreetMap contributors＋copyright リンク／GSI 3種=「地理院タイル（国土地理院）」＋ `https://maps.gsi.go.jp/development/ichiran.html` リンク）であることを `contracts/basemaps-module.md`・研究 R4 に照らして確定し、`main.js` の `maplibregl.Map` 生成時に既定 `AttributionControl` を無効化していない（`attributionControl:false` を設定していない）ことを確認する（FR-005/006/007、研究 R3。依存: T004, T005）

**Checkpoint**: US1+US2 が独立に機能。可視ソース集約で出典が背景に追従

---

## Phase 5: User Story 3 - 既定状態と操作を妨げない配置 (Priority: P3)

**Goal**: 初回・再読込は OSM 既定、左下コントロールが地図操作・既存コントロールを妨げず、タイル取得失敗を無言にしない。

**Independent Test**: quickstart.md #1・#4・#8・#9・#10 — 既定 OSM／再読込で OSM 復帰／白地図オーバーズーム破綻なし／タイル失敗の可視化／ズーム・パンを妨げない（US3 受入 AC1〜3、FR-004/010、SC-005/006）。

### Implementation for User Story 3

- [X] T008 [US3] `main.js` で `osm-layer` が既定可視（`getDefaultBasemapId()` と一致、GSI3種は `visibility:'none'`）であり、再読込でセッション状態を持たず OSM へ戻ること、`bottom-left` 配置が既存コントロール（ハザード=top-left／skhb=top-right／Geolocate・Terrain=bottom-right）と非衝突であることを確認・調整する（FR-004、US3-AC1/2/3。微調整が要る場合は共有 CSS のみ、インライン禁止）
- [X] T009 [US3] `main.js` に `map.on('error', (e) => …)` を1箇所追加し、タイル/ソース取得失敗を非ブロッキングに利用者へ可視化（控えめな短時間通知、地図のズーム/パンは継続、全画面ブロック禁止、`console` のみで握りつぶさない）（FR-010・憲章 III、研究 R5。依存: T006）

**Checkpoint**: 全ユーザーストーリーが独立に機能

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー横断の品質ゲートと仕上げ

- [X] T010 [P] `npm run build`（`vite build --base=./`）が成功することを確認する（憲章 II 必須ゲート）
- [X] T011 [P] `npm run test`（`node --test`）が `tests/unit/basemaps.test.mjs` 含め全 green であることを確認する（憲章 II）
- [ ] T012 `specs/002-basemap-switcher/quickstart.md` の手動スモーク #1〜#10 を全項目実施し合否を記録する（描画経路の検証・SC-001〜006） — ⚠ ブラウザでの目視確認が本質的に必要。CLI 環境では自動実行不可のため**人手での実施待ち**（`npm run dev` で起動し quickstart.md の表に従い記録）
- [X] T013 [P] `main.js` / `basemaps.js` にデバッグ `console`・デッドコードが残っていないこと、新規スタイルがインラインでなく共有 CSS（`opacity-control.css`／`style.css`）であること、Lint/Format がクリーンであることを最終確認する（憲章 I/III）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。即時開始可
- **Foundational (Phase 2)**: Setup 完了に依存。**全ユーザーストーリーをブロック**
- **User Stories (Phase 3+)**: Foundational 完了に依存
  - US1（P1）→ US2（P2）→ US3（P3）の優先順に逐次実施を推奨（本機能は単一ファイル `main.js` 集中のため並行性は低い）
- **Polish (Phase 6)**: 対象ストーリー完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 後に開始可。他ストーリー非依存（MVP）
- **US2 (P2)**: Foundational 後に開始可。`AttributionControl` の自動追従は US1 の排他切替（可視1背景）を前提に独立検証可
- **US3 (P3)**: Foundational 後に開始可。既定/復帰は単独検証可。T009 は US1 の load 結線（T006）後

### Within Each User Story

- 本機能の自動テストは Foundational の `basemaps.js` のみ（test-first: T003→T004）
- US1〜US3 の実装は主に `main.js` 単一ファイルを編集 → 同一ファイル競合回避のため逐次
- 各ストーリー完了（Checkpoint）後に次優先へ

### Parallel Opportunities

- T002 は T001 と並行可（読み取り確認・別観点）
- Polish の T010 / T011 / T013 は相互独立で並行可（T012 手動スモークは実装完了後）
- US1〜US3 は `main.js` を共有編集するため**ストーリー間の並行は非推奨**（同一ファイル競合）

---

## Parallel Example: User Story 1

```bash
# 本機能の US1 は main.js 単一ファイルへの逐次編集（T005 → T006）であり、
# ストーリー内に並行可能タスクはない（同一ファイル競合を避ける）。
# 並行できるのは Foundational のテスト記述（T003）と Setup 確認（T002）など別ファイル/別観点のみ。
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（T001–T002）
2. Phase 2: Foundational（T003→T004、`basemaps.js` green）
3. Phase 3: User Story 1（T005–T006）
4. **STOP and VALIDATE**: quickstart #2/#3/#6 で US1 を独立検証
5. デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 追加 → 独立検証 → デモ（MVP：背景切替）
3. US2 追加 → 独立検証 → デモ（出典の自動追従）
4. US3 追加 → 独立検証 → デモ（既定/復帰・非衝突・失敗可視化）
5. Polish（ゲート＋手動スモーク＋仕上げ）

### Parallel Team Strategy

本機能は `main.js` 集中で小規模のため、単一担当の逐次実装が最適。複数名なら「Foundational の test 記述（T003）」と「Setup 確認（T002）」のみ分担可。

---

## Notes

- [P] = 別ファイル・依存なし。本機能は `main.js` 集中のため [P] は限定的
- [Story] ラベルでタスク↔ユーザーストーリーの追跡性を担保
- 各ユーザーストーリーは独立に完了・テスト可能
- Foundational は test-first（T003 を FAIL 確認後に T004）
- タスクまたは論理単位ごとにコミット
- 各 Checkpoint でストーリーを独立検証可
- 回避: 曖昧タスク／同一ファイル競合／ストーリー独立性を壊す相互依存／新規依存の追加（利用者制約・憲章 I）
