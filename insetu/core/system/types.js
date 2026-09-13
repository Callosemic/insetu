/**
 * @typedef {Object} EntityData
 * @property {string} filepath - Absolute or VFS-relative path to the target resource (SSOT).
 * @property {string} [repoDir] - Target repository folder name (e.g., "axoneme").
 * @property {string} [titleText] - Human-readable display title.
 * @property {string} [entityType] - Polymorphic classification ('file', 'file:diff', 'task', 'citation', etc.).
 * @property {boolean} [isFS] - True if physical VFS disk asset, false if virtual artifact.
 */