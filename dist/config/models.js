import { validateAnthropicBaseUrl } from '../utils/ssrf-guard.js';
const DIRECT_MODEL_ENV_KEYS = ['QODER_MODEL', 'ANTHROPIC_MODEL'];
const INHERIT_TIER_PRIORITY = ['MEDIUM', 'HIGH', 'LOW'];
const QODER_TIER_NAMES = new Set(['lite', 'efficient', 'auto', 'performance', 'ultimate']);
/** @deprecated Claude tier aliases retained for backward compatibility in normalizeToQoderAlias. */
const CLAUDE_TIER_ALIASES = new Set(['sonnet', 'opus', 'haiku', 'fable']);
const TIER_ENV_KEYS = {
    LOW: [
        'OMC_MODEL_LOW',
        'QODER_BEDROCK_HAIKU_MODEL',
        'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    ],
    MEDIUM: [
        'OMC_MODEL_MEDIUM',
        'QODER_BEDROCK_SONNET_MODEL',
        'ANTHROPIC_DEFAULT_SONNET_MODEL',
    ],
    HIGH: [
        'OMC_MODEL_HIGH',
        'QODER_BEDROCK_OPUS_MODEL',
        'ANTHROPIC_DEFAULT_OPUS_MODEL',
    ],
};
/**
 * Canonical Qoder family defaults.
 *
 * Maps QoderModelTier keys to the Qoder CLI tier name or frontier model name
 * that should be used when no environment override is present.
 *
 * Also includes legacy Claude family keys (HAIKU, SONNET, OPUS, FABLE)
 * mapped to their Qoder equivalents for backward compatibility with
 * existing code that references these keys.
 */
export const QODER_FAMILY_DEFAULTS = {
    // Qoder tier keys (primary)
    LITE: 'lite',
    EFFICIENT: 'efficient',
    AUTO: 'auto',
    PERFORMANCE: 'performance',
    ULTIMATE: 'ultimate',
    // Legacy Claude keys (backward compat — mapped to Qoder equivalents)
    HAIKU: 'efficient',
    SONNET: 'auto',
    OPUS: 'performance',
    FABLE: 'ultimate',
};
/**
 * Canonical tier->model mapping used as built-in defaults.
 *
 * Qwen3.7-Max-DogFooding is the preferred base model — it is a powerful
 * internal free model. Higher tiers try their Qoder tier name first,
 * falling back to Qwen3.7-Max-DogFooding if the tier is unavailable.
 */
export const BUILTIN_TIER_MODEL_DEFAULTS = {
    LOW: 'lite',
    MEDIUM: 'Qwen3.7-Max-DogFooding',
    HIGH: 'ultimate',
};
/** Fallback model when a tier is unavailable or fails. */
export const QODER_DEFAULT_FALLBACK_MODEL = 'Qwen3.7-Max-DogFooding';
/**
 * High-reasoning variant hints per Qoder tier.
 *
 * Qoder uses `--reasoning-effort high` rather than model-name suffixes,
 * so these values are advisory only. They map each tier to the tier
 * that should be used when deep reasoning is desired at that level.
 */
export const QODER_FAMILY_HIGH_VARIANTS = {
    LITE: 'efficient',
    EFFICIENT: 'auto',
    AUTO: 'performance',
    PERFORMANCE: 'ultimate',
    ULTIMATE: 'ultimate',
};
/** Built-in defaults for external provider models */
export const BUILTIN_EXTERNAL_MODEL_DEFAULTS = {
    codexModel: 'gpt-5.3-codex',
    geminiModel: 'gemini-3.1-pro-preview',
    antigravityModel: 'Gemini 3.1 Pro (High)',
};
/**
 * Centralized Model ID Constants
 *
 * All default model IDs are defined here so they can be overridden
 * via environment variables without editing source code.
 *
 * Environment variables (highest precedence):
 *   OMC_MODEL_HIGH    - Model ID for HIGH tier (performance-class)
 *   OMC_MODEL_MEDIUM  - Model ID for MEDIUM tier (auto-class)
 *   OMC_MODEL_LOW     - Model ID for LOW tier (efficient-class)
 *
 * User config (~/.config/qoder-omc/config.jsonc) can also override
 * via `routing.tierModels` or per-agent `agents.<name>.model`.
 */
/**
 * Resolve the default model ID for a tier.
 *
 * Resolution order:
 * 1. OMC tier env vars (OMC_MODEL_HIGH / OMC_MODEL_MEDIUM / OMC_MODEL_LOW)
 * 2. Qoder provider env vars (for example Bedrock app-profile model IDs)
 * 3. Anthropic family-default env vars
 * 4. Built-in fallback
 *
 * User/project config overrides are applied later by the config loader
 * via deepMerge, so they take precedence over these defaults.
 */
function readEnvValue(key) {
    const value = process.env[key]?.trim();
    return value || undefined;
}
function resolveTierModelFromEnv(tier) {
    for (const key of TIER_ENV_KEYS[tier]) {
        const value = readEnvValue(key);
        if (value) {
            return value;
        }
    }
    return undefined;
}
function getDirectModelEnvValue() {
    for (const key of DIRECT_MODEL_ENV_KEYS) {
        const value = readEnvValue(key);
        if (value) {
            return value;
        }
    }
    return undefined;
}
function getProviderDetectionModelEnvValues() {
    const directModel = getDirectModelEnvValue();
    if (directModel) {
        return [directModel];
    }
    const values = new Set();
    for (const tier of INHERIT_TIER_PRIORITY) {
        const value = resolveTierModelFromEnv(tier);
        if (value) {
            values.add(value);
        }
    }
    return [...values];
}
function getDirectProviderDetectionModelEnvValues() {
    const directModel = getDirectModelEnvValue();
    return directModel ? [directModel] : [];
}
export function resolveInheritedModelFromEnv() {
    const directModel = getDirectModelEnvValue();
    if (directModel) {
        return directModel;
    }
    for (const tier of INHERIT_TIER_PRIORITY) {
        const value = resolveTierModelFromEnv(tier);
        if (value) {
            return value;
        }
    }
    return undefined;
}
export function hasTierModelEnvOverrides() {
    return Object.values(TIER_ENV_KEYS).some((keys) => keys.some((key) => {
        return Boolean(readEnvValue(key));
    }));
}
export function getDefaultModelHigh() {
    return resolveTierModelFromEnv('HIGH') || BUILTIN_TIER_MODEL_DEFAULTS.HIGH;
}
export function getDefaultModelMedium() {
    return resolveTierModelFromEnv('MEDIUM') || BUILTIN_TIER_MODEL_DEFAULTS.MEDIUM;
}
export function getDefaultModelLow() {
    return resolveTierModelFromEnv('LOW') || BUILTIN_TIER_MODEL_DEFAULTS.LOW;
}
/**
 * Get all default tier models as a record.
 * Each call reads current env vars, so changes are reflected immediately.
 */
export function getDefaultTierModels() {
    return {
        LOW: getDefaultModelLow(),
        MEDIUM: getDefaultModelMedium(),
        HIGH: getDefaultModelHigh(),
    };
}
/**
 * Resolve a Qoder model tier from an arbitrary model ID.
 *
 * Recognizes:
 * - Qoder tier names: 'lite', 'efficient', 'auto', 'performance', 'ultimate'
 * - Frontier model names: 'Qwen3.7-Max-DogFooding', 'GLM-5.2', etc. (returns null — pass through)
 * - Legacy Claude names for backward compat: 'haiku' -> EFFICIENT, 'sonnet' -> AUTO, 'opus' -> PERFORMANCE
 *
 * Returns null when the model ID is not recognized (treated as a pass-through frontier model).
 */
export function resolveQoderFamily(modelId) {
    const lower = modelId.toLowerCase();
    // Qoder tier names (exact match, case-insensitive)
    if (lower === 'lite')
        return 'LITE';
    if (lower === 'efficient')
        return 'EFFICIENT';
    if (lower === 'auto')
        return 'AUTO';
    if (lower === 'performance')
        return 'PERFORMANCE';
    if (lower === 'ultimate')
        return 'ULTIMATE';
    // Backward compat: legacy Claude tier names
    if (lower.includes('sonnet'))
        return 'AUTO';
    if (lower.includes('opus'))
        return 'PERFORMANCE';
    if (lower.includes('haiku'))
        return 'EFFICIENT';
    if (lower.includes('fable'))
        return 'ULTIMATE';
    return null;
}
/**
 * Resolve a high-reasoning variant hint from a model ID.
 * Returns the next tier up for advisory escalation, or null for unrecognized IDs.
 */
export function getClaudeHighVariantFromModel(modelId) {
    const family = resolveQoderFamily(modelId);
    return family ? QODER_FAMILY_HIGH_VARIANTS[family] : null;
}
/** Get built-in default model for an external provider */
export function getBuiltinExternalDefaultModel(provider) {
    if (provider === 'codex')
        return BUILTIN_EXTERNAL_MODEL_DEFAULTS.codexModel;
    if (provider === 'antigravity')
        return BUILTIN_EXTERNAL_MODEL_DEFAULTS.antigravityModel;
    return BUILTIN_EXTERNAL_MODEL_DEFAULTS.geminiModel;
}
function hasBedrockModelId(modelIds) {
    for (const modelId of modelIds) {
        if (/^((us|eu|ap|global)\.anthropic\.|anthropic\.claude)/i.test(modelId)) {
            return true;
        }
        if (/^arn:aws(-[^:]+)?:bedrock:/i.test(modelId)
            && /:(inference-profile|application-inference-profile)\//i.test(modelId)) {
            return true;
        }
    }
    return false;
}
/**
 * Detect whether Qoder is running on AWS Bedrock.
 *
 * Qoder sets QODER_USE_BEDROCK=1 when configured for Bedrock.
 * As a fallback, Bedrock model IDs use prefixed formats like:
 *   - us.anthropic.claude-sonnet-4-6-v1:0
 *   - global.anthropic.claude-sonnet-4-6-v1:0
 *   - anthropic.claude-3-haiku-20240307-v1:0
 */
export function isBedrock() {
    // Primary signal: Qoder's own env var
    if (process.env.QODER_USE_BEDROCK === '1') {
        return true;
    }
    // Fallback: detect Bedrock model ID patterns in the active model env value.
    return hasBedrockModelId(getProviderDetectionModelEnvValues());
}
/**
 * Check whether a model ID is a provider-specific identifier that should NOT
 * be normalized to a bare alias.
 *
 * Provider-specific IDs include:
 *   - Bedrock prefixed: us.anthropic.claude-*, global.anthropic.claude-*, anthropic.claude-*
 *   - Bedrock ARN: arn:aws:bedrock:...
 *   - Vertex AI: vertex_ai/...
 */
export function isProviderSpecificModelId(modelId) {
    // Bedrock prefixed formats (region.anthropic.claude-*, anthropic.claude-*)
    if (/^((us|eu|ap|global)\.anthropic\.|anthropic\.claude)/i.test(modelId)) {
        return true;
    }
    // Bedrock ARN formats
    if (/^arn:aws(-[^:]+)?:bedrock:/i.test(modelId)) {
        return true;
    }
    // Vertex AI prefixed format
    if (modelId.toLowerCase().startsWith('vertex_ai/')) {
        return true;
    }
    return false;
}
/**
 * Detect whether a model ID has a Qoder extended-context window suffix
 * (e.g., `[1m]`, `[200k]`) that is NOT a valid Bedrock API identifier.
 */
export function hasExtendedContextSuffix(modelId) {
    return /\[\d+[mk]\]$/i.test(modelId);
}
/**
 * Check whether a model ID is safe to pass as the `model` parameter when
 * spawning sub-agents on non-standard providers (Bedrock, Vertex AI).
 */
export function isSubagentSafeModelId(modelId) {
    return isProviderSpecificModelId(modelId) && !hasExtendedContextSuffix(modelId);
}
/**
 * Detect whether Qoder is running on Google Vertex AI.
 *
 * Qoder sets QODER_USE_VERTEX=1 when configured for Vertex AI.
 * Vertex model IDs typically use a "vertex_ai/" prefix.
 */
export function isVertexAI() {
    if (process.env.QODER_USE_VERTEX === '1') {
        return true;
    }
    // Fallback: detect vertex_ai/ prefix in the active model env value.
    return hasVertexModelId(getProviderDetectionModelEnvValues());
}
function hasVertexModelId(modelIds) {
    return modelIds.some((modelId) => modelId.toLowerCase().startsWith('vertex_ai/'));
}
function hasNonClaudeModelId(modelIds) {
    for (const modelId of modelIds) {
        const lower = modelId.toLowerCase();
        // A model ID is "non-Claude" if it is not a known Qoder tier name and
        // not a legacy Claude tier alias.
        if (!QODER_TIER_NAMES.has(lower) && !CLAUDE_TIER_ALIASES.has(lower)) {
            return true;
        }
    }
    return false;
}
/**
 * Detect whether OMC should avoid passing tier-specific model names
 * to the Agent tool and instead force inheritance.
 *
 * Returns true when:
 * - User explicitly set OMC_ROUTING_FORCE_INHERIT=true
 * - Running on AWS Bedrock — needs full Bedrock model IDs, not bare tier names
 * - Running on Google Vertex AI — needs full Vertex model paths
 * - A non-Qoder model ID is detected (CC Switch, LiteLLM, etc.)
 * - A custom ANTHROPIC_BASE_URL points to a non-Anthropic endpoint
 */
export function isNonClaudeProvider() {
    // Explicit opt-in: user has already set forceInherit via env var
    if (process.env.OMC_ROUTING_FORCE_INHERIT === 'true') {
        return true;
    }
    // AWS Bedrock: Claude via AWS, but needs full Bedrock model IDs
    if (isBedrock()) {
        return true;
    }
    // Google Vertex AI: Claude via GCP, needs full Vertex model paths
    if (isVertexAI()) {
        return true;
    }
    // Check the active model env value for non-Qoder model IDs.
    // Direct QODER_MODEL/ANTHROPIC_MODEL env vars intentionally short-circuit
    // lower-precedence tier defaults so stale tier envs do not force inheritance.
    if (hasNonClaudeModelId(getProviderDetectionModelEnvValues())) {
        return true;
    }
    // Custom base URL suggests a proxy/gateway (CC Switch, LiteLLM, OneAPI, etc.)
    const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
    if (baseUrl) {
        // Validate URL for SSRF protection
        const validation = validateAnthropicBaseUrl(baseUrl);
        if (!validation.allowed) {
            console.error(`[SSRF Guard] Rejecting ANTHROPIC_BASE_URL: ${validation.reason}`);
            // Treat invalid URLs as non-Claude to prevent potential SSRF
            return true;
        }
        if (!baseUrl.includes('anthropic.com')) {
            return true;
        }
    }
    return false;
}
/**
 * Detect whether provider state should globally force Agent/Task calls to
 * inherit the parent session model. Tier model env overrides intentionally do
 * not trigger this by themselves: they are configured per-tier defaults for
 * OMC routing, not proof that every delegated agent should drop its model.
 */
export function shouldAutoForceInherit() {
    if (process.env.OMC_ROUTING_FORCE_INHERIT === 'true') {
        return true;
    }
    if (process.env.QODER_USE_BEDROCK === '1') {
        return true;
    }
    if (process.env.QODER_USE_VERTEX === '1') {
        return true;
    }
    const directModelValues = getDirectProviderDetectionModelEnvValues();
    if (hasBedrockModelId(directModelValues)
        || hasVertexModelId(directModelValues)
        || hasNonClaudeModelId(directModelValues)) {
        return true;
    }
    const baseUrl = process.env.ANTHROPIC_BASE_URL || '';
    if (baseUrl) {
        const validation = validateAnthropicBaseUrl(baseUrl);
        if (!validation.allowed) {
            console.error(`[SSRF Guard] Rejecting ANTHROPIC_BASE_URL: ${validation.reason}`);
            return true;
        }
        if (!baseUrl.includes('anthropic.com')) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=models.js.map