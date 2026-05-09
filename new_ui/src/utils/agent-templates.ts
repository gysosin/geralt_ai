import type { CreateBotCommand } from '@/types';

export const AGENT_TEMPLATE_DRAFT_STORAGE_KEY = 'geralt.agentTemplateDraft';

export type AgentTemplateCategory = 'documents' | 'procurement' | 'support' | 'compliance';

export type AgentTemplate = {
    id: string;
    name: string;
    category: AgentTemplateCategory;
    description: string;
    instruction: string;
    tags: string[];
    impact: 'high' | 'standard';
    suggestedCollections: string[];
    welcomeButtons: Array<{ label: string; action: string }>;
};

export type AgentTemplateFilter = 'all' | AgentTemplateCategory;

type DraftStorage = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

export const agentTemplates: AgentTemplate[] = [
    {
        id: 'policy-qa',
        name: 'Policy Q&A Agent',
        category: 'documents',
        description: 'Answers employee and operating policy questions with source-grounded responses.',
        instruction: 'Answer policy questions using attached knowledge collections. Cite the relevant policy area, explain uncertainty, and ask a clarifying question when the user request is ambiguous.',
        tags: ['policy', 'hr', 'knowledge base'],
        impact: 'high',
        suggestedCollections: ['Employee handbook', 'Operating policies'],
        welcomeButtons: [
            { label: 'Find policy answer', action: 'Answer this policy question using the attached knowledge base.' },
            { label: 'Summarize policy changes', action: 'Summarize the newest or most important policy changes.' },
        ],
    },
    {
        id: 'vendor-risk',
        name: 'Vendor Risk Analyst',
        category: 'procurement',
        description: 'Compares supplier documents, contracts, and due diligence notes for procurement risk.',
        instruction: 'Assess vendor risk using attached contracts, security questionnaires, procurement notes, and renewal documents. Highlight financial, operational, compliance, and delivery concerns before recommending next actions.',
        tags: ['vendor', 'risk', 'procurement'],
        impact: 'high',
        suggestedCollections: ['Vendor contracts', 'Security questionnaires'],
        welcomeButtons: [
            { label: 'Summarize vendor risk', action: 'Summarize the main vendor risk factors from the attached knowledge base.' },
            { label: 'Compare vendors', action: 'Compare the shortlisted vendors by price, risk, and contract readiness.' },
        ],
    },
    {
        id: 'contract-review',
        name: 'Contract Review Agent',
        category: 'compliance',
        description: 'Reviews legal and commercial clauses for missing terms, risky language, and negotiation points.',
        instruction: 'Review contract language with a risk-first lens. Identify missing clauses, nonstandard terms, obligations, renewal mechanics, data handling requirements, and negotiation questions.',
        tags: ['contract', 'legal', 'risk'],
        impact: 'high',
        suggestedCollections: ['Vendor contracts', 'Legal playbooks'],
        welcomeButtons: [
            { label: 'Review risky clauses', action: 'List the highest-risk clauses and explain why they matter.' },
            { label: 'Prepare negotiation notes', action: 'Prepare negotiation notes from this contract.' },
        ],
    },
    {
        id: 'incident-briefing',
        name: 'Incident Briefing Agent',
        category: 'support',
        description: 'Turns support logs and runbooks into concise incident summaries and customer updates.',
        instruction: 'Create concise incident updates from logs, tickets, and runbooks. Separate confirmed facts from assumptions, list current impact, owner, next update time, and recommended customer-facing language.',
        tags: ['incident', 'support', 'runbook'],
        impact: 'high',
        suggestedCollections: ['Support runbooks', 'Incident notes'],
        welcomeButtons: [
            { label: 'Draft incident summary', action: 'Draft a concise incident summary with impact and next actions.' },
            { label: 'Find runbook step', action: 'Find the most relevant runbook steps for this incident.' },
        ],
    },
    {
        id: 'onboarding-guide',
        name: 'Onboarding Guide Agent',
        category: 'documents',
        description: 'Helps new employees find onboarding docs, tools, and first-week tasks.',
        instruction: 'Guide new employees through onboarding material. Recommend next tasks, link relevant policy sections, and keep answers short unless the user asks for detail.',
        tags: ['onboarding', 'employee', 'guide'],
        impact: 'standard',
        suggestedCollections: ['Employee handbook', 'Onboarding docs'],
        welcomeButtons: [
            { label: 'Plan first week', action: 'Create a first-week onboarding plan from the attached documents.' },
            { label: 'Find tool access', action: 'Find the access steps for a required onboarding tool.' },
        ],
    },
    {
        id: 'procurement-triage',
        name: 'Procurement Triage Agent',
        category: 'procurement',
        description: 'Classifies purchase requests and prepares sourcing next steps.',
        instruction: 'Triage procurement requests by urgency, completeness, risk, budget impact, and required approvals. Return structured next steps that procurement can act on.',
        tags: ['purchase request', 'triage', 'approval'],
        impact: 'standard',
        suggestedCollections: ['Procurement policy', 'Budget guidance'],
        welcomeButtons: [
            { label: 'Triage request', action: 'Triage this purchase request and list missing information.' },
            { label: 'Approval path', action: 'Identify the likely approval path for this request.' },
        ],
    },
    {
        id: 'support-escalation',
        name: 'Support Escalation Agent',
        category: 'support',
        description: 'Prepares escalation packets from tickets, logs, and customer context.',
        instruction: 'Build escalation packets for support issues. Include reproduction details, observed errors, customer impact, prior attempts, likely owner, and the smallest next diagnostic step.',
        tags: ['support', 'escalation', 'customer'],
        impact: 'standard',
        suggestedCollections: ['Support tickets', 'Product runbooks'],
        welcomeButtons: [
            { label: 'Create escalation packet', action: 'Create an escalation packet from this support context.' },
            { label: 'Find missing evidence', action: 'Identify what evidence is missing before escalation.' },
        ],
    },
    {
        id: 'compliance-auditor',
        name: 'Compliance Auditor Agent',
        category: 'compliance',
        description: 'Checks documents against controls, audit evidence, and retention requirements.',
        instruction: 'Review compliance evidence against policy and control requirements. Identify missing proof, expired artifacts, risky access, and remediation steps with clear priority.',
        tags: ['audit', 'compliance', 'controls'],
        impact: 'high',
        suggestedCollections: ['Audit evidence', 'Security policies'],
        welcomeButtons: [
            { label: 'Check audit evidence', action: 'Check this evidence package for missing or expired artifacts.' },
            { label: 'List remediation work', action: 'List the remediation work needed for this control.' },
        ],
    },
];

const normalize = (value: unknown) => String(value || '').toLowerCase();

export const getAgentTemplateById = (id: string) =>
    agentTemplates.find((template) => template.id === id);

export const filterAgentTemplates = (
    query: string,
    category: AgentTemplateFilter,
    templates: AgentTemplate[] = agentTemplates,
): AgentTemplate[] => {
    const normalizedQuery = normalize(query).trim();

    return templates.filter((template) => {
        const matchesCategory = category === 'all' || template.category === category;
        const matchesQuery = !normalizedQuery || normalize([
            template.name,
            template.description,
            template.category,
            template.tags.join(' '),
            template.suggestedCollections.join(' '),
        ].join(' ')).includes(normalizedQuery);

        return matchesCategory && matchesQuery;
    });
};

export const createAgentTemplateDraft = (template: AgentTemplate): CreateBotCommand => ({
    bot_name: template.name,
    description: template.description,
    prompt: template.instruction,
    welcome_message: template.instruction,
    welcome_buttons: template.welcomeButtons,
    collection_ids: [],
});

const getSessionStorage = (): DraftStorage | undefined => {
    if (typeof window === 'undefined') return undefined;
    return window.sessionStorage;
};

export const persistAgentTemplateDraft = (
    template: AgentTemplate,
    storage: DraftStorage | undefined = getSessionStorage(),
) => {
    if (!storage) return;
    storage.setItem(AGENT_TEMPLATE_DRAFT_STORAGE_KEY, JSON.stringify(createAgentTemplateDraft(template)));
};

export const readAgentTemplateDraft = (
    storage: DraftStorage | undefined = getSessionStorage(),
): CreateBotCommand | null => {
    if (!storage) return null;

    const rawDraft = storage.getItem(AGENT_TEMPLATE_DRAFT_STORAGE_KEY);
    if (!rawDraft) return null;

    try {
        const parsed = JSON.parse(rawDraft) as Partial<CreateBotCommand>;
        if (!parsed.bot_name || typeof parsed.bot_name !== 'string') return null;

        return {
            bot_name: parsed.bot_name,
            description: typeof parsed.description === 'string' ? parsed.description : undefined,
            prompt: typeof parsed.prompt === 'string' ? parsed.prompt : undefined,
            welcome_message: typeof parsed.welcome_message === 'string' ? parsed.welcome_message : '',
            welcome_buttons: Array.isArray(parsed.welcome_buttons) ? parsed.welcome_buttons : [],
            collection_ids: Array.isArray(parsed.collection_ids) ? parsed.collection_ids : [],
        };
    } catch {
        return null;
    }
};

export const clearAgentTemplateDraft = (
    storage: DraftStorage | undefined = getSessionStorage(),
) => {
    storage?.removeItem(AGENT_TEMPLATE_DRAFT_STORAGE_KEY);
};

export const consumeAgentTemplateDraft = (
    storage: DraftStorage | undefined = getSessionStorage(),
): CreateBotCommand | null => {
    const draft = readAgentTemplateDraft(storage);
    clearAgentTemplateDraft(storage);
    return draft;
};

export const getAgentTemplateSummary = (templates: AgentTemplate[] = agentTemplates) => ({
    total: templates.length,
    categories: new Set(templates.map((template) => template.category)).size,
    highImpact: templates.filter((template) => template.impact === 'high').length,
});
