// 背景地図レジストリ（純粋データ＋純粋関数。地図インスタンス非依存＝ユニットテスト対象）
// 仕様: specs/002-basemap-switcher/contracts/basemaps-module.md / data-model.md / research.md R2・R4
// 新規依存なし（利用者制約・憲章 I）。MapLibre には依存しない純粋モジュール。

// 国土地理院タイル共通の出典（規約: 出典を「国土地理院」または「地理院タイル」と記載し
// 一覧ページへのリンクを付す。research.md R4）
const GSI_ATTRIBUTION =
    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル（国土地理院）</a>';

/**
 * 背景地図レジストリ。スイッチャーの選択肢かつ地図ソース/レイヤー定義の元。
 * isDefault は osm がちょうど1件（不変条件）。
 *
 * @type {ReadonlyArray<{
 *   id: string,
 *   label: string,
 *   sourceId: string,
 *   source: object,
 *   isDefault: boolean
 * }>}
 */
export const BASEMAPS = Object.freeze([
    {
        id: 'osm',
        label: 'OSM',
        sourceId: 'osm',
        source: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            maxzoom: 19,
            tileSize: 256,
            attribution:
                '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
        isDefault: true,
    },
    {
        id: 'gsi-std',
        label: '地理院地図（標準地図）',
        sourceId: 'gsi-std',
        source: {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
            minzoom: 5,
            maxzoom: 18,
            tileSize: 256,
            attribution: GSI_ATTRIBUTION,
        },
        isDefault: false,
    },
    {
        id: 'gsi-seamlessphoto',
        label: '航空写真',
        sourceId: 'gsi-seamlessphoto',
        source: {
            type: 'raster',
            tiles: [
                'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
            ],
            minzoom: 2,
            maxzoom: 18,
            tileSize: 256,
            attribution: GSI_ATTRIBUTION,
        },
        isDefault: false,
    },
    {
        id: 'gsi-blank',
        label: '白地図',
        sourceId: 'gsi-blank',
        source: {
            type: 'raster',
            tiles: [
                'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png',
            ],
            minzoom: 5,
            // 白地図は z5–14 提供（research.md R2）。z15–18 は MapLibre が
            // z14 タイルをオーバーズーム描画するため最大ズームでも破綻しない。
            maxzoom: 14,
            tileSize: 256,
            attribution: GSI_ATTRIBUTION,
        },
        isDefault: false,
    },
]);

/**
 * 既定背景地図の id を返す（= 'osm'）。
 * isDefault が一意でなければ不変条件違反として例外を投げる（番人）。
 *
 * @returns {string}
 */
export const getDefaultBasemapId = () => {
    const defaults = BASEMAPS.filter((b) => b.isDefault);
    if (defaults.length !== 1) {
        throw new Error(
            `背景地図レジストリの既定が一意ではありません（件数: ${defaults.length}）`,
        );
    }
    return defaults[0].id;
};

/**
 * OpacityControl({ baseLayers }) にそのまま渡せる
 * { `<id>-layer`: label } マップを返す。順序は BASEMAPS 準拠。
 *
 * @returns {Record<string, string>}
 */
export const buildBaseLayers = () => {
    return Object.fromEntries(
        BASEMAPS.map((b) => [`${b.id}-layer`, b.label]),
    );
};
