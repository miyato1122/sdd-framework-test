// 最寄り地物選定ロジック（nearest.js）の回帰テスト。
// @turf/distance v7（named export）で従来と同一の選定結果になることを保証する。
// 実行: `npm test`（= node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance } from '@turf/distance';
import { pickNearestFeature } from '../../nearest.js';

// 固定の地物（東京駅周辺を基準に距離が明確に異なるよう配置）
const mkFeature = (name, coordinates) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { name },
});

const point = [139.767, 35.681]; // 東京駅付近

test('候補が空なら null を返す', () => {
    assert.equal(pickNearestFeature(point, []), null);
});

test('候補が1件ならその地物を返し dist を付与する', () => {
    const only = mkFeature('only', [139.7, 35.6]);
    const result = pickNearestFeature(point, [only]);
    assert.equal(result.properties.name, 'only');
    assert.equal(typeof result.properties.dist, 'number');
    assert.ok(result.properties.dist > 0);
});

test('複数候補から幾何的に最も近い地物を選ぶ', () => {
    const near = mkFeature('near', [139.766, 35.68]); // 基準に最も近い
    const mid = mkFeature('mid', [139.7, 35.6]);
    const far = mkFeature('far', [140.0, 36.0]);
    const result = pickNearestFeature(point, [mid, near, far]);
    assert.equal(result.properties.name, 'near');
});

test('返り値は公開 API の geometry を保持する（_geometry に依存しない）', () => {
    const near = mkFeature('near', [139.766, 35.68]);
    const result = pickNearestFeature(point, [near]);
    assert.deepEqual(result.geometry.coordinates, [139.766, 35.68]);
});

test('選定結果の dist は候補中の最小距離である', () => {
    const a = mkFeature('a', [139.9, 35.8]);
    const b = mkFeature('b', [139.768, 35.682]); // 最近傍
    const c = mkFeature('c', [138.0, 35.0]);
    const result = pickNearestFeature(point, [a, b, c]);
    assert.equal(result.properties.name, 'b');
    // 他候補の距離より小さいこと
    for (const f of [a, c]) {
        assert.ok(
            result.properties.dist <= distance(point, f.geometry.coordinates),
        );
    }
});
