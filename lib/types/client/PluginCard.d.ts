/**
 * Plugin card inside the Plugins settings section: dock-strip visibility and
 * LLM-listening toggles with the live request count. Root-scoped, so the
 * owning session resolves from the session list (current first, then any).
 */
import type { ReactNode } from 'react';
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import type { PanelActions } from './actions.ts';
export interface PluginCardProps extends PropsLocale<'cfcp.panel'> {
    /** Standard global prop: session-list selector. */
    useSessions: SnapshotSelectorHook<SessionListState>;
    /** Bound panel verbs. */
    actions: PanelActions;
}
/**
 * Render the plugin card.
 * @param props - composed slot props.
 */
export declare function PluginCard(props: PluginCardProps): ReactNode;
//# sourceMappingURL=PluginCard.d.ts.map