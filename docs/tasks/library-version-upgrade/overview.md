# ライブラリバージョンアップ タスク概要

**作成日**: 2026-05-20
**プロジェクト期間**: 2.5〜3 営業日相当（演習用、開始日未定）
**推定工数**: 20 時間（4h × 5 タスク相当）
**総タスク数**: 7 件
**作業規模**: 軽量タスク分割 / 半日（4h）粒度 / 2 フェーズ / Claude Code タスク未登録

## 関連文書

- **要件定義書**: [📋 requirements.md](../../spec/library-version-upgrade/requirements.md)
- **受け入れ基準**: [✅ acceptance-criteria.md](../../spec/library-version-upgrade/acceptance-criteria.md)
- **ユーザーストーリー**: [📖 user-stories.md](../../spec/library-version-upgrade/user-stories.md)
- **準備タスク**: [🔧 prep.md](../../spec/library-version-upgrade/prep.md)
- **アーキテクチャ**: [📐 architecture.md](../../design/library-version-upgrade/architecture.md)
- **データフロー**: [🔄 dataflow.md](../../design/library-version-upgrade/dataflow.md)
- **コンテキスト**: [📝 note.md](../../spec/library-version-upgrade/note.md)
- **技術スタック**: [docs/tech-stack.md](../../tech-stack.md)

## フェーズ構成

| フェーズ | 期間 | 成果物 | タスク数 | 工数 |
|---------|------|--------|----------|------|
| Phase 1 | 約 1 日 | 採用版確定 / lockfile 生成 / Node 要件文書化 | 3 | 8h |
| Phase 2 | 約 1.5 日 | コード書き換え / UI 実機検証 / クリーン再現 / 非機能退化チェック | 4 | 12h |

## タスク番号管理

- **使用済みタスク番号**: TASK-0001 〜 TASK-0007
- **次回開始番号**: TASK-0008

## 全体進捗

- [ ] Phase 1: 準備とバージョン選定（3 タスク中 2 完了）
- [ ] Phase 2: 実装と検証（未着手）

> **進行ステータス（2026-05-20）**: tsumiki SDD フレームワーク検証演習の一環として TASK-0001 / TASK-0002 を実行。実時間が想定より重く、TASK-0003 以降は中断。本ブランチは tsumiki 適用結果のチェックポイントとして commit。残作業（TASK-0003〜0007）は別アプローチでの検証材料として位置づける。

## マイルストーン

- **M1: 採用版確定**（Phase 1 完了時）: install / build が exit 0、`package-lock.json` 再生成済み
- **M2: コード変更完了**（TASK-0004 完了時）: `main.js` から `_watchState` 直接参照が消えている
- **M3: 実機検証完了**（TASK-0005 完了時）: TC-REQ-005 系と TC-REQ-501-02/03 が全パス
- **M4: 偽 green ゲート通過**（TASK-0006 完了時）: クリーン環境再現の build が成功し lockfile がコミット可能
- **M5: 完了**（TASK-0007 完了時）: `npm audit` / パフォーマンス退化なしを確認

---

## Phase 1: 準備とバージョン選定

**期間**: 約 1 日（8h）
**目標**: 採用バージョン組み合わせを確定し、install / build が成功する状態を作る
**成果物**: 更新後の `package.json` / 新規生成 `package-lock.json` / `dist/` 成果物 / `docs/tech-stack.md` の Node 要件追記

### タスク一覧

- [x] [TASK-0001: 現行ベースライン計測](TASK-0001.md) - 2h (DIRECT) 🔵 ✅ 完了 (2026-05-20)
- [x] [TASK-0002: バージョン候補選定と install/build 試行](TASK-0002.md) - 4h (DIRECT) 🔵 ✅ 完了 (2026-05-20) — 採用版: vite 8.0.13 / maplibre-gl 5.24.0 / maplibre-gl-opacity 1.7.0 ピン / maplibre-gl-gsi-terrain 2.3.2 / @turf/distance 7.3.5。詳細: [version-selection.md](version-selection.md)
- [ ] [TASK-0003: tech-stack.md に Node 要件追記](TASK-0003.md) - 2h (DIRECT) 🔵

### 依存関係

```
TASK-0001 → TASK-0002 → TASK-0003
```

TASK-0003 は TASK-0002 で採用 Vite 版が確定したあとに着手。

---

## Phase 2: 実装と検証

**期間**: 約 1.5 日（12h）
**目標**: REQ-501 の書き換え、既存機能の非回帰確認、偽 green 防止、非機能退化チェックを完了
**成果物**: 修正後 `main.js` / UI 検証記録 / クリーン環境 build ログ / `npm audit` 比較記録

### タスク一覧

- [ ] [TASK-0004: REQ-501 `_watchState` 撤去（公開イベント駆動へ）](TASK-0004.md) - 4h (TDD) 🔵
- [ ] [TASK-0005: UI 実機検証（TC-REQ-005 系 + 501）](TASK-0005.md) - 4h (DIRECT) 🔵
- [ ] [TASK-0006: クリーン環境再現と lockfile コミット](TASK-0006.md) - 2h (DIRECT) 🔵
- [ ] [TASK-0007: npm audit / パフォーマンス退化チェック](TASK-0007.md) - 2h (DIRECT) 🟡

### 依存関係

```
TASK-0002 → TASK-0004 → TASK-0005 → TASK-0006 → TASK-0007
```

TASK-0004 は TASK-0002 で採用 maplibre-gl 版が確定し、その版で `trackuserlocationend` イベントが利用可能であることを確認した直後に着手する。

---

## 信頼性レベルサマリー

### 全タスク統計

- **総タスク数**: 7 件
- 🔵 青信号: 6 件 (86%)
- 🟡 黄信号: 1 件 (14%)
- 🔴 赤信号: 0 件 (0%)

### フェーズ別信頼性

| フェーズ | 🔵 青 | 🟡 黄 | 🔴 赤 | 合計 |
|---------|-------|-------|-------|------|
| Phase 1 | 3 | 0 | 0 | 3 |
| Phase 2 | 3 | 1 | 0 | 4 |

**品質評価**: 高品質（要件・設計が明示済みで、各タスクは既存資料に直接対応。残る 🟡 はパフォーマンス閾値の実測ばらつきに依存する TASK-0007 のみ）

## クリティカルパス

```
TASK-0001 → TASK-0002 → TASK-0004 → TASK-0005 → TASK-0006 → TASK-0007
```

- **クリティカルパス工数**: 16 時間
- **並行作業可能工数**: 2 時間（TASK-0003 を TASK-0004 と並行実施可能）

## スコープ外（明示）

`requirements.md` REQ-403 と整合：

- TypeScript 化 / Lint・Formatter / Vitest 等の新規導入
- Nuxt 移行・背景地図切替・既存機能挙動変更（README の別シナリオ）
- `main.js` の Popup `setHTML` 周辺の安全化（次要件以降）

## 次のステップ

タスクを実装するには:
- 全タスク順番に実装: `/tsumiki:kairo-implement`
- 特定タスクを実装: `/tsumiki:kairo-implement TASK-0001`
