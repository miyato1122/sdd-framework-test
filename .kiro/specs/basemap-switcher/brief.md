# Brief: basemap-switcher

## Problem

利用者は防災ハザードマップ閲覧時に背景地図を選べない。背景地図は `osm` ラスタ1枚にハードコードされており、地形把握に向く地理院地図標準、現況確認に向く航空写真、ハザード重畳を見やすくする白地図へ切り替える手段がない。本リポジトリは SDD フレームワーク比較演習の検証台であり、本件の主目的は **「新規機能実装フロー（要件→設計→タスク→実装の各ゲート）を Kiro で一通り回し、その品質を観察すること」** にある。

## Current State

- `main.js` の style 定義で背景地図は `osm` source ＋ `osm-layer` の1枚固定。切替の口は存在しない。
- 出典は各 source の `attribution` を MapLibre の AttributionControl が「使用中ソースのみ」自動集約して描画（v5 では `DOM.sanitize`/DOMPurify 経由の innerHTML）。
- 既存コントロール配置: ハザード OpacityControl=`top-left`、skhb OpacityControl=`top-right`、Geolocate/Terrain=`bottom-right`。`bottom-left` は空き。
- 永続化（リロード後の選択保持）機構はなし。

## Desired Outcome

- 利用者が地図 `bottom-left` のコントロールから背景地図を4種（OSM／地理院地図 標準／航空写真／白地図）から排他選択でき、選択が即座に地図へ反映される。
- 表示中の背景地図に応じて出典表記が適切に差し替わる（GSI 系表示時は国土地理院の出典、OSM 表示時は現行 OSM 出典）。ハザード/skhb 等の重畳レイヤの出典は背景切替に影響されず維持される。
- ハザード重畳・skhb・現在地ナビ・3D 地形など既存機能に回帰がない。

## Approach

**案B: 軽量カスタム MapLibre `IControl` ＋ 出典同期ロジック。**

バニラ JS で `IControl`（onAdd/onRemove、`maplibregl-ctrl` クラス）を実装し `addControl(ctrl, 'bottom-left')` で設置。4択（ラジオ/セレクト、a11y 配慮）で背景地図を排他切替し、出典は「ラベルと URL を分離した定数テーブル」から spec 003 の安全構築パターン（エスケープ・スキーム検証）を踏襲して同期する。

採用理由: 動機が「新規機能フローの検証」である以上、IControl 契約・アクセシビリティ・出典の安全な動的構築という、設計/レビューゲートで議論が生まれる論点を持つ案Bの方が、各ゲート品質を観察する題材として価値が高い。最小差分の OpacityControl 流用案(案A)・`setStyle` 丸ごと差替案(案C, 回帰リスク大)は不採用。

## Scope

- **In**:
  - `bottom-left` のカスタム IControl による背景地図の排他切替 UI（OSM／地理院地図標準／航空写真／白地図の4種）
  - 各背景地図の raster source/layer 定義（GSI のズーム/フォーマット差を吸収）
  - 表示中背景地図に追従する出典表記の差し替え
  - 既存機能（ハザード重畳・skhb・現在地ナビ・3D 地形・PWA）の非回帰
- **Out**:
  - 選択状態の永続化（localStorage 等でのリロード後保持）
  - 任意 URL のカスタム背景地図追加 UI
  - 4種以外の GSI レイヤ（淡色地図 等）の追加
  - 背景地図の不透明度調整

## Boundary Candidates

- **背景地図データ定義**: 4種の source/layer モデリング（`std` z0–18 png / `seamlessphoto` z2–18 **.jpg** / `blank` **z5–14・日本域のみ** png / 既存 osm）。per-source の minzoom/maxzoom と拡張子差の吸収。
- **切替コントロール (UI)**: IControl 実装・`bottom-left` 設置・排他選択・キーボード/ラベル等 a11y。
- **出典同期**: 表示中背景に対応する出典の決定と AttributionControl への安全な反映。背景以外のレイヤ出典の保持。

## Out of Boundary

- 選択の永続化（明示的に本スペックの責務外。動機＝フロー検証に対し過剰）。
- カスタムタイル URL 入力・任意ベースマップ追加。
- 既存 OpacityControl（ハザード/skhb）の挙動・配置変更。

## Upstream / Downstream

- **Upstream**: `main.js` の MapLibre style 定義（`osm` source/`osm-layer`）と AttributionControl の集約挙動。`maplibre-gl` v5.24.0 の IControl/AttributionControl API。spec 003 で確立した「innerHTML 経路へ生 HTML を渡さない（ラベル/URL 分離・エスケープ・スキーム検証）」制約。
- **Downstream**: 将来の「背景地図選択の永続化」スペック候補（本件で UI/データ境界が定義されればその上に乗せられる）。他フレームワーク比較側の basemap 演習（`specs/004-persist-custom-basemap` 系）との横並び評価。

## Existing Spec Touchpoints

- **Extends**: なし（新規スペック。`dependency-modernization` は依存更新であり無関係）。
- **Adjacent**: `main.js` 内のハザード/skhb 用 OpacityControl と AttributionControl 集約挙動 — 背景切替が他レイヤの可視・出典に副作用を与えないこと。

## Constraints

- 出典は AttributionControl の innerHTML 経路（v5 は DOMPurify 経由）。出典文字列は信頼できる開発者定義定数に限定し、利用者入力を一切補間しない。spec 003 のラベル/URL 分離・エスケープ・スキーム検証を必須継承。
- GSI タイル: 申請不要・CORS 開放（2026-05-19 確認）。出典は「`出典：国土地理院ウェブサイト`」＋ GSI ページへのリンク。OSM は現行表記を維持。`seamlessphoto` は `.jpg`、`blank` は z5–14・日本域のみのため per-source ズーム境界を設定（範囲外で空白/ボケを防ぐ）。
- **要設計判断**: 可視 visibility トグルのみだと4ソースが全て "used" となり AttributionControl が綺麗に切り替わらない。「切替時にソース/レイヤを add/remove」か「カスタムコントロールが出典を明示管理」かを design フェーズで決定する（案B が狙う中心的設計論点）。
- 技術方針: バニラ JS（TS 不使用）、既存スタイル（日本語コメント・2スペース・ESM）順守。lint/整形の新規導入なし。
- 検証: クリーン環境（lockfile 再現）での build/dev/preview 成功＋ブラウザ実機スモークの二段。build グリーン単独を合格としない。UI/ライブラリ挙動は静的解析で断定せず実機目視はユーザー実施・実装側はチェックリスト提供。
