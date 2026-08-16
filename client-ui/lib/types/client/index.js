// Runtime: the generated Remote contribution for the Host panel service. The
// client bundle inlines it (generated /remote contributions are the one
// cross-package value import the purity gate allows, zod along with it) and
// apply() mounts it through ctx.remote.$mount — that mount is what PROVIDES
// the remote.custom-first-control-prompt-panel capability. The api-remotes
// assembly list only covers the core namespaces, so a third-party namespace
// must mount itself; otherwise the entry stays pending forever.
import TYPERT_REMOTE from '@deepseek-ai/dsh-custom-first-control-prompt/remote';
import { en, zh } from "./locales.js";
import { createPanelActions } from "./actions.js";
import { PanelSection } from "./PanelSection.js";
import { PluginCard } from "./PluginCard.js";
import { Dock } from "./Dock.js";
export { PanelSection } from "./PanelSection.js";
export { PluginCard } from "./PluginCard.js";
export { Dock } from "./Dock.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'cfcp.panel';
/**
 * Required services. The panel Remote namespace capability is deliberately
 * NOT injected: this plugin provides it itself via the $mount in apply.
 */
export const inject = ['slots', 'locale', 'remote'];
/**
 * Client plugin body: mount the panel's Remote namespace, then register the
 * settings section, the plugin card, and the composer dock strip once their
 * declaring slots are on the ledger.
 * @param ctx - client root context.
 */
export async function apply(ctx) {
    // Mount first: the slot faces below call the Remote verbs, and the mount is
    // what installs the capability those calls ride on. Mounting is client-local
    // (the contribution is inlined into this bundle), so it succeeds even on
    // deployments whose Host does not install the core plugin — calls then fail
    // with a service error instead of the plugin never activating.
    const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-custom-first-control-prompt: copy dictionaries');
    const actions = createPanelActions(ctx);
    // Registration-time text (the nav label thunk) rides the locale revision.
    const t = ctx.locale.bind(NS);
    const face = () => ({ actions });
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'cfcp-prompt',
        order: 30,
        locale: NS,
        label: () => t('panelTitle'),
        inject: face,
    }, PanelSection));
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        id: 'custom-first-control-prompt',
        order: 10,
        locale: NS,
        inject: face,
    }, PluginCard));
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'cfcp',
        order: 30,
        locale: NS,
        inject: face,
    }, Dock));
    return disposeRemote;
}
//# sourceMappingURL=index.js.map