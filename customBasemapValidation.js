const LABEL_MAX = 40;
const ZOOM_MIN = 0;
const ZOOM_MAX = 24;

export function validateCustomBasemapInput(raw) {
    const errors = {};
    const value = {};

    const label = (raw.label ?? '').trim();
    if (label.length === 0) {
        errors.label = '名称を入力してください。';
    } else if (label.length > LABEL_MAX) {
        errors.label = `名称は ${LABEL_MAX} 文字以内で入力してください。`;
    } else {
        value.label = label;
    }

    const tileUrl = (raw.tileUrl ?? '').trim();
    if (tileUrl.length === 0) {
        errors.tileUrl = 'タイル URL を入力してください。';
    } else {
        let parsed;
        try {
            parsed = new URL(tileUrl);
        } catch {
            parsed = null;
        }
        if (!parsed) {
            errors.tileUrl = 'タイル URL の形式が不正です。';
        } else if (parsed.protocol !== 'https:') {
            errors.tileUrl = 'タイル URL は https:// で始まる必要があります。';
        } else if (
            !tileUrl.includes('{z}') ||
            !tileUrl.includes('{x}') ||
            !tileUrl.includes('{y}')
        ) {
            errors.tileUrl =
                'タイル URL に {z}, {x}, {y} のすべてを含めてください。';
        } else {
            value.tileUrl = tileUrl;
        }
    }

    const attributionText = (raw.attributionText ?? '').trim();
    value.attributionText = attributionText;

    const attributionUrl = (raw.attributionUrl ?? '').trim();
    if (attributionUrl.length > 0) {
        let parsed;
        try {
            parsed = new URL(attributionUrl);
        } catch {
            parsed = null;
        }
        if (!parsed) {
            errors.attributionUrl = '出典リンク URL の形式が不正です。';
        } else if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {
            errors.attributionUrl =
                '出典リンク URL は http:// または https:// で始まる必要があります。';
        } else {
            value.attributionUrl = attributionUrl;
        }
    } else {
        value.attributionUrl = '';
    }

    const minzoom = parseZoom(raw.minzoom, 'minzoom', errors);
    const maxzoom = parseZoom(raw.maxzoom, 'maxzoom', errors);
    if (
        minzoom !== undefined &&
        maxzoom !== undefined &&
        minzoom !== null &&
        maxzoom !== null &&
        minzoom > maxzoom
    ) {
        errors.maxzoom = 'maxzoom は minzoom 以上である必要があります。';
    }
    if (minzoom !== undefined) value.minzoom = minzoom;
    if (maxzoom !== undefined) value.maxzoom = maxzoom;

    if (Object.keys(errors).length > 0) {
        return { ok: false, errors };
    }
    return { ok: true, value };
}

function parseZoom(raw, field, errors) {
    const s = (raw ?? '').toString().trim();
    if (s.length === 0) return null;
    if (!/^\d+$/.test(s)) {
        errors[field] = `${field} は 0〜${ZOOM_MAX} の整数で入力してください。`;
        return undefined;
    }
    const n = Number(s);
    if (n < ZOOM_MIN || n > ZOOM_MAX) {
        errors[field] = `${field} は ${ZOOM_MIN}〜${ZOOM_MAX} の範囲で入力してください。`;
        return undefined;
    }
    return n;
}

export function buildAttributionHtml({ text, url }) {
    const hasText = typeof text === 'string' && text.length > 0;
    const hasUrl = typeof url === 'string' && url.length > 0;
    if (!hasText && !hasUrl) return '';
    if (hasText && hasUrl) {
        return `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${escHtml(text)}</a>`;
    }
    if (hasText) {
        return escHtml(text);
    }
    return `<a href="${escAttr(url)}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`;
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
