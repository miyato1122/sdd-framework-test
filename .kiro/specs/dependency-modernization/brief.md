# Brief: dependency-modernization

## Problem
- 誰の問題か: 本リポジトリ（Vite + MapLibre GL JS の地図アプリ）を保守・検証する開発者。
- どんな痛みか: 依存パッケージが大幅に古く（vite 3 系 / maplibre-gl 2 系 / @turf/distance 6 系）、セキュリティ修正・バグ修正・新 API から取り残されている。特に `maplibre-gl-gsi-terrain@0.0.2` は旧 callback 形式の `addProtocol` を使っており、maplibre-gl を v4 以上へ単独で上げると 3D 地形・陰影が無言で破綻する。各パッケージの依存関係が結合しているため、場当たり的な単独更新ができない。

## Current State
- `package.json`:
  - devDependencies: `vite ^3.2.0`（lockfile 3.2.1）
  - dependencies: `@turf/distance ^6.5.0`, `maplibre-gl ^2.4.0`, `maplibre-gl-gsi-terrain ^0.0.2`, `maplibre-gl-opacity ^1.4.0`
- アプリ本体は実質 `main.js`（約580行）＋ `index.html` / `style.css` のみ。テスト自動化は無い。
- 環境: Node v24.14.1 / npm 11.12.1 / Windows。
- ギャップ: 「動作可能な最新版」へ到達するには maplibre-gl の 3メジャー移行と、それを解錠する地形プラグイン更新が連動して必要。実機（ブラウザ）でしか確認できない私的 API 依存箇所が 2 つ存在する。

## Desired Outcome
- 全依存が「動作可能な最新版」に更新され、アプリの既存挙動（地図描画／ベースレイヤ opacity 切替／GeolocateControl 現在地／skhb クリック Popup／mousemove のルート距離線／3D 地形＋陰影＋TerrainControl）が維持されている。
- 合格基準（このスペックの検証ゲート）:
  - (A) クリーン環境（lockfile 再現）で `npm run build` 成功、かつ `npm run dev` / `npm run preview` がブラウザコンソールにエラーなく起動する。
  - (B) ブラウザ実機スモークで上記の主要機能がすべて動作する（目視はユーザー実施。実装側はチェックリストを用意）。
  - build グリーン単独では合格としない（過去に lockfile 環境で偽 green の前例あり）。

## Approach
**案1: フル最新・協調一括更新（採用）**

- ターゲット版: `vite 8.0.13` / `maplibre-gl 5.24.0` / `@turf/distance 7.3.5` / `maplibre-gl-opacity 1.8.0` / `maplibre-gl-gsi-terrain 2.3.2`。
- 5 パッケージを一括更新し、`maplibre-gl-gsi-terrain` 2.3.2（async 化済み・`useGsiTerrainSource(addProtocol)` 署名不変）で maplibre v5 を解錠する。
- 技術調査結果により `main.js` のソース改修は原則不要（public API は v2→v5 安定、`@turf/distance` v7 は default export 維持で `import distance` 不変）。
- 私的 API 依存 2 箇所は実機検証し、必要時にフォールバックへ切替: `geolocationControl._watchState`（L545）→ 公開 state 判定、`feature._geometry`（L568）→ `.geometry.coordinates`。
- 採用理由: ユーザー要件「動作可能な最新」に直結。改修最小で実現可能性が技術調査で確認済み。単一スペックとして検証ゲートが明快で、SDD フレームワーク比較演習の素材として質が高い。
- 不採用案: 案2（リスク段階更新）= 低改修のため段階化オーバーヘッドが相対的に大きい／中間 cap の実益が薄い。案3（maplibre メジャー据え置き）=「最新」要件を満たさず調査も非推奨。

## Scope
- **In**:
  - `package.json` の 5 依存をターゲット版へ更新し、`package-lock.json` を再生成。
  - 移行に伴う最小限のソース調整（私的 API 2 箇所のフォールバック切替が必要になった場合のみ）。
  - クリーン環境での `npm run build` / `dev` / `preview` 検証と、実機スモーク用チェックリストの整備。
- **Out**:
  - 既存の機能追加・UI 改修・リファクタリング。
  - Popup の生 HTML 注入（XSS）など、アップグレードと無関係な既存セキュリティ課題の修正（別途扱い）。
  - テスト自動化基盤の新規導入（合格判定は build＋実機スモークで行う）。
  - ルート `specs/`（Spec Kit 系成果物）への変更。

## Boundary Candidates
- 低リスク群（`vite` / `@turf/distance` / `maplibre-gl-opacity`）の更新。
- 高リスク結合ペア（`maplibre-gl` ＋ `maplibre-gl-gsi-terrain`）の協調更新と addProtocol 移行検証。
- 私的 API 依存箇所（L545 `_watchState` / L568 `_geometry`）の実機検証＋フォールバック。
- クリーン環境再現と検証ゲート（build＋実機スモークチェックリスト）。

## Out of Boundary
- アプリの新機能・挙動変更。
- アップグレード非起因の既存セキュリティ脆弱性（Popup 生 HTML 等）の是正。
- E2E/ユニットテストフレームワーク導入。
- Spec Kit（ルート `specs/`）側の運用や比較分析そのもの。

## Upstream / Downstream
- **Upstream**: 既存 `main.js` / `index.html` / `style.css` の現挙動。Node v24 / npm 11 実行環境。npm レジストリ上の各パッケージ最新版。
- **Downstream**: 本更新後に行う将来の機能追加・改修（最新 API 前提で進められる）。SDD フレームワーク比較演習の評価（cc-sdd 側の挙動を比較材料として使う）。

## Existing Spec Touchpoints
- **Extends**: なし（`.kiro/specs/` は空。Kiro 視点では新規グリーンフィールド）。
- **Adjacent**: ルート `specs/004-persist-custom-basemap`（別フレームワーク Spec Kit の成果物）。同一コードベースを対象にするため、ベースマップ/ソース定義周辺の変更が重複しないよう注意。本スペックは依存更新に限定し、当該機能ロジックには踏み込まない。

## Constraints
- 技術: ターゲット版は固定（vite 8.0.13 / maplibre-gl 5.24.0 / @turf/distance 7.3.5 / maplibre-gl-opacity 1.8.0 / maplibre-gl-gsi-terrain 2.3.2）。maplibre v5 到達は gsi-terrain 2.3.2 への更新が前提（不可分）。
- 検証: 実機（ブラウザ）目視はユーザー実施。実装側はチェックリストを提供。build グリーン単独を合格としない。クリーン環境（lockfile 再現）での再検証必須。
- 環境: Windows で npm install / git ref 操作が断続的にファイルロックで失敗し得る。先に実状態を診断し、`npm install` を優先する。
- 言語: 本スペックの成果物 Markdown は日本語で記述する。
