# library-version-upgrade ベースライン計測

**計測日**: 2026-05-20
**計測タスク**: [TASK-0001](TASK-0001.md)
**比較先タスク**: [TASK-0007](TASK-0007.md)

## 計測対象バージョン（現行）

`package.json`（変更なし）:

| パッケージ | バージョン指定 | 実インストール |
| --- | --- | --- |
| vite (devDeps) | `^3.2.0` | 3.2.1 |
| maplibre-gl | `^2.4.0` | （`package-lock.json` 参照） |
| @turf/distance | `^6.5.0` | （同上） |
| maplibre-gl-opacity | `^1.4.0` | （同上） |
| maplibre-gl-gsi-terrain | `^0.0.2` | （同上） |

## 計測環境

- OS: Windows 11 Home 10.0.26200
- Node.js: v24.14.1
- 作業ディレクトリ: `C:\Users\tomoa\work\worktrees\sdd-framework-test\smooth-flicker\sdd-framework-test`

## 1. dev コールドスタート時間

手順: 各試行前に `node_modules/.vite` を削除し、`npm run dev` を起動して、stdout の `ready in ...` 行が出力された時点までの経過時間（ms）を計測。終了後は dev サーバーを SIGKILL。計測スクリプト: `.measure-dev.cjs`（一時ファイル、計測後削除）。

| 試行 | 経過時間 (ms) |
| --- | --- |
| 1 | 308.8 |
| 2 | 305.7 |
| 3 | 311.6 |

- **中央値**: **308.8 ms（≒ 0.31 秒）**
- 参考: Vite 自身が報告する内部 `ready in` 値は概ね 120 ms 前後（小規模プロジェクトのため低位）

注記:
- 試行時、ローカル 5173-5177 ポートは他プロセスが使用中だったため Vite は 5178 に着地。ポート探索は ready 計測に数 ms 影響しうるが、3 試行とも条件は同一。
- 計測値は「`npm run dev` の spawn から `ready in` 行検出まで」の wall-clock。Node プロセス起動コスト + Vite 初期化を含む。TASK-0007 でも同一スクリプトを使用すれば再現性あり。
- **ポート占有事象（2026-05-20 検出）**: setup サブエージェントが計測後に dev サーバーを kill したと報告したが、verify フェーズで `netstat` 確認の結果、4 つの Vite プロセス（PID 36604/38388/28228/45428、ポート 5173/5176/5177/5178）が残存。本ファイル記録後に orchestrator が手動で kill 済み。3 試行はそれぞれ別ポート（5176/5177/5178）に着地しているが分散は ±3ms と小さく、本ベースラインを採用。**TASK-0007 では「同じスクリプト（順次ポート探索を許容）」または「5173 を事前に空けてから計測」のどちらかで条件を揃えること**。

## 2. build 成果物サイズ

手順: `dist/` を削除して `npm run build` を実行。`dist/` 配下を再帰集計。計測スクリプト: `.measure-size.cjs`（一時ファイル、計測後削除）。

| 区分 | サイズ (KB) | 備考 |
| --- | --- | --- |
| dist 合計 | **20227.55 KB** | 静的タイル `dist/skhb/` を含む |
| dist 合計（`skhb/` 除く） | **1307.24 KB** | 比較に有用な実コード相当 |
| `dist/assets/` | 871.02 KB | JS + CSS |
| `dist/skhb/` | 18920.30 KB | 配布静的 PBF タイル（コード変更で増減しない） |

主要ファイル個別サイズ:

| ファイル | サイズ | gzip |
| --- | --- | --- |
| `dist/assets/index.c98e5188.js` | 801.49 KB | 217.79 KB |
| `dist/assets/index.13a062fa.css` | 69.54 KB | 9.59 KB |
| `dist/index.html` | 0.77 KB | — |
| `dist/manifest.json` | 0.73 KB | — |
| `dist/sw.js` | 0.07 KB | — |

注記:
- Vite が `chunk > 500 KiB` の警告を出力（main JS が 801.49 KB）。これは現行の素のバンドル状態であり TASK-0007 の比較条件として採録。
- NFR-002「現行比 2 倍を超えない」の対象は実コード成果物が主眼のため、**`dist/assets/index.*.js` の 801.49 KB** を主指標とし、補助指標として `dist`（skhb 除く）の 1307.24 KB を併用する。

## 3. npm audit (`--omit=dev`)

手順: `npm audit --omit=dev --json` の `metadata.vulnerabilities` を抽出。

| 重大度 | 件数 |
| --- | --- |
| info | 0 |
| low | 0 |
| moderate | **1** |
| high | **0** |
| critical | **0** |
| total | 1 |

詳細:

- `protocol-buffers-schema` (`<3.6.1`) — prototype pollution（GHSA-j452-xhg8-qg39）。直接依存ではなく `maplibre-gl-gsi-terrain` 経由の推移依存。`fixAvailable: true`。

注記:
- NFR-101「high/critical が増えないこと」のベースラインは **high=0 / critical=0**。TASK-0007 ではこの 2 値が増えていないことを確認する。
- 同 lockfile であれば原則安定。レジストリ側 advisory 追加で moderate 以下が変動しうる点に留意。

## TASK-0007 比較で参照する主要数値

| 指標 | 現行値 | NFR 閾値 |
| --- | --- | --- |
| dev コールドスタート中央値 | **0.31 秒** | 現行比 ≤ 2 倍（NFR-001） |
| `dist/assets/index.*.js` | **801.49 KB** | 現行比 ≤ 2 倍（NFR-002 主指標） |
| `dist` 合計（skhb 除く） | **1307.24 KB** | 現行比 ≤ 2 倍（NFR-002 補助） |
| npm audit high | **0** 件 | 増えない（NFR-101） |
| npm audit critical | **0** 件 | 増えない（NFR-101） |
