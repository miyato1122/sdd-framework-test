// 背景地図スイッチャー（自作 MapLibre IControl）。
// 仕様: specs/003-custom-basemap/contracts/ui-basemap-switcher.md / research.md R1′・R5
//
// 002 は maplibre-gl-opacity の OpacityControl を背景切替に転用していたが、同
// プラグインは「構築時固定 baseLayers」設計で実行時の動的追加・一覧末尾の
// 追加ボタンに非対応（research R1′）。本コントロールはプラグインの描画 DOM
// 形状（#opacity-control＋ネイティブ radio＋label[for]）を踏襲し、既存共有
// CSS（opacity-control.css / style.css）をそのまま適用してスタイル二重化と
// アクセシビリティ後退を避ける（憲章 III）。新規依存なし（利用者制約・憲章 I）。
//
// 注: a11y（label[for]・キーボード・フォーカス順）は実機スモークで確認すること
//     （quickstart.md §4。静的断定しない）。

import {
    validateCustomBasemapInput,
    createCustomBasemap,
} from './basemaps.js';

/**
 * 背景地図切替コントロール。組み込み＋ユーザー定義背景を排他選択し、
 * 一覧末尾の「＋ 背景地図を追加」からインラインフォームで実行時追加する。
 *
 * MapLibre IControl 実装（onAdd/onRemove）。
 */
export default class BasemapSwitcherControl {
    /**
     * @param {object} opts
     * @param {ReadonlyArray<{id:string,label:string,isDefault:boolean}>} opts.basemaps 組み込み背景（順序＝表示順）
     * @param {string} opts.defaultId 初期選択の背景 id
     * @param {(basemap:object) => void} opts.onAddBasemap 追加確定時、地図側で source/layer を登録するコールバック
     */
    constructor({ basemaps, defaultId, onAddBasemap }) {
        // 現在の選択肢（組み込み＋実行時追加分）。表示順を保持。
        this._entries = basemaps.map((b) => ({
            id: b.id,
            label: b.label,
        }));
        this._defaultId = defaultId;
        this._currentId = defaultId;
        this._onAddBasemap = onAddBasemap;
        this._addSeq = 0; // ユーザー定義 id のシード（セッション内一意・決定論）
        this._map = null;
        this._container = null;
        this._listEl = null;
        this._addButtonEl = null;
        this._formEl = null;
    }

    /** @returns {HTMLElement} */
    onAdd(map) {
        this._map = map;
        const container = document.createElement('div');
        // maplibregl-ctrl 配下に置く（プラグインと同じ枠）。id は既存 CSS 再利用。
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const inner = document.createElement('div');
        inner.id = 'opacity-control'; // 既存 opacity-control.css をそのまま適用
        container.appendChild(inner);

        this._listEl = document.createElement('div');
        this._listEl.className = 'basemap-switcher-list';
        inner.appendChild(this._listEl);

        // 末尾「追加」ボタン（FR-001）
        this._addButtonEl = document.createElement('button');
        this._addButtonEl.type = 'button';
        this._addButtonEl.className = 'basemap-add-button';
        this._addButtonEl.textContent = '＋ 背景地図を追加';
        this._addButtonEl.addEventListener('click', () => this._toggleForm());
        inner.appendChild(this._addButtonEl);

        // 追加フォーム（インライン・既定は非表示。FR-002）
        this._formEl = this._buildForm();
        inner.appendChild(this._formEl);

        this._renderList();
        this._container = container;
        return container;
    }

    onRemove() {
        this._container?.parentNode?.removeChild(this._container);
        this._map = null;
        this._container = null;
    }

    // --- 内部 ---

    /** ラジオ一覧を現在の選択肢で再描画する（追加時にも呼ぶ）。 */
    _renderList() {
        this._listEl.replaceChildren();
        for (const entry of this._entries) {
            const row = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'basemap-switcher';
            input.id = `bm-${entry.id}`;
            input.value = entry.id;
            input.checked = entry.id === this._currentId;
            input.addEventListener('change', () => {
                if (input.checked) this._select(entry.id);
            });
            const label = document.createElement('label');
            label.htmlFor = `bm-${entry.id}`; // label[for]＝キーボード/クリック切替
            label.textContent = entry.label;
            row.appendChild(input);
            row.appendChild(label);
            this._listEl.appendChild(row);
        }
    }

    /**
     * 排他選択: 選択背景の `<id>-layer` のみ可視、他背景は none。
     * 出典は MapLibre 既定 AttributionControl が可視ソースから自動集約（002 R3）。
     */
    _select(id) {
        if (!this._map) return;
        for (const entry of this._entries) {
            const visibility = entry.id === id ? 'visible' : 'none';
            const layerId = `${entry.id}-layer`;
            if (this._map.getLayer(layerId)) {
                this._map.setLayoutProperty(layerId, 'visibility', visibility);
            }
        }
        this._currentId = id;
    }

    _buildForm() {
        const form = document.createElement('form');
        form.className = 'basemap-add-form';
        form.hidden = true;
        form.setAttribute('novalidate', 'novalidate');

        // 出典は生 HTML を受け付けず「表示名（必須）」「リンク URL（任意）」に
        // 分離して入力させる（Clarifications Q5・research R7）。組み立てと
        // エスケープは basemaps.js（buildAttributionHtml）が担う。
        const fields = [
            { key: 'label', label: '表示名', type: 'text' },
            {
                key: 'urlTemplate',
                label: 'タイル取得元（URL テンプレート）',
                type: 'text',
                placeholder: 'https://example.com/tiles/{z}/{x}/{y}.png',
            },
            {
                key: 'attributionLabel',
                label: '出典の表示名',
                type: 'text',
                placeholder: '例: 国土地理院',
            },
            {
                key: 'attributionUrl',
                label: '出典リンク URL（任意）',
                type: 'url',
                placeholder: 'https://example.com/terms（任意・http(s)）',
            },
        ];
        this._inputs = {};
        this._errorEls = {};
        for (const f of fields) {
            const wrap = document.createElement('div');
            wrap.className = 'basemap-add-field';
            const lbl = document.createElement('label');
            lbl.htmlFor = `basemap-add-${f.key}`;
            lbl.textContent = f.label;
            const inp = document.createElement('input');
            inp.type = f.type;
            inp.id = `basemap-add-${f.key}`;
            if (f.placeholder) inp.placeholder = f.placeholder;
            const err = document.createElement('p');
            err.className = 'basemap-add-error';
            err.id = `basemap-add-${f.key}-error`;
            err.hidden = true;
            // エラーを支援技術へ通知し、入力と関連付け（憲章 III）
            err.setAttribute('role', 'alert');
            inp.setAttribute('aria-describedby', err.id);
            wrap.append(lbl, inp, err);
            form.appendChild(wrap);
            this._inputs[f.key] = inp;
            this._errorEls[f.key] = err;
        }

        const actions = document.createElement('div');
        actions.className = 'basemap-add-actions';
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.className = 'basemap-add-submit';
        submit.textContent = '追加';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'basemap-add-cancel';
        cancel.textContent = 'キャンセル';
        cancel.addEventListener('click', () => this._closeForm());
        actions.append(submit, cancel);
        form.appendChild(actions);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._submit();
        });
        return form;
    }

    _toggleForm() {
        if (this._formEl.hidden) this._openForm();
        else this._closeForm();
    }

    _openForm() {
        this._clearErrors();
        this._formEl.hidden = false;
        this._inputs.label?.focus();
    }

    /** キャンセル/閉じる: 一覧・地図・出典・現在選択は不変（FR-009・US3-AC4）。 */
    _closeForm() {
        this._formEl.reset();
        this._clearErrors();
        this._formEl.hidden = true;
    }

    _clearErrors() {
        for (const key of Object.keys(this._errorEls)) {
            const el = this._errorEls[key];
            el.textContent = '';
            el.hidden = true;
            this._inputs[key]?.removeAttribute('aria-invalid');
        }
    }

    _showErrors(errors) {
        this._clearErrors();
        for (const { field, message } of errors) {
            const el = this._errorEls[field];
            if (!el) continue;
            el.textContent = message;
            el.hidden = false;
            this._inputs[field]?.setAttribute('aria-invalid', 'true');
        }
    }

    /**
     * 追加確定: 検証 → NG なら項目別エラー表示しフォーム維持（FR-008）。
     * OK なら BaseMap 生成 → 地図側で source/layer 登録 → 一覧へ追記。
     * 現在選択・可視・出典は変更しない（自動選択しない＝Clarifications Q4）。
     */
    _submit() {
        const input = {
            label: this._inputs.label.value,
            urlTemplate: this._inputs.urlTemplate.value,
            attributionLabel: this._inputs.attributionLabel.value,
            attributionUrl: this._inputs.attributionUrl.value,
        };
        const existingLabels = this._entries.map((e) => e.label);
        const result = validateCustomBasemapInput(input, existingLabels);
        if (!result.ok) {
            this._showErrors(result.errors);
            return; // 追加しない・フォームは開いたまま（無言失敗禁止）
        }
        this._addSeq += 1;
        const basemap = createCustomBasemap(input, this._addSeq);
        // 地図側で source/layer を登録（visibility:'none'）
        this._onAddBasemap?.(basemap);
        // 一覧末尾（追加ボタンの直前）へ追記。現在選択は不変（Q4）。
        this._entries.push({ id: basemap.id, label: basemap.label });
        this._renderList();
        this._closeForm();
    }
}
