// build.mjs
// Code-splitting esbuild bundler producing codemirror-core, lang/*, legacy/*, lezer/*, licenses, and languages.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'insetu', 'static', 'vendor', 'codemirror');
const VENDOR_JSON_PATH = path.join(REPO_ROOT, 'insetu', 'static', 'vendor.json');
const SRC_MANIFEST_PATH = path.join(__dirname, 'languages.src.json');
const STAGE_DIR = path.join(__dirname, '.entry_stage');

const srcManifest = JSON.parse(fs.readFileSync(SRC_MANIFEST_PATH, 'utf-8'));
const languages = srcManifest.languages || {};

// 1. Validate uniqueness of IDs, extensions, and filenames in languages.src.json
const seenExtensions = new Map();
const seenFilenames = new Map();
for (const [id, spec] of Object.entries(languages)) {
    for (const ext of (spec.extensions || [])) {
        const normExt = ext.toLowerCase();
        if (seenExtensions.has(normExt)) {
            throw new Error(`Duplicate extension '.${normExt}' in '${id}' and '${seenExtensions.get(normExt)}'`);
        }
        seenExtensions.set(normExt, id);
    }
    for (const fname of (spec.filenames || [])) {
        const normName = fname.toLowerCase();
        if (seenFilenames.has(normName)) {
            throw new Error(`Duplicate filename '${fname}' in '${id}' and '${seenFilenames.get(normName)}'`);
        }
        seenFilenames.set(normName, id);
    }
}

// 2. Group entry files (multiple languages may share one file, e.g. legacy/clike.js exports kotlin and scala)
const fileExportsMap = new Map();
for (const [id, spec] of Object.entries(languages)) {
    if (spec.kind === 'builtin') continue;
    if (!spec.file || !spec.package || !spec.export) {
        throw new Error(`Language '${id}' must define 'file', 'package', and 'export'`);
    }
    if (!fileExportsMap.has(spec.file)) {
        fileExportsMap.set(spec.file, { pkg: spec.package, exports: new Set(), langIds: [] });
    }
    const group = fileExportsMap.get(spec.file);
    if (group.pkg !== spec.package) {
        throw new Error(`Conflicting package '${spec.package}' vs '${group.pkg}' for file '${spec.file}'`);
    }
    group.exports.add(spec.export);
    group.langIds.push(id);
}

// 3. Stage entry modules
fs.rmSync(STAGE_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGE_DIR, { recursive: true });

const coreEntrySource = [
    'export * from "@codemirror/state";',
    'export * from "@codemirror/view";',
    'export * from "@codemirror/language";',
    'export * from "@codemirror/autocomplete";',
    'export * from "@codemirror/commands";',
    'export * from "@codemirror/lint";',
    'export * from "@codemirror/merge";',
    'export { basicSetup } from "codemirror";',
    'export { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";',
    'export { markdown } from "@codemirror/lang-markdown";',
    'export { python } from "@codemirror/lang-python";',
    'export { javascript } from "@codemirror/lang-javascript";',
    'export { json } from "@codemirror/lang-json";',
    'export { yaml } from "@codemirror/lang-yaml";',
    'export { html as htmlLang } from "@codemirror/lang-html";',
    'export { css as cssLang } from "@codemirror/lang-css";',
    ''
].join('\n');

const entryPoints = {};

function stageEntry(outRelNoExt, code) {
    const stagedFile = path.join(STAGE_DIR, `${outRelNoExt}.js`);
    fs.mkdirSync(path.dirname(stagedFile), { recursive: true });
    fs.writeFileSync(stagedFile, code, 'utf-8');
    entryPoints[outRelNoExt] = stagedFile;
}

stageEntry('codemirror-core', coreEntrySource);
stageEntry('lezer/common', 'export * from "@lezer/common";\n');
stageEntry('lezer/highlight', 'export * from "@lezer/highlight";\n');
stageEntry('lezer/lr', 'export * from "@lezer/lr";\n');

for (const [relFile, info] of fileExportsMap.entries()) {
    const outNoExt = relFile.replace(/\.js$/, '');
    const exportNames = Array.from(info.exports).sort().join(', ');
    stageEntry(outNoExt, `export { ${exportNames} } from "${info.pkg}";\n`);
}

// 4. Clean output directory (removes stale state.js, view.js, merge.js, lang-*.js) and run one split esbuild pass
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

let buildResult;
try {
    buildResult = await esbuild.build({
        entryPoints,
        outdir: OUT_DIR,
        bundle: true,
        splitting: true,
        format: 'esm',
        target: 'es2022',
        minify: true,
        chunkNames: 'chunks/[name]-[hash]',
        absWorkingDir: __dirname,
        metafile: true,
        logLevel: 'info'
    });
} finally {
    fs.rmSync(STAGE_DIR, { recursive: true, force: true });
}

// 5. Import built modules in Node to validate every declared export exists
const tempModulePkg = path.join(OUT_DIR, 'package.json');
fs.writeFileSync(tempModulePkg, '{"type":"module"}\n', 'utf-8');
try {
    const coreMod = await import(pathToFileURL(path.join(OUT_DIR, 'codemirror-core.js')).href);
    for (const [id, spec] of Object.entries(languages)) {
        if (spec.kind === 'builtin') {
            if (typeof coreMod[spec.export] !== 'function') {
                throw new Error(`Builtin language '${id}' export '${spec.export}' is missing from codemirror-core.js`);
            }
        } else {
            const builtPath = path.join(OUT_DIR, spec.file);
            if (!fs.existsSync(builtPath)) {
                throw new Error(`Expected built language file '${spec.file}' for '${id}' does not exist`);
            }
            const mod = await import(pathToFileURL(builtPath).href);
            const exportedVal = mod[spec.export];
            if (spec.kind === 'lezer' && typeof exportedVal !== 'function') {
                throw new Error(`Lezer language '${id}' export '${spec.export}' in '${spec.file}' is not a function`);
            }
            if (spec.kind === 'stream' && (!exportedVal || typeof exportedVal !== 'object')) {
                throw new Error(`Stream language '${id}' export '${spec.export}' in '${spec.file}' is not a stream parser object`);
            }
        }
    }
} finally {
    fs.rmSync(tempModulePkg, { force: true });
}

// 6. Write public languages.json manifest
const outputLanguages = {};
for (const [id, spec] of Object.entries(languages)) {
    const entry = {
        label: spec.label,
        kind: spec.kind,
        export: spec.export
    };
    if (spec.file) entry.file = spec.file;
    if (spec.options) entry.options = spec.options;
    if (spec.extensions && spec.extensions.length > 0) entry.extensions = spec.extensions;
    if (spec.filenames && spec.filenames.length > 0) entry.filenames = spec.filenames;
    if (spec.sample) entry.sample = spec.sample;
    outputLanguages[id] = entry;
}
fs.writeFileSync(
    path.join(OUT_DIR, 'languages.json'),
    JSON.stringify({ schema: 1, languages: outputLanguages }, null, 2) + '\n',
    'utf-8'
);

// 7. Copy the license of every package esbuild actually bundled (direct and indirect) into licenses/<pkg>.txt
const licensesDir = path.join(OUT_DIR, 'licenses');
fs.mkdirSync(licensesDir, { recursive: true });
const nodeModulesDir = path.join(__dirname, 'node_modules');
const bundledPkgDirs = new Map();
const duplicatePkgs = new Set();
for (const inputPath of Object.keys(buildResult.metafile.inputs)) {
    // The last node_modules segment names the package that owns the file, even in nested installs.
    const parts = inputPath.split('/');
    const nmIdx = parts.lastIndexOf('node_modules');
    if (nmIdx < 0) continue;
    const nameParts = parts[nmIdx + 1].startsWith('@') ? parts.slice(nmIdx + 1, nmIdx + 3) : parts.slice(nmIdx + 1, nmIdx + 2);
    const pkgName = nameParts.join('/');
    const pkgDir = path.join(__dirname, ...parts.slice(0, nmIdx + 1 + nameParts.length));
    if (bundledPkgDirs.has(pkgName) && bundledPkgDirs.get(pkgName) !== pkgDir) {
        duplicatePkgs.add(pkgName);
    }
    bundledPkgDirs.set(pkgName, pkgDir);
}

// CodeMirror compares facets and node types by identity, so two copies of these packages break highlighting silently.
const IDENTITY_PACKAGES = ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@lezer/common', '@lezer/highlight', '@lezer/lr'];
const identityDuplicates = Array.from(duplicatePkgs).filter(p => IDENTITY_PACKAGES.includes(p));
if (identityDuplicates.length) {
    throw new Error(`Two copies of ${identityDuplicates.join(', ')} were bundled; align the versions in package.json so npm installs one copy`);
}
for (const dup of duplicatePkgs) {
    console.warn(`⚠️ Two copies of '${dup}' were bundled (a nested install); align versions to save bytes.`);
}

const missingLicenses = [];
for (const pkgName of Array.from(bundledPkgDirs.keys()).sort()) {
    const pkgDir = bundledPkgDirs.get(pkgName);
    const licenseFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENCE']
        .map(f => path.join(pkgDir, f))
        .find(p => fs.existsSync(p));
    if (!licenseFile) {
        missingLicenses.push(`${pkgName} (${pkgDir})`);
        continue;
    }
    const safeName = pkgName.replace(/^@/, '').replace(/\//g, '__');
    fs.copyFileSync(licenseFile, path.join(licensesDir, `${safeName}.txt`));
}
if (missingLicenses.length) {
    throw new Error(`No LICENSE file found for bundled packages:\n  ${missingLicenses.join('\n  ')}`);
}

// 8. Update insetu/static/vendor.json with real versions and @lezer/* import-map entries
function readInstalledVersion(pkgName) {
    const p = path.join(nodeModulesDir, ...pkgName.split('/'), 'package.json');
    if (!fs.existsSync(p)) {
        throw new Error(`Cannot read the installed version of '${pkgName}'; run npm ci in scripts/codemirror/ first`);
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')).version;
}

if (fs.existsSync(VENDOR_JSON_PATH)) {
    const vendorJson = JSON.parse(fs.readFileSync(VENDOR_JSON_PATH, 'utf-8'));
    const imports = vendorJson.imports || {};
    const corePkgs = [
        ['codemirror-core', 'codemirror'],
        ['@codemirror/state', '@codemirror/state'],
        ['@codemirror/view', '@codemirror/view'],
        ['@codemirror/language', '@codemirror/language'],
        ['@codemirror/autocomplete', '@codemirror/autocomplete'],
        ['@codemirror/commands', '@codemirror/commands'],
        ['@codemirror/lint', '@codemirror/lint'],
        ['codemirror', 'codemirror']
    ];
    for (const [specifier, npmName] of corePkgs) {
        imports[specifier] = {
            path: 'vendor/codemirror/codemirror-core.js',
            version: readInstalledVersion(npmName),
            range: '>=6.0.0 && <7.0.0'
        };
    }
    const lezerPkgs = [
        ['@lezer/common', 'vendor/codemirror/lezer/common.js'],
        ['@lezer/highlight', 'vendor/codemirror/lezer/highlight.js'],
        ['@lezer/lr', 'vendor/codemirror/lezer/lr.js']
    ];
    for (const [specifier, relPath] of lezerPkgs) {
        imports[specifier] = {
            path: relPath,
            version: readInstalledVersion(specifier),
            range: '>=1.0.0 && <2.0.0'
        };
    }
    vendorJson.imports = imports;
    fs.writeFileSync(VENDOR_JSON_PATH, JSON.stringify(vendorJson, null, 4) + '\n', 'utf-8');
}

console.log(`✅ Built CodeMirror core, 3 Lezer entries, and ${fileExportsMap.size} language modules into ${OUT_DIR} (${bundledPkgDirs.size} package licenses)`);
