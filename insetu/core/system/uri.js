/**
 * Canonical URI and structural bucket address value objects for the inSetu frontend.
 */

/** Immutable value object representing a canonical structural bucket address (<repo>::<bucket_id>). */
export class BucketAddress {
    constructor(repo, bucketId = 'main') {
        this.repo = (repo || 'global').toLowerCase().trim();
        this.bucketId = (bucketId || 'main').trim();
    }

    get key() {
        return `${this.repo}::${this.bucketId}`;
    }
    get contextUri() {
        const safeRepo = this.repo.startsWith('.') ? `dot_${this.repo.substring(1)}`.replace(/-/g, '_').toLowerCase() : this.repo.replace(/-/g, '_').toLowerCase();
        if (this.bucketId === 'main') return `ctx://contexts/${safeRepo}_context.txt`;
        return `ctx://contexts/${safeRepo}_${this.bucketId}_context.txt`;
    }

    get diffUri() {
        const safeRepo = this.repo.startsWith('.') ? `dot_${this.repo.substring(1)}`.replace(/-/g, '_').toLowerCase() : this.repo.replace(/-/g, '_').toLowerCase();
        if (this.bucketId === 'main') return `ctx://diffs/${safeRepo}_diffs.txt`;
        return `ctx://diffs/${safeRepo}_${this.bucketId}_diffs.txt`;
    }

    static fromKey(key) {
        if (!key) return new BucketAddress('global', 'main');
        if (key.includes('::')) {
            const [repo, bucketId] = key.split('::');
            return new BucketAddress(repo, bucketId);
        }
        return new BucketAddress(key, 'main');
    }
    static fromFilepath(filepath, manifestMeta = null) {
        if (manifestMeta) {
            const primaryRepo = manifestMeta.repo || (Array.isArray(manifestMeta.repos) && manifestMeta.repos.length === 1 ? manifestMeta.repos[0] : (Array.isArray(manifestMeta.repos) ? 'global' : null));
            const bucketId = manifestMeta.bucket_id || manifestMeta.type || null;
            if (primaryRepo && bucketId) {
                return new BucketAddress(primaryRepo, bucketId);
            }
        }
        const filename = new InSetuURI(filepath).basename;
        return new BucketAddress('orphan', filename);
    }
    static fromVfsPath(filepath) {
        const manifestVfs = window.inSetu?.stores?.App?.getState()?.manifest?.vfs || {};
        const normUri = filepath && filepath.includes('://') ? filepath : `vfs://${String(filepath || '').replace(/^\/+/, '')}`;

        for (const [key, bucket] of Object.entries(manifestVfs)) {
            if (bucket.files && (bucket.files.includes(normUri) || bucket.files.includes(filepath))) {
                return BucketAddress.fromKey(key);
            }
        }
        const parsed = new InSetuURI(normUri);
        return new BucketAddress(parsed.repo || 'global', 'main');
    }
}


/** Lexical URI parser and manipulator enforcing canonical scheme:// prefixes across vfs://, ctx://, and ws:// paths. */
export class InSetuURI {
    constructor(raw = '', defaultScheme = 'vfs') {
        if (raw instanceof InSetuURI) {
            Object.assign(this, raw);
            return;
        }
        const rawStr = typeof raw === 'object' && raw !== null
            ? String(raw.folderpath || raw.filepath || raw.id || '')
            : String(raw || '');
        const normRaw = rawStr.replace(/\\/g, '/').trim();
        const hadTrailingSlash = normRaw.endsWith('/') && !normRaw.endsWith('://');
        const clean = normRaw.replace(/\/+$/, '');
        let withScheme = clean
            ? (clean.includes('://') ? clean : `${defaultScheme}://${clean.replace(/^\/+/, '')}`)
            : '';

        let str = withScheme;
        let scheme = defaultScheme;
        const schemeMatch = str.match(/^([a-zA-Z0-9_-]+):\/\/(.*)$/);
        if (schemeMatch) {
            scheme = schemeMatch[1];
            str = schemeMatch[2];
        }
        str = str.replace(/^\/+/, '');
        const parts = str.split('/').filter(Boolean);
        const volume = parts.length > 0 ? parts[0] : '';
        const repo = parts.length > 1 ? parts[0] : (scheme === 'vfs' ? volume : '');
        const relativePath = parts.length > 1 ? parts.slice(1).join('/') : (scheme === 'vfs' ? '' : str);
        const filename = parts[parts.length - 1] || '';

        this.scheme = scheme;
        this.volume = volume;
        this.repo = repo;
        this.relativePath = relativePath;
        this.filename = filename;
        this.raw = rawStr;
        this.canonical = withScheme;
        this.isDir = hadTrailingSlash;

        this.isCompiledArtifact = scheme === 'ctx' && ['contexts', 'diffs'].includes(volume);
        this.isUserTemplate = withScheme.includes('/.templates/user/');
        this.isReadOnlyTemplate = !this.isUserTemplate && withScheme.includes('/.templates/');
        this.isTemplate = this.isUserTemplate || this.isReadOnlyTemplate;
        this.isSharedMount = scheme === 'ws';
        this.isReadOnly = this.isSharedMount || this.isCompiledArtifact || this.isReadOnlyTemplate;
        this.isEditable = !this.isReadOnly && (scheme === 'vfs' || scheme === 'ctx' || scheme === 'virtual' || scheme === 'yomama');
        this.isSource = !this.isCompiledArtifact;
    }

    get basename() {
        return this.filename || this.volume || '';
    }

    get rootSegment() {
        return this.repo || this.volume || '';
    }

    get logicalPath() {
        const root = this.rootSegment;
        return root
            ? (this.relativePath ? `${root}/${this.relativePath}` : root)
            : (this.relativePath || '');
    }

    get pathSegments() {
        return String(this.logicalPath || '').split('/').filter(Boolean);
    }

    get isRootVolume() {
        return Boolean(this.volume && !this.relativePath);
    }

    get parentUri() {
        if (!this.scheme) return '';
        const segs = this.pathSegments;
        if (segs.length <= 1) {
            return `${this.scheme}://`;
        }
        segs.pop();
        return `${this.scheme}://${segs.join('/')}`;
    }

    withName(newName) {
        const cleanName = String(newName || '').trim().replace(/^\/+|\/+$/g, '');
        if (!cleanName) return this.toString();
        const parent = this.parentUri;
        if (!parent || parent.endsWith('://')) {
            return `${this.scheme || 'vfs'}://${cleanName}`;
        }
        return `${parent}/${cleanName}`;
    }

    join(...segments) {
        const cleanSegs = segments
            .map(s => String(s || '').trim().replace(/^\/+|\/+$/g, ''))
            .filter(Boolean);
        const base = this.toString().replace(/\/+$/, '');
        if (cleanSegs.length === 0) return base;
        if (!base || base.endsWith('://')) {
            return `${this.scheme || 'vfs'}://${cleanSegs.join('/')}`;
        }
        return `${base}/${cleanSegs.join('/')}`;
    }

    resolveRelative(targetPath) {
        const cleanTarget = String(targetPath || '').replace(/\\/g, '/').trim();
        if (!cleanTarget) return this.toString();
        if (cleanTarget.includes('://')) {
            return new InSetuURI(cleanTarget).toString();
        }
        const scheme = this.scheme || 'vfs';
        const volume = this.volume || this.repo || '';
        const baseRelParts = cleanTarget.startsWith('/')
            ? []
            : (this.relativePath ? this.relativePath.split('/').filter(Boolean) : []);
        if (!cleanTarget.startsWith('/') && !this.isDir && baseRelParts.length > 0) {
            baseRelParts.pop();
        }
        for (const seg of cleanTarget.replace(/^\/+/, '').split('/')) {
            if (!seg || seg === '.') continue;
            if (seg === '..') {
                if (baseRelParts.length > 0) baseRelParts.pop();
                continue;
            }
            baseRelParts.push(seg);
        }
        const relJoined = baseRelParts.join('/');
        if (volume) {
            return relJoined ? `${scheme}://${volume}/${relJoined}` : `${scheme}://${volume}`;
        }
        return relJoined ? `${scheme}://${relJoined}` : `${scheme}://`;
    }
    static canonicalize(raw, defaultScheme = 'vfs') {
        if (!raw) return '';
        const rawStr = typeof raw === 'object' && raw !== null
            ? String(raw.folderpath || raw.filepath || raw.id || '')
            : String(raw || '');
        let s = rawStr.replace(/\\/g, '/').trim();
        if (!s) return '';
        const hasTrailingSlash = (s.endsWith('/') && !s.endsWith('://')) || Boolean(typeof raw === 'object' && raw?.isDir);
        s = s.replace(/^(vfs|ctx|ws|virtual|yomama):\/(?!\/)/, '$1://');
        if (s.startsWith('vfs://') || s.startsWith('ctx://') || s.startsWith('ws://') || s.startsWith('virtual://') || s.startsWith('yomama://')) {
            const parsed = new InSetuURI(s);
            return hasTrailingSlash ? `${parsed.toString()}/` : parsed.toString();
        }
        while (s.includes('://')) {
            s = s.split('://').pop();
        }
        const clean = s.replace(/^\/+|\/+$/g, '');
        if (!clean) return `${defaultScheme}://`;
        if (clean.includes('diffs/') || clean.endsWith('_diffs.txt')) {
            return `ctx://diffs/${clean.replace(/^diffs\//, '')}`;
        }
        if (clean.includes('prompts/')) {
            return `ctx://prompts/${clean.replace(/^prompts\//, '')}`;
        }
        // startsWith, not includes: 'repo/.insetu-data/settings/x.md' is a repository file, not ctx://settings (matches InSetuURI.canonicalize in Python).
        if (clean.startsWith('settings/')) {
            return `ctx://settings/${clean.replace(/^settings\//, '')}`;
        }
        if (clean.endsWith('_context.txt') || clean.startsWith('contexts/')) {
            return `ctx://contexts/${clean.replace(/^contexts\//, '')}`;
        }
        return `${defaultScheme}://${clean}${hasTrailingSlash ? '/' : ''}`;
    }

    toString() {
        if (!this.canonical) return '';
        return this.canonical;
    }
}
