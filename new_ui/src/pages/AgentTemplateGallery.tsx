import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, FileText, Search, ShieldCheck, ShoppingCart, Sparkles, Headphones, WandSparkles } from 'lucide-react';
import {
    agentTemplates,
    filterAgentTemplates,
    getAgentTemplateSummary,
    persistAgentTemplateDraft,
    type AgentTemplateCategory,
    type AgentTemplateFilter,
} from '../utils/agent-templates';

const categoryFilters: Array<{ id: AgentTemplateFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'documents', label: 'Documents' },
    { id: 'procurement', label: 'Procurement' },
    { id: 'support', label: 'Support' },
    { id: 'compliance', label: 'Compliance' },
];

const categoryTone: Record<AgentTemplateCategory, { icon: React.ElementType; className: string }> = {
    documents: { icon: FileText, className: 'border-sky-400/30 bg-sky-400/10 text-sky-200' },
    procurement: { icon: ShoppingCart, className: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
    support: { icon: Headphones, className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
    compliance: { icon: ShieldCheck, className: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200' },
};

const AgentTemplateGallery: React.FC = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<AgentTemplateFilter>('all');
    const summary = useMemo(() => getAgentTemplateSummary(agentTemplates), []);
    const visibleTemplates = useMemo(
        () => filterAgentTemplates(query, activeCategory),
        [activeCategory, query],
    );

    const useTemplate = (templateId: string) => {
        const template = agentTemplates.find((item) => item.id === templateId);
        if (!template) return;

        persistAgentTemplateDraft(template);
        navigate(`/bots?template=${encodeURIComponent(template.id)}`);
    };

    return (
        <div className="mx-auto max-w-[1240px] space-y-6 pb-10">
            <section className="rounded-3xl border border-white/5 bg-surface/30 p-6 backdrop-blur-xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
                            <WandSparkles size={16} />
                            Agent Launchpad
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Agent template gallery</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-400">
                            Start from production-ready agent blueprints for document Q&A, procurement, support, and compliance workflows.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/bots')}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                    >
                        <Bot size={16} />
                        Manage agents
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        ['Templates', summary.total],
                        ['Categories', summary.categories],
                        ['High impact', summary.highImpact],
                        ['Visible now', visibleTemplates.length],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                            <p className="text-xs font-medium text-gray-500">{label}</p>
                            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search templates by workflow, role, or collection type..."
                            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-amber-400/50"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categoryFilters.map((filter) => (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setActiveCategory(filter.id)}
                                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${activeCategory === filter.id
                                    ? 'border-amber-400/30 bg-amber-400/10 text-white'
                                    : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
                                    }`}
                                aria-pressed={activeCategory === filter.id}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {visibleTemplates.length === 0 ? (
                    <div className="rounded-3xl border border-white/5 bg-surface/30 p-10 text-center text-sm text-gray-500 lg:col-span-2">
                        No templates match this view.
                    </div>
                ) : (
                    visibleTemplates.map((template) => {
                        const tone = categoryTone[template.category];
                        const CategoryIcon = tone.icon;

                        return (
                            <article
                                key={template.id}
                                className="rounded-3xl border border-white/5 bg-surface/30 p-5 backdrop-blur-xl transition-colors hover:border-amber-400/20 hover:bg-white/[0.04]"
                            >
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.className}`}>
                                                <CategoryIcon size={12} />
                                                {template.category}
                                            </span>
                                            {template.impact === 'high' && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
                                                    <Sparkles size={12} />
                                                    High impact
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="mt-3 text-xl font-semibold text-white">{template.name}</h2>
                                        <p className="mt-2 text-sm text-gray-400">{template.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => useTemplate(template.id)}
                                        className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                                    >
                                        Use template
                                    </button>
                                </div>

                                <div className="mt-5 grid gap-4 border-t border-white/5 pt-4 xl:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Suggested knowledge</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {template.suggestedCollections.map((collection) => (
                                                <span key={collection} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-gray-300">
                                                    {collection}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Starter prompts</p>
                                        <div className="mt-2 space-y-2">
                                            {template.welcomeButtons.map((button) => (
                                                <p key={button.label} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-400">
                                                    {button.label}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Instruction preview</p>
                                    <p className="mt-2 line-clamp-3 rounded-2xl border border-white/5 bg-black/20 p-3 text-xs leading-5 text-gray-500">
                                        {template.instruction}
                                    </p>
                                </div>
                            </article>
                        );
                    })
                )}
            </section>
        </div>
    );
};

export default AgentTemplateGallery;
