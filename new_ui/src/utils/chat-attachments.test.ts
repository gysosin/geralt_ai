import { describe, expect, it } from 'vitest';
import type { Collection } from '../../types';
import { buildChatAttachmentOptions, getSelectedAttachmentLabel } from './chat-attachments';

describe('chat attachment utilities', () => {
    const collections = [
        { id: 'finance', name: 'Finance', fileCount: 12, type: 'reports' },
        { id: 'empty-name', collection_name: 'Policies', file_count: 3 },
    ] as Collection[];

    it('builds collection attachment options with stable labels and counts', () => {
        expect(buildChatAttachmentOptions(collections)).toEqual([
            {
                id: 'finance',
                label: 'Finance',
                description: undefined,
                documentCount: 12,
                type: 'reports',
            },
            {
                id: 'empty-name',
                label: 'Policies',
                description: undefined,
                documentCount: 3,
                type: 'general',
            },
        ]);
    });

    it('returns the selected collection label or all collections', () => {
        const options = buildChatAttachmentOptions(collections);

        expect(getSelectedAttachmentLabel(options, 'finance')).toBe('Finance');
        expect(getSelectedAttachmentLabel(options, null)).toBe('All collections');
        expect(getSelectedAttachmentLabel(options, 'missing')).toBe('All collections');
    });
});
