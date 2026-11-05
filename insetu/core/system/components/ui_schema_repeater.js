/**
* Declarative schema-driven repeater component and field condition/default helpers.
*/
import { html } from 'lit';
import { sharedStyles } from 'sutram';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';

export function _evaluateFieldCondition(cond, itemData = {}, rootData = {}) {
    if (!cond || typeof cond !== 'object') return true;
    const targetVal = itemData[cond.field] !== undefined ? itemData[cond.field] : rootData[cond.field];
    if (Array.isArray(cond.in)) return cond.in.includes(targetVal);
    if (Array.isArray(cond.not_in)) return !cond.not_in.includes(targetVal);
    if (cond.equals !== undefined) return targetVal === cond.equals;
    if (cond.not_equals !== undefined) return targetVal !== cond.not_equals;
    return true;
}

export function _buildDefaultItemFromSchema(itemSchema = [], index = 1) {
    const obj = {};
    (itemSchema || []).forEach(f => {
        if (!f || !f.id) return;
        if (f.type === 'record' && Array.isArray(f.fields)) {
            obj[f.id] = _buildDefaultItemFromSchema(f.fields, index);
        } else if (f.type === 'repeater') {
            obj[f.id] = Array.isArray(f.default) ? JSON.parse(JSON.stringify(f.default)) : [];
        } else if (f.default !== undefined) {
            obj[f.id] = typeof f.default === 'function' ? f.default(index) : JSON.parse(JSON.stringify(f.default));
        } else if (f.type === 'target_binding') {
            obj[f.id] = { endpoint: '', model: '' };
        } else if (f.type === 'number') {
            obj[f.id] = 0;
        } else if (f.type === 'boolean') {
            obj[f.id] = false;
        } else {
            obj[f.id] = '';
        }
    });
    return obj;
}


/** Declarative repeater widget for array-of-object settings schemas with bounds, slug sync, and conditional sub-fields. */
export class InSetuSchemaRepeater extends InSetuElement {
    static get extensionName() { return 'system'; }
    static properties = {
        field: { type: Object },
        items: { type: Array },
        rootFormData: { type: Object },
        datalistOptions: { type: Array },
        optionResolver: { attribute: false },
        _expandedMap: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.field = {};
        this.items = [];
        this.rootFormData = {};
        this.datalistOptions = [];
        this.optionResolver = null;
        this._expandedMap = { 0: true };
    }

    _deriveUniqueSlug(baseStr, excludeIdx = -1, currentItems = []) {
        const idKey = this.field?.id_key || 'id';
        const rawSlug = this.utils.slugify(String(baseStr || '')) || `item_${excludeIdx >= 0 ? excludeIdx + 1 : currentItems.length + 1}`;
        const existingIds = new Set(
            (currentItems || [])
                .map((it, i) => (i !== excludeIdx && it && typeof it === 'object') ? it[idKey] : null)
                .filter(Boolean)
        );
        if (!existingIds.has(rawSlug)) return rawSlug;
        let suffix = 2;
        while (existingIds.has(`${rawSlug}_${suffix}`)) {
            suffix++;
        }
        return `${rawSlug}_${suffix}`;
    }

    _emitChange(nextItems) {
        this.items = nextItems;
        this.dispatchEvent(new CustomEvent('insetu-repeater-changed', {
            detail: { id: this.field.id, value: nextItems },
            bubbles: true,
            composed: true
        }));
    }

    _addItem() {
        const current = Array.isArray(this.items) ? [...this.items] : [];
        const maxItems = this.field.max_items ?? Infinity;
        if (current.length >= maxItems) return;
        const nextIdx = current.length + 1;
        const newItem = _buildDefaultItemFromSchema(this.field.item_schema || [], nextIdx);
        const titleKey = this.field.item_title_key;
        if (titleKey && !newItem[titleKey]) {
            newItem[titleKey] = `${this.field.item_label || 'Item'} ${nextIdx}`;
        }
        const implicitIdKey = this.field.id_key;
        const implicitSlugSource = this.field.slug_source || titleKey;
        if (implicitIdKey && implicitSlugSource) {
            newItem[implicitIdKey] = this._deriveUniqueSlug(newItem[implicitSlugSource] || `item_${nextIdx}`, -1, current);
        }
        const slugField = (this.field.item_schema || []).find(s => s.type === 'slug');
        if (slugField && !newItem[slugField.id]) {
            const srcVal = newItem[slugField.source_key || titleKey] || `item_${nextIdx}`;
            newItem[slugField.id] = this.utils.slugify(String(srcVal)) || `item_${nextIdx}`;
        }
        const next = [...current, newItem];
        this._expandedMap = { ...this._expandedMap, [next.length - 1]: true };
        this._emitChange(next);
    }

    _removeItem(idx) {
        const current = Array.isArray(this.items) ? [...this.items] : [];
        const minItems = this.field.min_items ?? 0;
        if (current.length <= minItems) return;
        current.splice(idx, 1);
        this._emitChange(current);
    }

    _moveItem(idx, dir) {
        const current = Array.isArray(this.items) ? [...this.items] : [];
        const targetIdx = idx + dir;
        if (targetIdx < 0 || targetIdx >= current.length) return;
        const temp = current[idx];
        current[idx] = current[targetIdx];
        current[targetIdx] = temp;
        this._emitChange(current);
    }

    _updateItemField(idx, subField, rawVal) {
        const current = Array.isArray(this.items) ? [...this.items] : [];
        const item = { ...(current[idx] || {}) };
        const prevSourceVal = item[subField.id];
        let val = rawVal;
        if (subField.type === 'number') {
            val = rawVal === '' ? '' : Number(rawVal);
        } else if (subField.type === 'comma_list') {
            val = String(rawVal || '').split(',').map(s => s.trim()).filter(Boolean);
        }
        item[subField.id] = val;

        // Implicit Repeater Identity Synchronization (id_key & slug_source)
        const implicitIdKey = this.field.id_key;
        const implicitSlugSource = this.field.slug_source;
        if (implicitIdKey && implicitSlugSource === subField.id) {
            const prevSlug = this.utils.slugify(String(prevSourceVal || ''));
            const curId = item[implicitIdKey] || '';
            if (!curId || curId === prevSlug || curId.startsWith(`${prevSlug}_`)) {
                item[implicitIdKey] = this._deriveUniqueSlug(val, idx, current);
            }
        }

        // Auto-populate any dependent slug field if it hasn't been manually customized
        (this.field.item_schema || []).forEach(sf => {
            if (sf.type === 'slug' && sf.source_key === subField.id) {
                item[sf.id] = this.utils.slugify(String(val || '')) || item[sf.id] || `item_${idx + 1}`;
            }
        });

        current[idx] = item;
        this._emitChange(current);
    }

    _updateNestedRecordField(idx, recordField, childField, rawVal) {
        const current = Array.isArray(this.items) ? [...this.items] : [];
        const item = { ...(current[idx] || {}) };
        const rec = { ...(item[recordField.id] || {}) };
        rec[childField.id] = childField.type === 'number' ? Number(rawVal) : rawVal;
        item[recordField.id] = rec;
        current[idx] = item;
        this._emitChange(current);
    }
    _renderLeafInput(subField, value, onChange, datalistId = '', itemData = {}) {
        const fType = subField.type || 'text';
        if (fType === 'boolean') {
            return html`
                <sutram-toggle
                    ?flush=${true}
                    .label=${subField.toggle_label || subField.label || subField.id}
                    .checked=${Boolean(value)}
                    @sutram-input-changed=${e => onChange(e.detail.value)}>
                </sutram-toggle>
            `;
        }
        if (fType === 'target_binding') {
            const epSourceKey = subField.endpoint_source || 'compute_endpoints';
            const epList = Array.isArray(this.rootFormData?.[epSourceKey]) ? this.rootFormData[epSourceKey] : [];
            const resolveModels = (epId) => {
                if (typeof this.optionResolver === 'function') {
                    return this.optionResolver(subField, epId, this.rootFormData, itemData);
                }
                return this.datalistOptions || [];
            };
            return html`
                <sutram-target-binding
                    ?flush=${true}
                    ?allowEmptyEndpoint=${Boolean(subField.allow_empty)}
                    .label=${subField.label || subField.id}
                    .value=${value || subField.default || { endpoint: '', model: '' }}
                    .endpoints=${epList}
                    .models=${resolveModels}
                    .endpointPlaceholder=${subField.endpoint_placeholder || 'Select endpoint...'}
                    .modelPlaceholder=${subField.placeholder || 'Select or type model...'}
                    @sutram-input-changed=${e => onChange(e.detail.value)}>
                </sutram-target-binding>
            `;
        }
        if (fType === 'select') {
            let opts = typeof subField.options === 'function'
                ? subField.options(this.rootFormData, itemData)
                : (subField.options || []);
            if (subField.options_from && typeof subField.options_from === 'object') {
                const srcArr = Array.isArray(this.rootFormData?.[subField.options_from.field])
                    ? this.rootFormData[subField.options_from.field]
                    : [];
                const vKey = subField.options_from.value_key || 'id';
                const lKey = subField.options_from.label_key || 'title';
                opts = srcArr
                    .filter(it => it && typeof it === 'object' && (it[vKey] || it[lKey]))
                    .map(it => ({ value: String(it[vKey] || it[lKey]), label: String(it[lKey] || it[vKey]) }));
            }
            return html`
                <sutram-select
                    ?flush=${true}
                    .label=${subField.label || subField.id}
                    .value=${String(value ?? subField.default ?? '')}
                    .options=${opts}
                    @sutram-input-changed=${e => onChange(e.detail.value)}>
                </sutram-select>
            `;
        }
        if (fType === 'textarea') {
            return html`
                <sutram-textarea
                    ?flush=${true}
                    .label=${subField.label || subField.id}
                    .monospace=${true}
                    .placeholder=${subField.placeholder || ''}
                    .value=${Array.isArray(value) ? value.join('\n') : String(value ?? '')}
                    @sutram-input-changed=${e => onChange(e.detail.value)}>
                </sutram-textarea>
            `;
        }
        const displayVal = fType === 'comma_list'
            ? (Array.isArray(value) ? value.join(', ') : String(value ?? ''))
            : String(value ?? '');
        return html`
            <sutram-stack direction="col" gap="xs">
                <sutram-input
                    ?flush=${true}
                    .label=${subField.label || subField.id}
                    .type=${fType === 'password' ? 'password' : (fType === 'number' ? 'number' : 'text')}
                    .placeholder=${subField.placeholder || ''}
                    .value=${displayVal}
                    @sutram-input-changed=${e => onChange(e.detail.value)}>
                </sutram-input>
                ${datalistId && Array.isArray(this.datalistOptions) && this.datalistOptions.length > 0 ? html`
                    <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                        ${this.datalistOptions.slice(0, 6).map(opt => html`
                            <sutram-pill
                                pillId=${opt.value}
                                labelText=${opt.label || opt.value}
                                ?compact=${true}
                                @sutram-pill-toggled=${() => onChange(opt.value)}>
                            </sutram-pill>
                        `)}
                    </sutram-stack>
                ` : ''}
            </sutram-stack>
        `;
    }

    render() {
        const f = this.field || {};
        const list = Array.isArray(this.items) ? this.items : [];
        const minItems = f.min_items ?? 0;
        const maxItems = f.max_items ?? Infinity;
        const canAdd = list.length < maxItems;
        const canRemove = list.length > minItems;
        const itemSchema = Array.isArray(f.item_schema) ? f.item_schema : [];
        const boundsLabel = maxItems < Infinity ? `${list.length} / ${maxItems}` : `${list.length}`;

        return html`
            <sutram-surface variant="panel" padding="md" gap="md">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <sutram-stack direction="col" gap="xs">
                        <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                            <strong>${f.label || f.id}</strong>
                            <sutram-tag text="${boundsLabel} items (min ${minItems})" intent="highlight"></sutram-tag>
                            <sutram-tag text=${f.scope || 'workspace'} intent="neutral"></sutram-tag>
                        </sutram-stack>
                        ${f.description ? html`<sutram-label .text=${f.description}></sutram-label>` : ''}
                    </sutram-stack>
                    <sutram-btn
                        ?compact=${true}
                        intent="primary"
                        icon="plus"
                        label=${f.add_label || `Add ${f.item_label || 'Item'}`}
                        ?disabled=${!canAdd}
                        @click=${() => this._addItem()}>
                    </sutram-btn>
                </sutram-stack>

                ${list.length === 0 ? html`
                    <sutram-empty-state text=${f.empty_text || 'No items configured yet.'}></sutram-empty-state>
                ` : html`
                    <sutram-stack direction="col" gap="sm">
                        ${list.map((item, idx) => {
                            const titleKey = f.item_title_key || 'title';
                            const subKey = f.item_subtitle_key !== undefined ? f.item_subtitle_key : 'id';
                            const cardTitle = item?.[titleKey] || item?.label || item?.id || `${f.item_label || 'Item'} #${idx + 1}`;
                            const cardSub = subKey && item?.[subKey] && item?.[subKey] !== cardTitle ? ` (${item[subKey]})` : '';
                            const isOpen = Boolean(this._expandedMap[idx]);
                            return html`
                                <sutram-collapsible
                                    titleText="${cardTitle}${cardSub}"
                                    intent="neutral"
                                    .open=${isOpen}
                                    @sutram-collapsible-toggled=${e => {
                                        e.stopPropagation();
                                        this._expandedMap = { ...this._expandedMap, [idx]: e.detail.open };
                                    }}>
                                    <sutram-stack slot="actions" direction="row" align="center" gap="xs">
                                        ${typeof f.item_actions === 'function' ? f.item_actions(item, idx, (patch) => {
                                            const current = Array.isArray(this.items) ? [...this.items] : [];
                                            current[idx] = { ...(current[idx] || {}), ...patch };
                                            this._emitChange(current);
                                        }) : ''}
                                        ${list.length > 1 ? html`
                                            <sutram-btn ?compact=${true} intent="neutral" icon="chevron-up" ?disabled=${idx === 0} @click=${e => { e.stopPropagation(); this._moveItem(idx, -1); }}></sutram-btn>
                                            <sutram-btn ?compact=${true} intent="neutral" icon="chevron-down" ?disabled=${idx === list.length - 1} @click=${e => { e.stopPropagation(); this._moveItem(idx, 1); }}></sutram-btn>
                                        ` : ''}
                                        <sutram-btn
                                            ?compact=${true}
                                            intent="danger"
                                            icon="trash-2"
                                            label="Remove"
                                            ?disabled=${!canRemove}
                                            title=${!canRemove ? `Minimum of ${minItems} item(s) required` : 'Remove item'}
                                            @click=${e => { e.stopPropagation(); this._removeItem(idx); }}>
                                        </sutram-btn>
                                    </sutram-stack>

                                    <sutram-stack direction="col" gap="md">
                                        <sutram-stack direction="grid" gap="md">
                                            ${itemSchema.filter(sf => sf.type !== 'hidden' && sf.type !== 'record' && sf.type !== 'repeater' && sf.type !== 'custom' && _evaluateFieldCondition(sf.show_if, item, this.rootFormData)).map(sf => html`
                                                <sutram-stack direction="col" gap="xs">
                                                    ${this._renderLeafInput(
                                                        sf,
                                                        item?.[sf.id],
                                                        val => this._updateItemField(idx, sf, val),
                                                        sf.options_source ? `${f.id}_${idx}_${sf.id}` : '',
                                                        item
                                                    )}
                                                    ${sf.description ? html`<sutram-label .text=${sf.description}></sutram-label>` : ''}
                                                </sutram-stack>
                                            `)}
                                        </sutram-stack>

                                        ${itemSchema.filter(sf => sf.type === 'custom' && typeof sf.custom_render === 'function' && _evaluateFieldCondition(sf.show_if, item, this.rootFormData)).map(customField => html`
                                            <sutram-stack direction="col" gap="xs">
                                                ${customField.custom_render(item, idx, (patch) => {
                                                    const current = Array.isArray(this.items) ? [...this.items] : [];
                                                    current[idx] = { ...(current[idx] || {}), ...patch };
                                                    this._emitChange(current);
                                                })}
                                            </sutram-stack>
                                        `)}

                                        ${itemSchema.filter(sf => sf.type === 'record' && _evaluateFieldCondition(sf.show_if, item, this.rootFormData)).map(recField => html`
                                            <sutram-surface variant="inset" padding="md" gap="sm">
                                                <strong>${recField.label || recField.id}</strong>
                                                <sutram-stack direction="grid" gap="md">
                                                    ${(recField.fields || []).filter(cf => _evaluateFieldCondition(cf.show_if, item?.[recField.id] || {}, item)).map(cf => html`
                                                        <sutram-stack direction="col" gap="xs" ?spanFull=${cf.type === 'target_binding' || cf.type === 'textarea'}>
                                                            ${this._renderLeafInput(
                                                                cf,
                                                                (item?.[recField.id] || {})[cf.id],
                                                                val => this._updateNestedRecordField(idx, recField, cf, val),
                                                                cf.options_source ? `${f.id}_${idx}_${recField.id}_${cf.id}` : ''
                                                            )}
                                                            ${cf.description ? html`<sutram-label .text=${cf.description}></sutram-label>` : ''}
                                                        </sutram-stack>
                                                    `)}
                                                </sutram-stack>
                                            </sutram-surface>
                                        `)}
                                    </sutram-stack>
                                </sutram-collapsible>
                            `;
                        })}
                    </sutram-stack>
                `}
            </sutram-surface>
        `;
    }
}

if (!customElements.get('insetu-schema-repeater')) {
    customElements.define('insetu-schema-repeater', InSetuSchemaRepeater);
}
