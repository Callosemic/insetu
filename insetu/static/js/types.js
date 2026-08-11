/**
 * @typedef {Object} EntityData
 * @property {string} filepath - Absolute or VFS-relative path to the target resource (SSOT).
 * @property {string} [repoDir] - Target repository folder name.
 * @property {string} [titleText] - Human-readable display title.
 * @property {string} [entityType] - Polymorphic classification ('file', 'file:diff', 'task', 'citation', etc.).
 * @property {boolean} [isFS] - True if physical VFS disk asset, false if virtual artifact.
 */

/**
 * @typedef {Object} VFSMutation
 * @property {string} filepath - VFS-relative path affected by the mutation.
 * @property {'save'|'delete'|'move'} operation - Type of VFS operation performed.
 * @property {boolean} [ignore_ledger] - Whether to bypass ledger event broadcasts.
 */

/**
 * @typedef {Object} JobProgress
 * @property {string} jobId - Unique identifier for the background task.
 * @property {'pending'|'processing'|'completed'|'failed'} status - Current task state.
 * @property {string} [progress] - Human-readable status message.
 * @property {Object} [artifact] - Output payload upon task completion.
 */

/**
 * @typedef {Object} WorkspaceConfig
 * @property {string} [activeWorkspace] - ID of the active workspace profile.
 * @property {string[]} allRepos - List of target repository folder names.
 * @property {Set<string>} pinnedRepos - Active repository filter set.
 * @property {Object[]} targetConfigs - Array of raw repository configuration objects.
 */

/**
 * @typedef {Object} ExtensionSchema
 * @property {string} name - Human-readable extension title.
 * @property {string} version - SemVer version string.
 * @property {Object[]} [entityActions] - Array of polymorphic entity action configurations.
 * @property {Object[]} [layoutSlots] - Array of UI slot mount declarations.
 * @property {Object[]} [customEditors] - Array of file pattern editor matchers.
 */