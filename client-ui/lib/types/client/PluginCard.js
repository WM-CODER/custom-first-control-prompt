import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRequestsPoll } from "./poll.js";
import css from './panel.module.css';
/**
 * Render the plugin card.
 * @param props - composed slot props.
 */
export function PluginCard(props) {
    const { actions, useSessions, t } = props;
    const sessionId = useSessions(s => s.current ?? s.ids[0]);
    const { view, error, refresh } = useRequestsPoll(actions, sessionId);
    const dockVisible = view?.dockVisible ?? true;
    const paused = view?.paused ?? true;
    const disabled = sessionId === undefined;
    const run = (promise) => {
        void promise.then(() => { refresh(); });
    };
    return (_jsxs("div", { className: css['card'], children: [_jsx("div", { className: css['cardTitle'], children: t('cardTitle') }), disabled ? _jsx("div", { className: css['hint'], children: t('noSession') }) : null, _jsxs("label", { className: css['row'], children: [_jsx("input", { type: "checkbox", checked: dockVisible, disabled: disabled, onChange: event => { if (sessionId !== undefined)
                            run(actions.setDockVisible(sessionId, event.target.checked)); } }), _jsx("span", { children: t('toggleDock') })] }), _jsxs("label", { className: css['row'], children: [_jsx("input", { type: "checkbox", checked: !paused, disabled: disabled, onChange: event => { if (sessionId !== undefined)
                            run(actions.setPaused(sessionId, !event.target.checked)); } }), _jsx("span", { children: t('toggleListen') }), _jsxs("span", { className: css['count'], children: [view?.requests.length ?? 0, " ", t('requests')] })] }), error !== undefined ? _jsx("div", { className: css['error'], children: error }) : null] }));
}
//# sourceMappingURL=PluginCard.js.map