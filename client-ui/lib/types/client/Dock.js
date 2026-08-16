import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Composer dock strip: a collapsible bar above the message input showing the
 * panel's live request-listening state. Listening defaults to off; the strip
 * offers start/stop, clear, expand/collapse, and hide (re-enabled from the
 * plugin card in settings). All state arrives from the Host panel service.
 */
import { useState } from 'react';
import { useRequestsPoll } from "./poll.js";
import css from './panel.module.css';
/** Collapsed-strip request summary: model and message count. */
function requestSummary(request) {
    const model = request.model.length > 0 ? request.model : '?';
    return `${model} · ${request.messages.length}`;
}
/** One captured request body: system prompt then the message list. */
function RequestBody(props) {
    const { request, t } = props;
    return (_jsxs("div", { className: css['requestBody'], children: [_jsxs("div", { className: css['requestMeta'], children: [_jsxs("span", { children: [t('requestModel'), ": ", request.model || '—'] }), _jsxs("span", { children: [t('requestProvider'), ": ", request.provider || '—'] }), _jsxs("span", { children: [t('requestTime'), ": ", new Date(request.time).toLocaleTimeString()] })] }), request.system.length > 0
                ? (_jsxs(_Fragment, { children: [_jsx("div", { className: css['blockLabel'], children: t('requestSystem') }), _jsx("pre", { className: css['mono'], children: request.system })] }))
                : null, request.messages.length > 0
                ? (_jsxs(_Fragment, { children: [_jsx("div", { className: css['blockLabel'], children: t('requestMessages') }), request.messages.map((message, at) => (_jsxs("pre", { className: css['mono'], children: [_jsx("span", { className: css['role'], children: message.role }), ' ', message.text] }, at)))] }))
                : null] }));
}
/**
 * Render the dock strip. Hidden state (Host-side `dockVisible` false) renders
 * nothing; the strip comes back through the plugin card in settings.
 * @param props - composed slot props.
 */
export function Dock(props) {
    const { sessionId, actions, t } = props;
    const [expanded, setExpanded] = useState(false);
    const { view, error, refresh } = useRequestsPoll(actions, sessionId);
    if (view !== undefined && !view.dockVisible)
        return null;
    const paused = view?.paused ?? true;
    const requests = view?.requests ?? [];
    const latest = requests[requests.length - 1];
    const run = (promise) => {
        void promise.then(() => { refresh(); });
    };
    return (_jsxs("div", { className: css['dock'], children: [_jsxs("div", { className: css['dockHeader'], children: [_jsxs("button", { type: "button", className: css['dockTitle'], onClick: () => { setExpanded(value => !value); }, "aria-expanded": expanded, title: expanded ? t('collapse') : t('expand'), children: [_jsx("span", { children: t('dockLabel') }), _jsx("span", { className: paused ? css['badgeOff'] : css['badgeOn'], children: paused ? t('listeningOff') : t('listeningOn') }), _jsxs("span", { className: css['count'], children: [requests.length, " ", t('requests')] })] }), _jsxs("div", { className: css['dockButtons'], children: [_jsx("button", { type: "button", onClick: () => { run(actions.setPaused(sessionId, !paused)); }, children: paused ? t('start') : t('stop') }), _jsx("button", { type: "button", onClick: () => { run(actions.clearRequests(sessionId)); }, children: t('clear') }), _jsx("button", { type: "button", onClick: () => { run(actions.setDockVisible(sessionId, false)); }, children: t('dockHide') })] })] }), expanded
                ? (_jsxs("div", { className: css['dockBody'], children: [error !== undefined ? _jsx("div", { className: css['error'], children: error }) : null, latest === undefined
                            ? _jsx("div", { className: css['hint'], children: t('emptyRequests') })
                            : (_jsxs("div", { children: [_jsxs("div", { className: css['requestSummary'], children: ["#", latest.id, " ", requestSummary(latest)] }), _jsx(RequestBody, { request: latest, t: t })] }))] }))
                : null] }));
}
//# sourceMappingURL=Dock.js.map