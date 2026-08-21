/**
 * custom-first-control-prompt panel surface, browser half. Registers the
 * settings section (preview/config/RAW/LLM-listening) and the composer dock
 * strip — all bound to the Host panel service through its Typert Remote
 * namespace. This package owns no business state: every value arrives from
 * the Host service.
 *
 * @module @wm-coders/dsh-client-ui-custom-first-control-prompt/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type CfcpKey } from './locales.ts';
export { PanelSection } from './PanelSection.tsx';
export { Dock } from './Dock.tsx';
export type { PanelActions } from './actions.ts';
export type { CfcpKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The custom-first-control-prompt panel's copy. */
        'cfcp.panel': CfcpKey;
    }
}
/**
 * Required services. The panel Remote namespace capability is deliberately
 * NOT injected: this plugin provides it itself via the $mount in apply.
 */
export declare const inject: string[];
/**
 * Client plugin body: mount the panel's Remote namespace, then register the
 * settings section and the composer dock strip once their declaring slots
 * are on the ledger.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map