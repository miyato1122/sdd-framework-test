# Requirements Document

## Introduction

防災ハザードマップ PWA（Vite + MapLibre GL JS。OSM 背景地図に国土地理院ハザードマップと指定緊急避難場所を重ね、現在地から最寄り避難所への距離・経路を案内）の依存パッケージが大幅に古く、技術的負債とセキュリティ修正の取り残しが生じている。本スペックは、既存のユーザー可視挙動を維持したまま、全依存を discovery で確認済みの「動作可能な最新の目標版」（`vite 8.0.13` / `maplibre-gl 5.24.0` / `@turf/distance 7.3.5` / `maplibre-gl-opacity 1.8.0` / `maplibre-gl-gsi-terrain 2.3.2`）へ協調的に更新することを要求する。合格判定は静的ビルドの成功だけでは不十分とし、クリーン環境での再現とブラウザ実機スモークの双方を必須とする（偽 green の回避）。移行手順・コード改修方法・フォールバック実装などの HOW は design/tasks フェーズに委ねる。

## Boundary Context (Optional)

- **In scope**: 5 依存の目標版更新とロックファイルの再生成、更新に伴う最小限のユーザー可視挙動維持、クリーン環境での build/dev/preview 検証、実機スモーク用チェックリストの提供。
- **Out of scope**: 機能追加・UI 改修・リファクタリング、アップグレード非起因の既存セキュリティ課題（Popup の生 HTML 描画＝XSS）の是正、テスト自動化基盤の新規導入、Nuxt 構成への移行、ルート `/specs/`（別フレームワーク成果物）への変更。
- **Adjacent expectations**: ルート `/specs/`（git-spec / Spec Kit 系成果物）は同一コードベースを対象とするため改修重複を避ける。security steering に従い、本更新作業で新たな未信頼データの生 HTML 描画経路を導入しない（既存の Popup XSS の是正自体は本スペックの責務外）。

## Requirements

### Requirement 1: 依存パッケージの最新化（バージョン目標）
**Objective:** As a 保守開発者, I want 全依存が動作可能な最新の目標版に更新されること, so that セキュリティ修正と最新 API の恩恵を受け、技術的負債を解消できる

#### Acceptance Criteria
1. When 依存解決が完了したとき, the 依存構成 shall `vite` を 8.0.13、`maplibre-gl` を 5.24.0、`@turf/distance` を 7.3.5、`maplibre-gl-opacity` を 1.8.0、`maplibre-gl-gsi-terrain` を 2.3.2 に解決する
2. The 依存構成 shall ロックファイルにより上記目標版がクリーン環境で同一に再現可能であること
3. If いずれかの依存が目標版に解決できない場合, then the 依存更新プロセス shall その依存名と理由を記録し、合格としない
4. The 依存更新プロセス shall 目標版以外への依存追加・置換を行わない（本スペックは指定 5 依存の版更新に限定する）

### Requirement 2: ビルド・開発・プレビューの健全性（クリーン環境）
**Objective:** As a 保守開発者, I want クリーン環境でビルド・開発・プレビューがエラーなく成立すること, so that 更新後も配信と開発が継続できる

#### Acceptance Criteria
1. When クリーン環境（ロックファイル再現）で本番ビルドを実行したとき, the ビルドパイプライン shall エラーなく配信成果物を生成する
2. When クリーン環境で開発サーバまたはプレビューを起動したとき, the 防災マップアプリ shall ブラウザコンソールにエラーを出さずに初期地図を表示する
3. The 検証プロセス shall ビルド成功のみをもって合格としない（Requirement 4 の実機スモーク通過を必須とする）

### Requirement 3: 既存ユーザー機能の維持
**Objective:** As a 一般利用者, I want 更新前と同じ防災機能が使えること, so that 更新によって防災情報の確認に支障が出ない

#### Acceptance Criteria
1. When アプリを開いたとき, the 防災マップアプリ shall OSM 背景地図と重畳ハザード（洪水・高潮・津波・土石流・急傾斜地崩壊・地すべり）を表示する
2. When 利用者がレイヤ不透明度コントロールを操作したとき, the 防災マップアプリ shall ベースレイヤ/重畳レイヤの切替および不透明度変更を反映する
3. When 利用者が現在地取得を有効化したとき, the 防災マップアプリ shall 現在地を取得して地図に反映する
4. While 現在地取得がオフのとき, the 防災マップアプリ shall 現在地および現在地起点の経路ラインを表示しない
5. When 利用者が指定緊急避難場所をクリックしたとき, the 防災マップアプリ shall その施設の名称・住所・備考・対応災害種別をポップアップ表示する
6. While ズームが規定の閾値以上かつ現在地が確定しているとき, the 防災マップアプリ shall 現在地と最寄り避難施設を結ぶ経路ラインを描画する
7. If ズームが規定の閾値未満または現在地が未確定の場合, then the 防災マップアプリ shall 経路ラインを表示しない
8. When 利用者が 3D 地形表示を有効化したとき, the 防災マップアプリ shall 地理院標高に基づく地形誇張と陰影を表示する

### Requirement 4: 実機スモークによる合格判定（検証ゲート）
**Objective:** As a 保守開発者/評価者, I want 合格判定が静的ビルドだけでなく実機スモークで担保されること, so that 偽 green を避け、更新後に本当に動作することを確認できる

#### Acceptance Criteria
1. The 検証プロセス shall クリーン環境での build/dev/preview 成立（Requirement 2）と実機スモーク（Requirement 3 の全機能）の双方の通過を合格条件とする
2. Where 実機目視確認が必要な場合, the 検証プロセス shall 実装側がスモーク用チェックリストを提供し、目視判定は利用者が実施する
3. If 実機スモークでいずれかの主要機能が再現しない場合, then the 検証プロセス shall 不合格として該当機能と原因を記録する
4. The 検証プロセス shall 更新前後で Requirement 3 の各機能に利用者可視のリグレッションが無いことを確認する

<!-- Additional requirements follow the same pattern -->
