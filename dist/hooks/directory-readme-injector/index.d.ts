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
export * from './types.js';
export * from './constants.js';
export * from './storage.js';
/**
 * Create directory README injector hook for Qoder.
 *
 * @param workingDirectory - The working directory for resolving paths
 * @returns Hook handlers for tool execution
 */
export declare function createDirectoryReadmeInjectorHook(workingDirectory: string): {
    /**
     * Process a tool execution and inject READMEs if relevant.
     */
    processToolExecution: (toolName: string, filePath: string, sessionID: string) => string;
    /**
     * Get context files (README.md, AGENTS.md, AGENTS.local.md) for a specific
     * file without marking as injected. Includes user-level AGENTS.md.
     */
    getContextFilesForFile: (filePath: string) => string[];
    /**
     * @deprecated Use getContextFilesForFile instead
     */
    getReadmesForFile: (filePath: string) => string[];
    /**
     * Clear session cache when session ends.
     */
    clearSession: (sessionID: string) => void;
    /**
     * Check if a tool triggers README injection.
     */
    isTrackedTool: (toolName: string) => boolean;
};
/**
 * Get README paths for a file (simple utility function).
 */
export declare function getReadmesForPath(filePath: string, workingDirectory?: string): string[];
//# sourceMappingURL=index.d.ts.map