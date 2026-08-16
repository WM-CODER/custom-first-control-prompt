/**
 * Runtime-invariant companion for `@deepseek-ai/dsh-custom-first-control-prompt`:
 * asserts the package-owned seeded-message shape — every user or assistant
 * message this plugin seeds carries exactly one text block that is either the
 * documented transcript frame or plain conversational seed text.
 *
 * @module @deepseek-ai/dsh-custom-first-control-prompt/invariant
 */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name of this invariant companion. */
export declare const name = "custom-first-control-prompt-invariant";
/** Required service: the invariant registry. */
export declare const inject: string[];
/**
 * Register the custom-first-control-prompt invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map