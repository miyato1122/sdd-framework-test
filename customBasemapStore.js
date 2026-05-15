import { get, set } from 'idb-keyval';

export const KEY_CUSTOM_BASEMAPS = 'custom-basemaps';
export const KEY_SELECTED_BASEMAP_ID = 'selected-basemap-id';

export const CUSTOM_BASEMAP_FIELDS = [
    'id',
    'label',
    'tileUrl',
    'attributionText',
    'attributionUrl',
    'minzoom',
    'maxzoom',
    'createdAt',
];

export async function getCustomBasemaps() {
    try {
        const value = await get(KEY_CUSTOM_BASEMAPS);
        return Array.isArray(value) ? value : [];
    } catch (e) {
        console.warn('[customBasemapStore] getCustomBasemaps failed:', e);
        return [];
    }
}

export async function saveCustomBasemap(record) {
    const list = await getCustomBasemaps();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
        list[idx] = record;
    } else {
        list.push(record);
    }
    try {
        await set(KEY_CUSTOM_BASEMAPS, list);
    } catch (e) {
        console.warn('[customBasemapStore] saveCustomBasemap failed:', e);
        throw e;
    }
}

export async function deleteCustomBasemap(id) {
    const list = await getCustomBasemaps();
    const next = list.filter((r) => r.id !== id);
    try {
        await set(KEY_CUSTOM_BASEMAPS, next);
    } catch (e) {
        console.warn('[customBasemapStore] deleteCustomBasemap failed:', e);
        throw e;
    }
}

export async function getSelectedBasemapId() {
    try {
        const value = await get(KEY_SELECTED_BASEMAP_ID);
        return typeof value === 'string' ? value : null;
    } catch (e) {
        console.warn('[customBasemapStore] getSelectedBasemapId failed:', e);
        return null;
    }
}

export async function setSelectedBasemapId(id) {
    try {
        await set(KEY_SELECTED_BASEMAP_ID, id);
    } catch (e) {
        console.warn('[customBasemapStore] setSelectedBasemapId failed:', e);
    }
}
