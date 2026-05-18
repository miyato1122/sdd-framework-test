---

description: "機能実装のためのタスクリスト"
---

# タスク: 依存ライブラリの最新化（package.json）

**Input**: 設計文書 `/specs/001-upgrade-dependencies/`
**Prerequisites**: plan.md（必須）, spec.md（ユーザーストーリーに必須）, research.md, data-model.md, contracts/

**Tests**: 本機能ではテストを含める。plan.md の憲章チェック（憲章 II）に基づき、
`@turf/distance` v7 化の影響を受ける純粋ロジック（最寄り施設選定）のユニット
テストのみを対象とする（過剰なテストは生成しない）。地図描画系は
contracts の手動スモークで検証する。

**Organization**: タスクはユーザーストーリー単位でグループ化し、各ストーリーを
独立して実装・検証できるようにする。

## 書式: `[ID] [P?] [Story] 説明`

- **[P]**: 並行実行可能（別ファイル・依存なし）
- **[Story]**: 所属ユーザーストーリー（US1, US2, US3）
- 説明には正確なファイルパスを含める

## パス規約

- 本プロジェクトはフロントエンド単体（バニラ JS + Vite）。ソースはリポジトリ
  直下（`index.html` / `main.js` / `public/`）。本タスクで純粋ロジックを
  `nearest.js` に切り出し、ユニットテストを `tests/unit/` に置く。

---

## Phase 1: Setup（共有基盤）

**Purpose**: 回帰比較の基準確保とテスト基盤の準備

- [X] T001 [P] アップグレード前のベースラインを取得: コミット済み `dist/`（=旧ビルド成果物）のバンドルサイズを基準として記録（JS 820,724 B / CSS 71,205 B、dist 総計 20.7MB は静的資産込み）。行動基準は contracts の B1–B10（既知正常仕様）。※ブラウザ手動スモークの事前取得は人手必要
- [X] T002 [P] テスト基盤を準備: `package.json` に `"test": "node --test"` を追加し、`tests/unit/` ディレクトリを作成（追加依存なし＝Node 組込みテストランナーを使用、憲章 I「新規依存より既存/プラットフォーム優先」）

---

## Phase 2: Foundational（ブロッキング前提）

**Purpose**: 全ユーザーストーリーの前提となる「依存の最新化適用」と
「`main.js` の新 API 追従」。完了するまでどのストーリーも検証できない

**⚠️ CRITICAL**: 本フェーズ完了までユーザーストーリー着手不可

- [X] T003 `package.json` の依存を目標版へ更新: `vite ^8.0.13`(devDep), `maplibre-gl ^5.24.0`, `@turf/distance ^7.3.5`, `maplibre-gl-opacity ^1.8.0`, `maplibre-gl-gsi-terrain ^2.3.2`。さらに `engines.node` に `"^20.19.0 || >=22.12.0"` を追加（`package.json`）
- [X] T004 `npm install` を実行し `package-lock.json` を再生成して再現性を確保（51 packages 追加・脆弱性 0・全目標版一致）（`package-lock.json`）
- [X] T005 最寄り施設選定の純粋ロジックを `nearest.js` に純粋関数 `pickNearestFeature` として切り出し、`main.js` の `getNearestFeature` から呼び出すよう変更（テスト可能化、憲章 I/II）（`nearest.js`, `main.js`）
- [X] T006 `@turf/distance` を named import 化: `nearest.js` で `import { distance } from '@turf/distance'`、`main.js` の default import を除去（`nearest.js`, `main.js`）
- [X] T007 内部 API 置換: `nearestFeature._geometry.coordinates` を公開 `nearestFeature.geometry.coordinates` に変更（`pickNearestFeature` が geometry を明示保持）（`main.js`, `nearest.js`）
- [X] T008 内部 API 置換: `geolocationControl._watchState` 依存を公開イベント `trackuserlocationend`（userLocation を null 化）へ変更し、render 内の内部状態参照を除去（`main.js`）
- [X] T009 地形連携: gsi-terrain 2.3.2 の型は `useGsiTerrainSource(addProtocol, options?)` で旧コードと同一署名・peerDep maplibre-gl `^5.0.0` 一致。**無変更で互換**を確認（FR-006 フォールバック不要）。research.md に記録（`main.js`, `specs/001-upgrade-dependencies/research.md`）

**Checkpoint**: 新依存が導入され `main.js` が新 API に追従済み。各ストーリーの検証を開始可能

---

## Phase 3: User Story 1 - 既存機能が回帰しない (Priority: P1) 🎯 MVP

**Goal**: ライブラリ最新化の前後で地図アプリの観測可能な挙動が等価であること

**Independent Test**: アップグレード後ビルドを起動し、ユニットテストと
contracts の手動スモーク（C1–C9, C11）が全 PASS・新規コンソールエラー 0

### Tests for User Story 1

> **NOTE: 実装（Foundational）後にテストを作成し、基準と同一結果になることを検証**

- [X] T010 [P] [US1] `tests/unit/nearest-feature.test.mjs` を作成: 固定ジオメトリ入力に対し `nearest.js` の最寄り選定を検証（`node:test` / `node:assert`、@turf/distance v7 named）（`tests/unit/nearest-feature.test.mjs`）
- (人手) **T012 [US1] 地図の目視は人手** — 自動範囲完了: vite 8 で dev サーバ起動 OK、`index.html`/`main.js` 配信 200・エラーログ無し。ブラウザでの地図表示確認は T014 に集約（`main.js`, `index.html`）

### Implementation for User Story 1

- [X] T011 [US1] `npm run build` 成功を確認（vite 8.0.13、12 modules）。※ maplibre-gl-opacity 1.8.0 の CSS サブパス廃止による初回ビルド失敗を `main.js` の CSS import 削除で解消（FR-002/FR-005）（`main.js`, `package.json`）
- [X] T013 [US1] `npm test` 実行しユニットテスト 5/5 PASS（@turf v7 で選定結果不変、B8/B7、FR-004）（`tests/unit/nearest-feature.test.mjs`）
- [ ] T014 [US1] **要・人手**: `specs/001-upgrade-dependencies/contracts/behavioral-equivalence.md` の手動スモーク C1–C9, C11 をブラウザで実施し結果欄へ記録（FR-004, SC-001）。LLM では実行不可（`specs/001-upgrade-dependencies/contracts/behavioral-equivalence.md`）
- [~] T015 [US1] 自動範囲完了: `dist/` 比較（JS 820,724→1,087,540 B/+32.5%）。原因（maplibre v5 規模増・許容）を research.md 決定7に記録済（憲章 IV）。**体感性能は要・人手**（`specs/001-upgrade-dependencies/research.md`）

**Checkpoint**: US1 単独で機能等価が検証済み（MVP として完成・デモ可能）

---

## Phase 4: User Story 2 - サポート対象の最新環境で開発・ビルドできる (Priority: P2)

**Goal**: 規定 Node のクリーン環境で依存導入〜本番ビルドが無修正で成功する

**Independent Test**: クリーン環境で `npm ci`→`build`→`dev` が成功し、
`npm audit` の高～重大が 0

### Implementation for User Story 2

- [X] T016 [US2] `npm install`（コミット済み lockfile）→ `npm run build` が無修正成功・**決定論的（同一バンドルハッシュ）で再現**を確認（SC-002）。注: Windows で `npm ci` はネイティブ `.node` のファイルロックで失敗（環境起因の一時障害、`npm install` 経路で代替）。dev の地図目視は人手（`package.json`, `package-lock.json`）
- [X] T017 [P] [US2] `npm audit` 実行 → **高～重大脆弱性 0**（複数回確認、FR-009, SC-003）（`package-lock.json`）
- [X] T018 [P] [US2] `package.json` `engines.node`（`^20.19.0 || >=22.12.0`）と `README.md`「動作要件」記述が**一致済み**を確認（変更不要、FR-007, SC-004）（`README.md`, `package.json`）

**Checkpoint**: US1 と US2 がどちらも独立に成立

---

## Phase 5: User Story 3 - SDD フレームワーク比較の記録が残る (Priority: P3)

**Goal**: 本題材を Spec Kit(git-spec) で実施した結果が比較可能な粒度で残る

**Independent Test**: `README.md`「検討結果 > git-spec」節に本実行の記録が存在する

### Implementation for User Story 3

- [X] T019 [US3] `README.md`「## 検討結果 > ### git-spec」節に本実行の所感を日本語で追記（バージョン表・破壊的変更と対処・自動検証結果・git-spec 所感）。本 branch の README に open-spec の「2026-05-14 完了」注記は存在せず（main 由来）上書き懸念なし（FR-010, SC-005）（`README.md`）

**Checkpoint**: 全ユーザーストーリーが独立に成立

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーに跨る最終整合・安全網

- [X] T020 [P] ドキュメント整合最終確認: package.json 依存/engines・package-lock.json・README「動作要件」・README「検討結果(git-spec)」が相互一致、**不整合 0** を確認（SC-004）（`package.json`, `package-lock.json`, `README.md`）
- [X] T021 [P] quickstart のロールバック手順を机上確認 → 追加ファイル（`nearest.js`/`tests/`/`README.md`）未記載のギャップを検出し正確化（`specs/001-upgrade-dependencies/quickstart.md`）
- [X] T022 最終再確認: 仕様チェックリスト 16/16 維持、憲章ゲート（build✓/test 5✓/audit 0✓）通過、未正当化違反なし（Lint は Complexity Tracking で正当化、手動スモークは憲章 II が許容）。残課題は人手検証 T014/T012/T015 のみ（`specs/001-upgrade-dependencies/checklists/requirements.md`, `specs/001-upgrade-dependencies/plan.md`）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし・即時開始可。ただし T001 はアップグレード前の
  基準取得のため Phase 2 より前に完了必須
- **Foundational (Phase 2)**: Setup 完了に依存 — 全ユーザーストーリーをブロック
- **User Stories (Phase 3+)**: すべて Foundational 完了に依存
  - 以降は優先順（P1 → P2 → P3）で逐次、またはスタッフが居れば並行
- **Polish (最終)**: 着手対象の全ストーリー完了に依存

### User Story Dependencies

- **US1 (P1)**: Foundational 後に開始可。他ストーリーへの依存なし（MVP）
- **US2 (P2)**: Foundational 後に開始可。US1 とは独立に検証可能
- **US3 (P3)**: Foundational 後に開始可。記録の「存在」は独立検証可能だが、
  内容は US1/US2 の結果（破壊的変更・課題）を反映するため実務上は US1/US2 後に書く

### Within Each User Story

- テストは Foundational（実装）後に作成し、基準と同一結果を確認
- Foundational 内: `package.json` 更新 → `npm install` → `main.js`/`nearest.js`
  改修（同一ファイル群のため逐次）
- 各ストーリーは次優先へ移る前に完了させる

### Parallel Opportunities

- Setup: T001 と T002 は別ファイル/別観点で並行可（[P]）
- Foundational: `main.js` を共有するため T005–T009 は逐次（[P] 不可）
- US2: T017 と T018 は別ファイルで並行可（[P]）
- Polish: T020 と T021 は別ファイルで並行可（[P]）
- Foundational 完了後、US1/US2/US3 は人員があれば並行着手可

---

## Parallel Example: Setup

```bash
# Setup の独立タスクを同時実行:
Task: "アップグレード前ベースライン取得（dist サイズ＋現状挙動を contracts に記録）"
Task: "テスト基盤準備（package.json に test スクリプト、tests/unit/ 作成）"
```

```bash
# US2 の独立検証タスクを同時実行:
Task: "npm audit（高～重大 0 を確認）"
Task: "engines と README 動作要件の整合確認"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1: Setup を完了（特に T001 基準取得）
2. Phase 2: Foundational を完了（CRITICAL・全ストーリーをブロック）
3. Phase 3: US1 を完了
4. **STOP and VALIDATE**: US1 を独立検証（ユニットテスト＋手動スモーク）
5. 問題なければここで「最新化しても回帰なし」を達成（MVP）

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 追加 → 独立検証 → MVP（機能等価の確証）
3. US2 追加 → 独立検証（クリーン環境/監査/ドキュメント整合）
4. US3 追加 → README に比較記録を残す
5. 各ストーリーは前のストーリーを壊さず価値を加える

### Parallel Team Strategy

複数人の場合:

1. Setup + Foundational をチームで完了（main.js 改修は逐次のため担当を一本化）
2. Foundational 完了後:
   - 担当 A: US1（テスト＋スモーク）
   - 担当 B: US2（クリーン環境/監査/整合）
   - 担当 C: US3（記録、A/B の結果を反映）

---

## Notes

- [P] タスク = 別ファイル・依存なし
- [Story] ラベルはタスクとユーザーストーリーの追跡用
- 各ストーリーは独立に完了・検証可能
- `main.js` を変更するタスクは同一ファイル競合のため逐次（[P] を付けない）
- 各タスクまたは論理的なまとまりごとにコミット
- 任意のチェックポイントで停止してストーリーを独立検証可能
- 回避: 曖昧なタスク、同一ファイル競合、独立性を壊す跨ストーリー依存
