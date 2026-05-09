export type ChatPromptTemplateCategory = 'analysis' | 'writing' | 'extraction' | 'planning';
export type ChatPromptTemplateFilter = 'all' | ChatPromptTemplateCategory;

export type ChatPromptTemplate = {
    id: string;
    title: string;
    category: ChatPromptTemplateCategory;
    description: string;
    prompt: string;
    tags: string[];
};

export const chatPromptTemplates: ChatPromptTemplate[] = [
    {
        id: 'source-summary',
        title: 'Source summary',
        category: 'analysis',
        description: 'Summarize selected knowledge with citations and uncertainty.',
        prompt: 'Summarize the selected knowledge. Include the most important points, cite source names when available, and separate confirmed facts from assumptions.',
        tags: ['summary', 'sources', 'documents'],
    },
    {
        id: 'risk-review',
        title: 'Risk review',
        category: 'analysis',
        description: 'Find operational, legal, financial, and data risks.',
        prompt: 'Review this material for risk. Group findings by operational, legal, financial, compliance, and data risk. For each risk, include severity, evidence, and a recommended next action.',
        tags: ['risk', 'audit', 'compliance'],
    },
    {
        id: 'extract-action-items',
        title: 'Extract action items',
        category: 'extraction',
        description: 'Turn long notes or documents into owners and next steps.',
        prompt: 'Extract action items from this content. Return a table with task, owner if known, deadline if known, dependency, and priority.',
        tags: ['tasks', 'owners', 'extraction'],
    },
    {
        id: 'compare-options',
        title: 'Compare options',
        category: 'analysis',
        description: 'Compare vendors, policies, approaches, or proposals.',
        prompt: 'Compare the available options. Use a concise table with strengths, weaknesses, cost or effort, risk, and recommendation.',
        tags: ['compare', 'vendor', 'decision'],
    },
    {
        id: 'draft-stakeholder-update',
        title: 'Stakeholder update',
        category: 'writing',
        description: 'Draft a crisp status update for leadership or customers.',
        prompt: 'Draft a stakeholder update. Include current status, what changed, impact, risks, next steps, owner, and next update timing. Keep it concise and plain-spoken.',
        tags: ['status', 'update', 'writing'],
    },
    {
        id: 'build-implementation-plan',
        title: 'Implementation plan',
        category: 'planning',
        description: 'Convert a goal into phases, dependencies, and checks.',
        prompt: 'Create an implementation plan for this goal. Include phases, tasks, dependencies, risks, validation steps, rollout plan, and rollback considerations.',
        tags: ['plan', 'delivery', 'rollout'],
    },
    {
        id: 'extract-fields',
        title: 'Extract structured fields',
        category: 'extraction',
        description: 'Pull structured values from uploaded documents or pasted text.',
        prompt: 'Extract structured fields from this content. Return valid JSON with field names, values, confidence, and source evidence for each field.',
        tags: ['json', 'fields', 'ocr'],
    },
];

const normalize = (value: unknown) => String(value || '').toLowerCase();

export const filterChatPromptTemplates = (
    query: string,
    category: ChatPromptTemplateFilter,
    templates: ChatPromptTemplate[] = chatPromptTemplates,
): ChatPromptTemplate[] => {
    const normalizedQuery = normalize(query).trim();

    return templates.filter((template) => {
        const matchesCategory = category === 'all' || template.category === category;
        const matchesQuery = !normalizedQuery || normalize([
            template.title,
            template.description,
            template.category,
            template.tags.join(' '),
        ].join(' ')).includes(normalizedQuery);

        return matchesCategory && matchesQuery;
    });
};

export const applyChatPromptTemplate = (
    template: ChatPromptTemplate,
    context?: string,
) => {
    const trimmedContext = context?.trim();
    if (!trimmedContext) return template.prompt;

    return `${template.prompt}\n\nContext: ${trimmedContext}`;
};

export const getChatPromptTemplateSummary = (templates: ChatPromptTemplate[] = chatPromptTemplates) => ({
    total: templates.length,
    categories: new Set(templates.map((template) => template.category)).size,
});
