import { create } from 'zustand'
import type {
    Bot,
    Collection,
    ConversationSummary,
    AnalyticsDashboard,
    DashboardStats,
    UsageSummary,
    DailyUsage,
} from '@/types'
import {
    analyticsService,
    conversationService,
    botService,
    collectionService,
} from '@/src/services'

interface DashboardState {
    // Data
    stats: DashboardStats
    analytics: AnalyticsDashboard | null
    recentConversations: ConversationSummary[]
    bots: Bot[]
    collections: Collection[]

    // Loading states
    isLoading: boolean
    isStatsLoading: boolean
    isAnalyticsLoading: boolean
    isConversationsLoading: boolean

    // Error state
    error: string | null

    // Actions
    fetchDashboardData: (tenantId: string) => Promise<void>
    fetchStats: (tenantId: string) => Promise<void>
    fetchAnalytics: () => Promise<void>
    fetchRecentConversations: () => Promise<void>
    clearError: () => void
}

export const useDashboardStore = create<DashboardState>()((set, get) => ({
    // Initial state
    stats: {
        conversations: 0,
        bots: 0,
        collections: 0,
        documents: 0,
    },
    analytics: null,
    recentConversations: [],
    bots: [],
    collections: [],
    isLoading: false,
    isStatsLoading: false,
    isAnalyticsLoading: false,
    isConversationsLoading: false,
    error: null,

    /**
     * Fetch all dashboard data at once
     */
    fetchDashboardData: async (tenantId: string) => {
        set({ isLoading: true, error: null })
        try {
            await Promise.all([
                get().fetchStats(tenantId),
                get().fetchAnalytics(),
                get().fetchRecentConversations(),
            ])
        } catch (error) {
            set({ error: 'Failed to load dashboard data' })
        } finally {
            set({ isLoading: false })
        }
    },

    /**
     * Fetch stats (conversations, bots, collections, documents)
     */
    fetchStats: async (tenantId: string) => {
        set({ isStatsLoading: true })
        try {
            const [conversations, bots, collections] = await Promise.all([
                conversationService.getAllConversations(),
                botService.getAllBots(tenantId),
                collectionService.getAllCollections(tenantId),
            ])

            // Calculate total documents from collections
            const documents = collections.reduce(
                (acc, c) => acc + (c.fileCount || c.file_count || 0),
                0
            )

            set({
                stats: {
                    conversations: conversations.length,
                    bots: bots.length,
                    collections: collections.length,
                    documents,
                },
                bots,
                collections,
                isStatsLoading: false,
            })
        } catch (error) {
            console.error('Failed to fetch stats:', error)
            set({ isStatsLoading: false })
        }
    },

    /**
     * Fetch analytics data
     */
    fetchAnalytics: async () => {
        set({ isAnalyticsLoading: true })
        try {
            const analytics = await analyticsService.getDashboard()
            set({ analytics, isAnalyticsLoading: false })
        } catch (error) {
            console.error('Failed to fetch analytics:', error)
            set({ isAnalyticsLoading: false })
        }
    },

    /**
     * Fetch recent conversations
     */
    fetchRecentConversations: async () => {
        set({ isConversationsLoading: true })
        try {
            const conversations = await conversationService.getAllConversations()
            // Sort by timestamp and take the most recent 5
            const sorted = conversations
                .sort((a, b) => {
                    const dateA = new Date(a.timestamp || a.created_at || 0)
                    const dateB = new Date(b.timestamp || b.created_at || 0)
                    return dateB.getTime() - dateA.getTime()
                })
                .slice(0, 5)

            set({ recentConversations: sorted, isConversationsLoading: false })
        } catch (error) {
            console.error('Failed to fetch conversations:', error)
            set({ isConversationsLoading: false })
        }
    },

    clearError: () => set({ error: null }),
}))

export default useDashboardStore
