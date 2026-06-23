/**
 * Agent-specific frontmatter utilities.
 *
 * Parses and generates YAML frontmatter for agent definition files
 * located in the `agents/` directory. Reuses the shared frontmatter
 * parser from `./frontmatter` for the heavy lifting.
 */

import { parseFrontmatter, parseFrontmatterList } from './frontmatter.js';

/**
 * Parsed agent frontmatter with structured fields.
 */
export interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string[];
  body: string;
}

/**
 * Parse YAML frontmatter from an agent markdown file.
 *
 * Extracts `name`, `description`, and `tools` from the frontmatter block.
 * The `tools` field is split by comma and trimmed. If `tools` is absent,
 * defaults to `['*']` (inherit all tools).
 *
 * Returns null if the file has no frontmatter or is missing the required
 * `name` field.
 */
export function parseAgentFrontmatter(content: string): AgentFrontmatter | null {
  const { metadata, body } = parseFrontmatter(content);

  const name = metadata.name?.trim();
  if (!name) {
    return null;
  }

  const description = metadata.description?.trim() ?? '';
  const tools = parseFrontmatterList(metadata.tools);

  return {
    name,
    description,
    tools: tools.length > 0 ? tools : ['*'],
    body,
  };
}

/**
 * Generate a YAML frontmatter block for an agent definition.
 *
 * @param name - Unique agent identifier (lowercase with hyphens).
 * @param description - One-line description used for subagent selection.
 * @param tools - Optional tool list. Omit or pass `['*']` for all tools.
 * @returns The frontmatter string including the opening/closing `---` delimiters
 *          and a trailing newline, ready to be prepended to agent markdown content.
 */
export function generateAgentFrontmatter(
  name: string,
  description: string,
  tools?: string[],
): string {
  const lines: string[] = ['---', `name: ${name}`, `description: ${description}`];

  if (tools && tools.length > 0 && !(tools.length === 1 && tools[0] === '*')) {
    lines.push(`tools: ${tools.join(', ')}`);
  }

  lines.push('---', '');
  return lines.join('\n');
}
