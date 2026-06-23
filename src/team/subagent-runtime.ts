// src/team/subagent-runtime.ts

/**
 * Qoder Subagent Runtime — lightweight team backend using Qoder CLI's
 * native subagent system (.qoder/agents/<name>.md).
 *
 * When the subagent backend is active (subagent is the default backend for qoder provider),
 * workers are spawned as `qodercli -p "..." --max-turns 50` invocations
 * that leverage Qoder's built-in subagent dispatch instead of tmux panes.
 *
 * The tmux-based backends remain the default fallback for all providers.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolveCliBinaryPath } from './model-contract.js';


/** Validate and sanitize agent name to prevent path traversal and YAML injection. */
function sanitizeAgentName(name: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid agent name "${name}": only alphanumeric, hyphens, and underscores allowed.`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration for a single subagent worker. */
export interface SubagentWorkerConfig {
  /** Short role name used as the agent filename, e.g. 'executor', 'architect'. */
  name: string;
  /** Absolute or cwd-relative path to the .qoder/agents/<name>.md file. */
  agentFile: string;
  /** Natural-language task description passed to the subagent. */
  task: string;
  /** Optional explicit model ID forwarded via --model. */
  model?: string;
  /** When true, spawn the worker in an isolated Qoder CLI worktree via --worktree. */
  useWorktree?: boolean;
}

/** Configuration for a full subagent-based team. */
export interface SubagentTeamConfig {
  teamName: string;
  workers: SubagentWorkerConfig[];
  /** Working directory for spawned processes. */
  cwd: string;
}

// ---------------------------------------------------------------------------
// Subagent config generation
// ---------------------------------------------------------------------------

/** Default tool set for a subagent. */
const DEFAULT_SUBAGENT_TOOLS: readonly string[] = [
  'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash',
];

/**
 * Generate a Qoder subagent config file content (.qoder/agents/<name>.md)
 * with YAML frontmatter from a role definition.
 *
 * The returned string is a complete markdown file ready to be written.
 */
export function generateSubagentConfig(
  role: string,
  systemPrompt: string,
  tools?: string[],
): string {
  const effectiveTools = tools && tools.length > 0 ? tools : DEFAULT_SUBAGENT_TOOLS;
  const toolsYaml = effectiveTools.map(t => `  - ${t}`).join('\n');

  return [
    '---',
    `name: ${sanitizeAgentName(role)}`,
    `description: OMC team worker — ${sanitizeAgentName(role)}`,
    'tools:',
    toolsYaml,
    '---',
    '',
    systemPrompt,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Command building
// ---------------------------------------------------------------------------

/**
 * Build the qodercli command-line arguments to invoke a subagent task.
 *
 * The resulting array is suitable for `spawn(binary, args)` where binary
 * is the resolved qodercli path.
 *
 * Pattern: `qodercli --yolo -p "<prompt>" --max-turns 50`
 */
export function buildSubagentCommand(worker: SubagentWorkerConfig): string[] {
  const prompt = `Use the ${worker.name} subagent to complete the following task:\n\n${worker.task}`;
  const args: string[] = [];
  if (worker.useWorktree) {
    args.push('--worktree', worker.name);
  }
  args.push('--yolo', '-p', prompt, '--max-turns', '50');
  if (worker.model) {
    args.push('--model', worker.model);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

/**
 * Check whether Qoder CLI's subagent system is available.
 *
 * Returns `true` when the `qodercli` binary can be resolved in PATH.
 * Qoder CLI's subagent system is always available — no opt-in required.
 */
export function isSubagentAvailable(): boolean {
  // Binary availability
  try {
    resolveCliBinaryPath('qodercli');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Agent file management
// ---------------------------------------------------------------------------

/**
 * Ensure the `.qoder/agents/` directory exists under `cwd` and write the
 * subagent config file for a given worker.
 *
 * Returns the absolute path to the written agent file.
 */
export function writeSubagentAgentFile(
  worker: SubagentWorkerConfig,
  systemPrompt: string,
  cwd: string,
  tools?: string[],
): string {
  const agentsDir = join(cwd, '.qoder', 'agents');
  mkdirSync(agentsDir, { recursive: true });

  const agentPath = worker.agentFile.startsWith('/')
    ? worker.agentFile
    : join(agentsDir, `${worker.name}.md`);

  const content = generateSubagentConfig(worker.name, systemPrompt, tools);
  writeFileSync(agentPath, content, 'utf-8');
  return agentPath;
}

// ---------------------------------------------------------------------------
// Team creation
// ---------------------------------------------------------------------------

/** Active child processes keyed by `${teamName}/${workerName}`. */
const activeProcesses = new Map<string, ChildProcess>();

/**
 * Create a subagent team by generating agent config files in `.qoder/agents/`
 * and launching `qodercli` processes for each worker.
 *
 * Each worker is spawned as an independent detached child process. The caller
 * is responsible for tracking PIDs via the team state files; this function
 * only creates the files and starts the processes.
 */
export async function createSubagentTeam(config: SubagentTeamConfig): Promise<void> {
  const { teamName, workers, cwd } = config;

  // Resolve qodercli binary once
  let binary: string;
  try {
    binary = resolveCliBinaryPath('qodercli');
  } catch {
    throw new Error(
      'qodercli binary not found in PATH. Install Qoder CLI to use the subagent backend.',
    );
  }

  // Ensure agents directory exists
  const agentsDir = join(cwd, '.qoder', 'agents');
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  // Spawn each worker
  for (const worker of workers) {
    const args = buildSubagentCommand(worker);
    const key = `${teamName}/${worker.name}`;

    const child = spawn(binary, args, {
      cwd,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        OMC_TEAM_WORKER: key,
        OMC_TEAM_NAME: teamName,
        OMC_WORKER_NAME: worker.name,
      },
    });

    // Unref so the parent process can exit without waiting
    child.unref();

    activeProcesses.set(key, child);

    child.on('error', (err) => {
      console.error(`[omc:subagent] Worker ${key} spawn error: ${err.message}`);
      activeProcesses.delete(key);
    });

    // Clean up on exit
    child.on('exit', () => {
      activeProcesses.delete(key);
    });
  }
}

/**
 * Return the PIDs of all active subagent workers for a team.
 */
export function getActiveSubagentPids(teamName: string): Array<{ worker: string; pid: number | undefined }> {
  const result: Array<{ worker: string; pid: number | undefined }> = [];
  for (const [key, child] of activeProcesses.entries()) {
    if (key.startsWith(`${teamName}/`)) {
      const worker = key.slice(teamName.length + 1);
      result.push({ worker, pid: child.pid });
    }
  }
  return result;
}

/**
 * Send SIGTERM to all active subagent workers for a team.
 */
export function stopSubagentTeam(teamName: string): void {
  for (const [key, child] of activeProcesses.entries()) {
    if (key.startsWith(`${teamName}/`)) {
      try {
        child.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
      activeProcesses.delete(key);
    }
  }
}

/**
 * Clear all entries from the active-process map. Intended for test cleanup
 * so module-level state does not leak between test cases.
 */
export function clearActiveProcesses(): void {
  activeProcesses.clear();
}

/** @internal Exposed for testing — do not use in production code. */
export const _testInternals = {
  activeProcesses,
};
