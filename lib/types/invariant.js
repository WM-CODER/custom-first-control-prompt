/** Package-owned invariant companion. @module @wm-coder/dsh-custom-first-control-prompt/invariant */
const PACKAGE_NAME = '@wm-coder/dsh-custom-first-control-prompt';
/** Cordis companion plugin name. */
export const name = 'custom-first-control-prompt-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the seed messages live only on the request path, so
 * the session log never carries plugin-attributed events to validate.
 */
const install = () => { };
/** Register this package's invariant companion. */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map