/**
 * Settings section: preview / config / RAW / LLM-listening tabs over the Host
 * panel service. Root-scoped; the owning session resolves from the session
 * list (current first, then any session).
 */
import type { ReactNode } from 'react';
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { PropsLocale, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import type { PanelActions } from './actions.ts';
export interface PanelSectionProps extends PropsLocale<'cfcp.panel'> {
    /** Close the settings panel (shell-owned). */
    close: () => void;
    /** Standard global prop: session-list selector. */
    useSessions: SnapshotSelectorHook<SessionListState>;
    /** Bound panel verbs. */
    actions: PanelActions;
}
/**
 * Render the settings section.
 * @param props - composed slot props.
 */
export declare function PanelSection(props: PanelSectionProps): ReactNode;
//# sourceMappingURL=PanelSection.d.ts.map