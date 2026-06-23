/**
 * Directory README Injector Hook
 *
 * Automatically injects relevant README content from directories when files are accessed.
 * Walks up the directory tree from accessed files to find and inject README.md files.
 *
 * Supports the three-layer AGENTS.md memory system:
 *   1. `~/.qoder/AGENTS.md` (user-level global, lowest priority)
 *   2. `${project}/AGENTS.md` (project-level)
 *   3. `${project}/AGENTS.local.md` (machine-local, highest priority)
 *
 * Ported from oh-my-opencode's directory-readme-injector hook.
 * Adapted for Qoder's shell hook system.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { loadInjectedPaths, saveInjectedPaths, clearInjectedPaths, } from './storage.js';
import { CONTEXT_FILENAMES, TRACKED_TOOLS } from './constants.js';
import { getQoderConfigDir } from '../../utils/config-dir.js';
// Re-export submodules
export * from './types.js';
export * from './constants.js';
export * from './storage.js';
/**
 * Simple token estimation (4 chars per token)
 */
const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_README_TOKENS = 5000;
/**
 * Simple truncation for README content
 */
function truncateContent(content, maxTokens = DEFAULT_MAX_README_TOKENS) {
    const estimatedTokens = Math.ceil(content.length / CHARS_PER_TOKEN);
    if (estimatedTokens <= maxTokens) {
        return { result: content, truncated: false };
    }
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const truncated = content.slice(0, maxChars);
    return {
        result: truncated,
        truncated: true,
    };
}
/**
 * Create directory README injector hook for Qoder.
 *
 * @param workingDirectory - The working directory for resolving paths
 * @returns Hook handlers for tool execution
 */
export function createDirectoryReadmeInjectorHook(workingDirectory) {
    const sessionCaches = new Map();
    function getSessionCache(sessionID) {
        if (!sessionCaches.has(sessionID)) {
            sessionCaches.set(sessionID, loadInjectedPaths(sessionID));
        }
        return sessionCaches.get(sessionID);
    }
    function resolveFilePath(filePath) {
        if (!filePath)
            return null;
        if (isAbsolute(filePath))
            return filePath;
        return resolve(workingDirectory, filePath);
    }
    /**
     * Find context files (README.md, AGENTS.md, AGENTS.local.md) by walking up
     * the directory tree. Returns paths in order from root to leaf.
     *
     * Also includes the user-level `~/.qoder/AGENTS.md` when it exists and has
     * not yet been injected in this session.
     */
    function findContextFilesUp(startDir) {
        const found = [];
        let current = startDir;
        while (true) {
            for (const filename of CONTEXT_FILENAMES) {
                const filePath = join(current, filename);
                if (existsSync(filePath)) {
                    found.push(filePath);
                }
            }
            // Stop at working directory root
            if (current === workingDirectory)
                break;
            const parent = dirname(current);
            // Stop at filesystem root
            if (parent === current)
                break;
            // Stop if we've gone outside the working directory
            if (!parent.startsWith(workingDirectory))
                break;
            current = parent;
        }
        // Return in order from root to leaf (reverse the array)
        return found.reverse();
    }
    /**
     * Get the user-level AGENTS.md path (`~/.qoder/AGENTS.md`).
     */
    function getUserLevelAgentsMdPath() {
        const userAgentsPath = join(getQoderConfigDir(), 'AGENTS.md');
        if (existsSync(userAgentsPath)) {
            return userAgentsPath;
        }
        return null;
    }
    /**
     * Get a human-readable label for a context file.
     */
    function getContextLabel(filePath) {
        if (filePath.endsWith('AGENTS.local.md'))
            return 'Local AGENTS (machine-specific)';
        if (filePath.endsWith('AGENTS.md')) {
            // Distinguish user-level from project-level
            const userAgentsPath = join(getQoderConfigDir(), 'AGENTS.md');
            if (filePath === userAgentsPath)
                return 'User AGENTS (global)';
            return 'Project AGENTS';
        }
        return 'Project README';
    }
    /**
     * Process a file path and return context file content to inject.
     * Finds README.md, AGENTS.md, and AGENTS.local.md files walking up the
     * directory tree, plus the user-level ~/.qoder/AGENTS.md.
     */
    function processFilePathForContextFiles(filePath, sessionID) {
        const resolved = resolveFilePath(filePath);
        if (!resolved)
            return '';
        const dir = dirname(resolved);
        const cache = getSessionCache(sessionID);
        const contextPaths = findContextFilesUp(dir);
        // Prepend user-level AGENTS.md (lowest priority, injected first)
        const userAgentsPath = getUserLevelAgentsMdPath();
        if (userAgentsPath && !cache.has(userAgentsPath)) {
            contextPaths.unshift(userAgentsPath);
        }
        let output = '';
        for (const contextPath of contextPaths) {
            // Track by full file path to allow both README.md and AGENTS.md
            // from the same directory to be independently injected
            if (cache.has(contextPath))
                continue;
            try {
                const content = readFileSync(contextPath, 'utf-8');
                const { result, truncated } = truncateContent(content);
                const truncationNotice = truncated
                    ? `\n\n[Note: Content was truncated to save context window space. For full context, please read the file directly: ${contextPath}]`
                    : '';
                const label = getContextLabel(contextPath);
                output += `\n\n[${label}: ${contextPath}]\n${result}${truncationNotice}`;
                cache.add(contextPath);
            }
            catch {
                // Skip files that can't be read
            }
        }
        if (output) {
            saveInjectedPaths(sessionID, cache);
        }
        return output;
    }
    return {
        /**
         * Process a tool execution and inject READMEs if relevant.
         */
        processToolExecution: (toolName, filePath, sessionID) => {
            if (!TRACKED_TOOLS.includes(toolName.toLowerCase())) {
                return '';
            }
            return processFilePathForContextFiles(filePath, sessionID);
        },
        /**
         * Get context files (README.md, AGENTS.md, AGENTS.local.md) for a specific
         * file without marking as injected. Includes user-level AGENTS.md.
         */
        getContextFilesForFile: (filePath) => {
            const resolved = resolveFilePath(filePath);
            if (!resolved)
                return [];
            const dir = dirname(resolved);
            const contextPaths = findContextFilesUp(dir);
            // Prepend user-level AGENTS.md
            const userAgentsPath = getUserLevelAgentsMdPath();
            if (userAgentsPath) {
                contextPaths.unshift(userAgentsPath);
            }
            return contextPaths;
        },
        /**
         * @deprecated Use getContextFilesForFile instead
         */
        getReadmesForFile: (filePath) => {
            const resolved = resolveFilePath(filePath);
            if (!resolved)
                return [];
            const dir = dirname(resolved);
            return findContextFilesUp(dir);
        },
        /**
         * Clear session cache when session ends.
         */
        clearSession: (sessionID) => {
            sessionCaches.delete(sessionID);
            clearInjectedPaths(sessionID);
        },
        /**
         * Check if a tool triggers README injection.
         */
        isTrackedTool: (toolName) => {
            return TRACKED_TOOLS.includes(toolName.toLowerCase());
        },
    };
}
/**
 * Get README paths for a file (simple utility function).
 */
export function getReadmesForPath(filePath, workingDirectory) {
    const cwd = workingDirectory || process.cwd();
    const hook = createDirectoryReadmeInjectorHook(cwd);
    return hook.getReadmesForFile(filePath);
}
//# sourceMappingURL=index.js.map