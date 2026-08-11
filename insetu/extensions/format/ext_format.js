import { createExtensionStore } from '../core/sdk.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };

export const FormatStore = createExtensionStore('Format', {
    activeFormatJobId: null
});

window.inSetu.stores.Format = FormatStore;

window.ExtensionRegistry.registerExtension('format', {
    name: "Code Formatting",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'format-code',
            label: 'Format Code',
            icon: '🧹',
            intent: 'primary',
            order: 45,
            match: (data) => {
                if (!data) return false;
                const fp = (data.filepath || data.path || data.filename || '').toLowerCase();
                return fp.endsWith('.js') || fp.endsWith('.json') || fp.endsWith('.css') || fp.endsWith('.html') || fp.endsWith('.py');
            },
            onClick: async (data, e) => {
                try {
                    const res = await window.inSetu.api.workspace('format/format-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filepath: data.filepath })
                    });
                    if (res.ok) {
                        const resData = await res.json();
                        window.inSetu.utils.pollJob(resData.job_id, {
                            onComplete: () => {
                                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                                    window.inSetu.ui.setGlobalStatus(`✅ Code formatted: ${data.filepath}`, 3000);
                                }
                            },
                            onError: (err) => alert(`Formatting failed: ${err.message}`)
                        });
                    }
                } catch (err) {
                    alert(`Network error formatting code: ${err.message}`);
                }
            }
        }
    ],
    layoutSlots: [],
    uiHooks: {}
});