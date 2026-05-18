# クイックスタート: 依存最新化の実施・検証・ロールバック

対象ブランチ: `001-upgrade-dependencies` / Node: `^20.19.0 || >=22.12.0`
（開発機 v24.14.1 で充足）

## 0. 事前（任意・推奨）: 基準スナップショット

回帰比較のため、アップグレード前のビルド/挙動を控える。

```bash
npm install            # 旧依存で一度導入（基準）
npm run build          # 基準バンドルサイズを記録（dist/ のサイズ）
npm run dev            # 基準挙動を contracts のチェックリストで確認
```

## 1. アップグレード適用

`package.json` を目標バージョンへ更新し、ロックを再生成。

```bash
# devDependencies
npm install -D vite@^8.0.13
# dependencies
npm install maplibre-gl@^5.24.0 @turf/distance@^7.3.5 \
            maplibre-gl-opacity@^1.8.0 maplibre-gl-gsi-terrain@^2.3.2
```

`package.json` に engines を追記:

```json
"engines": { "node": "^20.19.0 || >=22.12.0" }
```

## 2. コード追従（research.md の決定に基づく）

- `main.js` の `@turf/distance` を named import へ:
  `import { distance } from '@turf/distance';`
- `main.js:568` `nearestFeature._geometry.coordinates`
  → 公開 `nearestFeature.geometry.coordinates` へ置換。
- `main.js:545` `geolocationControl._watchState === 'OFF'`
  → 公開イベント（`trackuserlocationstart` / `trackuserlocationend`）で
  追跡状態フラグを保持する方式へ置換。
- `useGsiTerrainSource(maplibregl.addProtocol)` を gsi-terrain 2.3.2 の
  シグネチャに合わせて確認・必要なら調整（不可なら FR-006 のフォールバック）。

## 3. 検証ゲート（憲章ワークフロー順）

```bash
npm run build          # ゲート: ビルド成功（FR-002 / SC-002）
npm run dev            # 手動スモーク（contracts/behavioral-equivalence.md C1–C11）
npm test               # 追加した純粋ロジック ユニットテスト（B8/B7）
npm audit              # 高～重大脆弱性 0（FR-009 / SC-003）
```

性能確認（憲章 IV / SC：体感）:
- `npm run dev` で初回操作可能まで体感 < 3 秒、パン/ズームのカクつきなし。
- `npm run build` 後の `dist/` サイズを手順 0 の基準と比較（増加時は理由記録）。

## 4. ドキュメント整合（FR-007 / FR-010）

- README「動作要件」の Node 記述と `package.json` engines を一致させる。
- README「検討結果 > git-spec」節に本実行の所感（手順・遭遇した破壊的変更・
  所要・課題）を日本語で追記（open-spec の「2026-05-14 完了」は上書きしない）。

## 5. ロールバック

問題時は依存とコード変更を戻す（実装で追加/変更した全ファイルを対象）:

```bash
git checkout -- package.json package-lock.json main.js README.md
git clean -fd nearest.js tests/            # 新規追加ファイルを除去
npm install            # コミット済みロックから再現（Windows で npm ci が
                        # ネイティブ .node ロックする場合は install を使う）
```

または当該ブランチ（`001-upgrade-dependencies`）を破棄し `main` 由来で再作成。

## 完了判定（spec SC との対応）

- SC-001: contracts C1–C9,C11 が全 PASS（観測機能 100% 等価）
- SC-002: 手順 3 のクリーン `npm install`→`npm run build` が無修正成功
- SC-003: `npm audit` 高～重大 0（or 文書化済み正当化）
- SC-004: package.json / package-lock.json / README(動作要件・検討結果) 不整合 0
- SC-005: README git-spec 節に比較可能な粒度で記録
