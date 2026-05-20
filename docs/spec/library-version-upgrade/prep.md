# ライブラリバージョンアップ 準備タスク（ユーザー作業）

> **仕様**: [requirements.md](requirements.md)
> **生成日**: 2026-05-20

## 信頼性レベル凡例

- 🔵 **青信号**: 要件定義書・既存資料・メモから明確に必要と判明したタスク
- 🟡 **黄信号**: 要件定義書・既存資料・メモから妥当に推測されるタスク
- 🔴 **赤信号**: 推測による予防的タスク

## 必須（実装開始前に完了が必要）

- [ ] **Node.js のバージョン確認・アップグレード** 🟡 *REQ-103 より*
  - Vite を最新メジャー（v6 系想定）に上げる場合、`engines.node` 要件は **Node.js 18+ または 20+ LTS** が一般的（Vite 6: Node 18.x / 20.x / 22.x）。
  - 現在の `node -v` を確認し、要件未満なら nvm-windows / Volta 等でアップグレードする。
  - 取得先（例）:
    - Node.js 公式: https://nodejs.org/
    - nvm-windows: https://github.com/coreybutler/nvm-windows
  - 関連要件: REQ-103, NFR-301

- [ ] **クリーン環境のためのバックアップ** 🔵 *NFR-302 / メモ [[project_001_false_green_build]] より*
  - 作業前のブランチを退避（例: `git switch -c backup/pre-library-upgrade`）。
  - `package-lock.json` を後で diff 確認できるように保持。
  - 関連要件: REQ-002, NFR-302

- [ ] **インターネット接続（npm レジストリ到達）** 🔵 *REQ-001 / REQ-002 より*
  - `npm config get registry` で標準レジストリ／社内ミラーを確認。
  - プロキシ配下なら `npm config set proxy` / `https-proxy` を事前設定。

## 推奨（実装中に用意できればOK）

- [ ] **対象パッケージの最新版・互換性情報の事前把握** 🟡 *REQ-101 / REQ-102 より*
  - `npm view <pkg> versions --json` で利用可能版を確認。
  - 特に確認したいペア:
    - `maplibre-gl` の最新 ↔ `maplibre-gl-gsi-terrain` の対応版（`addProtocol` 仕様変化）。
    - `maplibre-gl-opacity` が MapLibre 新メジャーに対応しているか。
    - `@turf/distance` v7 と Vite 新版（ESM のみ）の整合。
  - 関連要件: REQ-101, REQ-102, REQ-301, REQ-405, EDGE-001

- [ ] **MapLibre v5 移行ノート確認** 🔵 *メモ [[reference_maplibre_v5_attribution_sanitizer]] より*
  - 出典 HTML サニタイズが弱いことを念頭に、本要件中で `attribution` に新規利用者入力を流さない（REQ-404 / NFR-102）。
  - 移行ガイド（公式）: https://maplibre.org/maplibre-gl-js/docs/

- [ ] **ブラウザでの位置情報許可と地理院/OSM タイル到達確認** 🟡 *TC-REQ-005-06 より*
  - 実機 UI 検証時に GeolocateControl の許可ダイアログが出るブラウザ（Chrome 等）を用意。
  - 開発機からタイル CDN へ HTTPS でアクセスできることを確認。

## 確認事項（ヒアリングで解消済）

すべての確認事項は 2026-05-20 のテキストヒアリング Q1〜Q7 で確定済み。決定内容を以下に明記する。

- [x] **「動作可能な最新」の許容範囲** 🔵 *[interview-record.md](interview-record.md) Q3*
  - 決定: **(b) 互換性のため一段戻し許容**。REQ-101 / EDGE-101 に反映済み。

- [x] **`maplibre-gl-gsi-terrain` 非対応時の判断** 🔵 *[interview-record.md](interview-record.md) Q4*
  - 決定: **(a) `maplibre-gl` を一段戻して整合させる**。REQ-102 / EDGE-001 に反映済み。

- [x] **`_watchState` 非公開 API 依存の扱い** 🔵 *[interview-record.md](interview-record.md) Q5*
  - 決定: **(i) 本要件スコープ内で公開イベント API へ書き換える**。新規 REQ-501 を追加、REQ-403 にスコープ例外を明記、acceptance-criteria.md に TC-REQ-501-01〜03 を追加。

- [x] **Node.js 最低バージョンの記載先** 🔵 *[interview-record.md](interview-record.md) Q6*
  - 決定: **(i) `docs/tech-stack.md` のセットアップ手順節**に追記。REQ-103 に反映済み。

---

## サマリー

| 優先度 | 件数 | 🔵 | 🟡 | 🔴 |
|--------|------|-----|-----|-----|
| 必須 | 3 | 2 | 1 | 0 |
| 推奨 | 3 | 1 | 2 | 0 |
| 確認事項 | 4（全て解消済） | 4 | 0 | 0 |
| **合計** | **10** | **7** | **3** | **0** |

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **ヒアリング記録**: [interview-record.md](interview-record.md)
- **ユーザストーリー**: [user-stories.md](user-stories.md)
- **受け入れ基準**: [acceptance-criteria.md](acceptance-criteria.md)
- **コンテキストノート**: [note.md](note.md)
