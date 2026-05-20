# ライブラリバージョンアップ データフロー図

**作成日**: 2026-05-20
**関連アーキテクチャ**: [architecture.md](architecture.md)
**関連要件定義**: [requirements.md](../../spec/library-version-upgrade/requirements.md)

## 信頼性レベル凡例
- 🔵 **青信号**: 要件定義・既存コード・メモから直接取得した確実なフロー
- 🟡 **黄信号**: 要件定義・既存コード・メモから妥当に推測したフロー
- 🔴 **赤信号**: 根拠のない推測

---

## 1. 全体像：本要件で「変わるフロー」と「変わらないフロー」 🔵

**信頼性**: 🔵 *要件定義の REQ 群 / 既存 main.js より*

```mermaid
flowchart LR
    subgraph 変わるフロー
        A1[依存解決 & build フロー<br/>npm install / npm run build]
        A2[GeolocateControl 停止検知<br/>REQ-501]
        A3[Node 要件の文書化<br/>REQ-103]
    end

    subgraph 変わらないフロー
        B1[地図初期描画]
        B2[ハザード / SKHB レイヤー表示切替]
        B3[クリックポップアップ]
        B4[mousemove カーソル変化]
        B5[最寄り避難所ルート描画]
        B6[3D 地形 / 陰影図]
        B7[PWA Service Worker 登録]
        B8[外部タイル CDN 取得]
    end

    A1 -. 影響範囲確認 .-> B1
    A1 -. 影響範囲確認 .-> B2
    A1 -. 影響範囲確認 .-> B3
    A2 -. 既存挙動を維持 .-> B5
    A1 -. 影響範囲確認 .-> B6
```

本ドキュメントでは「変わるフロー」3 件を中心に図化し、「変わらないフロー」は受け入れ基準（[acceptance-criteria.md](../../spec/library-version-upgrade/acceptance-criteria.md) TC-REQ-005-01〜B01）で目視確認を行うことを参照のみ示す。

---

## 2. 依存解決と build フロー 🔵

**信頼性**: 🔵 *要件 REQ-001/002/003/101 / NFR-302 / メモ [[project_001_false_green_build]] より*

### 2.1 通常パス（成功時）

```mermaid
sequenceDiagram
    actor Dev as 開発者
    participant FS as ファイルシステム
    participant NPM as npm CLI
    participant Reg as npm レジストリ
    participant Vite as vite build

    Dev->>FS: package.json の依存版を最新候補に更新
    Dev->>FS: node_modules / package-lock.json を削除
    Dev->>NPM: npm install
    NPM->>Reg: 依存ツリー解決
    Reg-->>NPM: 各パッケージ tar.gz
    NPM->>FS: node_modules 展開 + package-lock.json 生成
    NPM-->>Dev: install 完了 (exit 0)

    Dev->>NPM: npm run build
    NPM->>Vite: vite build --base=./
    Vite->>FS: src 解決 + バンドル + dist/ 出力
    Vite-->>Dev: build 完了 (exit 0)

    Dev->>FS: package-lock.json をコミット対象に追加
```

### 2.2 衝突時パス（一段戻し戦略） 🔵

**信頼性**: 🔵 *ヒアリング Q3 = (b) / Q4 = (a) / EDGE-101 より*

```mermaid
flowchart TD
    Start[全パッケージ @latest で package.json 更新] --> Inst1[npm install]
    Inst1 --> Resolve{依存解決}
    Resolve -- ERESOLVE / peer dep エラー --> Identify[衝突中心パッケージ特定<br/>プラグイン側を優先]
    Identify --> Downgrade1[該当パッケージを一段戻し<br/>latest-1 / 前メジャー]
    Downgrade1 --> Inst1

    Resolve -- 成功 --> Build1[npm run build]
    Build1 --> BuildOK{ビルド成功?}
    BuildOK -- No --> Identify
    BuildOK -- Yes --> Dev1[npm run dev で起動 + 描画確認]
    Dev1 --> Runtime{runtime エラー?}
    Runtime -- addProtocol 系 --> DowngradeML[maplibre-gl を一段戻す<br/>Q4 = a]
    DowngradeML --> Inst1
    Runtime -- なし --> Done[完成候補]

    Done --> Clean[クリーン環境再現<br/>NFR-302]
    Clean --> CleanOK{再現成功?}
    CleanOK -- No --> FakeGreen[偽 green と判定<br/>Start に戻る]
    FakeGreen --> Start
    CleanOK -- Yes --> Commit[lockfile コミット + 完了]
```

### 2.3 入出力データ

| ステップ | 入力 | 出力 |
|---|---|---|
| package.json 更新 | 旧バージョン文字列 | 新バージョン文字列（候補） |
| `npm install` | package.json + （任意） lockfile | node_modules / package-lock.json |
| `npm run build` | node_modules + main.js + index.html | `dist/index.html` / `dist/assets/*.js` / `dist/assets/*.css` |
| クリーン再現 | コミット済み package.json + package-lock.json | `dist/` 同等成果物 |

---

## 3. ランタイム：GeolocateControl 停止検知フロー（REQ-501） 🔵

**信頼性**: 🔵 *要件 REQ-501 / 既存 main.js 行418-425, 543-554 / ヒアリング Q5 = (i) より*

### 3.1 現状（変更前 = `_watchState` 直接参照）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant GC as GeolocateControl
    participant App as main.js
    participant Map as map (MapLibre)
    participant Route as map.getSource('route')

    User->>GC: 位置追跡 ON
    GC->>App: 'geolocate' イベント<br/>(e.coords.lon, lat)
    App->>App: userLocation = [lon, lat]

    loop 毎フレーム (map.on('render'))
        Map->>App: render イベント
        App->>GC: _watchState を直接参照<br/>(非公開 API)
        GC-->>App: 'OFF' or 'WAITING_ACTIVE' or 'ACTIVE_LOCK' ...
        alt _watchState === 'OFF'
            App->>App: userLocation = null
        end
        alt zoom < 7 OR userLocation === null
            App->>Route: setData(空 FeatureCollection)
        else
            App->>App: getNearestFeature(lon, lat)
            App->>Route: setData(LineString[現在地→最寄り])
        end
    end
```

### 3.2 変更後（REQ-501 = 公開イベント駆動） 🔵

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant GC as GeolocateControl
    participant App as main.js
    participant Map as map (MapLibre)
    participant Route as map.getSource('route')

    User->>GC: 位置追跡 ON
    GC->>App: 'geolocate' イベント
    App->>App: userLocation = [lon, lat]

    User->>GC: 位置追跡 OFF
    GC->>App: 'trackuserlocationend' イベント<br/>(公開 API)
    App->>App: userLocation = null

    loop 毎フレーム (map.on('render'))
        Map->>App: render イベント
        Note over App: _watchState 参照は削除
        alt zoom < 7 OR userLocation === null
            App->>Route: setData(空 FeatureCollection)
        else
            App->>App: getNearestFeature(lon, lat)
            App->>Route: setData(LineString[現在地→最寄り])
        end
    end
```

### 3.3 状態遷移 🔵

```mermaid
stateDiagram-v2
    [*] --> NotTracking : 初期
    NotTracking --> Tracking : GeolocateControl ON<br/>+ 'geolocate' 発火
    Tracking --> Tracking : 位置更新<br/>('geolocate' 再発火)
    Tracking --> NotTracking : 'trackuserlocationend' 発火<br/>(変更後 / REQ-501)

    state Tracking {
        [*] --> RouteHidden
        RouteHidden --> RouteVisible : zoom >= 7
        RouteVisible --> RouteHidden : zoom < 7
    }

    state NotTracking {
        [*] --> RouteEmpty
    }
```

### 3.4 差分の本質 🔵

- **変更前**: `render` ハンドラ内で `geolocationControl._watchState` を **pull 型に毎フレーム照会**。MapLibre 内部実装変更で破綻するリスクあり（EDGE-002）。
- **変更後**: `trackuserlocationend` を **push 型に一度購読**。MapLibre のメジャーアップでイベント名が安定している限り、内部実装の変更に追随不要。
- **コード差分（概念）**:
  - 追加: `geolocationControl.on('trackuserlocationend', () => { userLocation = null; });`
  - 削除: `render` 内の `if (geolocationControl._watchState === 'OFF') userLocation = null;`

---

## 4. 既存ランタイムフロー（参考・変更なし） 🔵

**信頼性**: 🔵 *既存 main.js より、本要件で挙動を変えない*

以下は「変えない」ことを明示するための参考図。受け入れ基準 TC-REQ-005-01〜B01 で同等性を確認する。

### 4.1 タイル取得経路

```mermaid
flowchart LR
    Init[map = new Map - style.sources] --> Sources
    Sources -->|raster| OSM[tile.openstreetmap.org]
    Sources -->|raster| Hazard[disaportaldata.gsi.go.jp]
    Sources -->|vector PBF| SKHB[同一オリジン /skhb]
    Sources -->|raster-dem| DEM[gsi-terrain プラグイン経由]
```

### 4.2 クリックポップアップ

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant Map as map
    participant App as main.js
    participant Popup as maplibregl.Popup

    User->>Map: click
    Map->>App: 'click' イベント (e.point)
    App->>Map: queryRenderedFeatures(point, {layers: skhb-1..8})
    Map-->>App: features[]
    alt features.length > 0
        App->>Popup: new Popup().setLngLat().setHTML(<避難所情報>).addTo(map)
    end
```

### 4.3 最寄り避難所計算（Turf v7 採用後も挙動不変） 🔵

```mermaid
sequenceDiagram
    participant App as main.js
    participant Map as map
    participant Turf as @turf/distance (default import)

    App->>Map: getStyle().layers.filter(skhb*)
    Map-->>App: skhbLayers[]
    App->>App: 表示中レイヤーの filter を取得
    App->>Map: querySourceFeatures('skhb', {filter})
    Map-->>App: features[]

    loop reduce
        App->>Turf: distance([lon, lat], feature.geometry.coordinates)
        Turf-->>App: 距離 (km)
    end

    App-->>App: nearestFeature
```

---

## 5. エラーハンドリングフロー（依存解決 / runtime） 🟡

**信頼性**: 🟡 *EDGE-001 / EDGE-002 / 過去事例から妥当な推測*

```mermaid
flowchart TD
    Err[エラー発生] --> Kind{種別}
    Kind -->|npm ERESOLVE / peer dep| Plug[衝突中心を特定 → 一段戻し<br/>Q3 = b / Q4 = a]
    Kind -->|vite build エラー| Bundle[エラーログから原因特定<br/>ESM/CJS 不整合なら最新版から一段戻し]
    Kind -->|runtime: addProtocol 例外| ML[maplibre-gl を一段戻す<br/>EDGE-001 / Q4 = a]
    Kind -->|runtime: route 描画固定 ON/OFF| WS[trackuserlocationend イベント名再確認<br/>EDGE-002 / REQ-501]
    Kind -->|Windows EPERM/EBUSY| Retry[npm install リトライ<br/>NFR-301]

    Plug --> Restart[ステップ 2.2 の戦略図に戻る]
    Bundle --> Restart
    ML --> Restart
    WS --> Restart
    Retry --> Restart
```

---

## 6. 検証フロー（受け入れ基準への対応） 🔵

**信頼性**: 🔵 *受け入れ基準 acceptance-criteria.md のテスト実施計画 Phase 1-3 より*

```mermaid
flowchart LR
    P1[Phase 1: 依存整合性 & build<br/>TC-REQ-001/002/405/501-01]
    P2[Phase 2: dev UI 実機<br/>TC-REQ-005/501-02/03/NFR-201/202/EDGE-002]
    P3[Phase 3: クリーン再現 & 非機能<br/>TC-NFR-001/002/101/301/302/EDGE-001]

    P1 --> P2 --> P3
    P3 --> Done[完了]
```

---

## 関連文書

- **アーキテクチャ**: [architecture.md](architecture.md)
- **設計ヒアリング**: [design-interview.md](design-interview.md)
- **要件定義**: [requirements.md](../../spec/library-version-upgrade/requirements.md)
- **受け入れ基準**: [acceptance-criteria.md](../../spec/library-version-upgrade/acceptance-criteria.md)

## 信頼性レベルサマリー

- 🔵 青信号: 8 件 (89%)
- 🟡 黄信号: 1 件 (11%)
- 🔴 赤信号: 0 件 (0%)

**品質評価**: 高品質（変更フロー 3 件・既存フロー参照は既存コードと要件から直接派生。残る 🟡 はエラーハンドリングフローの「種別ごとの対応分岐の網羅性」に限定）
