import { Context } from "@deepseek-ai/cordis";

//#region src/invariant.d.ts
/** Cordis plugin name of this invariant companion. */
declare const name = "custom-first-control-prompt-invariant";
/** Required service: the invariant registry. */
declare const inject: string[];
/**
 * Register the custom-first-control-prompt invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
declare const apply: (ctx: Context) => Promise<() => void>;
//#endregion
export { apply, inject, name };
//# sourceMappingURL=invariant.d.ts.map