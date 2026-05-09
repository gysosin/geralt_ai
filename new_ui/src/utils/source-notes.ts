export type SourceNotes = Record<string, string>;

export const upsertSourceNote = (
    currentNotes: SourceNotes,
    sourceId: string,
    value: string,
): SourceNotes => {
    const nextNotes = { ...currentNotes };
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        delete nextNotes[sourceId];
        return nextNotes;
    }

    nextNotes[sourceId] = trimmedValue;
    return nextNotes;
};

export const getSourceNoteCount = (sourceNotes: SourceNotes): number => (
    Object.values(sourceNotes).filter((note) => note.trim()).length
);
