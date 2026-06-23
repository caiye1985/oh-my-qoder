export type ModelTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type QoderModelTier = 'LITE' | 'EFFICIENT' | 'AUTO' | 'PERFORMANCE' | 'ULTIMATE';
/** @deprecated Use QoderModelTier instead. Retained for backward compatibility. */
export type ClaudeModelFamily = QoderModelTier;
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
export declare const QODER_FAMILY_DEFAULTS: {
    readonly LITE: "lite";
    readonly EFFICIENT: "efficient";
    readonly AUTO: "auto";
    readonly PERFORMANCE: "performance";
    readonly ULTIMATE: "ultimate";
    readonly HAIKU: "efficient";
    readonly SONNET: "auto";
    readonly OPUS: "performance";
    readonly FABLE: "ultimate";
};
/**
 * Canonical tier->model mapping used as built-in defaults.
 *
 * Qwen3.7-Max-DogFooding is the preferred base model — it is a powerful
 * internal free model. Higher tiers try their Qoder tier name first,
 * falling back to Qwen3.7-Max-DogFooding if the tier is unavailable.
 */
export declare const BUILTIN_TIER_MODEL_DEFAULTS: Record<ModelTier, string>;
/** Fallback model when a tier is unavailable or fails. */
export declare const QODER_DEFAULT_FALLBACK_MODEL = "Qwen3.7-Max-DogFooding";
/**
 * High-reasoning variant hints per Qoder tier.
 *
 * Qoder uses `--reasoning-effort high` rather than model-name suffixes,
 * so these values are advisory only. They map each tier to the tier
 * that should be used when deep reasoning is desired at that level.
 */
export declare const QODER_FAMILY_HIGH_VARIANTS: Record<QoderModelTier, string>;
/** Built-in defaults for external provider models */
export declare const BUILTIN_EXTERNAL_MODEL_DEFAULTS: {
    readonly codexModel: "gpt-5.3-codex";
    readonly geminiModel: "gemini-3.1-pro-preview";
    readonly antigravityModel: "Gemini 3.1 Pro (High)";
};
export declare function resolveInheritedModelFromEnv(): string | undefined;
export declare function hasTierModelEnvOverrides(): boolean;
export declare function getDefaultModelHigh(): string;
export declare function getDefaultModelMedium(): string;
export declare function getDefaultModelLow(): string;
/**
 * Get all default tier models as a record.
 * Each call reads current env vars, so changes are reflected immediately.
 */
export declare function getDefaultTierModels(): Record<ModelTier, string>;
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
export declare function resolveQoderFamily(modelId: string): QoderModelTier | null;
/**
 * Resolve a high-reasoning variant hint from a model ID.
 * Returns the next tier up for advisory escalation, or null for unrecognized IDs.
 */
export declare function getClaudeHighVariantFromModel(modelId: string): string | null;
/** Get built-in default model for an external provider */
export declare function getBuiltinExternalDefaultModel(provider: 'codex' | 'gemini' | 'antigravity'): string;
/**
 * Detect whether Qoder is running on AWS Bedrock.
 *
 * Qoder sets QODER_USE_BEDROCK=1 when configured for Bedrock.
 * As a fallback, Bedrock model IDs use prefixed formats like:
 *   - us.anthropic.claude-sonnet-4-6-v1:0
 *   - global.anthropic.claude-sonnet-4-6-v1:0
 *   - anthropic.claude-3-haiku-20240307-v1:0
 */
export declare function isBedrock(): boolean;
/**
 * Check whether a model ID is a provider-specific identifier that should NOT
 * be normalized to a bare alias.
 *
 * Provider-specific IDs include:
 *   - Bedrock prefixed: us.anthropic.claude-*, global.anthropic.claude-*, anthropic.claude-*
 *   - Bedrock ARN: arn:aws:bedrock:...
 *   - Vertex AI: vertex_ai/...
 */
export declare function isProviderSpecificModelId(modelId: string): boolean;
/**
 * Detect whether a model ID has a Qoder extended-context window suffix
 * (e.g., `[1m]`, `[200k]`) that is NOT a valid Bedrock API identifier.
 */
export declare function hasExtendedContextSuffix(modelId: string): boolean;
/**
 * Check whether a model ID is safe to pass as the `model` parameter when
 * spawning sub-agents on non-standard providers (Bedrock, Vertex AI).
 */
export declare function isSubagentSafeModelId(modelId: string): boolean;
/**
 * Detect whether Qoder is running on Google Vertex AI.
 *
 * Qoder sets QODER_USE_VERTEX=1 when configured for Vertex AI.
 * Vertex model IDs typically use a "vertex_ai/" prefix.
 */
export declare function isVertexAI(): boolean;
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
export declare function isNonClaudeProvider(): boolean;
/**
 * Detect whether provider state should globally force Agent/Task calls to
 * inherit the parent session model. Tier model env overrides intentionally do
 * not trigger this by themselves: they are configured per-tier defaults for
 * OMC routing, not proof that every delegated agent should drop its model.
 */
export declare function shouldAutoForceInherit(): boolean;
//# sourceMappingURL=models.d.ts.map