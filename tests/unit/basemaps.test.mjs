// 背景地図レジストリ（basemaps.js）の契約テスト。
// 002 観点1〜5＋003 観点6〜7（contracts/003 basemaps-module.md）を
// 決定論的・実ネットワーク非依存で検証する。実行: `npm test`（= node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BASEMAPS,
    getDefaultBasemapId,
    buildBaseLayers,
    DEFAULT_USER_TILE_ZOOM,
    validateCustomBasemapInput,
    createCustomBasemap,
    escapeHtml,
    buildAttributionHtml,
} from '../../basemaps.js';

test('観点1: BASEMAPS は4件・id 一意・isDefault は osm が一意', () => {
    assert.equal(BASEMAPS.length, 4);
    const ids = BASEMAPS.map((b) => b.id);
    assert.equal(new Set(ids).size, 4);
    assert.deepEqual(
        [...ids].sort(),
        ['gsi-blank', 'gsi-seamlessphoto', 'gsi-std', 'osm'],
    );
    const defaults = BASEMAPS.filter((b) => b.isDefault);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].id, 'osm');
});

test('観点2: 各 source.tiles[0] が公式 URL・gsi-blank の maxzoom は 14', () => {
    const byId = Object.fromEntries(BASEMAPS.map((b) => [b.id, b]));
    assert.equal(
        byId['osm'].source.tiles[0],
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    assert.equal(
        byId['gsi-std'].source.tiles[0],
        'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    );
    assert.equal(
        byId['gsi-seamlessphoto'].source.tiles[0],
        'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    );
    assert.equal(
        byId['gsi-blank'].source.tiles[0],
        'https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png',
    );
    assert.equal(byId['gsi-blank'].source.maxzoom, 14);
});

test('観点3: attribution が提供元規約に準拠（OSM / 地理院タイル）', () => {
    const byId = Object.fromEntries(BASEMAPS.map((b) => [b.id, b]));
    const osmAttr = byId['osm'].source.attribution;
    assert.match(osmAttr, /OpenStreetMap/);
    assert.match(osmAttr, /openstreetmap\.org\/copyright/);
    for (const id of ['gsi-std', 'gsi-seamlessphoto', 'gsi-blank']) {
        const attr = byId[id].source.attribution;
        assert.match(attr, /地理院タイル|国土地理院/);
        assert.match(attr, /maps\.gsi\.go\.jp\/development\/ichiran\.html/);
    }
});

test('観点4: getDefaultBasemapId() は osm', () => {
    assert.equal(getDefaultBasemapId(), 'osm');
});

test('観点5: buildBaseLayers() は4キー・`<id>-layer`→label・順序が BASEMAPS 準拠', () => {
    const layers = buildBaseLayers();
    const keys = Object.keys(layers);
    assert.equal(keys.length, 4);
    assert.deepEqual(
        keys,
        BASEMAPS.map((b) => `${b.id}-layer`),
    );
    for (const b of BASEMAPS) {
        assert.equal(layers[`${b.id}-layer`], b.label);
    }
});

// --- 003 観点（contracts/003 basemaps-module.md。Q5 で出典は label/url 分離） ---

const validInput = () => ({
    label: 'マイ地図',
    urlTemplate: 'https://example.com/tiles/{z}/{x}/{y}.png',
    attributionLabel: 'My Source',
    attributionUrl: 'https://example.com/terms',
});

test('観点1+: 組み込み4種はすべて isUserDefined === false', () => {
    for (const b of BASEMAPS) {
        assert.equal(b.isUserDefined, false, `${b.id} は組み込み`);
    }
});

test('観点10: DEFAULT_USER_TILE_ZOOM は { tileSize:256, maxzoom:19 }', () => {
    assert.equal(DEFAULT_USER_TILE_ZOOM.tileSize, 256);
    assert.equal(DEFAULT_USER_TILE_ZOOM.maxzoom, 19);
});

test('観点2: validateCustomBasemapInput 正常系（URL 有り／空 双方）は ok:true', () => {
    const r1 = validateCustomBasemapInput(validInput(), ['OSM', '航空写真']);
    assert.equal(r1.ok, true);
    assert.deepEqual(r1.errors, []);
    const r2 = validateCustomBasemapInput(
        { ...validInput(), attributionUrl: '   ' }, // 任意＝空でも OK
        [],
    );
    assert.equal(r2.ok, true);
});

test('観点3: 必須空（label/urlTemplate/attributionLabel）で該当 field エラー。attributionUrl 空は非エラー', () => {
    for (const field of ['label', 'urlTemplate', 'attributionLabel']) {
        const input = { ...validInput(), [field]: '   ' };
        const r = validateCustomBasemapInput(input, []);
        assert.equal(r.ok, false);
        assert.ok(
            r.errors.some((e) => e.field === field),
            `${field} の不足が検出される`,
        );
    }
    const rUrlEmpty = validateCustomBasemapInput(
        { ...validInput(), attributionUrl: '' },
        [],
    );
    assert.equal(
        rUrlEmpty.errors.some((e) => e.field === 'attributionUrl'),
        false,
    );
});

test('観点4: 表示名重複（組み込み・追加済み双方、trim 一致）は label エラー', () => {
    const r1 = validateCustomBasemapInput(
        { ...validInput(), label: 'OSM' },
        ['OSM', '航空写真'],
    );
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some((e) => e.field === 'label'));
    const r2 = validateCustomBasemapInput(
        { ...validInput(), label: '  追加済み  ' },
        ['追加済み'],
    );
    assert.equal(r2.ok, false);
    assert.ok(r2.errors.some((e) => e.field === 'label'));
});

test('観点5: urlTemplate 不正（解釈不能／座標欠落／非http(s)）は urlTemplate エラー、混在 http は ok', () => {
    const bad = [
        'not a url',
        'https://example.com/tiles/{z}/{x}.png', // {y} 欠落
        'javascript:alert(1)//{z}/{x}/{y}',
        'data:image/png;base64,AAAA{z}{x}{y}',
    ];
    for (const urlTemplate of bad) {
        const r = validateCustomBasemapInput(
            { ...validInput(), urlTemplate },
            [],
        );
        assert.equal(r.ok, false, `不正: ${urlTemplate}`);
        assert.ok(r.errors.some((e) => e.field === 'urlTemplate'));
    }
    const httpOk = validateCustomBasemapInput(
        {
            ...validInput(),
            urlTemplate: 'http://example.com/tiles/{z}/{x}/{y}.png',
        },
        [],
    );
    assert.equal(httpOk.ok, true);
});

test('観点6: attributionUrl 不正（解釈不能／非http(s)）は attributionUrl エラー、http(s) は OK', () => {
    for (const attributionUrl of [
        'not a url',
        'javascript:alert(1)',
        'data:text/html,<script>1</script>',
    ]) {
        const r = validateCustomBasemapInput(
            { ...validInput(), attributionUrl },
            [],
        );
        assert.equal(r.ok, false, `不正: ${attributionUrl}`);
        assert.ok(r.errors.some((e) => e.field === 'attributionUrl'));
    }
    for (const attributionUrl of [
        'https://example.com/terms',
        'http://example.com/terms',
    ]) {
        const r = validateCustomBasemapInput(
            { ...validInput(), attributionUrl },
            [],
        );
        assert.equal(r.ok, true, `OK: ${attributionUrl}`);
    }
});

test('観点7: escapeHtml は &<>"\' を実体参照へ（& 先頭）', () => {
    assert.equal(
        escapeHtml(`&<>"'`),
        '&amp;&lt;&gt;&quot;&#39;',
    );
    assert.equal(escapeHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
    assert.equal(escapeHtml(null), '');
});

test('観点8: buildAttributionHtml は安全構築（URL 有→リンク／空→テキスト／HTML 無害化）', () => {
    const withUrl = buildAttributionHtml('My Source', 'https://example.com/t');
    assert.match(
        withUrl,
        /^<a href="https:\/\/example\.com\/t" target="_blank" rel="noopener noreferrer">My Source<\/a>$/,
    );
    assert.equal(buildAttributionHtml('  Plain  ', ''), 'Plain');
    // HTML インジェクション不可: 入力タグは出力にタグとして現れない
    const inj = buildAttributionHtml('<script>alert(1)</script>', '');
    assert.equal(inj.includes('<script>'), false);
    assert.match(inj, /&lt;script&gt;/);
});

test('観点9: createCustomBasemap は契約どおりの BaseMap を生成（決定論・出典は安全構築）', () => {
    const bm = createCustomBasemap(validInput(), 1);
    assert.equal(bm.label, 'マイ地図');
    assert.equal(bm.isUserDefined, true);
    assert.equal(bm.isDefault, false);
    assert.equal(bm.source.type, 'raster');
    assert.deepEqual(bm.source.tiles, [
        'https://example.com/tiles/{z}/{x}/{y}.png',
    ]);
    assert.equal(bm.source.tileSize, 256);
    assert.equal(bm.source.maxzoom, 19);
    assert.equal('minzoom' in bm.source, false);
    assert.equal(
        bm.source.attribution,
        buildAttributionHtml(
            validInput().attributionLabel,
            validInput().attributionUrl,
        ),
    );
    // 出典の表示名に HTML を入れても source.attribution にタグは現れない
    const injected = createCustomBasemap(
        { ...validInput(), attributionLabel: '<img src=x onerror=alert(1)>' },
        9,
    );
    assert.equal(injected.source.attribution.includes('<img'), false);
    // id/sourceId は一意・決定論（同 seed 同出力／別 seed 別 id）
    assert.equal(bm.id, bm.sourceId);
    assert.equal(bm.id, 'user-1');
    assert.equal(createCustomBasemap(validInput(), 1).id, bm.id);
    assert.notEqual(createCustomBasemap(validInput(), 2).id, bm.id);
    assert.equal(
        BASEMAPS.some((b) => b.id === bm.id),
        false,
    );
});
