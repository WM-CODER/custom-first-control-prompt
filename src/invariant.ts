/** Package-owned invariant companion. @module @deepseek-ai/dsh-custom-first-control-prompt/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-custom-first-control-prompt'

/** Cordis companion plugin name. */
export const name = 'custom-first-control-prompt-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the seed messages live only on the request path, so
 * the session log never carries plugin-attributed events to validate.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
