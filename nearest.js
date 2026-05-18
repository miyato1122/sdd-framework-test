// 最寄り地物選定の純粋ロジック（地図インスタンスに依存しない＝ユニットテスト対象）
import { distance } from '@turf/distance';

/**
 * 指定地点に最も近い地物を返す純粋関数。
 *
 * @param {[number, number]} point - 基準地点 [経度, 緯度]
 * @param {Array<{geometry:{coordinates:[number,number]}, properties:object}>} features
 *        - 候補地物の配列（各地物は geometry.coordinates を持つ）
 * @returns {object|null} 最寄り地物（properties.dist に距離を付与）。候補が空なら null
 */
export const pickNearestFeature = (point, features) => {
    return features.reduce((minDistFeature, feature) => {
        const dist = distance(point, feature.geometry.coordinates);
        if (minDistFeature === null || minDistFeature.properties.dist > dist) {
            return {
                ...feature,
                // 公開 API の geometry を明示的に保持（consumer が geometry.coordinates を参照）
                geometry: feature.geometry,
                properties: {
                    ...feature.properties,
                    dist,
                },
            };
        }
        return minDistFeature;
    }, null);
};
