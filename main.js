// MapLibre GL JSの読み込み
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// OpacityControlプラグインの読み込み
import OpacityControl from 'maplibre-gl-opacity';
import './node_modules/maplibre-gl-opacity/build/maplibre-gl-opacity.css';
// App-level visual-parity override (must load AFTER the widget CSS above so
// the cascade lets the override win). See style.css (Task 4.2 variant (c)).
import './style.css';

// 地点間の距離を計算するモジュール
import distance from '@turf/distance';

// 地理院標高タイルをMapLibre GL JSで利用するためのモジュール
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';

/**
 * 出典メタデータ（信頼／未信頼いずれの入力も受け付ける）。
 * @typedef {Object} BasemapAttribution
 * @property {string} label 表示テキスト（HTML として扱わない／任意入力可）
 * @property {string} [url] リンク先URL（http/https のみ a 化、それ以外は fail-closed）
 */

/**
 * 出典文字列を DOM API 経由で安全に構築する（任意入力対応・fail-closed）。
 *
 * 入力 attr は信頼／未信頼いずれの値（利用者入力／永続化由来値を含む）も
 * 受理する単一実装である（Req 4.1/4.2/4.5）。label と url は文字列補間
 * せず、document.createElement と textContent／setAttribute のみで構築し、
 * outerHTML で文字列化する。これによりブラウザの DOM API がテキストの
 * HTML エスケープと属性値のエンコードを保証し、属性ブレイクアウト・
 * markup 注入・ラベル経由の XSS が成立しない（Req 4.5）。
 *
 * url は new URL(url, location.href) で解析し、protocol が http: ／
 * https: のときのみ a 要素を構築する（target=_blank、rel=noopener 付与）。
 * 解析が throw する場合・protocol が http(s) 以外（javascript: ／ data:
 * ／ vbscript: 等）の場合は a を生成せず span を textContent のみで構築
 * し outerHTML を返す（fail-closed・ラベルのみ／Req 4.3）。
 *
 * MapLibre v5 サニタイザは多層防御の最後段に位置し、本関数は唯一の防御
 * として依存しない（design.md Security Considerations 整合）。
 *
 * @param {BasemapAttribution} attr {label, url?}（任意入力可）
 * @returns {string} source.attribution に渡す安全な HTML 文字列
 *   （http(s) なら a 要素、不適合なら span 要素／いずれもラベルは escape 済み）
 */
function buildAttribution(attr) {
    const label = attr.label;
    const url = attr.url;
    // url スキーム検証: http: ／ https: のみ allow-list（fail-closed）。
    // location.href を base に解決し protocol を判定する。url 未指定や
    // 解析失敗時は a を生成せず span ラベルのみへフォールバックする。
    let isHttp = false;
    if (typeof url === 'string' && url.length > 0) {
        try {
            isHttp = /^https?:$/.test(new URL(url, location.href).protocol);
        } catch {
            // URL として解釈できない場合も fail-closed
            isHttp = false;
        }
    }
    // a 生成パス: createElement + textContent + setAttribute で構築し
    // outerHTML を返す。文字列補間を経由しないため、label の markup や
    // url の引用符を用いた属性ブレイクアウトは DOM API が機械的に防ぐ。
    if (isHttp) {
        const a = document.createElement('a');
        a.textContent = label;
        a.setAttribute('href', url);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
        return a.outerHTML;
    }
    // fail-closed パス: a を生成せず span のテキストのみを返す（Req 4.3）。
    // ラベルは textContent 経由のため markup として解釈されない。
    const span = document.createElement('span');
    span.textContent = label;
    return span.outerHTML;
}

/**
 * 背景地図エントリ（4種背景の単一情報源）。
 * @typedef {Object} BasemapDef
 * @property {'osm'|'gsi_std'|'gsi_seamlessphoto'|'gsi_blank'} id 背景地図ID（ドメイン接頭辞付き）
 * @property {string} label  コントロール表示用の日本語ラベル
 * @property {object} source MapLibre raster source 定義（tiles, tileSize, minzoom, maxzoom）
 * @property {string} attribution buildAttribution で構築済みの出典文字列
 */

/**
 * 背景地図レジストリ（設定 as データ）。
 *
 * OSM・地理院地図(標準)・航空写真・白地図の4種を単一情報源として宣言する。
 * 各エントリの source は Style Spec v8 の raster source 定義で、ズーム範囲・
 * 画像形式差（.jpg/.png）を per-source に保持して表示欠陥を吸収する
 * （Req 2.1/2.2/2.3/2.4）。出典は開発者が定義する信頼定数 {label,url} のみを
 * buildAttribution に通して構築し、利用者入力・外部由来データを補間しない
 * （Req 3.1/3.2/4.1）。osm エントリは初期スタイルの既存 osm source と同一値
 * （tiles/tileSize/maxzoom）で、起動時の既定＝OSM・現行挙動を維持する
 * （Req 1.6。初期スタイルへの実結線は task 4.1 の責務）。
 *
 * @type {ReadonlyArray<BasemapDef>}
 */
const BASEMAPS = [
    {
        // OSM（既定）。初期スタイルの既存 osm source と同一値を踏襲（Req 1.6）。
        id: 'osm',
        label: 'OpenStreetMap',
        source: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            maxzoom: 19,
            tileSize: 256,
        },
        // 既存 osm 出典（OpenStreetMap contributors ＋ 著作権リンク）を
        // ラベル/URL 分離の信頼定数として buildAttribution 経由で構築（Req 3.1）。
        attribution: buildAttribution({
            label: 'OpenStreetMap contributors',
            url: 'https://www.openstreetmap.org/copyright',
        }),
    },
    {
        // 地理院地図(標準): PNG z0–18（research.md GSI std）。
        id: 'gsi_std',
        label: '地理院地図(標準)',
        source: {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 18,
        },
        attribution: buildAttribution({
            label: '出典：国土地理院ウェブサイト',
            url: 'https://maps.gsi.go.jp/development/ichiran.html',
        }),
    },
    {
        // 航空写真: JPEG z2–18。タイル画像形式が .jpg のため欠落させない
        // よう拡張子を保持（Req 2.1。research.md GSI seamlessphoto）。
        id: 'gsi_seamlessphoto',
        label: '航空写真',
        source: {
            type: 'raster',
            tiles: [
                'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
            ],
            tileSize: 256,
            minzoom: 2,
            maxzoom: 18,
        },
        attribution: buildAttribution({
            label: '出典：国土地理院ウェブサイト',
            url: 'https://maps.gsi.go.jp/development/ichiran.html',
        }),
    },
    {
        // 白地図: PNG z5–14・日本域のみ。maxzoom:14 で z>14 を overzoom
        // させ空白埋め尽くしを回避（Req 2.2/2.3。research.md GSI blank）。
        id: 'gsi_blank',
        label: '白地図',
        source: {
            type: 'raster',
            tiles: [
                'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            minzoom: 5,
            maxzoom: 14,
        },
        attribution: buildAttribution({
            label: '出典：国土地理院ウェブサイト',
            url: 'https://maps.gsi.go.jp/development/ichiran.html',
        }),
    },
];

/**
 * 現在アクティブな背景地図 id（実行時状態は唯一これのみ）。
 *
 * 初期スタイルは既存の osm source / osm-layer を持つため、起動時の
 * アクティブ背景は 'osm' とみなす（Req 1.6。初期スタイルへの実結線・
 * 整合は task 4.1 の責務であり、ここでは初期スタイルを改変しない）。
 *
 * @type {BasemapDef['id']}
 */
let currentBasemapId = 'osm';

/**
 * 背景地図を切り替える（アクティブ背景を常に単一・最下に保つ）。
 *
 * 選択された id を BASEMAPS から引き、現アクティブ背景の layer→source を
 * remove してから選択 source を addSource し、`hazard_flood-layer` を
 * beforeId に addLayer して常に重畳より下（最下）へ挿入する（Req 1.3/
 * 1.4/5.4）。source id は背景 id（例 `osm`/`gsi_std`）、layer id は
 * `<id>-layer`（例 `osm-layer`）で既存初期スタイルの命名と一貫させる。
 *
 * 同一 id の再選択、および BASEMAPS に存在しない id は no-op として
 * 何も変更せず返る（不要な再生成・防御的無効 id 回避）。
 *
 * 選択 source の `attribution` は BASEMAPS で buildAttribution 経由に
 * 構築済みで、未使用となった旧背景 source を除去することで MapLibre
 * 既定 AttributionControl が当該背景＋重畳のみへ自動更新される
 * （Req 3.3）。重畳（hazard_ 各種・skhb・route・hillshade）・既存
 * コントロールには一切触れない（Req 3.4/5.1/5.2）。タイル取得失敗は MapLibre が
 * タイル単位で許容し致命化しないため、本関数に追加のエラーハンドリング
 * を設けない（Req 2.5。設計上の非致命を維持）。
 *
 * @param {BasemapDef['id']} id 選択された背景地図 id
 * @returns {void}
 */
function setBasemap(id) {
    // 防御的: BASEMAPS に無い id は no-op（既存背景を維持）
    const entry = BASEMAPS.find((b) => b.id === id);
    if (!entry) return;
    // 同一 id の再選択は no-op（不要な source/layer 再生成を回避）
    if (id === currentBasemapId) return;

    // 旧アクティブ背景の layer→source を remove（過渡的に背景 0 個）。
    // source/layer 命名は初期スタイル（source `osm` / layer `osm-layer`）
    // と一貫させる: source id = 背景 id、layer id = `<id>-layer`。
    const prevLayerId = `${currentBasemapId}-layer`;
    const prevSourceId = currentBasemapId;
    map.removeLayer(prevLayerId);
    map.removeSource(prevSourceId);

    // 選択 source を add。BASEMAPS は attribution を source の外に持つため
    // ここで source へマージして渡す（未マージだと切替後に出典が消える）。
    // 既定 AttributionControl は使用中 source の attribution を集約するため
    // これで背景に追従して出典が表示される（Req 3.1/3.2/3.3）。
    map.addSource(id, { ...entry.source, attribution: entry.attribution });
    // 背景は常に最下: 初期スタイル常駐の `hazard_flood-layer` を beforeId
    // に指定し重畳（hazard_ 各種・route・skhb）より下へ挿入する（Req 5.4）。
    map.addLayer(
        {
            id: `${id}-layer`,
            source: id,
            type: 'raster',
        },
        'hazard_flood-layer',
    );

    // アクティブ id を更新（実行時状態の唯一の真実）
    currentBasemapId = id;
}

/**
 * 背景地図切替コントロール（MapLibre IControl）。
 *
 * 地図左下に配置する背景地図の排他選択 UI。BASEMAPS の各エントリを
 * ネイティブ `<input type="radio">` ＋ `<label for>` として `<fieldset>`／
 * `<legend>` 内に生成し、選択を setBasemap へ結線する（Req 1.1/1.2/1.5/
 * 6.1/6.2/6.3）。
 *
 * DOM は document.createElement / textContent のみで構築し、innerHTML 経路に
 * データを流さない（security.md。ラベルは BASEMAPS の開発者定数だが安全な
 * DOM 構築に統一する）。ネイティブ radio／label／fieldset／legend を用いる
 * ことでキーボード操作（Req 6.1）・支援技術ラベル（Req 6.2）・選択状態の
 * 提示（checked radio。Req 6.3）を標準セマンティクスで満たし、独自 ARIA
 * ウィジェットは構築しない。実行時状態は DOM の checked radio が唯一の
 * 真実で、内部に重複状態を持たない。
 *
 * 本クラスは定義のみで、map.addControl 登録・初期スタイル整合は task 4.1、
 * 最小スタイル（style.css）は task 3.2 の責務（本タスクは additive）。
 *
 * @implements {maplibregl.IControl}
 */
class BasemapSwitcherControl {
    constructor() {
        /**
         * onAdd で生成するコンテナ要素（onRemove での確実な除去用）。
         * @type {HTMLDivElement|null}
         */
        this._container = null;
        /**
         * change リスナ参照（onRemove で確実に解放しリークを防ぐ）。
         * @type {((e: Event) => void)|null}
         */
        this._onChange = null;
    }

    /**
     * コントロールの DOM を生成して返す（MapLibre IControl）。
     *
     * `maplibregl-ctrl maplibregl-ctrl-group` ＋ feature class
     * `basemap-switcher`（task 3.2 の CSS 標的）の div 内に、支援技術用
     * 見出しの `<legend>` を持つ `<fieldset>` を作り、BASEMAPS の各
     * エントリぶん `name="basemap"` の radio ＋ 対応 `<label for>` を
     * 生成する。currentBasemapId（既定 'osm'）に一致する radio を
     * checked にして現在選択を明示する（Req 1.2/1.5/1.6/6.2/6.3）。
     * radio の change で setBasemap(selectedId) を呼ぶ（Req 1.3/1.4）。
     *
     * @param {maplibregl.Map} _map MapLibre Map（本コントロールは Map API を直接使わず setBasemap 経由のため未使用）
     * @returns {HTMLElement} コントロールのルート要素
     */
    onAdd(_map) {
        // コンテナ: 既存コントロールと同じ MapLibre クラス＋feature class
        const container = document.createElement('div');
        container.className =
            'maplibregl-ctrl maplibregl-ctrl-group basemap-switcher';

        // fieldset/legend で選択肢グループを支援技術へ提示（Req 6.2）
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = '背景地図';
        fieldset.appendChild(legend);

        // change はグループ内のどの radio でも単一ハンドラで受ける
        this._onChange = (e) => {
            const target = e.target;
            // basemap グループの radio 以外は無視（防御的）
            if (
                !target ||
                target.name !== 'basemap' ||
                target.type !== 'radio'
            ) {
                return;
            }
            // 選択された背景 id を setBasemap へ結線（単一性は setBasemap が担保）
            setBasemap(target.value);
        };
        fieldset.addEventListener('change', this._onChange);

        // BASEMAPS の各エントリを radio ＋ label として安全な DOM API で構築
        BASEMAPS.forEach((entry) => {
            const inputId = `basemap-option-${entry.id}`;

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'basemap';
            input.id = inputId;
            input.value = entry.id;
            // 既定（currentBasemapId='osm'）に一致する radio を checked
            // にして現在選択を明示（Req 1.5/1.6/6.3）
            if (entry.id === currentBasemapId) {
                input.checked = true;
            }

            // label[for] で radio と関連付け、支援技術が読み上げ可能な
            // 識別ラベルを付与（Req 1.2/6.2）。テキストは textContent で
            // 構築し innerHTML 経路にデータを渡さない（security.md）
            const label = document.createElement('label');
            label.htmlFor = inputId;
            label.textContent = entry.label;

            // radio とラベルを 1 行（同一行）に収める行コンテナ。
            // fieldset は CSS で縦並び、各行内は CSS .basemap-option で
            // radio＋label を横並びにする（Req 1.2/6.4）
            const row = document.createElement('div');
            row.className = 'basemap-option';
            row.appendChild(input);
            row.appendChild(label);
            fieldset.appendChild(row);
        });

        container.appendChild(fieldset);
        this._container = container;
        return container;
    }

    /**
     * コントロールを取り外す（MapLibre IControl）。
     *
     * change リスナを解放し DOM を親から切り離してリークを防ぐ。
     *
     * @returns {void}
     */
    onRemove() {
        if (this._container) {
            // change リスナを確実に解放（fieldset 上に登録済み）
            if (this._onChange) {
                const fieldset = this._container.querySelector('fieldset');
                if (fieldset) {
                    fieldset.removeEventListener('change', this._onChange);
                }
            }
            // DOM を親から切り離す
            if (this._container.parentNode) {
                this._container.parentNode.removeChild(this._container);
            }
        }
        this._container = null;
        this._onChange = null;
    }

    /**
     * 既定の配置位置（MapLibre IControl）。
     *
     * 背景地図切替コントロールは地図の左下に配置する（Req 1.1）。
     * task 4.1 の addControl 第2引数でも明示するが、IControl 契約として
     * ここでも 'bottom-left' を返す。
     *
     * @returns {'bottom-left'}
     */
    getDefaultPosition() {
        return 'bottom-left';
    }
}

const map = new maplibregl.Map({
    container: 'map', // div要素のid
    zoom: 5, // 初期表示のズーム
    center: [138, 37], // 初期表示の中心
    minZoom: 5, // 最小ズーム
    maxZoom: 18, // 最大ズーム
    maxBounds: [122, 20, 154, 50], // 表示可能な範囲
    style: {
        version: 8,
        sources: {
            // 背景地図ソース（既定＝OSM）。
            // 初期スタイルの osm source を BASEMAPS の osm エントリと一貫させ、
            // 初回レンダリングと切替後レンダリングを同一にする（Req 1.6/3.3）。
            // tiles/tileSize/maxzoom は BASEMAPS[].source、attribution は
            // BASEMAPS[].attribution（buildAttribution 経由の安全な出典）から
            // 取り、ハードコード literal は持たない（Req 3.1 は BASEMAPS 形で充足）。
            // BASEMAPS / buildAttribution は上方で宣言済みのため参照は有効
            // （map 構築は const 宣言の後に実行され TDZ 非該当）。
            osm: {
                ...BASEMAPS.find((b) => b.id === 'osm').source,
                attribution: BASEMAPS.find((b) => b.id === 'osm').attribution,
            },
            // 重ねるハザードマップここから
            hazard_flood: {
                type: 'raster',
                tiles: [
                    'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png',
                ],
                minzoom: 2,
                maxzoom: 17,
                tileSize: 256,
                attribution:
                    '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
            },
            hazard_hightide: {
                type: 'raster',
                tiles: [
                    'https://disaportaldata.gsi.go.jp/raster/03_hightide_l2_shinsuishin_data/{z}/{x}/{y}.png',
                ],
                minzoom: 2,
                maxzoom: 17,
                tileSize: 256,
                attribution:
                    '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
            },
            hazard_tsunami: {
                type: 'raster',
                tiles: [
                    'https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_data/{z}/{x}/{y}.png',
                ],
                minzoom: 2,
                maxzoom: 17,
                tileSize: 256,
                attribution:
                    '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
            },
            hazard_doseki: {
                type: 'raster',
                tiles: [
                    'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png',
                ],
                minzoom: 2,
                maxzoom: 17,
                tileSize: 256,
                attribution:
                    '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
            },
            hazard_kyukeisha: {
                type: 'raster',
                tiles: [
                    'https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png',
                ],
                minzoom: 2,
                maxzoom: 17,
                tileSize: 256,
                attribution:
                    '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
            },
            hazard_jisuberi: {
                type: 'raster',
                tiles: [
                    'https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki/{z}/{x}/{y}.png',
                ],
                minzoom: 2,
                maxzoom: 17,
                tileSize: 256,
                attribution:
                    '<a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html">ハザードマップポータルサイト</a>',
            },
            // 重ねるハザードマップここまで
            skhb: {
                // 指定緊急避難場所ベクトルタイル
                type: 'vector',
                tiles: [
                    `${location.href.replace(
                        '/index.html',
                        '',
                    )}/skhb/{z}/{x}/{y}.pbf`,
                ],
                minzoom: 5,
                maxzoom: 8,
                attribution:
                    '<a href="https://www.gsi.go.jp/bousaichiri/hinanbasho.html" target="_blank">国土地理院:指定緊急避難場所データ</a>',
            },
            route: {
                // 現在位置と最寄りの避難施設をつなぐライン
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [],
                },
            },
        },
        layers: [
            // 背景地図レイヤー
            {
                id: 'osm-layer',
                source: 'osm',
                type: 'raster',
            },
            // 重ねるハザードマップここから
            {
                id: 'hazard_flood-layer',
                source: 'hazard_flood',
                type: 'raster',
                paint: { 'raster-opacity': 0.7 },
                layout: { visibility: 'none' }, // レイヤーの表示はOpacityControlで操作するためデフォルトで非表示にしておく
            },
            {
                id: 'hazard_hightide-layer',
                source: 'hazard_hightide',
                type: 'raster',
                paint: { 'raster-opacity': 0.7 },
                layout: { visibility: 'none' },
            },
            {
                id: 'hazard_tsunami-layer',
                source: 'hazard_tsunami',
                type: 'raster',
                paint: { 'raster-opacity': 0.7 },
                layout: { visibility: 'none' },
            },
            {
                id: 'hazard_doseki-layer',
                source: 'hazard_doseki',
                type: 'raster',
                paint: { 'raster-opacity': 0.7 },
                layout: { visibility: 'none' },
            },
            {
                id: 'hazard_kyukeisha-layer',
                source: 'hazard_kyukeisha',
                type: 'raster',
                paint: { 'raster-opacity': 0.7 },
                layout: { visibility: 'none' },
            },
            {
                id: 'hazard_jisuberi-layer',
                source: 'hazard_jisuberi',
                type: 'raster',
                paint: { 'raster-opacity': 0.7 },
                layout: { visibility: 'none' },
            },
            // 重ねるハザードマップここまで
            {
                // 現在位置と最寄り施設のライン
                id: 'route-layer',
                source: 'route',
                type: 'line',
                paint: {
                    'line-color': '#33aaff',
                    'line-width': 4,
                },
            },
            // 指定緊急避難場所ここから
            {
                id: 'skhb-1-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        // ズームレベルに応じた円の大きさ
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster1'], // 属性:disaster1がtrueの地物のみ表示する
                layout: { visibility: 'none' }, // レイヤーの表示はOpacityControlで操作するためデフォルトで非表示にしておく
            },
            {
                id: 'skhb-2-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster2'],
                layout: { visibility: 'none' },
            },
            {
                id: 'skhb-3-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster3'],
                layout: { visibility: 'none' },
            },
            {
                id: 'skhb-4-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster4'],
                layout: { visibility: 'none' },
            },
            {
                id: 'skhb-5-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster5'],
                layout: { visibility: 'none' },
            },
            {
                id: 'skhb-6-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster6'],
                layout: { visibility: 'none' },
            },
            {
                id: 'skhb-7-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster7'],
                layout: { visibility: 'none' },
            },
            {
                id: 'skhb-8-layer',
                source: 'skhb',
                'source-layer': 'skhb',
                type: 'circle',
                paint: {
                    'circle-color': '#6666cc',
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5,
                        2,
                        14,
                        6,
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                },
                filter: ['get', 'disaster8'],
                layout: { visibility: 'none' },
            },
        ],
    },
});

/**
 * 現在選択されている指定緊急避難場所レイヤー(skhb)を特定しそのfilter条件を返す
 */
const getCurrentSkhbLayerFilter = () => {
    const style = map.getStyle(); // style定義を取得
    const skhbLayers = style.layers.filter((layer) =>
        // `skhb`から始まるlayerを抽出
        layer.id.startsWith('skhb'),
    );
    const visibleSkhbLayers = skhbLayers.filter(
        // 現在表示中のレイヤーを見つける
        (layer) => layer.layout.visibility === 'visible',
    );
    return visibleSkhbLayers[0].filter; // 表示中レイヤーのfilter条件を返す
};

/**
 * 経緯度を渡すと最寄りの指定緊急避難場所を返す
 */
const getNearestFeature = (longitude, latitude) => {
    // 現在表示中の指定緊急避難場所のタイルデータ（＝地物）を取得する
    const currentSkhbLayerFilter = getCurrentSkhbLayerFilter();
    const features = map.querySourceFeatures('skhb', {
        sourceLayer: 'skhb',
        filter: currentSkhbLayerFilter,
    });

    // 現在地に最も近い地物を見つける
    const nearestFeature = features.reduce((minDistFeature, feature) => {
        const dist = distance(
            [longitude, latitude],
            feature.geometry.coordinates,
        );
        if (minDistFeature === null || minDistFeature.properties.dist > dist)
            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    dist,
                },
            };
        return minDistFeature;
    }, null);

    return nearestFeature;
};

let userLocation = null; // ユーザーの最新の現在地を保存する変数

// MapLibre GL JSの現在地取得機能
const geolocationControl = new maplibregl.GeolocateControl({
    trackUserLocation: true,
});
map.addControl(geolocationControl, 'bottom-right');
geolocationControl.on('geolocate', (e) => {
    // 位置情報が更新されるたびに発火・userLocationを更新
    userLocation = [e.coords.longitude, e.coords.latitude];
});

// マップの初期ロード完了時に発火するイベントを定義
map.on('load', () => {
    // 背景地図・重ねるタイル地図のコントロール
    const opacity = new OpacityControl({
        baseLayers: {
            'hazard_flood-layer': '洪水浸水想定区域',
            'hazard_hightide-layer': '高潮浸水想定区域',
            'hazard_tsunami-layer': '津波浸水想定区域',
            'hazard_doseki-layer': '土石流警戒区域',
            'hazard_kyukeisha-layer': '急傾斜警戒区域',
            'hazard_jisuberi-layer': '地滑り警戒区域',
        },
    });
    map.addControl(opacity, 'top-left');

    // 指定緊急避難場所レイヤーのコントロール
    const opacitySkhb = new OpacityControl({
        baseLayers: {
            'skhb-1-layer': '洪水',
            'skhb-2-layer': '崖崩れ/土石流/地滑り',
            'skhb-3-layer': '高潮',
            'skhb-4-layer': '地震',
            'skhb-5-layer': '津波',
            'skhb-6-layer': '大規模な火事',
            'skhb-7-layer': '内水氾濫',
            'skhb-8-layer': '火山現象',
        },
    });
    map.addControl(opacitySkhb, 'top-right');

    // 背景地図切替コントロール（既存 addControl 群と同所・map.on('load') 内）。
    // 地図左下に排他選択 UI を登録する（Req 1.1）。既存 OpacityControl
    // （左上/右上）・Geolocate/Terrain（右下）の登録・位置・挙動は変更しない
    // （Req 5.3）。getDefaultPosition も 'bottom-left' だが addControl 第2引数
    // でも明示する。
    map.addControl(new BasemapSwitcherControl(), 'bottom-left');

    // 地図上をクリックした際のイベント
    map.on('click', (e) => {
        // クリック箇所に指定緊急避難場所レイヤーが存在するかどうかをチェック
        const features = map.queryRenderedFeatures(e.point, {
            layers: [
                'skhb-1-layer',
                'skhb-2-layer',
                'skhb-3-layer',
                'skhb-4-layer',
                'skhb-5-layer',
                'skhb-6-layer',
                'skhb-7-layer',
                'skhb-8-layer',
            ],
        });
        if (features.length === 0) return; // 地物がなければ処理を終了

        // 地物があればポップアップを表示する
        const feature = features[0]; // 複数の地物が見つかっている場合は最初の要素を用いる
        const popup = new maplibregl.Popup()
            .setLngLat(feature.geometry.coordinates) // [lon, lat]
            // 名称・住所・備考・対応している災害種別を表示するよう、HTMLを文字列でセット
            .setHTML(
                `\
        <div style="font-weight:900; font-size: 1.2rem;">${
            feature.properties.name
        }</div>\
        <div>${feature.properties.address}</div>\
        <div>${feature.properties.remarks ?? ''}</div>\
        <div>\
        <span${
            feature.properties.disaster1 ? '' : ' style="color:#ccc;"'
        }">洪水</span>\
        <span${
            feature.properties.disaster2 ? '' : ' style="color:#ccc;"'
        }> 崖崩れ/土石流/地滑り</span>\
        <span${
            feature.properties.disaster3 ? '' : ' style="color:#ccc;"'
        }> 高潮</span>\
        <span${
            feature.properties.disaster4 ? '' : ' style="color:#ccc;"'
        }> 地震</span>\
        <div>\
        <span${
            feature.properties.disaster5 ? '' : ' style="color:#ccc;"'
        }>津波</span>\
        <span${
            feature.properties.disaster6 ? '' : ' style="color:#ccc;"'
        }> 大規模な火事</span>\
        <span${
            feature.properties.disaster7 ? '' : ' style="color:#ccc;"'
        }> 内水氾濫</span>\
        <span${
            feature.properties.disaster8 ? '' : ' style="color:#ccc;"'
        }> 火山現象</span>\
        </div>`,
            )
            .setMaxWidth('400px')
            .addTo(map);
    });

    // 地図上でマウスが移動した際のイベント
    map.on('mousemove', (e) => {
        // マウスカーソル以下に指定緊急避難場所レイヤーが存在するかどうかをチェック
        const features = map.queryRenderedFeatures(e.point, {
            layers: [
                'skhb-1-layer',
                'skhb-2-layer',
                'skhb-3-layer',
                'skhb-4-layer',
                'skhb-5-layer',
                'skhb-6-layer',
                'skhb-7-layer',
                'skhb-8-layer',
            ],
        });
        if (features.length > 0) {
            // 地物が存在する場合はカーソルをpointerに変更
            map.getCanvas().style.cursor = 'pointer';
        } else {
            // 存在しない場合はデフォルト
            map.getCanvas().style.cursor = '';
        }
    });

    // 地図画面が描画される毎フレームごとに、ユーザー現在地と最寄りの避難施設の線分を描画する
    map.on('render', () => {
        // GeolocationControlがオフなら現在位置を消去する
        if (geolocationControl._watchState === 'OFF') userLocation = null;

        // ズームが一定値以下または現在地が計算されていない場合はラインを消去する
        if (map.getZoom() < 7 || userLocation === null) {
            map.getSource('route').setData({
                type: 'FeatureCollection',
                features: [],
            });
            return;
        }

        // 現在地の最寄りの地物を取得
        const nearestFeature = getNearestFeature(
            userLocation[0],
            userLocation[1],
        );
        // 現在地と最寄りの地物をつないだラインのGeoJSON-Feature
        const routeFeature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    userLocation,
                    nearestFeature._geometry.coordinates,
                ],
            },
        };
        // style.sources.routeのGeoJSONデータを更新する
        map.getSource('route').setData({
            type: 'FeatureCollection',
            features: [routeFeature],
        });
    });

    // 地形データ生成（地理院標高タイル）
    const gsiTerrainSource = useGsiTerrainSource(maplibregl.addProtocol);
    // 地形データ追加（type=raster-dem）
    map.addSource('terrain', gsiTerrainSource);
    // 陰影図追加
    map.addLayer(
        {
            id: 'hillshade',
            source: 'terrain', // type=raster-demのsourceを指定
            type: 'hillshade', // 陰影図レイヤー
            paint: {
                'hillshade-illumination-anchor': 'map', // 陰影の方向の基準
                'hillshade-exaggeration': 0.2, // 陰影の強さ
            },
        },
        'hazard_jisuberi-layer', // どのレイヤーの手前に追加するかIDで指定
    );
    // 3D地形
    map.addControl(
        new maplibregl.TerrainControl({
            source: 'terrain', // type="raster-dem"のsourceのID
            exaggeration: 1, // 標高を強調する倍率
        }),
    );
});
