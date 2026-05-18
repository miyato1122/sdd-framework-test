// MapLibre GL JSの読み込み
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// OpacityControlプラグインの読み込み
// （maplibre-gl-opacity 1.8.0 は exports を "." のみに再編し CSS サブパスを廃止。
//  パッケージから CSS を import できないため、1.8.0 同梱 CSS をローカルに
//  同梱した opacity-control.css を読み込む。FR-005 の破壊的変更追従）
import OpacityControl from 'maplibre-gl-opacity';
import './opacity-control.css';
// アプリ共有スタイル（インライン禁止＝憲章 III。エラー通知等のクラスを集約）
import './style.css';

// 最寄り地物選定の純粋ロジック（@turf/distance v7 は named export のため nearest.js 側で取り込む）
import { pickNearestFeature } from './nearest.js';

// 地理院標高タイルをMapLibre GL JSで利用するためのモジュール
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain';

// 背景地図レジストリ（純粋モジュール。新規依存なし＝利用者制約・憲章 I）
import { BASEMAPS, buildBaseLayers } from './basemaps.js';

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
                // 既定背景（basemaps.js の getDefaultBasemapId='osm' と一致）。
                // 背景スイッチャー（OpacityControl baseLayers）の初期選択になる。
                layout: { visibility: 'visible' },
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

    // 現在地に最も近い地物を見つける（純粋ロジックは nearest.js に分離）
    return pickNearestFeature([longitude, latitude], features);
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
geolocationControl.on('trackuserlocationend', () => {
    // 現在地追跡がオフになったら現在位置を消去する（公開イベントで内部状態に依存しない）
    userLocation = null;
});

// タイル/データ取得失敗を無言にしないための非ブロッキング通知（FR-010・憲章 III）。
// 全画面ブロックやレイアウト破壊をせず、地図のズーム/パン操作は継続できる。
const errorToast = document.createElement('div');
errorToast.className = 'map-error-toast';
errorToast.setAttribute('role', 'status'); // 支援技術へ通知（aria-live=polite）
errorToast.setAttribute('aria-live', 'polite');
errorToast.hidden = true;
document.body.appendChild(errorToast);

let errorToastTimer = null;
const showMapErrorNotice = () => {
    errorToast.textContent =
        '地図データの取得に一部失敗しました。地図の操作はそのまま続けられます。';
    errorToast.hidden = false;
    if (errorToastTimer !== null) clearTimeout(errorToastTimer);
    // 連続するタイルエラーは1つの通知に集約し、数秒で自動的に消す
    errorToastTimer = setTimeout(() => {
        errorToast.hidden = true;
        errorToastTimer = null;
    }, 5000);
};

// タイル/ソース取得失敗を捕捉（地図は操作継続・背景選択状態は不変）
map.on('error', () => {
    showMapErrorNotice();
});

// マップの初期ロード完了時に発火するイベントを定義
map.on('load', () => {
    // 背景地図（GSI 3種）のソース/レイヤーを追加（osm は初期スタイルに既存）。
    // OpacityControl の baseLayers で排他切替するため visibility:'none' で起動し、
    // osm-layer の直後（ハザード群の手前）に挿入して背景レイヤー群を構成する。
    for (const basemap of BASEMAPS) {
        if (basemap.sourceId === 'osm') continue; // osm は初期スタイルで定義済み
        map.addSource(basemap.sourceId, basemap.source);
        map.addLayer(
            {
                id: `${basemap.id}-layer`,
                source: basemap.sourceId,
                type: 'raster',
                layout: { visibility: 'none' },
            },
            'hazard_flood-layer', // この手前に追加＝osm-layer の直後・ハザードの背面
        );
    }

    // 背景地図切替コントロール（既存 OpacityControl を転用、地図左下に配置）。
    // baseLayers は排他（ラジオ）切替＝現在選択の表示。osm-layer が既定可視のため
    // 初期選択は OSM になる（FR-001/002/003/004/008、research R1/R3）。
    const basemapSwitcher = new OpacityControl({
        baseLayers: buildBaseLayers(),
    });
    map.addControl(basemapSwitcher, 'bottom-left');

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
        // 現在地の消去は trackuserlocationend イベント（公開 API）で処理する

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
                    nearestFeature.geometry.coordinates,
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
