// src/team/subagent-runtime.ts

/**
 * Qoder Subagent Runtime — hybrid team orchestration.
 *
 * Two modes, auto-selected by scenario:
 *
 * 1. **Pipeline mode** (default for `/team`): ONE main qodercli session
 *    orchestrates by delegating to subagents via natural language.
 *    Qoder CLI manages subagent lifecycle internally.
 *    Perfect for sequential pipelines: plan → prd → exec → verify → fix.
 *
 * 2. **Parallel mode** (for `$ultrawork`): N independent qodercli
 *    processes spawned with --worktree isolation. True parallelism
 *    for independent tasks with no cross-task dependencies.
 *
 * Legacy tmux backends remain for non-Qoder providers (codex, gemini).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolveCliBinaryPath } from './model-contract.js';

// ---------------------------------------------------------------------------
// Agent name validation
// ---------------------------------------------------------------------------

function sanitizeAgentName(name: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid agent name "${name}": only alphanumeric, hyphens, and underscores allowed.`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubagentWorkerConfig {
  name: string;
  agentFile: string;
  task: string;
  model?: string;
  useWorktree?: boolean;
}

export interface SubagentTeamConfig {
  teamName: string;
  workers: SubagentWorkerConfig[];
  cwd: string;
  orchestratorModel?: string;
  maxTurns?: number;
}

export type OrchestrationMode = 'pipeline' | 'parallel';

// ---------------------------------------------------------------------------
// Subagent config file generation
// ---------------------------------------------------------------------------

const DEFAULT_SUBAGENT_TOOLS = 'Read,Write,Edit,Grep,Glob,Bash';

export function generateSubagentConfig(
  role: string,
  systemPrompt: string,
  tools?: string[],
): string {
  const toolsStr = tools && tools.length > 0 ? tools.join(',') : DEFAULT_SUBAGENT_TOOLS;
  return [
    '---',
    `name: ${sanitizeAgentName(role)}`,
    `description: OMC team worker — ${sanitizeAgentName(role)}`,
    `tools: ${toolsStr}`,
    '---',
    '',
    systemPrompt,
    '',
  ].join('\n');
}

export function writeSubagentAgentFile(
  worker: SubagentWorkerConfig,
  systemPrompt: string,
  cwd: string,
  tools?: string[],
): string {
  const agentsDir = join(cwd, '.qoder', 'agents');
  mkdirSync(agentsDir, { recursive: true });

  sanitizeAgentName(worker.name);
  const agentPath = worker.agentFile.startsWith('/')
    ? worker.agentFile
    : join(agentsDir, `${worker.name}.md`);

  writeFileSync(agentPath, generateSubagentConfig(worker.name, systemPrompt, tools), 'utf-8');
  return agentPath;
}

export function installTeamAgentFiles(
  workers: SubagentWorkerConfig[],
  cwd: string,
  systemPrompts: Record<string, string>,
  tools?: Record<string, string[]>,
): Record<string, string> {
  const agentsDir = join(cwd, '.qoder', 'agents');
  mkdirSync(agentsDir, { recursive: true });

  const result: Record<string, string> = {};
  for (const worker of workers) {
    sanitizeAgentName(worker.name);
    const agentPath = worker.agentFile.startsWith('/')
      ? worker.agentFile
      : join(agentsDir, `${worker.name}.md`);
    const prompt = systemPrompts[worker.name] ?? `You are the ${worker.name} for this team.`;
    writeFileSync(agentPath, generateSubagentConfig(worker.name, prompt, tools?.[worker.name]), 'utf-8');
    result[worker.name] = agentPath;
  }
  return result;
}

export function readAgentFile(agentPath: string): string | null {
  if (!existsSync(agentPath)) return null;
  return readFileSync(agentPath, 'utf-8');
}

// ---------------------------------------------------------------------------
// Pipeline mode — ONE main agent delegates via natural language
// ---------------------------------------------------------------------------

/**
 * Build a serial orchestration prompt for pipeline mode.
 *
 * Uses Qoder's 串联唤起 pattern:
 * "先使用 planner subagent 规划，再使用 executor subagent 实现，最后使用 verifier subagent 验证"
 */
export function buildPipelinePrompt(config: SubagentTeamConfig): string {
  const { workers } = config;
  if (workers.length === 0) return '';
  if (workers.length === 1) {
    return `帮我使用 ${workers[0].name} subagent 完成以下任务: ${workers[0].task}`;
  }

  const parts = workers.map((w, i) => {
    const desc = `使用 ${w.name} subagent 完成: ${w.task}`;
    if (i === 0) return `先${desc}`;
    if (i === workers.length - 1) return `最后${desc}`;
    return `再${desc}`;
  });

  const chain = parts.join('，');

  return [
    chain,
    '',
    '每个 subagent 完成后，请审查其输出再继续下一个。',
    '如果某个 subagent 的输出不符合预期，请给出更具体的指令重新委派。',
    '所有 subagent 完成后，请汇总所有结果。',
  ].join('\n');
}

export function buildPipelineCommand(config: SubagentTeamConfig): string[] {
  const prompt = buildPipelinePrompt(config);
  const maxTurns = config.maxTurns ?? 100;
  const args = ['--yolo', '-p', prompt, '--max-turns', String(maxTurns)];
  if (config.orchestratorModel) {
    args.push('--model', config.orchestratorModel);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Parallel mode — N independent processes with worktree isolation
// ---------------------------------------------------------------------------

const activeProcesses = new Map<string, ChildProcess>();

export function buildParallelCommand(worker: SubagentWorkerConfig): string[] {
  const args: string[] = [];
  if (worker.useWorktree) {
    args.push('--worktree', worker.name);
  }
  args.push('--yolo', '-p', worker.task, '--max-turns', '50');
  if (worker.model) {
    args.push('--model', worker.model);
  }
  return args;
}

/**
 * Spawn N independent qodercli processes for parallel execution.
 * Each worker gets its own process (and optionally its own worktree).
 */
export async function spawnParallelTeam(config: SubagentTeamConfig): Promise<void> {
  const { teamName, workers, cwd } = config;

  let binary: string;
  try {
    binary = resolveCliBinaryPath('qodercli');
  } catch {
    throw new Error('qodercli binary not found in PATH.');
  }

  for (const worker of workers) {
    const args = buildParallelCommand(worker);
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

    child.unref();
    activeProcesses.set(key, child);

    child.on('error', (err) => {
      console.error(`[omc:parallel] Worker ${key} error: ${err.message}`);
      activeProcesses.delete(key);
    });

    child.on('exit', () => {
      activeProcesses.delete(key);
    });
  }
}

// ---------------------------------------------------------------------------
// Auto-select mode
// ---------------------------------------------------------------------------

/**
 * Determine the best orchestration mode for a team config.
 *
 * Parallel mode (default) when:
 *   - Workers have independent tasks (typical team/ultrawork scenario)
 *   - Any worker uses worktree isolation
 *   - More than 3 workers
 *   Each worker gets its own qodercli process with independent TodoWrite,
 *   enabling true parallel execution without shared-state conflicts.
 *
 * Pipeline mode when:
 *   - Explicitly requested via environment variable OMC_PIPELINE_MODE=1
 *   - 2-3 workers with known sequential dependencies
 *   Subagents share the main agent's session (including TodoWrite),
 *   so only one subagent can be in_progress at a time.
 */
export function resolveOrchestrationMode(config: SubagentTeamConfig): OrchestrationMode {
  // Explicit pipeline opt-in
  if (process.env.OMC_PIPELINE_MODE === '1') return 'pipeline';

  // Worktree always needs separate processes
  const hasWorktree = config.workers.some(w => w.useWorktree);
  if (hasWorktree) return 'parallel';

  // Default: parallel for team scenarios (independent tasks, separate TodoWrite per worker)
  return 'parallel';
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export function isSubagentAvailable(): boolean {
  try {
    resolveCliBinaryPath('qodercli');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

export function getActiveSubagentPids(teamName: string): Array<{ worker: string; pid: number | undefined }> {
  const result: Array<{ worker: string; pid: number | undefined }> = [];
  for (const [key, child] of activeProcesses.entries()) {
    if (key.startsWith(`${teamName}/`)) {
      result.push({ worker: key.slice(teamName.length + 1), pid: child.pid });
    }
  }
  return result;
}

export function stopSubagentTeam(teamName: string): void {
  for (const [key, child] of activeProcesses.entries()) {
    if (key.startsWith(`${teamName}/`)) {
      try { child.kill('SIGTERM'); } catch { /* already exited */ }
      activeProcesses.delete(key);
    }
  }
}

export function clearActiveProcesses(): void {
  activeProcesses.clear();
}

export const _testInternals = { activeProcesses };

// ---------------------------------------------------------------------------
// Legacy compat (deprecated — use buildPipelineCommand / buildParallelCommand)
// ---------------------------------------------------------------------------

/** @deprecated Use buildPipelineCommand or buildParallelCommand instead. */
export function buildSubagentCommand(worker: SubagentWorkerConfig): string[] {
  return buildParallelCommand(worker);
}

/** @deprecated Use spawnParallelTeam or pipeline mode instead. */
export async function createSubagentTeam(config: SubagentTeamConfig): Promise<void> {
  return spawnParallelTeam(config);
}
