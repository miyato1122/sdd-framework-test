# Implementation Plan

> 本スペックの作業は依存結合（maplibre v5 到達は gsi-terrain 2.3.2 と不可分）と検証依存（build→smoke→条件付き調整→再検証）により**本質的に逐次**である。並行実行可能なタスクは存在しないため `(P)` マーカーは付与しない。順序が依存関係を表す。

- [ ] 1. Foundation: 検証ハーネスとクリーン環境の整備
- [x] 1.1 実機スモークチェックリストの作成
  - `docs/dependency-modernization-smoke-checklist.md` を作成し、R3.1〜3.8 の各機能に 1:1 対応する目視判定項目を列挙する
  - 各項目に「期待される観測結果」と再現手順（操作・前提）を記載する
  - 現在地・経路系（3.4 / 3.6 / 3.7）は同一描画コールバック領域の連動集合であるため、1グループとして連続検証する旨を注記する
  - 目視判定は利用者が実施し、実装側はチェックリストと再現手順を提供する位置づけを明記する
  - 完了状態: チェックリストファイルが存在し、R3.1〜3.8 の 8 項目＋各期待観測結果・再現手順＋連動注記を含む
  - _Requirements: 4.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - _Boundary: Verification Harness_

- [x] 1.2 クリーン環境の確立と Windows ファイルロック診断
  - lockfile から再現可能なクリーン環境を確立する手順を定義・実行する
  - 実行環境の Node が vite 8 要件（`^20.19.0 || >=22.12.0`）を満たすことを確認する
  - Windows のファイルロックは先に実状態を診断し、`npm install` を優先・必要時再試行で解消する
  - 完了状態: クリーン環境が再現手順とともに確立され、Node 互換が確認され、ファイルロック状態が診断・解消されて記録されている
  - _Requirements: 2.1, 2.2_
  - _Boundary: Verification Harness_

- [x] 1.3 更新前ベースラインの記録
  - 現行（更新前）アプリで 1.1 のチェックリストを実施し、R3.1〜3.8 の更新前挙動をベースラインとして記録する
  - 完了状態: 更新前ベースラインのスモーク結果（R3.1〜3.8 全項目の挙動）が記録され、後続のリグレッション判定に利用可能である
  - _Requirements: 4.4_
  - _Boundary: Verification Harness_

- [ ] 2. Core: 依存の協調一括更新
- [x] 2.1 5依存を目標版へ更新し package.json を書き換え
  - devDependencies の vite、dependencies の maplibre-gl / @turf/distance / maplibre-gl-opacity / maplibre-gl-gsi-terrain を目標版へ更新する
  - 指定 5 依存以外の追加・削除・版変更を行わない
  - 完了状態: package.json の 5 依存が vite 8.0.13 / maplibre-gl 5.24.0 / @turf/distance 7.3.5 / maplibre-gl-opacity 1.8.0 / maplibre-gl-gsi-terrain 2.3.2 を指し、他依存は不変
  - _Requirements: 1.1, 1.4_
  - _Boundary: Dependency Set_

- [x] 2.2 クリーン環境で lockfile を再生成し再現性を確認
  - 1.2 で確立したクリーン環境で install し、`package-lock.json` を再生成する
  - 目標版がクリーン環境で同一再現することを確認する。いずれか解決不能なら依存名と理由を記録し不合格とする
  - 完了状態: 再生成された `package-lock.json` がクリーン環境で目標版を同一再現する、または解決不能依存と理由が記録され不合格判定されている
  - _Requirements: 1.2, 1.3_
  - _Depends: 1.2_
  - _Boundary: Dependency Set_

- [ ] 3. Integration: クリーン環境ビルド/起動の成立確認
- [x] 3.1 クリーン環境で build/dev/preview を実行し健全性を判定
  - クリーン環境（再生成 lockfile）で本番ビルドを実行し、エラーなく配信成果物が生成されることを確認する
  - dev / preview を起動し、ブラウザコンソールにエラーがないこと・初期地図が表示されることを確認する
  - `@turf/distance` の default export 互換はビルド成否で判定し、事前断定しない
  - gsi-terrain 2.3.2 ↔ maplibre-gl v5 の addProtocol 統合がクリーンビルドで解決・バンドルされることを確認する（3D 地形機能 3.8 の依存側解錠の検証点）
  - ビルド成功のみでは合格としない（実機スモークを必須とする）
  - 完了状態: クリーン環境で build 成功＋dev/preview がコンソールエラーなく初期地図表示、または失敗依存/原因が記録され不合格判定されている
  - _Requirements: 2.1, 2.2, 2.3, 3.8_
  - _Depends: 2.2_
  - _Boundary: Verification Harness, Dependency Set_

- [ ] 4. Validation: 実機スモーク・条件付き互換調整・再検証ループ・合格判定
- [ ] 4.1 実機スモークを実施し更新前後リグレッションを判定
  - 1.1 のチェックリストで R3.1〜3.8 を実機目視（目視は利用者実施、実装側は再現手順提供）
  - 1.3 のベースラインと突き合わせ、利用者可視リグレッションの有無を判定する
  - 現在地・経路系（3.4 / 3.6 / 3.7）は連動グループとして一括検証する
  - 完了状態: 全スモーク項目の pass/fail がチェックリスト上に記録され、ベースライン比較でリグレッション有無が判定されている
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.4_
  - _Depends: 3.1_
  - _Boundary: Verification Harness_

- [ ] 4.2 私的API起因の回帰時のみ公開APIへ条件付き置換し、適用時は再検証ループを実行
  - 4.1 で 3.4（現在地オフ非表示）または 3.6 / 3.7（経路ライン表示/非表示）が破綻した場合のみ、`geolocationControl._watchState`（main.js:545）/ `nearestFeature._geometry.coordinates`（main.js:568）を公開 API へ置換する
  - 破綻しない場合は無改修とし、3.4 / 3.6 / 3.7 が無改修で維持される根拠を記録する（成果物＝判断記録）
  - 置換した場合は Task 3.1（クリーン環境ビルド/起動）と Task 4.1（全スモーク、3.4/3.6/3.7 連動含む）を再実行し、記録を更新する
  - 再検証の再実行はキャッシュ成果物を使わず、クリーン環境で post-Adjust の `main.js` からフルリビルド・再起動して行う
  - 完了状態: 判断記録が存在し、(無改修なら 3.4/3.6/3.7 維持の根拠) または (置換適用かつ post-Adjust ソースで 3.1/4.1 を再実行し 3.4/3.6/3.7 維持を再確認) のいずれかが記録されている
  - _Requirements: 3.4, 3.6, 3.7_
  - _Depends: 4.1_
  - _Boundary: Source Compatibility Adjustments_

- [ ] 4.3 最終合格判定の記録（変更後エビデンス必須）
  - 合格条件＝最新の Task 3.1（クリーン環境 build/起動成立）∧ 最新の Task 4.1（実機スモーク全項目 pass）。ビルド単独では合格としない
  - 4.2 で置換を適用した場合、本判定のエビデンスは置換後に再実行した 3.1 / 4.1 の結果でなければならない（置換前エビデンスでの合格記録を禁止）
  - 不合格時は該当機能/依存と原因を記録する
  - 完了状態: 合格/不合格と根拠（最新 build 結果＋最新スモーク全項目＋リグレッション有無、4.2 置換時は再実行後エビデンス）が記録されている
  - _Requirements: 4.1, 4.3_
  - _Depends: 4.1, 4.2_
  - _Boundary: Verification Harness_

## Implementation Notes
- 1.2: `npm run build`/`npm run preview` は追跡対象の `dist/`（Windows では CRLF 差分で ` M dist/index.html`）を再生成する。クリーン環境再現は `dist/` に触れない `npm ci` を用いる。Task 3.1 は正規にビルドするため、`dist/` 再生成を意図的に扱い（コミット対象に含めるか、probe 用途なら path-scoped `git checkout -- dist/` で復元）、破壊的な `git checkout .` / `git reset --hard` は使わないこと。
- 2.2: クリーン再インストール時、旧 vite3 由来の残留 esbuild サービスデーモン（zombie PID）が `node_modules\.esbuild-*\esbuild.exe` をロックし `npm warn cleanup EPERM` を起こすことがある。これが Windows ファイルロックの実体。Task 3.1 で `npm run build`（vite8/esbuild 新版）実行前に、残留 esbuild プロセスを診断・終了してから実行すること。lockfile は `npm ci` で hash 不変・byte 同一再現を確認済み（偽green ガード済み）。
- 3.1: `maplibre-gl-opacity@1.8.0` は破壊的に `exports` フィールド導入＋CSS を `dist/`→`build/` 移設（CSS サブパス未公開）。`main.js:7` を `import './node_modules/maplibre-gl-opacity/build/maplibre-gl-opacity.css';`（exports ゲートを回避しつつ stylesheet をバンドル）へ修正＝modernization 起因の3つ目の最小ソース調整。design.md は Revalidation Trigger 発火として再整合済み（requirements In-scope 準拠）。R3.2 opacity パネルの見た目はこの相対パス経由で維持（4.1 実機スモークで見た目が崩れていればこの経路を疑う）。相対 node_modules パスはやや非慣用で将来の bundler/package layout 変更で再訪要。
