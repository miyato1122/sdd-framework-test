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
 * カスタム背景地図入力の検証エラー項目。
 * @typedef {Object} ValidationError
 * @property {string} field   違反フィールド名（label / tileUrl / attributionLabel / attributionLinkUrl / minzoom / maxzoom）
 * @property {string} message 利用者向け文言（日本語）
 *
 * @typedef {Object} NormalizedCustomBasemapInput
 * @property {string} label                  trim 済み 1〜100 文字
 * @property {string} tileUrl                trim 済み・https のみ・{z}{x}{y} 含む
 * @property {string} attributionLabel       trim 済み 1〜100 文字
 * @property {string} [attributionLinkUrl]   trim 済み（不正スキームでも入力許容、buildAttribution が fail-closed）
 * @property {number} [minzoom]              整数 0〜24
 * @property {number} [maxzoom]              整数 0〜24
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {ValidationError[]} errors
 * @property {NormalizedCustomBasemapInput} [normalized]  valid===true のときのみ
 */

/**
 * カスタム背景地図入力（フォームまたは永続化由来）を未信頼として検証する（fail-closed）。
 *
 * フォーム入力（Req 8.1〜8.4）と永続化復元時の再検証（Req 10.4）の双方が
 * 同一規則で動作する単一情報源。すべての違反項目を errors に蓄積してから
 * 返す（早期 return しない）ため、UI 側はフィールド単位で同時に提示できる。
 *
 * 検証規則:
 * - label / tileUrl / attributionLabel: 必須・trim 後 1〜100 文字
 * - tileUrl: new URL 解析可・protocol === https:・{z}/{x}/{y} 各 1 回以上
 *   （Req 4.4／8.3／8.2）
 * - attributionLinkUrl（任意）: 空または trim 後の文字列を許容。スキーム不正でも
 *   入力自体は許容し、表示時は buildAttribution が fail-closed（ラベルのみ）に
 *   する（design Validate セクション整合）
 * - minzoom / maxzoom（任意）: 整数 0〜24、両指定時は minzoom <= maxzoom
 *   （Req 8.4）
 * - tileSize は固定 256（入力対象外）
 *
 * @param {Record<string, unknown>} input  フォームまたは永続化由来の生値
 * @returns {ValidationResult}
 */
function validateCustomBasemapInput(input) {
    /** @type {ValidationError[]} */
    const errors = [];
    const safeInput = input && typeof input === 'object' ? input : {};

    const trimString = (v) => (typeof v === 'string' ? v.trim() : '');
    const label = trimString(safeInput.label);
    const tileUrl = trimString(safeInput.tileUrl);
    const attributionLabel = trimString(safeInput.attributionLabel);

    if (label.length === 0) {
        errors.push({ field: 'label', message: '表示名は必須です' });
    } else if (label.length > 100) {
        errors.push({ field: 'label', message: '表示名は 100 文字以内で入力してください' });
    }

    if (tileUrl.length === 0) {
        errors.push({ field: 'tileUrl', message: 'タイル URL テンプレートは必須です' });
    } else {
        let parsedTile = null;
        try {
            parsedTile = new URL(tileUrl);
        } catch {
            errors.push({ field: 'tileUrl', message: 'タイル URL テンプレートが有効な URL ではありません' });
        }
        if (parsedTile) {
            if (parsedTile.protocol !== 'https:') {
                errors.push({ field: 'tileUrl', message: 'タイル URL テンプレートは https:// で始まる必要があります' });
            }
            const hasZ = tileUrl.indexOf('{z}') >= 0;
            const hasX = tileUrl.indexOf('{x}') >= 0;
            const hasY = tileUrl.indexOf('{y}') >= 0;
            if (!hasZ || !hasX || !hasY) {
                errors.push({ field: 'tileUrl', message: 'タイル URL テンプレートに {z}/{x}/{y} のプレースホルダをすべて含めてください' });
            }
        }
    }

    if (attributionLabel.length === 0) {
        errors.push({ field: 'attributionLabel', message: '出典テキストは必須です' });
    } else if (attributionLabel.length > 100) {
        errors.push({ field: 'attributionLabel', message: '出典テキストは 100 文字以内で入力してください' });
    }

    // 任意: 出典リンク URL — スキーム不正でも入力は許容（buildAttribution が fail-closed）
    const attributionLinkUrlRaw = trimString(safeInput.attributionLinkUrl);
    const attributionLinkUrl = attributionLinkUrlRaw.length > 0 ? attributionLinkUrlRaw : undefined;

    // 任意: ズーム（整数・0〜24・両指定時は min <= max）
    const parseZoom = (raw, fieldName) => {
        if (raw === undefined || raw === null || raw === '') return undefined;
        const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
        if (!Number.isFinite(num) || !Number.isInteger(num)) {
            errors.push({ field: fieldName, message: 'ズームは整数で入力してください' });
            return null;
        }
        if (num < 0 || num > 24) {
            errors.push({ field: fieldName, message: 'ズームは 0〜24 の範囲で入力してください' });
            return null;
        }
        return num;
    };
    const minzoom = parseZoom(safeInput.minzoom, 'minzoom');
    const maxzoom = parseZoom(safeInput.maxzoom, 'maxzoom');
    if (
        typeof minzoom === 'number' &&
        typeof maxzoom === 'number' &&
        minzoom > maxzoom
    ) {
        errors.push({ field: 'maxzoom', message: '最大ズームは最小ズーム以上である必要があります' });
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    /** @type {NormalizedCustomBasemapInput} */
    const normalized = { label, tileUrl, attributionLabel };
    if (attributionLinkUrl !== undefined) normalized.attributionLinkUrl = attributionLinkUrl;
    if (typeof minzoom === 'number') normalized.minzoom = minzoom;
    if (typeof maxzoom === 'number') normalized.maxzoom = maxzoom;

    return { valid: true, errors: [], normalized };
}

/**
 * 永続化可能なカスタム背景地図定義（フォーム入力相当の保存形）。
 * source.attribution の組み立て結果は保存せず、毎起動時に buildAttribution で再構築する
 * （安全構築規則の一元化、Req 4.2／10.4 整合）。
 * @typedef {Object} BasemapDefPersistable
 * @property {string} id                     custom_ 接頭辞付き UUID
 * @property {string} label
 * @property {string} tileUrl
 * @property {string} attributionLabel
 * @property {string} [attributionLinkUrl]
 * @property {number} [minzoom]
 * @property {number} [maxzoom]
 */

/** localStorage キー（version 接頭辞付き、スキーマ進化時に上げる）。 */
const STORAGE_KEY_CUSTOMS = 'basemap-switcher:v1:customs';

/**
 * 永続化されたカスタム背景地図定義を読み込む（fail-closed）。
 *
 * localStorage 利用不可（typeof undefined・SecurityError）／読込時例外／
 * JSON 解析失敗／version 不一致／items が配列でない、のいずれでも空配列
 * を返し例外を呼び出し元に漏らさない（Req 10.5）。外部送信は行わない
 * （Req 10.3）。返り値の各 item は信頼できない値として扱うべきで、利用前
 * に validateCustomBasemapInput で再検証する必要がある（Req 10.4）。
 *
 * @returns {BasemapDefPersistable[]}  失敗時は []
 */
function loadCustomBasemaps() {
    try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(STORAGE_KEY_CUSTOMS);
        if (raw === null) return [];
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return [];
        if (parsed.version !== 1) return [];
        if (!Array.isArray(parsed.items)) return [];
        return parsed.items;
    } catch {
        return [];
    }
}

/**
 * カスタム背景地図定義を永続化する（fail-closed）。
 *
 * QuotaExceededError／SecurityError／serialize 失敗のいずれでも false を
 * 返し例外を呼び出し元に漏らさない（Req 10.5）。外部送信は行わない
 * （Req 10.3）。version: 1 包絡で書き込む（10.4 復元時の version 一致前提）。
 *
 * @param {BasemapDefPersistable[]} items
 * @returns {boolean}  保存成功
 */
function saveCustomBasemaps(items) {
    try {
        if (typeof localStorage === 'undefined') return false;
        const payload = JSON.stringify({ version: 1, items });
        localStorage.setItem(STORAGE_KEY_CUSTOMS, payload);
        return true;
    } catch {
        return false;
    }
}

/** localStorage キー（選択中背景地図 id、version 接頭辞付き）。 */
const STORAGE_KEY_SELECTED_ID = 'basemap-switcher:v1:selectedId';

/**
 * 永続化された「最後に選択した背景地図 id」を読み込む（fail-closed）。
 *
 * localStorage 利用不可・読込例外・JSON 解析失敗・version 不一致・id が文字列でない
 * のいずれでも null を返し例外を呼び出し元に漏らさない（Req 10.5）。
 * 外部送信は行わない（Req 10.3）。返り値は信頼せず利用前に getBasemapById で
 * 解決可能性を確認する設計（Req 10.4／10.8）。
 *
 * @returns {string | null}  失敗時は null
 */
function loadSelectedBasemapId() {
    try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(STORAGE_KEY_SELECTED_ID);
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.version !== 1) return null;
        if (typeof parsed.id !== 'string') return null;
        return parsed.id;
    } catch {
        return null;
    }
}

/**
 * 選択中背景地図 id を永続化する（fail-closed）。
 *
 * QuotaExceededError／SecurityError／serialize 失敗のいずれでも false を返し
 * 例外を呼び出し元に漏らさない（Req 10.5）。外部送信は行わない（Req 10.3）。
 *
 * @param {string} id
 * @returns {boolean}  保存成功
 */
function saveSelectedBasemapId(id) {
    try {
        if (typeof localStorage === 'undefined') return false;
        const payload = JSON.stringify({ version: 1, id });
        localStorage.setItem(STORAGE_KEY_SELECTED_ID, payload);
        return true;
    } catch {
        return false;
    }
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
const BUILTIN_BASEMAPS = Object.freeze([
    Object.freeze({
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
    }),
    Object.freeze({
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
    }),
    Object.freeze({
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
    }),
    Object.freeze({
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
    }),
]);

/**
 * 利用者が追加したカスタム背景地図のレジストリ（実行時可変）。
 * 起動時は空配列で、Phase 2 の restoreOnLoad（task 13.1）で永続化値から復元される。
 * 末尾追加・編集（id 保持の差し替え）・削除（id 一致除去）の対象。
 *
 * @type {BasemapDef[]}
 */
let customBasemaps = [];

/**
 * customBasemaps の各エントリに対応する永続化可能形（BasemapDefPersistable）を
 * 同順序で保持する並行ストア。Registry 変更（add／update／remove／restore）と
 * 同期して更新され、saveCustomBasemaps への入力として使用する。
 *
 * Why parallel: BasemapDef.attribution は buildAttribution の戻り値（HTML 文字列）
 * で原入力（attributionLabel／attributionLinkUrl）が消えているため、永続化フィールド
 * を逆算できない。design.md の規約「source.attribution は保存せず毎起動時に再構築」
 * を満たすために原入力を別途保持する（task 9.1 で導入、task 11.x 編集／削除時にも同期）。
 *
 * @type {BasemapDefPersistable[]}
 */
let customBasemapsPersistable = [];

/**
 * 組込み（不変）と利用者追加（可変）のレジストリを結合して返す。
 *
 * 順序は「組込みが先（BUILTIN_BASEMAPS の順）、利用者追加が後（追加順）」。
 * 返り値は呼び出しごとに新しい配列で、呼び出し側で長期保持しないこと
 * （Registry 変動後に再取得する設計、design Registry セクション）。
 *
 * @returns {ReadonlyArray<BasemapDef>}
 */
function getAllBasemaps() {
    return [...BUILTIN_BASEMAPS, ...customBasemaps];
}

/**
 * 指定 id に該当する背景地図エントリを組込み／利用者双方から検索する。
 *
 * @param {string} id  背景地図 id（'osm'/'gsi_*' または 'custom_<UUID>'）
 * @returns {BasemapDef | undefined}  該当なしは undefined
 */
function getBasemapById(id) {
    return getAllBasemaps().find((b) => b.id === id);
}

/**
 * カスタム背景地図を新規追加する（id を内部生成して採用）。
 *
 * crypto.randomUUID で UUID を生成し 'custom_' 接頭辞を付与して BUILTIN id
 * 空間と分離する。source は raster spec に組み立て、attribution は
 * buildAttribution 経由で安全構築する（利用者入力を DOM API 経由で
 * エスケープ・Req 4.2／4.5 整合）。customBasemaps の末尾に追加する
 * （新規追加は表示順末尾、Req 7.4）。
 *
 * 起動時の復元（保存済み id を採用）は addRestoredCustomBasemap
 * （task 11.1 で追加）の責務であり、本関数は新規追加専用。
 *
 * @param {NormalizedCustomBasemapInput} def  validate 通過済み正規化値（id 含まない）
 * @returns {BasemapDef}  生成された custom_<UUID> 付きエントリ
 */
function addCustomBasemap(def) {
    const id = 'custom_' + crypto.randomUUID();
    const source = {
        type: 'raster',
        tiles: [def.tileUrl],
        tileSize: 256,
    };
    if (typeof def.minzoom === 'number') source.minzoom = def.minzoom;
    if (typeof def.maxzoom === 'number') source.maxzoom = def.maxzoom;
    const attribution = buildAttribution({
        label: def.attributionLabel,
        url: def.attributionLinkUrl,
    });
    /** @type {BasemapDef} */
    const entry = { id, label: def.label, source, attribution };
    customBasemaps.push(entry);
    // 並行ストアにも永続化形を保持する（task 9.1 結線：saveCustomBasemaps への入力）
    /** @type {BasemapDefPersistable} */
    const persistable = {
        id,
        label: def.label,
        tileUrl: def.tileUrl,
        attributionLabel: def.attributionLabel,
    };
    if (def.attributionLinkUrl !== undefined) persistable.attributionLinkUrl = def.attributionLinkUrl;
    if (typeof def.minzoom === 'number') persistable.minzoom = def.minzoom;
    if (typeof def.maxzoom === 'number') persistable.maxzoom = def.maxzoom;
    customBasemapsPersistable.push(persistable);
    return entry;
}

/**
 * 起動時復元専用: Persistence 由来の {id, ...normalized} を受け取り、
 * 保存済み id をそのまま採用してレジストリ末尾に追加する（新 UUID を振らない）。
 *
 * id 安定性は選択復元（Req 10.7）の前提のため、addCustomBasemap（新規追加・新 UUID 生成）
 * とは契約を分離する（design レビュー C1 対応）。id が `/^custom_[0-9a-f-]{36}$/` に
 * 適合しない、もしくは item が不正なら防御的に undefined を返す。
 *
 * customBasemaps と customBasemapsPersistable の両ストアを同順序で更新する。
 *
 * @param {BasemapDefPersistable} item Persistence.loadCustomBasemaps 由来＋
 *   validateCustomBasemapInput 通過済み正規化値に id を保持したもの
 * @returns {BasemapDef | undefined}
 */
function addRestoredCustomBasemap(item) {
    if (!item || typeof item.id !== 'string') return undefined;
    if (!/^custom_[0-9a-f-]{36}$/.test(item.id)) return undefined;
    const source = {
        type: 'raster',
        tiles: [item.tileUrl],
        tileSize: 256,
    };
    if (typeof item.minzoom === 'number') source.minzoom = item.minzoom;
    if (typeof item.maxzoom === 'number') source.maxzoom = item.maxzoom;
    const attribution = buildAttribution({
        label: item.attributionLabel,
        url: item.attributionLinkUrl,
    });
    /** @type {BasemapDef} */
    const entry = { id: item.id, label: item.label, source, attribution };
    customBasemaps.push(entry);
    /** @type {BasemapDefPersistable} */
    const persistable = {
        id: item.id,
        label: item.label,
        tileUrl: item.tileUrl,
        attributionLabel: item.attributionLabel,
    };
    if (item.attributionLinkUrl !== undefined) persistable.attributionLinkUrl = item.attributionLinkUrl;
    if (typeof item.minzoom === 'number') persistable.minzoom = item.minzoom;
    if (typeof item.maxzoom === 'number') persistable.maxzoom = item.maxzoom;
    customBasemapsPersistable.push(persistable);
    return entry;
}

/**
 * カスタム背景地図エントリを編集する（id 保持で差し替え、順序維持）。
 *
 * 組込み id（'custom_' 接頭辞なし）は no-op で undefined を返す。
 * customBasemaps と customBasemapsPersistable の両ストアを同 index で差し替える。
 * attribution は新しい def の attributionLabel/Link から buildAttribution で再構築。
 *
 * @param {string} id custom_ 接頭辞付き id
 * @param {NormalizedCustomBasemapInput} def validate 通過済み正規化値
 * @returns {BasemapDef | undefined} 対象なしは undefined
 */
function updateCustomBasemap(id, def) {
    if (typeof id !== 'string' || !id.startsWith('custom_')) return undefined;
    const idx = customBasemaps.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    const source = {
        type: 'raster',
        tiles: [def.tileUrl],
        tileSize: 256,
    };
    if (typeof def.minzoom === 'number') source.minzoom = def.minzoom;
    if (typeof def.maxzoom === 'number') source.maxzoom = def.maxzoom;
    const attribution = buildAttribution({
        label: def.attributionLabel,
        url: def.attributionLinkUrl,
    });
    /** @type {BasemapDef} */
    const newEntry = { id, label: def.label, source, attribution };
    customBasemaps[idx] = newEntry;
    /** @type {BasemapDefPersistable} */
    const persistable = {
        id,
        label: def.label,
        tileUrl: def.tileUrl,
        attributionLabel: def.attributionLabel,
    };
    if (def.attributionLinkUrl !== undefined) persistable.attributionLinkUrl = def.attributionLinkUrl;
    if (typeof def.minzoom === 'number') persistable.minzoom = def.minzoom;
    if (typeof def.maxzoom === 'number') persistable.maxzoom = def.maxzoom;
    customBasemapsPersistable[idx] = persistable;
    return newEntry;
}

/**
 * カスタム背景地図エントリを削除する。
 *
 * 組込み id は no-op で false を返す。両ストアから同 index で除去。
 *
 * @param {string} id custom_ 接頭辞付き id
 * @returns {boolean} 除去できたか（id 不在・組込み id は false）
 */
function removeCustomBasemap(id) {
    if (typeof id !== 'string' || !id.startsWith('custom_')) return false;
    const idx = customBasemaps.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    customBasemaps.splice(idx, 1);
    customBasemapsPersistable.splice(idx, 1);
    return true;
}

/**
 * 指定 id のカスタム背景地図の永続化形（BasemapDefPersistable）を返す。
 * 編集 UI の pre-fill 用（BasemapDef.attribution は HTML 文字列で原入力を逆算
 * 不能なため、永続化ストアから取得する必要がある）。組込み id は undefined。
 *
 * @param {string} id custom_ 接頭辞付き id
 * @returns {BasemapDefPersistable | undefined}
 */
function getCustomBasemapPersistable(id) {
    if (typeof id !== 'string' || !id.startsWith('custom_')) return undefined;
    return customBasemapsPersistable.find((p) => p.id === id);
}

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
 * 選択された id を全レジストリ（getBasemapById = 組込み＋利用者カスタム）から
 * 引き、現アクティブ背景の layer→source を remove してから選択 source を
 * addSource し、`hazard_flood-layer` を beforeId に addLayer して常に重畳
 * より下（最下）へ挿入する（Req 1.3/1.4/5.4/7.5）。source id は背景 id（例
 * `osm`/`gsi_std`/`custom_<UUID>`）、layer id は `<id>-layer` で既存初期
 * スタイルの命名と一貫させる。
 *
 * 同一 id の再選択、および全レジストリに存在しない id は no-op として
 * 何も変更せず返る（不要な再生成・防御的無効 id 回避）。
 *
 * 選択 source の `attribution` は BUILTIN_BASEMAPS／Registry で
 * buildAttribution 経由に構築済みで、未使用となった旧背景 source を除去
 * することで MapLibre 既定 AttributionControl が当該背景＋重畳のみへ
 * 自動更新される（Req 3.3／3.5）。重畳（hazard_ 各種・skhb・route・
 * hillshade）・既存コントロールには一切触れない（Req 3.4/5.1/5.2）。
 * タイル取得失敗は MapLibre がタイル単位で許容し致命化しないため、本関数
 * に追加のエラーハンドリングを設けない（Req 2.5／8.5。設計上の非致命を維持）。
 *
 * opts.persist（既定 true）は本タスク（7.3）では signature のみ受理し、
 * 実際の saveSelectedBasemapId 呼出は Phase 2 task 11.3 で結線する。
 * restoreOnLoad（task 13.1）からは {persist: false} を渡して再保存ループを
 * 避ける契約（Req 10.6 関連）。
 *
 * @param {string} id 選択された背景地図 id（組込み or 'custom_<UUID>'）
 * @param {{persist?: boolean}} [opts] 既定 {persist: true}（11.3 で結線）
 * @returns {void}
 */
function setBasemap(id, opts) {
    // 防御的: 全レジストリに無い id は no-op（既存背景を維持）
    const entry = getBasemapById(id);
    if (!entry) return;
    // 同一 id の再選択は no-op（不要な source/layer 再生成を回避）
    if (id === currentBasemapId) return;
    // opts.persist は既定 true。明示的に false（restoreOnLoad 経由）でなければ
    // saveSelectedBasemapId を呼んで利用者選択を永続化する（Req 10.6）。
    // 保存失敗は無視（地図表示・既存機能をクラッシュさせない、fail-closed）。
    const shouldPersist = !(opts && opts.persist === false);

    // 旧アクティブ背景の layer→source を remove（過渡的に背景 0 個）。
    // source/layer 命名は初期スタイル（source `osm` / layer `osm-layer`）
    // と一貫させる: source id = 背景 id、layer id = `<id>-layer`。
    const prevLayerId = `${currentBasemapId}-layer`;
    const prevSourceId = currentBasemapId;
    map.removeLayer(prevLayerId);
    map.removeSource(prevSourceId);

    // 選択 source を add。BUILTIN_BASEMAPS／Registry は attribution を source の外に持つため
    // ここで source へマージして渡す（未マージだと切替後に出典が消える）。
    // 既定 AttributionControl は使用中 source の attribution を集約するため
    // これで背景に追従して出典が表示される（Req 3.1/3.2/3.3/3.5）。
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

    // 選択を永続化（restoreOnLoad 経由は shouldPersist=false で再保存ループ回避）
    if (shouldPersist) {
        saveSelectedBasemapId(id);
    }
}

/**
 * 起動時にカスタム背景地図定義と最後に選択した背景 id を localStorage から復元する。
 *
 * 手順:
 * 1. loadCustomBasemaps() の各 item を validateCustomBasemapInput で再検証（Req 10.4）。
 *    通過分のみ addRestoredCustomBasemap({id: item.id, ...normalized}) で
 *    customBasemaps / customBasemapsPersistable へ反映。**保存済み id を保持**
 *    （新 UUID を振らない — 設計レビュー C1 対応／後続の選択復元で getBasemapById
 *    が同じ id で解決できることが前提）。検証落ち item はスキップ。
 * 2. loadSelectedBasemapId() を getBasemapById で解決。undefined ／ 'osm' のときは
 *    初期 osm のまま（何もしない）。それ以外で組込み or 復元成功カスタム id に
 *    該当するときは setBasemap(id, {persist: false}) — 再保存ループを避ける。
 *
 * いずれの失敗（読込失敗・検証失敗・id 不在）も致命化しない（OSM フォールバック、
 * Req 1.6／10.8）。本関数は map.on('load') 内で addControl(Switcher) **より前**に
 * 呼ばれ、Switcher の初回 renderList が復元後の状態を反映できるようにする
 * （map.on('load') の登録順整理は task 13.2）。
 *
 * @returns {void}
 */
function restoreOnLoad() {
    // 1. 定義の復元（保存済み id を保持）
    const items = loadCustomBasemaps();
    for (const item of items) {
        const result = validateCustomBasemapInput(item);
        if (!result.valid) continue;
        addRestoredCustomBasemap({ id: item.id, ...result.normalized });
    }
    // 2. 選択の復元（解決できないときは初期 osm のまま）
    const selectedId = loadSelectedBasemapId();
    if (!selectedId || selectedId === 'osm') return;
    const entry = getBasemapById(selectedId);
    if (!entry) return;
    setBasemap(selectedId, { persist: false });
}

/**
 * 背景地図切替コントロール（MapLibre IControl）。
 *
 * 地図左下に配置する背景地図の排他選択 UI。BUILTIN_BASEMAPS の各エントリを
 * ネイティブ `<input type="radio">` ＋ `<label for>` として `<fieldset>`／
 * `<legend>` 内に生成し、選択を setBasemap へ結線する（Req 1.1/1.2/1.5/
 * 6.1/6.2/6.3）。
 *
 * DOM は document.createElement / textContent のみで構築し、innerHTML 経路に
 * データを流さない（security.md。ラベルは BUILTIN_BASEMAPS の開発者定数だが安全な
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
         * fieldset 参照（renderList が動的部分のみクリア／再構築するために使用）。
         * @type {HTMLFieldSetElement|null}
         */
        this._fieldset = null;
        /**
         * change リスナ参照（onRemove で確実に解放しリークを防ぐ）。
         * @type {((e: Event) => void)|null}
         */
        this._onChange = null;
        /**
         * click リスナ参照（追加ボタン／編集ボタンのデリゲーション用、onRemove で解放）。
         * @type {((e: Event) => void)|null}
         */
        this._onClick = null;
        /**
         * カスタム背景地図入力フォーム（追加／編集／削除）への参照。
         * task 8.3 で BasemapFormDialog が定義され、9.1 の結線時に setFormDialog で注入する。
         * 未注入の場合、追加／編集ボタンの click は no-op（防御的）。
         * @type {{open: (opts: {mode: 'create'|'edit', entry?: object}) => void} | null}
         */
        this._formDialog = null;
    }

    /**
     * カスタム背景地図入力フォーム（BasemapFormDialog）の参照を注入する。
     * map.addControl(...) 後に呼び出し、追加ボタン／編集ボタンの click を結線する。
     *
     * @param {{open: (opts: {mode: 'create'|'edit', entry?: object}) => void}} dialog
     * @returns {void}
     */
    setFormDialog(dialog) {
        this._formDialog = dialog;
    }

    /**
     * コントロールの DOM を生成して返す（MapLibre IControl）。
     *
     * 静的構造（コンテナ＋fieldset＋legend＋change リスナ）を一度だけ構築し、
     * 動的部分（各エントリの radio + label 行、Phase 2 で末尾 add ボタンや
     * 利用者エントリの edit ボタン）の生成は renderList() に委譲する。
     * 初回 onAdd 時に renderList() を呼んで現在のレジストリ状態を反映する。
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

        // change ハンドラはグループ内のどの radio でも単一でデリゲーション受信。
        // 設計レビュー C2 対応: setBasemap を呼ぶだけで renderList() は呼ばない
        // （ネイティブ radio の name="basemap" グループによる相互排他で checked
        // は自動同期される。renderList を呼ぶと矢印キー移動中のフォーカスが
        // 消失するため、レジストリ変動時のみに renderList を限定する）
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
            // 選択された背景 id を setBasemap へ結線（単一性は setBasemap が担保）。
            // ネイティブ radio の相互排他で当該 input の checked は自動的に true、
            // 他は false になる — JS から明示的に checked を設定する必要はない。
            setBasemap(target.value);
        };
        fieldset.addEventListener('change', this._onChange);

        // click デリゲーション: 末尾「追加」ボタン → formDialog.open({mode:'create'})、
        // 利用者エントリの「編集」ボタン → formDialog.open({mode:'edit', entry}) を分岐。
        // formDialog 未注入時は no-op（防御的）。
        this._onClick = (e) => {
            const target = e.target;
            if (!target || target.tagName !== 'BUTTON') return;
            const parent = target.parentElement;
            // 末尾「＋ 背景地図を追加」（Req 7.1／7.2）
            if (parent && parent.classList && parent.classList.contains('basemap-add-row')) {
                if (this._formDialog) this._formDialog.open({ mode: 'create' });
                return;
            }
            // 利用者エントリの「編集」ボタン（Req 9.1）。data-id で永続化形（persistable）を
            // 解決して FormDialog へ渡す。BasemapDef.attribution は HTML 文字列で原入力
            // （attributionLabel/Link）が逆算不能なため、pre-fill には persistable が必須。
            if (target.classList && target.classList.contains('basemap-edit-button')) {
                const targetId = target.getAttribute('data-id');
                if (this._formDialog && targetId) {
                    const entry = getCustomBasemapPersistable(targetId);
                    if (entry) this._formDialog.open({ mode: 'edit', entry });
                }
            }
        };
        fieldset.addEventListener('click', this._onClick);

        container.appendChild(fieldset);
        this._container = container;
        this._fieldset = fieldset;

        // 動的部分（各エントリ＋末尾追加ボタン行）の初回構築
        this.renderList();
        return container;
    }

    /**
     * fieldset 内の動的部分（各 .basemap-option 行および Phase 2 で追加される
     * .basemap-add-row／.basemap-edit-button）を一度クリアし、現在の
     * getAllBasemaps() に基づいて radio + label を再構築する。
     *
     * 呼び出し条件: レジストリ変動時のみ（add／edit／delete／restoreOnLoad
     * 完了後／削除に伴う選択フォールバック後）。利用者の `change` 操作経路では
     * 呼ばない — 上記 onAdd の change ハンドラ参照（C2 対応の局所更新方針）。
     *
     * これにより Req 6.1（キーボード操作）・6.3（選択状態の支援技術提示）の
     * 連続操作中のフォーカス保持を保証する。
     *
     * @returns {void}
     */
    renderList() {
        if (!this._fieldset) return;
        // legend のみ残し、それ以外の子（既存の .basemap-option 行など動的部分）を除去
        const legend = this._fieldset.querySelector('legend');
        while (this._fieldset.lastChild && this._fieldset.lastChild !== legend) {
            this._fieldset.removeChild(this._fieldset.lastChild);
        }

        // getAllBasemaps() の各エントリを radio ＋ label として安全な DOM API で構築。
        // 順序は組込みが先、利用者追加が後（getAllBasemaps の契約）。
        // Phase 2 で 12.1 が利用者エントリへの編集ボタン併置を、8.2 が末尾の
        // 追加ボタン行を追加するが、本タスク 8.1 は radio + label の再構築のみ。
        getAllBasemaps().forEach((entry) => {
            const inputId = `basemap-option-${entry.id}`;

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'basemap';
            input.id = inputId;
            input.value = entry.id;
            // currentBasemapId に一致する radio を checked にして現在選択を明示
            // （Req 1.5/1.6/6.3）。再描画時も current を読み直すため、復元や
            // フォールバック後の状態が正しく反映される。
            if (entry.id === currentBasemapId) {
                input.checked = true;
            }

            // label[for] で radio と関連付け、支援技術が読み上げ可能な
            // 識別ラベルを付与（Req 1.2/6.2）。テキストは textContent で構築し
            // innerHTML 経路にデータを渡さない（security.md／利用者入力ラベルでも同様に安全）
            const label = document.createElement('label');
            label.htmlFor = inputId;
            label.textContent = entry.label;

            // radio とラベルを 1 行に収める行コンテナ
            // （CSS .basemap-option で横並び・行内整列）
            const row = document.createElement('div');
            row.className = 'basemap-option';
            row.appendChild(input);
            row.appendChild(label);

            // 利用者エントリのみ「編集」ボタンを併置する（Req 9.1／9.2）。
            // 組込み 4 種（'osm'/'gsi_*'）には編集ボタンを描画しない。
            // click は onAdd の delegation handler が data-id 経由で entry を解決し
            // formDialog.open({mode:'edit', entry}) を呼ぶ。
            if (typeof entry.id === 'string' && entry.id.startsWith('custom_')) {
                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.className = 'basemap-edit-button';
                editButton.setAttribute('data-id', entry.id);
                editButton.setAttribute('aria-label', entry.label + 'を編集');
                editButton.textContent = '編集';
                row.appendChild(editButton);
            }

            this._fieldset.appendChild(row);
        });

        // 末尾の「＋ 背景地図を追加」ボタン行（Req 7.1）。
        // click は onAdd で登録済みのデリゲーションハンドラが捕捉して
        // formDialog.open({mode:'create'}) を呼ぶ（FormDialog は task 8.3、結線は 9.1）。
        const addRow = document.createElement('div');
        addRow.className = 'basemap-add-row';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.textContent = '＋ 背景地図を追加';
        addRow.appendChild(addButton);
        this._fieldset.appendChild(addRow);
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
            // change/click リスナを確実に解放（fieldset 上に登録済み）
            if (this._fieldset) {
                if (this._onChange) this._fieldset.removeEventListener('change', this._onChange);
                if (this._onClick) this._fieldset.removeEventListener('click', this._onClick);
            }
            // DOM を親から切り離す
            if (this._container.parentNode) {
                this._container.parentNode.removeChild(this._container);
            }
        }
        // FormDialog の DOM とリスナも併せて解放（lifecycle owner として）
        if (this._formDialog && typeof this._formDialog.unmount === 'function') {
            this._formDialog.unmount();
        }
        this._container = null;
        this._fieldset = null;
        this._onChange = null;
        this._onClick = null;
        this._formDialog = null;
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

/**
 * カスタム背景地図の追加／編集／削除のためのモーダル入力フォーム。
 *
 * ネイティブ HTML <dialog> を 1 個 document.body 直下に lazy-mount し、
 * showModal で開く。focus trap・ESC キャンセル・モーダル背景はブラウザ標準
 * に委ねる（Req 6.5）。Phase 1 task 8.3 は骨格と open／close 副作用なし、
 * submit 経路の Validate→Registry→Persistence→Switcher.renderList 結線は
 * Phase 1 task 9.1。Edit モード結線は Phase 2 task 12.2、削除は 12.3。
 *
 * cancel／ESC／backdrop はフォーム値を破棄し dialog.close()、レジストリ・
 * 永続化に副作用なし（Req 7.6）。
 */
class BasemapFormDialog {
    constructor() {
        this._dialog = null;
        this._form = null;
        this._titleEl = null;
        this._submitEl = null;
        this._cancelEl = null;
        this._fieldEls = {};
        this._mode = null;
        this._editingId = null;
        this._onSubmit = null;
        this._onCancelBtn = null;
        this._onDialogCancel = null;
        this._onBackdropClick = null;
        /**
         * submit ハンドラ（9.1 で結線）。値検証→add→persist→renderList→close を担う。
         * @type {((values: Record<string, string>, mode: 'create'|'edit', editingId: string|null) => void) | null}
         */
        this._submitHandler = null;
        /**
         * 削除ハンドラ（12.3 で結線）。confirm 後に呼ばれ、registry remove→persist→
         * setBasemap fallback→renderList→close-or-warn の choreography を担う。
         * @type {((id: string) => void) | null}
         */
        this._deleteHandler = null;
        this._deleteEl = null;
        this._onDelete = null;
        /**
         * submit 進行中フラグ。重複送信（高速連打）の防御として使う（task 12.4・Req 6.5）。
         * @type {boolean}
         */
        this._submitting = false;
    }

    /**
     * dialog DOM を document.body 直下に 1 個 lazy-mount する。
     * 既存のフォーム構造（label/tileUrl/attributionLabel/attributionLinkUrl/
     * minzoom/maxzoom）と aria-live エラー領域、保存/取消ボタンを構築する。
     * @returns {void}
     */
    mount() {
        if (this._dialog) return;
        const dialog = document.createElement('dialog');
        dialog.className = 'basemap-form-dialog';

        const form = document.createElement('form');
        form.method = 'dialog';

        const title = document.createElement('h2');
        title.textContent = 'カスタム背景地図を追加';
        form.appendChild(title);

        // フィールド定義（順序＝表示順）
        const fields = [
            { name: 'label', labelText: '表示名', required: true, type: 'text' },
            { name: 'tileUrl', labelText: 'タイル URL テンプレート', required: true, type: 'text', placeholder: 'https://example.com/{z}/{x}/{y}.png' },
            { name: 'attributionLabel', labelText: '出典テキスト', required: true, type: 'text' },
            { name: 'attributionLinkUrl', labelText: '出典リンク URL（任意）', required: false, type: 'text' },
            { name: 'minzoom', labelText: '最小ズーム（任意・0〜24）', required: false, type: 'number' },
            { name: 'maxzoom', labelText: '最大ズーム（任意・0〜24）', required: false, type: 'number' },
        ];

        for (const f of fields) {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'basemap-form-field';

            const labelEl = document.createElement('label');
            labelEl.htmlFor = 'bmf-' + f.name;
            // 必須印 '*' はテキストで併記（Req 6.5 の可視ラベル）
            labelEl.textContent = f.labelText + (f.required ? ' *' : '');

            const inputEl = document.createElement('input');
            inputEl.type = f.type;
            inputEl.id = 'bmf-' + f.name;
            inputEl.name = f.name;
            if (f.required) inputEl.required = true;
            if (f.placeholder) inputEl.placeholder = f.placeholder;

            const errorEl = document.createElement('div');
            errorEl.className = 'basemap-form-error';
            errorEl.setAttribute('aria-live', 'polite');
            errorEl.setAttribute('data-for', f.name);

            fieldDiv.appendChild(labelEl);
            fieldDiv.appendChild(inputEl);
            fieldDiv.appendChild(errorEl);
            form.appendChild(fieldDiv);

            this._fieldEls[f.name] = { inputEl, errorEl };
        }

        // 一般エラー領域（永続化失敗時の警告などフィールド非依存メッセージ用、9.1／12.3）
        const generalError = document.createElement('div');
        generalError.className = 'basemap-form-general-error';
        generalError.setAttribute('aria-live', 'polite');
        form.appendChild(generalError);
        this._generalErrorEl = generalError;

        const actions = document.createElement('div');
        actions.className = 'basemap-form-actions';
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.textContent = '保存';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = '取消';
        // 削除ボタン: edit モード時のみ表示（mount 時点では非表示、open で切替）
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'basemap-form-delete';
        deleteBtn.textContent = '削除';
        deleteBtn.style.display = 'none';
        actions.appendChild(submitBtn);
        actions.appendChild(cancelBtn);
        actions.appendChild(deleteBtn);
        form.appendChild(actions);

        dialog.appendChild(form);
        document.body.appendChild(dialog);

        this._dialog = dialog;
        this._form = form;
        this._titleEl = title;
        this._submitEl = submitBtn;
        this._cancelEl = cancelBtn;
        this._deleteEl = deleteBtn;

        // submit: form method=dialog は submit で dialog.close() を自動実行するが、
        // Phase 1 9.1 で値検証→add→persist の途中で close するか継続するかを制御するため
        // preventDefault してアプリ側の _submitHandler に委ねる。未注入時は no-op。
        this._onSubmit = (e) => {
            e.preventDefault();
            // 重複送信防止: handler 実行中の再 submit を無視（task 12.4・Req 6.5）。
            // handler が完了後（同期完了 or close 経由）にフラグを下ろす。
            if (this._submitting) return;
            if (!this._submitHandler) return;
            this._submitting = true;
            try {
                const values = {};
                for (const name in this._fieldEls) {
                    values[name] = this._fieldEls[name].inputEl.value;
                }
                this._submitHandler(values, this._mode, this._editingId);
            } finally {
                this._submitting = false;
            }
        };
        form.addEventListener('submit', this._onSubmit);

        // 取消ボタン: フォーム値を破棄して close、副作用なし（Req 7.6）
        this._onCancelBtn = () => {
            this._clearForm();
            this._dialog.close();
        };
        cancelBtn.addEventListener('click', this._onCancelBtn);

        // 削除ボタン: 確認後に _deleteHandler を呼ぶ。ハンドラ未注入時は no-op。
        // ハンドラ内で removeCustomBasemap→save→（選択中なら）setBasemap('osm')→
        // renderList→close-or-warn の choreography を実行する（Req 9.4／9.5／10.5）。
        this._onDelete = () => {
            if (this._mode !== 'edit' || !this._editingId) return;
            if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
                const ok = window.confirm('このカスタム背景地図を削除します。よろしいですか？');
                if (!ok) return;
            }
            if (this._deleteHandler) this._deleteHandler(this._editingId);
        };
        deleteBtn.addEventListener('click', this._onDelete);

        // ESC: <dialog> 標準で 'cancel' イベント → close。値破棄を併用。
        this._onDialogCancel = () => {
            this._clearForm();
        };
        dialog.addEventListener('cancel', this._onDialogCancel);

        // backdrop click: dialog 要素自身がイベント target なら背景クリック判定
        this._onBackdropClick = (e) => {
            if (e.target === this._dialog) {
                this._clearForm();
                this._dialog.close();
            }
        };
        dialog.addEventListener('click', this._onBackdropClick);
    }

    /**
     * 入力ハンドラを注入する（9.1 で結線）。
     * 受け取った values（trim 前生値）と mode／editingId を元に
     * 検証・add／update・persist・renderList・close を担う。
     *
     * @param {(values: Record<string, string>, mode: 'create'|'edit', editingId: string|null) => void} handler
     * @returns {void}
     */
    setSubmitHandler(handler) {
        this._submitHandler = handler;
    }

    /**
     * 削除ハンドラを注入する（12.3 で結線）。
     * 受け取った id（editingId）を元に removeCustomBasemap→save→必要なら
     * setBasemap('osm') fallback→renderList→close-or-warn を担う。
     *
     * @param {(id: string) => void} handler
     * @returns {void}
     */
    setDeleteHandler(handler) {
        this._deleteHandler = handler;
    }

    /**
     * dialog を開く。
     * create: 空フォーム表示。edit: Phase 2 12.2 で pre-fill 実装（本タスクでは空表示）。
     * showModal で表示し最初の input にフォーカスする（Req 7.2／6.5）。
     *
     * @param {{mode: 'create'|'edit', entry?: object}} opts
     * @returns {void}
     */
    open(opts) {
        if (!this._dialog) this.mount();
        this._mode = opts.mode;
        this._editingId = (opts.mode === 'edit' && opts.entry) ? opts.entry.id : null;
        this._clearErrors();
        this._clearGeneralError();

        if (opts.mode === 'create') {
            this._titleEl.textContent = 'カスタム背景地図を追加';
            this._submitEl.textContent = '保存';
            if (this._deleteEl) this._deleteEl.style.display = 'none';
            this._clearFormValues();
        } else if (opts.mode === 'edit') {
            this._titleEl.textContent = 'カスタム背景地図を編集';
            this._submitEl.textContent = '保存';
            // edit モード時のみ削除ボタンを表示（Req 9.1）
            if (this._deleteEl) this._deleteEl.style.display = '';
            // entry（BasemapDefPersistable）の各フィールドをフォームへ pre-fill。
            // 値の安全性（属性値や markup として解釈されないこと）は input.value への代入
            // が DOM API でテキスト扱いになるため自動保証される（buildAttribution と同設計）。
            this._clearFormValues();
            if (opts.entry) {
                const e = opts.entry;
                if (typeof e.label === 'string') this._fieldEls.label.inputEl.value = e.label;
                if (typeof e.tileUrl === 'string') this._fieldEls.tileUrl.inputEl.value = e.tileUrl;
                if (typeof e.attributionLabel === 'string') this._fieldEls.attributionLabel.inputEl.value = e.attributionLabel;
                if (typeof e.attributionLinkUrl === 'string') this._fieldEls.attributionLinkUrl.inputEl.value = e.attributionLinkUrl;
                if (typeof e.minzoom === 'number') this._fieldEls.minzoom.inputEl.value = String(e.minzoom);
                if (typeof e.maxzoom === 'number') this._fieldEls.maxzoom.inputEl.value = String(e.maxzoom);
            }
        }

        this._dialog.showModal();
        const firstField = this._fieldEls.label;
        if (firstField) firstField.inputEl.focus();
    }

    /** @returns {void} */
    close() {
        if (this._dialog && this._dialog.open) {
            this._dialog.close();
        }
    }

    /**
     * フィールドエラー文言を表示する（9.1／12.x で利用）。
     * @param {Array<{field: string, message: string}>} errors
     * @returns {void}
     */
    showFieldErrors(errors) {
        this._clearErrors();
        const firstErrField = errors[0]?.field;
        for (const e of errors) {
            const cell = this._fieldEls[e.field];
            if (cell) cell.errorEl.textContent = e.message;
        }
        // 最初のエラー入力へフォーカス
        if (firstErrField && this._fieldEls[firstErrField]) {
            this._fieldEls[firstErrField].inputEl.focus();
        }
    }

    /**
     * フィールド非依存の一般メッセージ（例: 保存失敗）を aria-live に表示する。
     * @param {string} message
     * @returns {void}
     */
    showGeneralMessage(message) {
        if (this._generalErrorEl) this._generalErrorEl.textContent = message;
    }

    _clearForm() {
        this._clearFormValues();
        this._clearErrors();
        this._clearGeneralError();
        this._mode = null;
        this._editingId = null;
    }

    _clearFormValues() {
        for (const name in this._fieldEls) {
            this._fieldEls[name].inputEl.value = '';
        }
    }

    _clearErrors() {
        for (const name in this._fieldEls) {
            this._fieldEls[name].errorEl.textContent = '';
        }
    }

    _clearGeneralError() {
        if (this._generalErrorEl) this._generalErrorEl.textContent = '';
    }

    /** リスナと DOM を解放する（Switcher.onRemove から呼ばれる）。 */
    unmount() {
        if (this._dialog) {
            if (this._onSubmit && this._form) this._form.removeEventListener('submit', this._onSubmit);
            if (this._onCancelBtn && this._cancelEl) this._cancelEl.removeEventListener('click', this._onCancelBtn);
            if (this._onDelete && this._deleteEl) this._deleteEl.removeEventListener('click', this._onDelete);
            if (this._onDialogCancel) this._dialog.removeEventListener('cancel', this._onDialogCancel);
            if (this._onBackdropClick) this._dialog.removeEventListener('click', this._onBackdropClick);
            if (this._dialog.parentNode) this._dialog.parentNode.removeChild(this._dialog);
        }
        this._dialog = this._form = this._titleEl = this._submitEl = this._cancelEl = this._deleteEl = null;
        this._generalErrorEl = null;
        this._fieldEls = {};
        this._onSubmit = this._onCancelBtn = this._onDelete = this._onDialogCancel = this._onBackdropClick = null;
        this._submitHandler = null;
        this._deleteHandler = null;
        this._mode = null;
        this._editingId = null;
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
            // 初期スタイルの osm source を BUILTIN_BASEMAPS の osm エントリと一貫させ、
            // 初回レンダリングと切替後レンダリングを同一にする（Req 1.6/3.3）。
            // tiles/tileSize/maxzoom は BUILTIN_BASEMAPS[].source、attribution は
            // BUILTIN_BASEMAPS[].attribution（buildAttribution 経由の安全な出典）から
            // 取り、ハードコード literal は持たない（Req 3.1 は BUILTIN_BASEMAPS 形で充足）。
            // BUILTIN_BASEMAPS / buildAttribution は上方で宣言済みのため参照は有効
            // （map 構築は const 宣言の後に実行され TDZ 非該当）。
            osm: {
                ...BUILTIN_BASEMAPS.find((b) => b.id === 'osm').source,
                attribution: BUILTIN_BASEMAPS.find((b) => b.id === 'osm').attribution,
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
    // Switcher と FormDialog をペアで生成・結線する（FormDialog の lazy-mount
    // は最初の open() で document.body 直下に dialog を作る）。
    const basemapSwitcher = new BasemapSwitcherControl();
    map.addControl(basemapSwitcher, 'bottom-left');
    const basemapFormDialog = new BasemapFormDialog();
    basemapSwitcher.setFormDialog(basemapFormDialog);

    // Phase 1 task 9.1: FormDialog submit → Validate → Registry → Persistence → Switcher.renderList の結線（add 経路）。
    // edit 経路は Phase 2 task 12.2 で同じハンドラ内に mode==='edit' 分岐として追加する。
    basemapFormDialog.setSubmitHandler((values, mode, editingId) => {
        // 1. 未信頼入力として検証（Req 8.1〜8.4）。
        //    違反時はフィールド単位エラーを表示し、ダイアログは閉じない／最初のエラーへフォーカス
        const result = validateCustomBasemapInput(values);
        if (!result.valid) {
            basemapFormDialog.showFieldErrors(result.errors);
            return;
        }

        // 2. Registry へ反映: create は addCustomBasemap、edit は updateCustomBasemap。
        //    両ストア（customBasemaps と customBasemapsPersistable）を同期して更新する。
        if (mode === 'create') {
            addCustomBasemap(result.normalized);
        } else if (mode === 'edit' && editingId) {
            const updated = updateCustomBasemap(editingId, result.normalized);
            if (!updated) {
                // 対象不在（削除済み等の競合）— 防御的に general message で通知し終了
                basemapFormDialog.showGeneralMessage(
                    '編集対象が見つかりませんでした',
                );
                return;
            }
            // 編集対象が現在選択中なら、source/attribution が変わったため再 setBasemap で反映。
            // 同 id だと no-op になるため、一度別の id（osm）に切替えてから戻す手は重い。
            // ここでは render 再描画で radio label/checked の同期のみ取り、source の更新は
            // 「次に切り替えたとき」または「再選択時」に反映される（既知の制約）。
            // → 利用者が編集後すぐに地図表示の即時反映を望む場合は、明示的に当該 radio を
            //    選び直してもらう。実機スモーク（14.2）でこの境界をチェック項目化する。
        } else {
            return; // 未知 mode は no-op
        }

        // 3. Switcher を再描画（label 変更や追加分の即時反映、Req 7.4／9.3）
        basemapSwitcher.renderList();

        // 4. 永続化（Req 10.1）。失敗時は dialog を閉じず警告を維持し利用者の明示操作を待つ
        //    （add／edit／delete を C3 一貫性で対称化、Req 10.5 の通知 visibility を保つ）
        const saved = saveCustomBasemaps(customBasemapsPersistable);
        if (!saved) {
            basemapFormDialog.showGeneralMessage(
                '保存できませんでした（当該セッションのみ反映、再読込で消えます）',
            );
            return;
        }

        // 5. 保存成功時のみ dialog を閉じる（次回 open で _clearForm が走り値はリセットされる）
        basemapFormDialog.close();
    });

    // Phase 2 task 12.3: delete ハンドラ結線。FormDialog の削除ボタン click 後に呼ばれる。
    // removeCustomBasemap → renderList → 選択中だったなら setBasemap('osm') → save の順。
    // 保存失敗時は dialog 内警告を出して dialog open を継続（C3 一貫性、Req 10.5）。
    basemapFormDialog.setDeleteHandler((id) => {
        const wasSelected = currentBasemapId === id;
        const removed = removeCustomBasemap(id);
        if (!removed) {
            basemapFormDialog.showGeneralMessage(
                '削除対象が見つかりませんでした',
            );
            return;
        }
        // 一覧を再描画（in-memory には除去済み）
        basemapSwitcher.renderList();
        // 選択中だったなら OSM へフォールバック（Req 9.5）。setBasemap は default persist=true で
        // saveSelectedBasemapId('osm') を呼ぶため、選択 id も同時に永続化される。
        if (wasSelected) {
            setBasemap('osm');
        }
        // 定義の永続化
        const saved = saveCustomBasemaps(customBasemapsPersistable);
        if (!saved) {
            basemapFormDialog.showGeneralMessage(
                '削除を保存できませんでした（当該セッションのみ反映、次回読込で復活します）',
            );
            return;
        }
        basemapFormDialog.close();
    });

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
