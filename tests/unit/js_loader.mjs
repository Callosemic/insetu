/**
 * Zero-dependency Node.js ESM loader and minimal browser environment shim for inSetu unit tests.
 * Resolves static/vendor.json import-map specifiers and /static/extensions/* paths to local disk files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INSETU_PKG = path.join(REPO_ROOT, 'insetu');
const STATIC_DIR = path.join(INSETU_PKG, 'static');

// 1. Minimal Browser & DOM Globals for Headless Lit / Zustand / Sutram Evaluation
class MemoryStorage {
    constructor() { this._map = new Map(); }
    getItem(k) { return this._map.has(k) ? this._map.get(k) : null; }
    setItem(k, v) { this._map.set(k, String(v)); }
    removeItem(k) { this._map.delete(k); }
    clear() { this._map.clear(); }
    key(i) { return Array.from(this._map.keys())[i] ?? null; }
    get length() { return this._map.size; }
}

if (typeof globalThis.window === 'undefined') {
    const et = new EventTarget();
    globalThis.localStorage = new MemoryStorage();
    globalThis.sessionStorage = new MemoryStorage();
    globalThis.CustomEvent = class CustomEvent extends Event {
        constructor(type, opts = {}) {
            super(type, opts);
            this.detail = opts.detail ?? null;
        }
    };
    globalThis.BroadcastChannel = class BroadcastChannel {
        constructor(name) { this.name = name; }
        postMessage() {}
        addEventListener() {}
        removeEventListener() {}
        close() {}
    };
    globalThis.CSSStyleSheet = class CSSStyleSheet {
        constructor() { this.cssRules = []; }
        replaceSync() {}
        replace() { return Promise.resolve(this); }
    };
    globalThis.ShadowRoot = class ShadowRoot {};
    globalThis.MutationObserver = class MutationObserver {
        observe() {}
        disconnect() {}
    };
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    globalThis.IntersectionObserver = class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    globalThis.HTMLElement = class HTMLElement {
        constructor() {
            this.dataset = {};
            this.style = { setProperty() {}, removeProperty() {} };
            this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
            this.shadowRoot = null;
        }
        connectedCallback() {}
        disconnectedCallback() {}
        requestUpdate() {}
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent(ev) { return et.dispatchEvent(ev); }
        setAttribute() {}
        getAttribute() { return null; }
        hasAttribute() { return false; }
        removeAttribute() {}
        closest() { return null; }
        getRootNode() { return globalThis.document; }
        attachShadow() {
            this.shadowRoot = {
                querySelector() { return null; },
                querySelectorAll() { return []; },
                adoptedStyleSheets: []
            };
            return this.shadowRoot;
        }
    };
    globalThis.Element = globalThis.HTMLElement;
    globalThis.Node = class Node {};
    const registryMap = new Map();
    globalThis.customElements = {
        define(name, ctor) { if (!registryMap.has(name)) registryMap.set(name, ctor); },
        get(name) { return registryMap.get(name); }
    };
    globalThis.document = {
        readyState: 'complete',
        hidden: false,
        adoptedStyleSheets: [],
        head: {
            appendChild() {},
            removeChild() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        },
        body: {
            style: { tabSize: 4, setProperty() {}, removeProperty() {} },
            setAttribute() {},
            getAttribute() { return 'dark'; },
            appendChild() {},
            removeChild() {},
            classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
        },
        documentElement: {
            style: { tabSize: 4, setProperty() {}, removeProperty() {} },
            setAttribute() {},
            getAttribute() { return null; }
        },
        createElement(tag) {
            const el = new globalThis.HTMLElement();
            el.tagName = String(tag || 'DIV').toUpperCase();
            el.content = { cloneNode() { return new globalThis.HTMLElement(); } };
            return el;
        },
        createComment(data) { return { nodeType: 8, data: String(data || '') }; },
        createTextNode(data) { return { nodeType: 3, data: String(data || '') }; },
        createTreeWalker() {
            return { currentNode: null, nextNode() { return null; } };
        },
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener: et.addEventListener.bind(et),
        removeEventListener: et.removeEventListener.bind(et),
        dispatchEvent: et.dispatchEvent.bind(et)
    };
    // Node 21+ ships a getter-only globalThis.navigator, so plain assignment throws; define it instead.
    Object.defineProperty(globalThis, 'navigator', {
        value: {
            onLine: true,
            userAgent: 'node-test',
            storage: { estimate: async () => ({ usage: 0, quota: 1000000 }), persisted: async () => true }
        },
        writable: true,
        configurable: true
    });
    globalThis.location = {
        origin: 'http://127.0.0.1:5005',
        href: 'http://127.0.0.1:5005/',
        pathname: '/',
        search: '',
        hash: ''
    };
    globalThis.history = { replaceState() {}, pushState() {} };
    globalThis.getComputedStyle = () => ({ tabSize: 4, getPropertyValue() { return ''; } });
    globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.window = globalThis;
    globalThis.window.addEventListener = et.addEventListener.bind(et);
    globalThis.window.removeEventListener = et.removeEventListener.bind(et);
    globalThis.window.dispatchEvent = et.dispatchEvent.bind(et);
    globalThis.window.innerWidth = 1440;
    globalThis.window.innerHeight = 900;
}

// 2. Register inline ESM resolution hook backed by static/vendor.json
const loaderCode = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const INSETU_PKG = ${JSON.stringify(INSETU_PKG)};
const STATIC_DIR = ${JSON.stringify(STATIC_DIR)};
const vendorJson = JSON.parse(fs.readFileSync(path.join(STATIC_DIR, 'vendor.json'), 'utf-8'));
const importMap = vendorJson.imports || {};
const LIT_SPECS = new Set([
    'lit',
    'lit-html',
    'lit-element',
    '@lit/reactive-element',
    'lit-virtualizer',
    '@lit-labs/virtualizer'
]);

export async function resolve(specifier, context, nextResolve) {
    if (LIT_SPECS.has(specifier) || specifier.endsWith('/lit-core.min.js') || specifier.endsWith('/lit-virtualizer.min.js')) {
        return { url: 'insetu-stub:///lit', shortCircuit: true };
    }
    if (importMap[specifier]) {
        const rel = importMap[specifier].path;
        return { url: pathToFileURL(path.join(STATIC_DIR, rel)).href, shortCircuit: true };
    }
    if (specifier.startsWith('/static/extensions/')) {
        const sub = specifier.slice('/static/extensions/'.length);
        const parts = sub.split('/');
        const modName = parts[0];
        const rest = parts.slice(1).join('/');
        const coreCand = path.join(INSETU_PKG, 'core', modName, rest);
        if (fs.existsSync(coreCand)) {
            return { url: pathToFileURL(coreCand).href, shortCircuit: true };
        }
        const extCand = path.join(INSETU_PKG, 'extensions', modName, rest);
        if (fs.existsSync(extCand)) {
            return { url: pathToFileURL(extCand).href, shortCircuit: true };
        }
    }
    if (specifier.startsWith('/static/')) {
        const rel = specifier.slice('/static/'.length);
        const cand = path.join(STATIC_DIR, rel);
        if (fs.existsSync(cand)) {
            return { url: pathToFileURL(cand).href, shortCircuit: true };
        }
    }
    return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
    if (url === 'insetu-stub:///lit') {
        return {
            format: 'module',
            source: [
                'export class LitElement extends globalThis.HTMLElement {',
                '  static properties = {};',
                '  static styles = [];',
                '  connectedCallback() {}',
                '  disconnectedCallback() {}',
                '  requestUpdate() {}',
                '  updated() {}',
                '  firstUpdated() {}',
                '  willUpdate() {}',
                '}',
                'export const html = (strings, ...values) => ({ strings, values });',
                'export const css = (strings, ...values) => ({ strings, values });',
                'export const unsafeCSS = (val) => val;',
                'export const nothing = Symbol.for("lit-nothing");',
                'export const noChange = Symbol.for("lit-noChange");',
                'export class LitVirtualizer extends LitElement {}',
                'export const virtualize = () => "";',
                'export const flow = () => ({});'
            ].join('\\n'),
            shortCircuit: true
        };
    }
    if (url.startsWith('file://') && url.endsWith('.js')) {
        return {
            format: 'module',
            source: fs.readFileSync(new URL(url), 'utf-8'),
            shortCircuit: true
        };
    }
    return nextLoad(url, context);
}
`;

register('data:text/javascript;charset=utf-8,' + encodeURIComponent(loaderCode), pathToFileURL(__filename));
