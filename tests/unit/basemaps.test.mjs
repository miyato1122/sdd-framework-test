// 背景地図レジストリ（basemaps.js）の契約テスト。
// contracts/basemaps-module.md のテスト観点1〜5を、決定論的・実ネットワーク非依存で検証する。
// 実行: `npm test`（= node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BASEMAPS,
    getDefaultBasemapId,
    buildBaseLayers,
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
