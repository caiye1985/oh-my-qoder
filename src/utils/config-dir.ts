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

import { join, normalize, parse, sep } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync } from 'fs';

/**
 * Strip a single trailing path separator (preserve filesystem root).
 * @internal Shared with scripts/lib/config-dir.{mjs,cjs,sh} — keep in sync.
 */
function stripTrailingSep(p: string): string {
  if (!p.endsWith(sep)) {
    return p;
  }
  return p === parse(p).root ? p : p.slice(0, -1);
}

/**
 * Resolve the Qoder configuration directory.
 *
 * Honours QODER_CONFIG_DIR (absolute path, or ~-prefixed) with fallback
 * to ~/.qoder.  Trailing separators are stripped; filesystem roots are
 * preserved.
 */
export function getQoderConfigDir(): string {
  const home = homedir();
  const configured = process.env.QODER_CONFIG_DIR?.trim();

  if (!configured) {
    // Backward compatibility: fall back to ~/.claude so existing Claude Code
    // installations that store data there continue to work out of the box.
    return stripTrailingSep(normalize(join(home, '.claude')));
  }

  if (configured === '~') {
    return stripTrailingSep(normalize(home));
  }

  if (configured.startsWith('~/') || configured.startsWith('~\\')) {
    return stripTrailingSep(normalize(join(home, configured.slice(2))));
  }

  return stripTrailingSep(normalize(configured));
}

/**
 * Resolve the OMC global configuration/cache directory under the active Claude
 * config dir. This keeps hook/updater/HUD caches aligned with QODER_CONFIG_DIR
 * instead of mixing in ~/.omc.
 */
export function getOmcConfigDir(): string {
  return join(getQoderConfigDir(), '.omc');
}

/** Resolve the canonical update-check cache file path. */
export function getUpdateCheckCachePath(): string {
  return join(getOmcConfigDir(), 'update-check.json');
}

// ---------------------------------------------------------------------------
// Three-layer AGENTS.md memory system
// ---------------------------------------------------------------------------

/** Filename for machine-local project AGENTS.md (not committed to git) */
export const AGENTS_LOCAL_FILENAME = 'AGENTS.local.md';

/** Filename for project-level AGENTS.md (committed to git) */
export const AGENTS_PROJECT_FILENAME = 'AGENTS.md';

/** Section markers injected between merged AGENTS.md layers */
const LAYER_MARKER_USER = '<!-- AGENTS.md layer: user (~/.qoder/AGENTS.md) -->';
const LAYER_MARKER_PROJECT = '<!-- AGENTS.md layer: project (./AGENTS.md) -->';
const LAYER_MARKER_LOCAL = '<!-- AGENTS.md layer: local (./AGENTS.local.md) -->';

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
export function getAgentsMdPaths(projectRoot: string): string[] {
  return [
    join(projectRoot, AGENTS_LOCAL_FILENAME),   // highest priority
    join(projectRoot, AGENTS_PROJECT_FILENAME), // project level
    join(getQoderConfigDir(), AGENTS_PROJECT_FILENAME), // user level, lowest priority
  ];
}

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
export function loadMergedAgentsMd(projectRoot: string): string | null {
  // Ordered lowest-priority first so higher-priority layers append last
  const layers: Array<{ path: string; label: string; content: string }> = [];

  const userPath = join(getQoderConfigDir(), AGENTS_PROJECT_FILENAME);
  const projectPath = join(projectRoot, AGENTS_PROJECT_FILENAME);
  const localPath = join(projectRoot, AGENTS_LOCAL_FILENAME);

  // Read each layer (skip if file does not exist or is empty)
  const readLayer = (filePath: string, label: string): void => {
    if (!existsSync(filePath)) return;
    try {
      const raw = readFileSync(filePath, 'utf-8').trim();
      if (raw.length > 0) {
        layers.push({ path: filePath, label, content: raw });
      }
    } catch {
      // Skip unreadable files silently
    }
  };

  // Lowest priority first
  readLayer(userPath, LAYER_MARKER_USER);
  readLayer(projectPath, LAYER_MARKER_PROJECT);
  readLayer(localPath, LAYER_MARKER_LOCAL);

  if (layers.length === 0) {
    return null;
  }

  // Single layer: return content without markers (backward compatible)
  if (layers.length === 1) {
    return layers[0].content;
  }

  // Multiple layers: concatenate with section markers
  return layers
    .map(layer => `${layer.label}\n${layer.content}`)
    .join('\n\n');
}
