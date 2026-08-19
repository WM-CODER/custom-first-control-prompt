/**
 * Copy dictionaries for the panel surface. Every visible string in the
 * settings section, the plugin card, and the composer dock comes from here.
 */
export declare const en: {
    readonly nav: "Custom prompt";
    readonly panelTitle: "Custom first-control prompt";
    readonly cardTitle: "Custom first-control prompt";
    readonly dockLabel: "Custom prompt";
    readonly toggleDock: "Show composer-top inspector strip";
    readonly toggleListen: "Listen to LLM requests";
    readonly listeningOn: "Listening";
    readonly listeningOff: "Paused";
    readonly requests: "requests";
    readonly noSession: "Open a conversation to use this panel.";
    readonly start: "Start";
    readonly stop: "Stop";
    readonly clear: "Clear";
    readonly refresh: "Refresh";
    readonly save: "Save";
    readonly importRaw: "Import RAW";
    readonly clearConfigConfirm: "Clear the configured prompt content? The plugin stays installed.";
    readonly tabPreview: "Preview";
    readonly tabConfig: "Config";
    readonly tabRaw: "RAW";
    readonly tabRequests: "LLM listening";
    readonly previewSections: "Registered sections (assembler state)";
    readonly previewEmpty: "No custom-first-control-prompt section is mounted in the current profile.";
    readonly previewNote: "Static section text as registered with the assembler — uninterpolated and shown without neighboring sections. The request-time form appears below once captured.";
    readonly previewRealSystem: "Real system prompt (latest captured request)";
    readonly previewRealSystemEmpty: "No captured request yet. Start listening and send a message; the real system prompt appears here.";
    readonly sectionName: "Name";
    readonly sectionOrder: "Order";
    readonly sectionText: "Text";
    readonly sectionEnabled: "Enabled";
    readonly historyUser: "User";
    readonly historyAssistant: "Assistant";
    readonly addSection: "Add section";
    readonly addPair: "Add pair";
    readonly remove: "Remove";
    readonly includeSubagents: "Also seed subagent sessions";
    readonly requestModel: "Model";
    readonly requestProvider: "Provider";
    readonly requestTime: "Time";
    readonly requestSystem: "System prompt";
    readonly requestMessages: "Messages";
    readonly requestPurpose: "Purpose";
    readonly requestPurposeConversation: "conversation (seed injection applies)";
    readonly emptyRequests: "No captured requests. Turn listening on and send a message.";
    readonly error: "Error: {message}";
    readonly readFailed: "Read failed";
    readonly writeFailed: "Write failed";
    readonly saved: "Saved";
    readonly dockHide: "Hide this strip";
    readonly collapse: "Collapse";
    readonly expand: "Expand";
    readonly roleUser: "user";
    readonly roleAssistant: "assistant";
    readonly configNotFound: "This profile patch file has no custom-first-control-prompt entry yet. Saving creates one.";
};
export declare const zh: Record<keyof typeof en, string>;
/** Dictionary key set shared by both locales. */
export type CfcpKey = keyof typeof en;
//# sourceMappingURL=locales.d.ts.map