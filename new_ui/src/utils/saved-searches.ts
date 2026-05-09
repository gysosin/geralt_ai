import type { GlobalSearchFilter } from './global-search';

export const SAVED_SEARCHES_STORAGE_KEY = 'geralt:saved-searches:v1';
export const MAX_SAVED_SEARCH_VIEWS = 8;

export type SavedSearchView = {
    id: string;
    label: string;
    query: string;
    filter: GlobalSearchFilter;
    createdAt: string;
};

const validFilters: GlobalSearchFilter[] = ['all', 'conversation', 'agent', 'collection'];

const isGlobalSearchFilter = (value: unknown): value is GlobalSearchFilter =>
    validFilters.includes(value as GlobalSearchFilter);

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'search';

export const createSavedSearchView = (
    query: string,
    filter: GlobalSearchFilter,
    now = Date.now(),
): SavedSearchView => {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    const slug = slugify(normalizedQuery);

    return {
        id: `${filter}-${slug}-${now}`,
        label: normalizedQuery,
        query: normalizedQuery,
        filter,
        createdAt: new Date(now).toISOString(),
    };
};

export const parseSavedSearchViews = (rawValue: string | null): SavedSearchView[] => {
    if (!rawValue) return [];

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item): item is SavedSearchView =>
                item &&
                typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.label === 'string' &&
                typeof item.query === 'string' &&
                isGlobalSearchFilter(item.filter) &&
                typeof item.createdAt === 'string',
            )
            .slice(0, MAX_SAVED_SEARCH_VIEWS);
    } catch {
        return [];
    }
};

export const addSavedSearchView = (
    views: SavedSearchView[],
    nextView: SavedSearchView,
): SavedSearchView[] => [
        nextView,
        ...views.filter((view) =>
            view.query.toLowerCase() !== nextView.query.toLowerCase() || view.filter !== nextView.filter,
        ),
    ].slice(0, MAX_SAVED_SEARCH_VIEWS);

export const removeSavedSearchView = (views: SavedSearchView[], id: string): SavedSearchView[] =>
    views.filter((view) => view.id !== id);
