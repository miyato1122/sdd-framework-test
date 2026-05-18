// 背景地図レジストリ（純粋データ＋純粋関数。地図インスタンス非依存＝ユニットテスト対象）
// 仕様: specs/002-basemap-switcher/contracts/basemaps-module.md / data-model.md / research.md R2・R4
//       specs/003-custom-basemap/contracts/basemaps-module.md（ユーザー定義背景の検証/生成を後方互換に追加）
// 新規依存なし（利用者制約・憲章 I）。MapLibre/DOM/ネットワークに依存しない純粋モジュール。

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
 *   isDefault: boolean,
 *   isUserDefined: boolean
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
        isUserDefined: false,
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
        isUserDefined: false,
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
        isUserDefined: false,
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
        isUserDefined: false,
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

// --- 003: ユーザー定義背景地図（検証・生成。純粋・実ネットワーク非依存） ---

/**
 * ユーザー定義ラスタソースのシステム既定（research.md R2）。
 * 利用者は方式・ズーム範囲を入力しない（標準 XYZ 固定・minzoom 未指定＝0 相当）。
 *
 * @type {Readonly<{ tileSize: number, maxzoom: number }>}
 */
export const DEFAULT_USER_TILE_ZOOM = Object.freeze({
    tileSize: 256,
    maxzoom: 19,
});

const TILE_PLACEHOLDERS = ['{z}', '{x}', '{y}'];

/**
 * 文字列が http(s) として解釈可能な URL かを判定（純粋）。
 * @param {string} s
 * @returns {boolean}
 */
const isHttpUrl = (s) => {
    let parsed = null;
    try {
        parsed = new URL(s);
    } catch {
        return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
};

/**
 * HTML 特殊文字をエスケープする（テキストを HTML 文脈へ安全に埋め込む）。
 * 生 HTML を出典へ流さないための要（Clarifications Q5・research R7）。
 * `&` を最初に置換すること（後続置換の `&xxx;` を二重化しないため）。1回適用前提。
 *
 * @param {string} s
 * @returns {string}
 */
export const escapeHtml = (s) =>
    String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

/**
 * 出典の表示名（必須・エスケープ対象）と任意 URL から安全な出典 HTML を構築する
 * （Clarifications Q5・research R7）。生 HTML は受け付けない。
 * URL が空ならエスケープ済みテキストのみ、非空なら検証済み前提でリンク化。
 *
 * @param {string} label 出典の表示名（プレーンテキスト）
 * @param {string} url 出典リンク URL（任意。空ならリンクなし。http(s) は呼び出し前に検証）
 * @returns {string}
 */
export const buildAttributionHtml = (label, url) => {
    const text = escapeHtml(String(label ?? '').trim());
    const u = String(url ?? '').trim();
    if (u === '') return text;
    const href = escapeHtml(u); // 属性値用に "&<>' を無害化
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

/**
 * ユーザー入力を検証する（FR-008・Clarifications Q2/Q3/Q5、contracts R3/R7）。
 * 不成立は項目（label/urlTemplate/attributionLabel/attributionUrl）単位で
 * 理由を返す（無言失敗禁止）。出典リンク URL は任意。
 *
 * @param {{label:string, urlTemplate:string, attributionLabel:string, attributionUrl:string}} input
 * @param {string[]} existingLabels 既存全背景地図の表示名（組み込み＋追加済み）
 * @returns {{ ok:boolean, errors:{field:'label'|'urlTemplate'|'attributionLabel'|'attributionUrl', message:string}[] }}
 */
export const validateCustomBasemapInput = (input, existingLabels = []) => {
    const errors = [];
    const label = (input?.label ?? '').trim();
    const urlTemplate = (input?.urlTemplate ?? '').trim();
    const attributionLabel = (input?.attributionLabel ?? '').trim();
    const attributionUrl = (input?.attributionUrl ?? '').trim();

    // 表示名: 非空かつ既存（組み込み＋追加済み）と重複しない（trim 比較）
    if (label === '') {
        errors.push({ field: 'label', message: '表示名を入力してください' });
    } else if (existingLabels.some((l) => (l ?? '').trim() === label)) {
        errors.push({
            field: 'label',
            message: 'その表示名は既存の背景地図と重複しています',
        });
    }

    // タイル取得元: 非空 → URL 解釈可能 → http(s) → {z}{x}{y} を全て含む
    if (urlTemplate === '') {
        errors.push({
            field: 'urlTemplate',
            message: 'タイル取得元（URL テンプレート）を入力してください',
        });
    } else if (!isHttpUrl(urlTemplate)) {
        errors.push({
            field: 'urlTemplate',
            message:
                'URL として解釈でき、http(s) のタイル取得元を指定してください',
        });
    } else if (!TILE_PLACEHOLDERS.every((p) => urlTemplate.includes(p))) {
        errors.push({
            field: 'urlTemplate',
            message: 'タイル座標の差し込み箇所 {z}/{x}/{y} を全て含めてください',
        });
    }

    // 出典の表示名: 非空（生 HTML 可否は問わない＝後段で必ずエスケープする）
    if (attributionLabel === '') {
        errors.push({
            field: 'attributionLabel',
            message: '出典の表示名を入力してください',
        });
    }

    // 出典リンク URL: 任意。入力されている場合のみ http(s) を要求
    if (attributionUrl !== '' && !isHttpUrl(attributionUrl)) {
        errors.push({
            field: 'attributionUrl',
            message:
                '出典リンク URL は http(s) の URL を指定してください（空欄可）',
        });
    }

    return { ok: errors.length === 0, errors };
};

/**
 * 検証通過済み入力から BaseMap 形状を生成する（contracts R4/R7・research R2）。
 * 出典は buildAttributionHtml でシステム構築（生 HTML 非受理＝Q5）。
 * idSeed は呼び出し側が与える一意値（決定論: 同 input・同 idSeed → 同出力）。
 * 既存 BASEMAPS の id（osm/gsi-*）と衝突しない `user-` 接頭辞を用いる。
 *
 * @param {{label:string, urlTemplate:string, attributionLabel:string, attributionUrl:string}} input
 * @param {string|number} idSeed 既存 id と衝突しない一意のシード
 * @returns {{id:string,label:string,sourceId:string,source:object,isDefault:boolean,isUserDefined:boolean}}
 */
export const createCustomBasemap = (input, idSeed) => {
    const id = `user-${idSeed}`;
    return {
        id,
        label: input.label.trim(),
        sourceId: id,
        source: {
            type: 'raster',
            tiles: [input.urlTemplate.trim()],
            tileSize: DEFAULT_USER_TILE_ZOOM.tileSize,
            maxzoom: DEFAULT_USER_TILE_ZOOM.maxzoom,
            attribution: buildAttributionHtml(
                input.attributionLabel,
                input.attributionUrl,
            ),
        },
        isDefault: false,
        isUserDefined: true,
    };
};
