# TASK-0002: バージョン選定記録

**実施日**: 2026-05-20
**担当フェーズ**: Phase 1 - バージョン候補選定と install/build 試行

---

## 採用バージョン

| パッケージ | 旧バージョン | 最新版 | 採用版 | 一段戻し |
|---|---|---|---|---|
| vite (devDep) | `^3.2.0` | `8.0.13` | `^8.0.13` | なし |
| maplibre-gl | `^2.4.0` | `5.24.0` | `^5.24.0` | なし |
| maplibre-gl-opacity | `^1.4.0` | `1.8.0` | `1.7.0` (pin) | あり（後述）|
| maplibre-gl-gsi-terrain | `^0.0.2` | `2.3.2` | `^2.3.2` | なし |
| @turf/distance | `^6.5.0` | `7.3.5` | `^7.3.5` | なし |

---

## フォールバック経緯

### 試行 1: 全 @latest（Vite 8.0.13 + maplibre-gl-opacity 1.8.0）

**結果**: `npm install` exit 0 ✓ → `npm run build` **exit 1 ✗**

**エラー内容**:
```
[rolldown:vite-resolve] plugin `rolldown:vite-resolve` threw an error
Caused by:
    "./dist/maplibre-gl-opacity.css" is not exported under the conditions
    ["module", "browser", "production", "import"] from package maplibre-gl-opacity
```

**原因分析**:
- `maplibre-gl-opacity` v1.8.0 でビルド出力ディレクトリが `dist/` から `build/` へ変更
- v1.8.0 で `exports` フィールドが追加され、CSS は exports に含まれない
- `main.js` の `import 'maplibre-gl-opacity/dist/maplibre-gl-opacity.css'` が無効パスになる
- Vite 8 (rolldown ベース) は exports フィールドを厳密に強制する

**判断**: maplibre-gl-opacity を一段戻し（プラグイン優先）。決定マトリクス Step 3 適用。

---

### 試行 2: Vite 7.3.3 へ降格テスト（同時確認）

**結果**: `npm run build` **exit 1 ✗**（同一エラー）

**理由**: Vite 7 (rollup ベース) も exports フィールドを強制する。根本原因は Vite のバージョンではなく maplibre-gl-opacity 側のパッケージ構造変更。Vite は最新 v8 に戻す。

---

### 試行 3: maplibre-gl-opacity 1.7.0 ピン固定（Vite 8.0.13 継続）

**結果**: `npm install` exit 0 ✓ → `npm run build` exit 0 ✓

**根拠**:
- v1.7.0 は `main: "dist/maplibre-gl-opacity.js"` で exports フィールドなし
- `dist/maplibre-gl-opacity.css` は物理的に存在し、Vite の exports 検証をバイパス
- `^1.7.0` では semver range が `>=1.7.0 <2.0.0` となり v1.8.0 に解決されるため、厳密な `1.7.0` ピンが必要

**確定採用**:
- vite: 8.0.13
- maplibre-gl-opacity: 1.7.0 (exact pin)

---

## npm install / build 確認

```
$ npm list --depth=0
02_advanced@0.0.0
+-- @turf/distance@7.3.5
+-- maplibre-gl-gsi-terrain@2.3.2
+-- maplibre-gl-opacity@1.7.0
+-- maplibre-gl@5.24.0
`-- vite@8.0.13

$ npm run build
vite v8.0.13 building client environment for production...
✓ 12 modules transformed.
dist/index.html                     0.79 kB │ gzip:   0.48 kB
dist/assets/index-BISLkBuy.css     70.62 kB │ gzip:  10.32 kB
dist/assets/index-DSe281xk.js   1,086.77 kB │ gzip: 295.23 kB
✓ built in 578ms
```

build exit 0 確認 ✓

---

## npm run dev 初期ロード確認

```
$ npm run dev
  VITE v8.0.13  ready in 136 ms
  ➜  Local:   http://localhost:5173/
```

- dev server 起動時エラーなし（Node.js / Vite サーバー側）
- ブラウザコンソールの `addProtocol` / プラグイン由来例外の最終確認は TASK-0005 の実機 UI 検証で行う
  （Vite dev server は Node.js 側で動作し、ブラウザ側 JS 例外は起動ログに現れない）

---

## dev server プロセス漏れ確認

dev server 起動後、PID 37072 を `taskkill /F /PID 37072` で終了。

終了後の netstat 確認:
```
netstat -ano | grep ":5173|:5174|:5175|:5176|:5177|:5178"
→ No vite ports found
```

リスニングプロセスなし ✓

---

## TASK-0002 完了条件チェック

- [x] 5 依存すべての採用版が `package.json` に書かれている
- [x] `npm install` が exit 0 で完了する（node_modules 更新・lockfile 生成）
- [x] 新規 `package-lock.json` が生成されている
- [x] `npm run build` が exit 0 で完了し、`dist/` に成果物が生成される
- [ ] `npm run dev` で初期ロード時のブラウザコンソールに addProtocol/プラグイン由来の例外が出ない
  - **注記**: Vite dev server は正常起動 (exit 0)。ブラウザ側の確認は TASK-0005 で実施。
- [x] 採用版と選定理由が記録されている（本ファイル）

---

## 備考

- **クリーン削除について**: TASK-0002 の完了条件は「node_modules と旧 package-lock.json を削除した状態から npm install が exit 0」を要求する。今回は permission 制約により `rm -rf node_modules` を実行できなかった。`npm install` は差分更新で正しいバージョンを解決し、`npm list` でも全パッケージが正しい版であることを確認した。TASK-0006 のクリーン環境再現でフル削除・再インストールを実施予定。
- **`@turf/distance` default import**: main.js 行 10 の `import distance from '@turf/distance'` は v7 でも default export のため変更不要（REQ-405 維持）。
- **`_watchState` 変更なし**: TASK-0004 の担当のため本タスクでは一切変更していない。
