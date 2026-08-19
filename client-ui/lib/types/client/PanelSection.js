import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Settings section: preview / config / RAW / LLM-listening tabs over the Host
 * panel service. Root-scoped; the owning session resolves from the session
 * list (current first, then any session).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRequestsPoll } from "./poll.js";
import css from './panel.module.css';
/** Empty editable config view. */
function emptyConfig() {
    return { found: false, sections: [], history: [], includeSubagents: false };
}
/**
 * Render the settings section.
 * @param props - composed slot props.
 */
export function PanelSection(props) {
    const { actions, useSessions, t } = props;
    const sessionId = useSessions(s => s.current ?? s.ids[0]);
    const [tab, setTab] = useState('preview');
    const [config, setConfig] = useState(() => emptyConfig());
    const [raw, setRaw] = useState('');
    const [path, setPath] = useState('');
    const [preview, setPreview] = useState([]);
    const [error, setError] = useState(undefined);
    const [notice, setNotice] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const [clearArmed, setClearArmed] = useState(false);
    const { view: requestsView, error: requestsError, refresh: refreshRequests } = useRequestsPoll(actions, sessionId);
    const loadConfig = useCallback(async () => {
        if (sessionId === undefined)
            return;
        const result = await actions.read(sessionId);
        if (result.ok) {
            setConfig(result.value.parsed);
            setRaw(result.value.raw);
            setPath(result.value.path);
            setError(undefined);
        }
        else {
            setError(result.error.message);
        }
    }, [actions, sessionId]);
    const loadPreview = useCallback(async () => {
        if (sessionId === undefined)
            return;
        const result = await actions.assemble(sessionId);
        if (result.ok) {
            setPreview(result.value.sections);
            setError(undefined);
        }
        else {
            setError(result.error.message);
        }
    }, [actions, sessionId]);
    useEffect(() => {
        setError(undefined);
        setNotice(undefined);
        if (sessionId === undefined)
            return;
        if (tab === 'config' || tab === 'raw')
            void loadConfig();
        else if (tab === 'preview')
            void loadPreview();
    }, [tab, sessionId, actions, loadConfig, loadPreview]);
    const save = async () => {
        if (sessionId === undefined)
            return;
        setBusy(true);
        setNotice(undefined);
        const result = await actions.write(sessionId, config);
        setBusy(false);
        if (result.ok) {
            setNotice(t('saved'));
            setError(undefined);
            await loadConfig();
        }
        else {
            setError(result.error.message);
        }
    };
    const clearAll = async () => {
        if (sessionId === undefined)
            return;
        setBusy(true);
        setNotice(undefined);
        const result = await actions.clear(sessionId);
        setBusy(false);
        setClearArmed(false);
        if (result.ok) {
            setNotice(t('saved'));
            setError(undefined);
            await loadConfig();
        }
        else {
            setError(result.error.message);
        }
    };
    const importRaw = async () => {
        if (sessionId === undefined)
            return;
        setBusy(true);
        setNotice(undefined);
        const result = await actions.importRaw(sessionId, raw);
        setBusy(false);
        if (result.ok) {
            setNotice(t('saved'));
            setError(undefined);
            await loadConfig();
        }
        else {
            setError(result.error.message);
        }
    };
    const setSection = (at, patch) => {
        setConfig(previous => ({
            ...previous,
            sections: previous.sections.map((section, index) => index === at ? { ...section, ...patch } : section),
        }));
    };
    const setPair = (at, patch) => {
        setConfig(previous => ({
            ...previous,
            history: previous.history.map((pair, index) => index === at ? { ...pair, ...patch } : pair),
        }));
    };
    const tabs = [
        { key: 'preview', label: 'tabPreview' },
        { key: 'config', label: 'tabConfig' },
        { key: 'raw', label: 'tabRaw' },
        { key: 'requests', label: 'tabRequests' },
    ];
    const renderTab = () => {
        if (sessionId === undefined)
            return _jsx("div", { className: css['hint'], children: t('noSession') });
        switch (tab) {
            case 'preview': {
                // The registered-section list is assembler state (static text, before
                // interpolation, without neighboring sections); the real system prompt
                // only exists inside a captured request, so show the latest one.
                const latestCaptured = [...(requestsView?.requests ?? [])].reverse()
                    .find(request => request.system.length > 0);
                return (_jsxs("div", { children: [_jsx("div", { className: css['blockLabel'], children: t('previewSections') }), _jsx("div", { className: css['hint'], children: t('previewNote') }), preview.length === 0
                            ? _jsx("div", { className: css['hint'], children: t('previewEmpty') })
                            : preview.map(section => (_jsxs("div", { className: css['previewSection'], children: [_jsxs("div", { className: css['blockLabel'], children: [section.name, " (order ", section.order, ")"] }), _jsx("pre", { className: css['mono'], children: section.text })] }, section.name))), _jsx("div", { className: css['blockLabel'], children: t('previewRealSystem') }), latestCaptured === undefined
                            ? _jsx("div", { className: css['hint'], children: t('previewRealSystemEmpty') })
                            : _jsx("pre", { className: css['mono'], children: latestCaptured.system })] }));
            }
            case 'config': {
                return (_jsxs("div", { children: [_jsx("div", { className: css['blockLabel'], children: "sections" }), config.sections.map((section, at) => (_jsxs("div", { className: css['editorRow'], children: [_jsxs("label", { className: css['field'], children: [_jsx("span", { children: t('sectionName') }), _jsx("input", { value: section.name, onChange: (event) => { setSection(at, { name: event.target.value }); } })] }), _jsxs("label", { className: css['field'], children: [_jsx("span", { children: t('sectionOrder') }), _jsx("input", { type: "number", value: section.order, onChange: (event) => {
                                                const order = Number(event.target.value);
                                                setSection(at, { order: Number.isFinite(order) ? order : 0 });
                                            } })] }), _jsxs("label", { className: css['field'], children: [_jsx("span", { children: t('sectionEnabled') }), _jsx("input", { type: "checkbox", checked: section.enabled, onChange: (event) => { setSection(at, { enabled: event.target.checked }); } })] }), _jsxs("label", { className: css['fieldWide'], children: [_jsx("span", { children: t('sectionText') }), _jsx("textarea", { value: section.text, onChange: (event) => { setSection(at, { text: event.target.value }); } })] }), _jsx("button", { type: "button", className: css['danger'], onClick: () => {
                                        setConfig(previous => ({
                                            ...previous,
                                            sections: previous.sections.filter((_s, index) => index !== at),
                                        }));
                                    }, children: t('remove') })] }, at))), _jsx("button", { type: "button", onClick: () => {
                                setConfig(previous => ({
                                    ...previous,
                                    sections: [...previous.sections, { name: '', order: previous.sections.length, text: '', enabled: true }],
                                }));
                            }, children: t('addSection') }), _jsx("div", { className: css['blockLabel'], children: "history" }), config.history.map((pair, at) => (_jsxs("div", { className: css['editorRow'], children: [_jsxs("label", { className: css['fieldWide'], children: [_jsx("span", { children: t('historyUser') }), _jsx("textarea", { value: pair.user, onChange: (event) => { setPair(at, { user: event.target.value }); } })] }), _jsxs("label", { className: css['fieldWide'], children: [_jsx("span", { children: t('historyAssistant') }), _jsx("textarea", { value: pair.assistant, onChange: (event) => { setPair(at, { assistant: event.target.value }); } })] }), _jsx("button", { type: "button", className: css['danger'], onClick: () => {
                                        setConfig(previous => ({
                                            ...previous,
                                            history: previous.history.filter((_p, index) => index !== at),
                                        }));
                                    }, children: t('remove') })] }, at))), _jsx("button", { type: "button", onClick: () => {
                                setConfig(previous => ({
                                    ...previous,
                                    history: [...previous.history, { user: '', assistant: '' }],
                                }));
                            }, children: t('addPair') }), _jsxs("label", { className: css['row'], children: [_jsx("input", { type: "checkbox", checked: config.includeSubagents, onChange: (event) => { setConfig(previous => ({ ...previous, includeSubagents: event.target.checked })); } }), _jsx("span", { children: t('includeSubagents') })] }), _jsxs("div", { className: css['buttonsRow'], children: [_jsx("button", { type: "button", disabled: busy, onClick: () => { void save(); }, children: t('save') }), _jsx("button", { type: "button", disabled: busy, className: clearArmed ? css['danger'] : '', onClick: () => {
                                        if (clearArmed)
                                            void clearAll();
                                        else
                                            setClearArmed(true);
                                    }, children: clearArmed ? t('clearConfigConfirm') : t('clear') })] })] }));
            }
            case 'raw':
                return (_jsxs("div", { children: [_jsx("div", { className: css['hint'], children: path.length > 0 ? path : t('configNotFound') }), _jsx("textarea", { className: css['rawArea'], value: raw, onChange: (event) => { setRaw(event.target.value); }, spellCheck: false }), _jsx("div", { className: css['buttonsRow'], children: _jsx("button", { type: "button", disabled: busy, onClick: () => { void importRaw(); }, children: t('importRaw') }) })] }));
            case 'requests': {
                const requests = requestsView?.requests ?? [];
                const paused = requestsView?.paused ?? true;
                const latest = requests[requests.length - 1];
                return (_jsxs("div", { children: [_jsxs("div", { className: css['buttonsRow'], children: [_jsx("button", { type: "button", onClick: () => {
                                        void actions.setPaused(sessionId, !paused).then(() => { refreshRequests(); });
                                    }, children: paused ? t('start') : t('stop') }), _jsx("button", { type: "button", onClick: () => {
                                        void actions.clearRequests(sessionId).then(() => { refreshRequests(); });
                                    }, children: t('clear') }), _jsxs("span", { className: css['count'], children: [requests.length, " ", t('requests')] })] }), requestsError !== undefined ? _jsx("div", { className: css['error'], children: requestsError }) : null, requests.length === 0
                            ? _jsx("div", { className: css['hint'], children: t('emptyRequests') })
                            : (_jsx("div", { className: css['requestList'], children: requests.map(request => (_jsxs("details", { className: css['requestItem'], open: request === latest, children: [_jsxs("summary", { children: [_jsxs("span", { children: ["#", request.id] }), _jsxs("span", { children: [request.purpose.length > 0 ? `[${request.purpose}] ` : '', request.model || '?', " \u00B7 ", request.messages.length, " ", t('requestMessages')] }), _jsx("span", { children: new Date(request.time).toLocaleTimeString() })] }), _jsxs("div", { className: css['requestMeta'], children: [_jsxs("span", { children: [t('requestModel'), ": ", request.model || '—'] }), _jsxs("span", { children: [t('requestProvider'), ": ", request.provider || '—'] }), _jsxs("span", { children: [t('requestPurpose'), ": ", request.purpose.length > 0 ? request.purpose : t('requestPurposeConversation')] })] }), request.system.length > 0
                                            ? (_jsxs(_Fragment, { children: [_jsx("div", { className: css['blockLabel'], children: t('requestSystem') }), _jsx("pre", { className: css['mono'], children: request.system })] }))
                                            : null, request.messages.map((message, at) => (_jsxs("pre", { className: css['mono'], children: [_jsx("span", { className: css['role'], children: message.role }), ' ', message.text] }, at)))] }, request.id))) }))] }));
            }
        }
    };
    return (_jsxs("div", { className: css['panel'], children: [_jsx("div", { className: css['tabs'], role: "tablist", children: tabs.map(({ key, label }) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === key, className: tab === key ? css['tabActive'] : css['tab'], onClick: () => { setTab(key); }, children: t(label) }, key))) }), notice !== undefined ? _jsx("div", { className: css['success'], children: notice }) : null, error !== undefined ? _jsx("div", { className: css['error'], children: t('error', { message: error }) }) : null, renderTab()] }));
}
//# sourceMappingURL=PanelSection.js.map