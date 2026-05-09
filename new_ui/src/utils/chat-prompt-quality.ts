export type ChatPromptQualityTone = 'muted' | 'warning' | 'good' | 'strong';

export type ChatPromptQuality = {
    score: number;
    label: string;
    tone: ChatPromptQualityTone;
    suggestions: string[];
};

const groundedTerms = [
    'document',
    'documents',
    'uploaded',
    'collection',
    'policy',
    'report',
    'cite',
    'source',
    'risk',
    'extract',
    'summarize',
    'compare',
];

const actionTerms = [
    'summarize',
    'compare',
    'extract',
    'draft',
    'review',
    'analyze',
    'find',
    'explain',
    'list',
    'create',
];

const includesAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

export const evaluateChatPromptQuality = (draft: string): ChatPromptQuality => {
    const normalized = draft.trim().toLowerCase();

    if (!normalized) {
        return {
            score: 0,
            label: 'No prompt',
            tone: 'muted',
            suggestions: ['Add a question or task before sending.'],
        };
    }

    let score = 20;
    const suggestions: string[] = [];

    if (normalized.length >= 24) {
        score += 25;
    } else {
        suggestions.push('Add more detail about the output you need.');
    }

    if (includesAny(normalized, actionTerms)) {
        score += 25;
    } else {
        suggestions.push('Start with an action like summarize, compare, extract, or draft.');
    }

    if (includesAny(normalized, groundedTerms)) {
        score += 30;
    } else {
        suggestions.push('Mention the document, collection, source, or evidence to ground the answer.');
    }

    if (score >= 80) {
        return { score, label: 'Strong', tone: 'strong', suggestions: [] };
    }

    if (score >= 60) {
        return { score, label: 'Good', tone: 'good', suggestions: suggestions.slice(0, 2) };
    }

    return { score, label: 'Needs detail', tone: 'warning', suggestions: suggestions.slice(0, 2) };
};
