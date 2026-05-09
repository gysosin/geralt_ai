import { describe, expect, it } from 'vitest';
import { getSourceNoteCount, upsertSourceNote } from './source-notes';

describe('source notes', () => {
    it('stores trimmed source notes by source id', () => {
        expect(upsertSourceNote({}, 'policy', '  check renewal date  ')).toEqual({
            policy: 'check renewal date',
        });
    });

    it('removes a source note when the value is empty', () => {
        expect(upsertSourceNote({ policy: 'check renewal date', memo: 'owner' }, 'policy', '   ')).toEqual({
            memo: 'owner',
        });
    });

    it('counts non-empty source notes', () => {
        expect(getSourceNoteCount({ policy: 'check renewal date', empty: '', whitespace: '   ' })).toBe(1);
    });
});
