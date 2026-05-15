// MapLibre GL JSの読み込み
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// OpacityControlプラグインの読み込み
// 注: v1.8.0 以降は package.json の exports に CSS が含まれないため、
//     付属 CSS は ./style.css にインライン化して取り込んでいる。
import OpacityControl from 'maplibre-gl-opacity';
import './style.css';

// 地点間の距離を計算するモジュール
import distance from '@turf/distance';

// 地理院標高タイルをMapLibre GL JSで利用するためのモジュール
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';

// カスタム背景地図の永続化・検証
import {
    getCustomBasemaps,
    saveCustomBasemap,
    deleteCustomBasemap,
    getSelectedBasemapId,
    setSelectedBasemapId,
} from './customBasemapStore.js';
import {
    validateCustomBasemapInput,
    buildAttributionHtml,
} from './customBasemapValidation.js';

// プリセット背景レイヤー ID（排他切替の対象）
const PRESET_BASEMAP_LAYER_IDS = [
    'osm-layer',
    'gsi_std-layer',
    'gsi_photo-layer',
    'gsi_blank-layer',
];
const DEFAULT_BASEMAP_LAYER_ID = 'osm-layer';

// 起動前に IndexedDB から復元する
const [restoredCustomBasemaps, restoredSelectedId] = await Promise.all([
    getCustomBasemaps(),
    getSelectedBasemapId(),
]);

// 復元値が指すレイヤーが実在するかを判定し、無ければ OSM にフォールバック
const restoredCustomLayerIds = restoredCustomBasemaps.map(
    (r) => `custom_${r.id}-layer`,
);
const allBasemapLayerIds = [
    ...PRESET_BASEMAP_LAYER_IDS,
    ...restoredCustomLayerIds,
];
let initialSelectedId =
    restoredSelectedId && allBasemapLayerIds.includes(restoredSelectedId)
        ? restoredSelectedId
        : DEFAULT_BASEMAP_LAYER_ID;
if (initialSelectedId !== restoredSelectedId) {
    // 永続化値が指すレイヤーが存在しないので OSM で補正保存
    setSelectedBasemapId(DEFAULT_BASEMAP_LAYER_ID);
}

// カスタム背景地図定義から source/layer のスタイル断片を組み立てるヘルパ
function buildSourceDef(record) {
    const source = {
        type: 'raster',
        tiles: [record.tileUrl],
        tileSize: 256,
        attribution: buildAttributionHtml({
            text: record.attributionText,
            url: record.attributionUrl,
        }),
    };
    if (typeof record.minzoom === 'number') source.minzoom = record.minzoom;
    if (typeof record.maxzoom === 'number') source.maxzoom = record.maxzoom;
    return source;
}

function buildLayerDef(record, visible) {
    return {
        id: `custom_${record.id}-layer`,
        source: `custom_${record.id}`,
        type: 'raster',
        layout: { visibility: visible ? 'visible' : 'none' },
    };
}

// 復元したカスタム背景地図を style.sources / style.layers に注入する
const customSources = {};
const customLayers = [];
for (const record of restoredCustomBasemaps) {
    customSources[`custom_${record.id}`] = buildSourceDef(record);
    customLayers.push(
        buildLayerDef(record, `custom_${record.id}-layer` === initialSelectedId),
    );
}

// プリセット背景の初期 visibility を選択中 ID に合わせて切り替える
const presetVisibility = (layerId) =>
    layerId === initialSelectedId ? 'visible' : 'none';

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
            // 背景地図ソース
            osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                maxzoom: 19,
                tileSize: 256,
                attribution:
                    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
            gsi_std: {
                type: 'raster',
                tiles: [
                    'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
                ],
                maxzoom: 18,
                tileSize: 256,
                attribution:
                    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
            },
            gsi_photo: {
                type: 'raster',
                tiles: [
                    'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
                ],
                minzoom: 2,
                maxzoom: 18,
                tileSize: 256,
                attribution:
                    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
            },
            gsi_blank: {
                type: 'raster',
                tiles: [
                    'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png',
                ],
                minzoom: 5,
                maxzoom: 14,
                tileSize: 256,
                attribution:
                    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
            },
            ...customSources,
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
            // 背景地図レイヤー（同時に可視なのは常に 1 つ。BasemapSwitcherControl で排他切替）
            {
                id: 'osm-layer',
                source: 'osm',
                type: 'raster',
                layout: { visibility: presetVisibility('osm-layer') },
            },
            {
                id: 'gsi_std-layer',
                source: 'gsi_std',
                type: 'raster',
                layout: { visibility: presetVisibility('gsi_std-layer') },
            },
            {
                id: 'gsi_photo-layer',
                source: 'gsi_photo',
                type: 'raster',
                layout: { visibility: presetVisibility('gsi_photo-layer') },
            },
            {
                id: 'gsi_blank-layer',
                source: 'gsi_blank',
                type: 'raster',
                layout: { visibility: presetVisibility('gsi_blank-layer') },
            },
            // ユーザー追加カスタム背景レイヤー（プリセット 4 つの直後・ハザードの直前に挿入）
            ...customLayers,
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
 * 背景地図切替コントロール（MapLibre IControl 実装）
 * プリセット 4 件と任意個のユーザー追加カスタム背景地図をラジオで排他切替する。
 * カスタム行には ⋮ メニューを表示し、編集／削除を提供する。
 */
class BasemapSwitcherControl {
    static PRESET_OPTIONS = [
        { id: 'osm-layer', label: 'OSM' },
        { id: 'gsi_std-layer', label: '地理院地図' },
        { id: 'gsi_photo-layer', label: '航空写真' },
        { id: 'gsi_blank-layer', label: '白地図' },
    ];

    constructor({ customBasemaps, selectedId, onOpenForm }) {
        this._customBasemaps = customBasemaps.slice();
        this._selectedId = selectedId;
        this._onOpenForm = onOpenForm;
        this._openMenuId = null; // 現在開いているドロップダウンの行 ID
    }

    onAdd(map) {
        this._map = map;
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        container.id = 'basemap-switcher';
        this._container = container;

        // ドキュメント全域クリックで開いているメニューを閉じる
        this._docClickHandler = (e) => {
            if (!this._openMenuId) return;
            if (!this._container.contains(e.target)) {
                this._closeAllMenus();
            } else {
                // メニュー外のクリックでも閉じる（メニューボタン自身は handler 内で再判定）
                const inDropdown = e.target.closest('.row-menu-dropdown');
                const inButton = e.target.closest('.row-menu-button');
                if (!inDropdown && !inButton) this._closeAllMenus();
            }
        };
        document.addEventListener('click', this._docClickHandler);

        this._escHandler = (e) => {
            if (e.key === 'Escape' && this._openMenuId) {
                this._closeAllMenus();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        this.renderRadios();
        return container;
    }

    onRemove() {
        document.removeEventListener('click', this._docClickHandler);
        document.removeEventListener('keydown', this._escHandler);
        this._container.remove();
        this._map = undefined;
    }

    setCustomBasemaps(list) {
        this._customBasemaps = list.slice();
        this.renderRadios();
    }

    setSelectedId(id) {
        this._selectedId = id;
        // 反映のため再描画（checked 属性の更新）
        this.renderRadios();
    }

    getSelectedId() {
        return this._selectedId;
    }

    _closeAllMenus() {
        this._openMenuId = null;
        // 再描画でメニューが閉じる
        this.renderRadios();
    }

    renderRadios() {
        const container = this._container;
        if (!container) return;
        container.innerHTML = '';

        const options = [
            ...BasemapSwitcherControl.PRESET_OPTIONS.map((o) => ({
                ...o,
                isCustom: false,
                record: null,
            })),
            ...this._customBasemaps.map((r) => ({
                id: `custom_${r.id}-layer`,
                label: r.label,
                isCustom: true,
                record: r,
            })),
        ];

        for (const opt of options) {
            const row = document.createElement('div');
            row.className = 'basemap-row';

            const labelEl = document.createElement('label');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'basemap-switcher';
            input.value = opt.id;
            input.checked = opt.id === this._selectedId;
            input.addEventListener('change', () => {
                if (input.checked) this._handleSelect(opt.id);
            });
            labelEl.appendChild(input);
            labelEl.appendChild(document.createTextNode(` ${opt.label}`));
            labelEl.title = opt.label;
            row.appendChild(labelEl);

            if (opt.isCustom) {
                row.appendChild(this._buildRowMenu(opt));
            }

            container.appendChild(row);
        }

        // 追加ボタン（末尾）
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-button';
        addBtn.textContent = '+ 背景地図を追加';
        addBtn.addEventListener('click', () => {
            this._closeAllMenus();
            this._onOpenForm({ mode: 'add' });
        });
        container.appendChild(addBtn);
    }

    _buildRowMenu(opt) {
        const wrap = document.createElement('span');
        wrap.className = 'row-menu';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'row-menu-button';
        button.setAttribute('aria-label', `${opt.label} の操作メニュー`);
        button.textContent = '⋮';
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._openMenuId === opt.id) {
                this._closeAllMenus();
            } else {
                this._openMenuId = opt.id;
                this.renderRadios();
            }
        });
        wrap.appendChild(button);

        if (this._openMenuId === opt.id) {
            const dropdown = document.createElement('div');
            dropdown.className = 'row-menu-dropdown';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.dataset.action = 'edit';
            editBtn.textContent = '編集';
            editBtn.addEventListener('click', () => {
                this._closeAllMenus();
                this._onOpenForm({ mode: 'edit', record: opt.record });
            });
            dropdown.appendChild(editBtn);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.dataset.action = 'delete';
            delBtn.textContent = '削除';
            delBtn.addEventListener('click', async () => {
                this._closeAllMenus();
                const ok = await confirmDelete(opt.record.label);
                if (!ok) return;
                this._handleDelete(opt.record);
            });
            dropdown.appendChild(delBtn);

            wrap.appendChild(dropdown);
        }

        return wrap;
    }

    _handleSelect(layerId) {
        applySelection(this._map, layerId);
        this._selectedId = layerId;
        setSelectedBasemapId(layerId);
    }

    async _handleDelete(record) {
        const layerId = `custom_${record.id}-layer`;
        const sourceId = `custom_${record.id}`;
        try {
            await deleteCustomBasemap(record.id);
        } catch (e) {
            console.warn('[BasemapSwitcherControl] delete failed:', e);
            return;
        }
        if (this._map.getLayer(layerId)) this._map.removeLayer(layerId);
        if (this._map.getSource(sourceId)) this._map.removeSource(sourceId);

        this._customBasemaps = this._customBasemaps.filter(
            (r) => r.id !== record.id,
        );

        // 選択中だった場合は OSM にフォールバック
        if (this._selectedId === layerId) {
            applySelection(this._map, DEFAULT_BASEMAP_LAYER_ID);
            this._selectedId = DEFAULT_BASEMAP_LAYER_ID;
            setSelectedBasemapId(DEFAULT_BASEMAP_LAYER_ID);
        }
        this.renderRadios();
    }
}

/**
 * 全背景レイヤーの visibility を切り替える共通処理。
 */
function applySelection(map, selectedLayerId) {
    const allIds = collectAllBasemapLayerIds(map);
    for (const id of allIds) {
        map.setLayoutProperty(
            id,
            'visibility',
            id === selectedLayerId ? 'visible' : 'none',
        );
    }
}

function collectAllBasemapLayerIds(map) {
    const style = map.getStyle();
    const ids = [];
    for (const layer of style.layers) {
        if (
            PRESET_BASEMAP_LAYER_IDS.includes(layer.id) ||
            layer.id.startsWith('custom_')
        ) {
            ids.push(layer.id);
        }
    }
    return ids;
}

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

// --- カスタム背景地図フォームの制御 ---
const dialog = document.getElementById('custom-basemap-form-dialog');
const form = document.getElementById('custom-basemap-form');
const titleEl = dialog.querySelector('[data-role="title"]');
const submitBtn = dialog.querySelector('button[data-role="submit"]');
const cancelBtn = dialog.querySelector('button[data-role="cancel"]');
const advancedEl = dialog.querySelector('details[data-role="advanced"]');
const fieldEls = {
    label: form.elements.label,
    tileUrl: form.elements.tileUrl,
    attributionText: form.elements.attributionText,
    attributionUrl: form.elements.attributionUrl,
    minzoom: form.elements.minzoom,
    maxzoom: form.elements.maxzoom,
};

function clearFormErrors() {
    for (const el of dialog.querySelectorAll('p.error')) {
        el.textContent = '';
        el.hidden = true;
    }
}

function showFormErrors(errors) {
    for (const el of dialog.querySelectorAll('p.error')) {
        const field = el.dataset.for;
        if (errors[field]) {
            el.textContent = errors[field];
            el.hidden = false;
        } else {
            el.textContent = '';
            el.hidden = true;
        }
    }
}

function resetForm() {
    form.reset();
    clearFormErrors();
    fieldEls.tileUrl.removeAttribute('readonly');
    delete dialog.dataset.mode;
    delete dialog.dataset.editingId;
    advancedEl.open = false;
}

function openForm({ mode, record }) {
    resetForm();
    dialog.dataset.mode = mode;
    if (mode === 'add') {
        titleEl.textContent = '背景地図を追加';
        submitBtn.textContent = '追加';
    } else if (mode === 'edit') {
        if (!record) return;
        titleEl.textContent = '背景地図を編集';
        submitBtn.textContent = '保存';
        dialog.dataset.editingId = record.id;
        fieldEls.label.value = record.label ?? '';
        fieldEls.tileUrl.value = record.tileUrl ?? '';
        fieldEls.tileUrl.setAttribute('readonly', '');
        fieldEls.attributionText.value = record.attributionText ?? '';
        fieldEls.attributionUrl.value = record.attributionUrl ?? '';
        fieldEls.minzoom.value =
            typeof record.minzoom === 'number' ? String(record.minzoom) : '';
        fieldEls.maxzoom.value =
            typeof record.maxzoom === 'number' ? String(record.maxzoom) : '';
        if (fieldEls.minzoom.value || fieldEls.maxzoom.value) {
            advancedEl.open = true;
        }
    }
    dialog.showModal();
}

cancelBtn.addEventListener('click', () => {
    dialog.close();
});
dialog.addEventListener('close', () => {
    resetForm();
});

// --- カスタム背景地図削除確認モーダル ---
const deleteDialog = document.getElementById('custom-basemap-delete-dialog');
const deleteMsgEl = deleteDialog.querySelector('[data-role="message"]');
const deleteConfirmBtn = deleteDialog.querySelector('button[data-role="confirm"]');
const deleteCancelBtn = deleteDialog.querySelector('button[data-role="cancel"]');

/**
 * 削除確認モーダルを画面中央に表示し、ユーザーの選択（OK / キャンセル）を返す。
 * 追加・編集フォームと同じく <dialog>.showModal() で表示する。
 */
function confirmDelete(label) {
    return new Promise((resolve) => {
        deleteMsgEl.textContent = `「${label}」を削除します。よろしいですか？`;
        const onConfirm = () => {
            cleanup();
            deleteDialog.close();
            resolve(true);
        };
        const onCancel = () => {
            cleanup();
            deleteDialog.close();
            resolve(false);
        };
        const onClose = () => {
            // Esc キーや外部 close() でも確実に解決させる
            cleanup();
            resolve(false);
        };
        function cleanup() {
            deleteConfirmBtn.removeEventListener('click', onConfirm);
            deleteCancelBtn.removeEventListener('click', onCancel);
            deleteDialog.removeEventListener('close', onClose);
        }
        deleteConfirmBtn.addEventListener('click', onConfirm);
        deleteCancelBtn.addEventListener('click', onCancel);
        deleteDialog.addEventListener('close', onClose);
        deleteDialog.showModal();
    });
}

let switcherControl; // 後段で map.on('load') 内に生成・代入

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = dialog.dataset.mode;
    const raw = {
        label: fieldEls.label.value,
        tileUrl: fieldEls.tileUrl.value,
        attributionText: fieldEls.attributionText.value,
        attributionUrl: fieldEls.attributionUrl.value,
        minzoom: fieldEls.minzoom.value,
        maxzoom: fieldEls.maxzoom.value,
    };
    const result = validateCustomBasemapInput(raw);
    if (!result.ok) {
        showFormErrors(result.errors);
        return;
    }
    clearFormErrors();

    if (mode === 'add') {
        await handleAddSubmit(result.value);
    } else if (mode === 'edit') {
        await handleEditSubmit(dialog.dataset.editingId, result.value);
    }
});

async function handleAddSubmit(value) {
    const id = crypto.randomUUID();
    const record = {
        id,
        label: value.label,
        tileUrl: value.tileUrl,
        attributionText: value.attributionText ?? '',
        attributionUrl: value.attributionUrl ?? '',
        minzoom: typeof value.minzoom === 'number' ? value.minzoom : null,
        maxzoom: typeof value.maxzoom === 'number' ? value.maxzoom : null,
        createdAt: Date.now(),
    };
    try {
        await saveCustomBasemap(record);
    } catch (e) {
        showFormErrors({
            label: '保存できませんでした（ブラウザの設定をご確認ください）。',
        });
        return;
    }
    const sourceId = `custom_${id}`;
    const layerId = `custom_${id}-layer`;
    map.addSource(sourceId, buildSourceDef(record));
    // ハザード未追加でも追加できるよう、beforeId が存在するか確認
    const beforeId = map.getLayer('hazard_flood-layer')
        ? 'hazard_flood-layer'
        : undefined;
    map.addLayer(buildLayerDef(record, true), beforeId);
    applySelection(map, layerId);
    setSelectedBasemapId(layerId);

    if (switcherControl) {
        const current = [...switcherControl._customBasemaps, record];
        switcherControl._customBasemaps = current;
        switcherControl._selectedId = layerId;
        switcherControl.renderRadios();
    }
    dialog.close();
}

async function handleEditSubmit(editingId, value) {
    if (!switcherControl) return;
    const existing = switcherControl._customBasemaps.find(
        (r) => r.id === editingId,
    );
    if (!existing) return;
    const updated = {
        ...existing,
        label: value.label,
        // tileUrl は readonly のため、入力値ではなく既存値を保持（安全策）
        tileUrl: existing.tileUrl,
        attributionText: value.attributionText ?? '',
        attributionUrl: value.attributionUrl ?? '',
        minzoom: typeof value.minzoom === 'number' ? value.minzoom : null,
        maxzoom: typeof value.maxzoom === 'number' ? value.maxzoom : null,
    };
    try {
        await saveCustomBasemap(updated);
    } catch (e) {
        showFormErrors({
            label: '保存できませんでした（ブラウザの設定をご確認ください）。',
        });
        return;
    }
    const layerId = `custom_${editingId}-layer`;
    const sourceId = `custom_${editingId}`;
    const wasSelected = switcherControl._selectedId === layerId;

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    map.addSource(sourceId, buildSourceDef(updated));
    const beforeId = map.getLayer('hazard_flood-layer')
        ? 'hazard_flood-layer'
        : undefined;
    map.addLayer(buildLayerDef(updated, wasSelected), beforeId);
    if (wasSelected) {
        applySelection(map, layerId);
    }

    switcherControl._customBasemaps = switcherControl._customBasemaps.map(
        (r) => (r.id === editingId ? updated : r),
    );
    switcherControl.renderRadios();
    dialog.close();
}

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

    // 背景地図切替コントロール（左下）
    switcherControl = new BasemapSwitcherControl({
        customBasemaps: restoredCustomBasemaps,
        selectedId: initialSelectedId,
        onOpenForm: openForm,
    });
    map.addControl(switcherControl, 'bottom-left');

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
