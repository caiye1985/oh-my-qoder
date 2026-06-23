/**
 * Qoder Configuration Directory Resolution
 *
 * Resolves the active Qoder configuration directory, honouring
 * QODER_CONFIG_DIR (absolute path, or ~-prefixed) with fallback to
 * ~/.qoder.  Trailing separators are stripped; filesystem roots are
 * preserved.
 *
 * Multi-surface mirrors (keep in sync):
 *   scripts/lib/config-dir.mjs   — ESM hook/HUD runtime
 *   scripts/lib/config-dir.cjs   — CJS bridge runtime
 *   scripts/lib/config-dir.sh    — POSIX shell runtime
 */
/**
 * Resolve the Qoder configuration directory.
 *
 * Honours QODER_CONFIG_DIR (absolute path, or ~-prefixed) with fallback
 * to ~/.qoder.  Trailing separators are stripped; filesystem roots are
 * preserved.
 */
export declare function getQoderConfigDir(): string;
/**
 * Resolve the OMC global configuration/cache directory under the active Claude
 * config dir. This keeps hook/updater/HUD caches aligned with QODER_CONFIG_DIR
 * instead of mixing in ~/.omc.
 */
export declare function getOmcConfigDir(): string;
/** Resolve the canonical update-check cache file path. */
export declare function getUpdateCheckCachePath(): string;
/** Filename for machine-local project AGENTS.md (not committed to git) */
export declare const AGENTS_LOCAL_FILENAME = "AGENTS.local.md";
/** Filename for project-level AGENTS.md (committed to git) */
export declare const AGENTS_PROJECT_FILENAME = "AGENTS.md";
/**
 * Return the three AGENTS.md file paths in priority order (highest first).
 *
 * Priority: local > project > user
 *   1. `${projectRoot}/AGENTS.local.md` — machine-local, not committed
 *   2. `${projectRoot}/AGENTS.md`       — project-level, committed
 *   3. `~/.qoder/AGENTS.md`             — user-level global config
 *
 * @param projectRoot - Absolute path to the current project root
 * @returns Array of absolute file paths in priority order (highest first)
 */
export declare function getAgentsMdPaths(projectRoot: string): string[];
/**
 * Read and merge all three AGENTS.md layers into a single string.
 *
 * Merge strategy: layers are concatenated lowest-priority first so that
 * higher-priority content appears later in the output (and thus takes
 * precedence when the model reads top-to-bottom). Each layer is wrapped
 * with a section marker for traceability.
 *
 * Returns `null` when no layer contains content.
 *
 * @param projectRoot - Absolute path to the current project root
 * @returns Merged content string, or null if no layers have content
 */
export declare function loadMergedAgentsMd(projectRoot: string): string | null;
//# sourceMappingURL=config-dir.d.ts.map