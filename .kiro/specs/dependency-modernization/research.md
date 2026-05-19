# Research & Design Decisions

## Summary
- **Feature**: `dependency-modernization`
- **Discovery Scope**: Extension（既存システムの依存近代化 / Integration-focused light discovery）
- **Key Findings**:
  - `main.js` の MapLibre 公開 API（Map / Popup / GeolocateControl / TerrainControl / GeoJSONSource）は v2→v5 で安定。`@turf/distance` v7 は default export 維持で `import distance` 不変（ただし静的主張のためビルドで最終確認）。
  - 唯一のゲートは `maplibre-gl-gsi-terrain`。現行 `0.0.2` は旧 callback 形式 `addProtocol` で maplibre v4+ で破綻。`2.3.2`（async 化済み・`useGsiTerrainSource(addProtocol)` 署名不変）が maplibre v5 到達を解錠。`maplibre-gl-opacity` はメジャーを縛らない。
  - 実機検証必須の私的 API 依存が 2 箇所: `geolocationControl._watchState`（main.js:545）、`nearestFeature._geometry.coordinates`（main.js:568）。静的解析では断定不可。

## Research Log

### MapLibre GL JS v2 → v5 破壊的変更（使用 API への影響）
- **Context**: 3 メジャー移行が `main.js` の地図機能に与える影響特定。
- **Sources Consulted**: MapLibre GL JS v3 リリースノート、maplibre-gl-js CHANGELOG、Breaking changes v5（GitHub issue #3834）、npm レジストリ、@turf/distance@7.3.5 / maplibre-gl-gsi-terrain 0.0.2 & 2.3.2 のパッケージソース。
- **Findings**:
  - `addProtocol` は v4 で Promise/AbortController 化、旧 callback 形式は削除。`main.js:580` は関数参照を渡すのみで直接破綻はせず、破綻箇所は `maplibre-gl-gsi-terrain@0.0.2` 内部のハンドラ。
  - terrain は v3 で `style.terrain`→`map.terrain` だが本コードは TerrainControl + raster-dem 経路のため影響なし。
  - Popup / TerrainControl / GeolocateControl / GeoJSONSource の使用シグネチャは v2→v5 安定。既定投影は mercator のまま（globe はオプトイン）。
- **Implications**: ソース改修は原則不要。私的フィールド 2 箇所のみ実機検証で確認し、必要時に公開 API へ置換。

### 依存の最新版とプラグイン peer 互換
- **Context**: 「動作可能な最新版」セットの確定と互換ゲート特定。
- **Findings**:
  - 最新安定版: vite 8.0.13 / maplibre-gl 5.24.0 / @turf/distance 7.3.5 / maplibre-gl-opacity 1.8.0 / maplibre-gl-gsi-terrain 2.3.2。
  - 両プラグインとも maplibre-gl を厳格な peerDependency 宣言せず（npm が自動で cap しない）。実互換は addProtocol 世代で決まる。gsi-terrain 0.0.2＝maplibre v3 まで、2.3.2＝maplibre v5 対応。opacity はメジャー非依存。
  - vite 8 は Node `^20.19.0 || >=22.12.0` 要求。検証環境 Node v24.14.1 で充足。
- **Implications**: maplibre v5 到達は gsi-terrain 2.3.2 への更新と不可分 → 5 依存の協調一括更新が必須。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 協調一括更新（採用） | 5 依存を目標版へ同時更新 | 「最新」要件に直結、改修最小、検証ゲート明快 | 4メジャー差が一度に着地、回帰の原因切り分けがやや難 | discovery 案1。gsi-terrain↔maplibre 結合が不可分なため段階化の実益が薄い |
| リスク段階更新 | 低リスク群→結合ペアの 2 波 | 原因切り分け容易 | 低改修ゆえ段階化オーバーヘッド大、中間 cap の実益薄 | discovery 案2（不採用） |
| maplibre メジャー据え置き | vite/turf/opacity のみ更新 | 実機リスク最小 | 「最新」要件未達 | discovery 案3（不採用） |

## Design Decisions

### Decision: 5 依存の協調一括更新
- **Context**: maplibre v5 到達と gsi-terrain 更新が不可分（R1, R3.8）。
- **Alternatives Considered**: 1. 段階更新 2. メジャー据え置き
- **Selected Approach**: package.json の 5 依存を目標版へ同時更新し、クリーン環境で lockfile 再生成。
- **Rationale**: 結合制約上、分割しても独立検証できず価値が薄い。最小変更で要件直結。
- **Trade-offs**: 回帰時の原因切り分けは私的 API 2 箇所の事前特定で緩和。
- **Follow-up**: クリーン環境ビルドと実機スモークで確認。

### Decision: 私的 API 依存を公開 API へ置換（条件付き）
- **Context**: `_watchState`（545）/ `_geometry`（568）はバージョン間非保証（R3.4, R3.6）。
- **Alternatives Considered**: 1. 現状維持で実機確認のみ 2. 無条件置換
- **Selected Approach**: 実機スモークで該当挙動が破綻した場合にのみ、公開状態判定 / `.geometry.coordinates` へ置換。破綻しなければ無改修。
- **Rationale**: 不要改修を避けつつ偽green を防ぐ。adopt（公開 API）優先。
- **Trade-offs**: 実機確認が前提（自動化不可、利用者目視）。

### Decision: `@turf/distance` default export 互換はビルドで検証
- **Context**: v7 dual export は静的ソース主張で、過去に偽green 前例あり。
- **Selected Approach**: 事前断定せず、クリーン環境ビルド（R2.1）を当該前提の検証点とする。
- **Rationale**: バンドラ解決失敗はビルドで顕在化する。静的解析だけで合格としない方針と一致。

## Risks & Mitigations
- gsi-terrain 2.3.2 で 3D 地形/陰影が実機再現しない — 実機スモーク（R3.8）で確認、`useGsiTerrainSource` 署名不変のためソース改修は原則不要、破綻時のみ調査。
- 私的 API 2 箇所の挙動変化 — 公開 API フォールバックを事前用意（条件付き適用）。
- Windows で npm install / git ref 操作がファイルロック断続失敗 — 先に実状態を診断、`npm install` を優先、再試行。
- 偽green（lockfile 再現環境で当初失敗の前例） — 合格をクリーン環境再現＋実機スモークの二段に固定、ビルド単独不可。

## References
- [MapLibre GL JS v3 release notes](https://maplibre.org/news/2023-05-23-maplibre-gl-js-v3/) — terrain/addProtocol 移行の起点
- [maplibre-gl-js CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) — v3/v4/v5 変更点
- [Breaking changes MapLibre GL JS v5 (#3834)](https://github.com/maplibre/maplibre-gl-js/issues/3834) — v5 破壊的変更一覧
- npm レジストリ（各パッケージ最新安定版・peer 宣言）/ unpkg・jsDelivr（@turf/distance@7.3.5、maplibre-gl-gsi-terrain 0.0.2 & 2.3.2 のソース）
- `.kiro/specs/dependency-modernization/brief.md` — discovery 確定スコープ・合格基準
