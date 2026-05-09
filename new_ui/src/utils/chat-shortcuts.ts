export type ChatComposerShortcut = {
    keys: string;
    action: string;
};

export const chatComposerShortcuts: ChatComposerShortcut[] = [
    { keys: 'Enter', action: 'Send prompt' },
    { keys: 'Shift + Enter', action: 'Insert a new line' },
    { keys: 'Esc', action: 'Close open menus' },
    { keys: 'Click Templates', action: 'Insert a reusable prompt' },
];
