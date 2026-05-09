import { describe, expect, it } from 'vitest';
import { chatComposerShortcuts } from './chat-shortcuts';

describe('chat shortcuts', () => {
    it('lists the composer shortcuts users can verify in the UI', () => {
        expect(chatComposerShortcuts).toEqual([
            { keys: 'Enter', action: 'Send prompt' },
            { keys: 'Shift + Enter', action: 'Insert a new line' },
            { keys: 'Esc', action: 'Close open menus' },
            { keys: 'Click Templates', action: 'Insert a reusable prompt' },
        ]);
    });
});
