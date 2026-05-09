import { describe, expect, it } from 'vitest';
import {
    AGENT_TEMPLATE_DRAFT_STORAGE_KEY,
    createAgentTemplateDraft,
    filterAgentTemplates,
    getAgentTemplateById,
    getAgentTemplateSummary,
    persistAgentTemplateDraft,
    consumeAgentTemplateDraft,
} from './agent-templates';

describe('agent template utilities', () => {
    it('filters templates by category and query', () => {
        const documentTemplates = filterAgentTemplates('', 'documents');
        const policyTemplates = filterAgentTemplates('policy', 'all');

        expect(documentTemplates.length).toBeGreaterThan(0);
        expect(documentTemplates.every((template) => template.category === 'documents')).toBe(true);
        expect(policyTemplates.map((template) => template.id)).toContain('policy-qa');
    });

    it('creates a create-agent draft from a template', () => {
        const template = getAgentTemplateById('vendor-risk');

        expect(template).toBeDefined();
        expect(createAgentTemplateDraft(template!)).toMatchObject({
            bot_name: 'Vendor Risk Analyst',
            collection_ids: [],
            welcome_buttons: [
                { label: 'Summarize vendor risk', action: 'Summarize the main vendor risk factors from the attached knowledge base.' },
                { label: 'Compare vendors', action: 'Compare the shortlisted vendors by price, risk, and contract readiness.' },
            ],
        });
    });

    it('persists and consumes the selected template draft', () => {
        const storage = new Map<string, string>();
        const sessionStorageLike = {
            getItem: (key: string) => storage.get(key) || null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        };
        const template = getAgentTemplateById('policy-qa')!;

        persistAgentTemplateDraft(template, sessionStorageLike);

        expect(storage.has(AGENT_TEMPLATE_DRAFT_STORAGE_KEY)).toBe(true);
        expect(consumeAgentTemplateDraft(sessionStorageLike)?.bot_name).toBe('Policy Q&A Agent');
        expect(storage.has(AGENT_TEMPLATE_DRAFT_STORAGE_KEY)).toBe(false);
    });

    it('summarizes available template coverage', () => {
        expect(getAgentTemplateSummary()).toEqual({
            total: 8,
            categories: 4,
            highImpact: 5,
        });
    });
});
