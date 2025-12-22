import api from './api'
import type {
    TokenUsageLog,
    UsageSummary,
    DailyUsage,
    TopUser,
    TopModel,
    AnalyticsDashboard,
} from '@/types'

const BASE_PATH = '/api/v1/bots/analytics'

export const analyticsService = {
    /**
     * Get usage summary
     */
    async getUsageSummary(): Promise<UsageSummary> {
        try {
            const response = await api.get<any>(`${BASE_PATH}/summary`)
            // Backend returns: total_tokens, unique_users_count, unique_models_count, estimated_cost
            // Normalize to frontend format
            return {
                total_tokens: response.data?.total_tokens || 0,
                total_input_tokens: response.data?.prompt_tokens || response.data?.total_input_tokens || 0,
                total_output_tokens: response.data?.completion_tokens || response.data?.total_output_tokens || 0,
                total_cost: response.data?.estimated_cost || response.data?.total_cost || 0,
                total_requests: response.data?.unique_users_count || response.data?.total_requests || 0,
                period: response.data?.period || 'All Time',
            }
        } catch {
            return {
                total_tokens: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_cost: 0,
                total_requests: 0,
                period: 'All Time',
            }
        }
    },

    /**
     * Get daily usage data
     */
    async getDailyUsage(days = 30): Promise<DailyUsage[]> {
        try {
            const response = await api.get<any>(
                `${BASE_PATH}/daily-usage?days=${days}`
            )
            // Backend returns { data: [...] } with date and total_tokens
            const rawData = response.data?.data || response.data || []
            if (!Array.isArray(rawData)) return []

            return rawData.map((item: any) => ({
                date: item.date || new Date().toISOString().split('T')[0],
                tokens: item.total_tokens || item.tokens || 0,
                requests: item.requests || 1,
                cost: item.cost || (item.total_tokens || 0) * 0.000003,
            }))
        } catch {
            return []
        }
    },

    /**
     * Get top users by token usage
     */
    async getTopUsers(limit = 10): Promise<TopUser[]> {
        try {
            const response = await api.get<any>(
                `${BASE_PATH}/top-users?limit=${limit}`
            )
            // Backend returns { data: [{ user_id, total_tokens }] }
            const rawData = response.data?.data || response.data || []
            if (!Array.isArray(rawData)) return []

            return rawData.map((item: any) => ({
                user_id: item.user_id || item.userId || 'Unknown',
                username: item.username || item.user_id || 'Unknown',
                total_tokens: item.total_tokens || item.tokens || 0,
                total_requests: item.requests || item.total_requests || 0,
            }))
        } catch {
            return []
        }
    },

    /**
     * Get top models by usage
     */
    async getTopModels(): Promise<TopModel[]> {
        try {
            const response = await api.get<any>(`${BASE_PATH}/top-models`)
            // Backend returns { data: [{ model, total_tokens }] }
            const rawData = response.data?.data || response.data || []
            if (!Array.isArray(rawData)) return []

            // Calculate total tokens for percentage
            const totalTokensSum = rawData.reduce((sum: number, item: any) =>
                sum + (item.total_tokens || item.tokens || 0), 0)

            return rawData.map((item: any) => {
                const itemTokens = item.total_tokens || item.tokens || 0
                return {
                    model: item.model || 'Unknown',
                    total_tokens: itemTokens,
                    total_requests: item.requests || item.total_requests || 0,
                    cost: item.cost || itemTokens * 0.000003,
                    percentage: totalTokensSum > 0 ? Math.round((itemTokens / totalTokensSum) * 100) : 0,
                }
            })
        } catch {
            return []
        }
    },

    /**
     * Get token usage logs
     */
    async getTokenLogs(
        page = 1,
        limit = 50,
        filters?: { model?: string; start_date?: string; end_date?: string }
    ): Promise<{ logs: TokenUsageLog[]; total: number; pages: number }> {
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) })
            if (filters?.model) params.append('model', filters.model)

            const response = await api.get<any>(`${BASE_PATH}/token-logs?${params.toString()}`)
            return {
                logs: Array.isArray(response.data?.data) ? response.data.data :
                    Array.isArray(response.data) ? response.data : [],
                total: response.data?.total || 0,
                pages: response.data?.pages || 1
            }
        } catch {
            return { logs: [], total: 0, pages: 1 }
        }
    },

    /**
     * Delete token logs
     */
    async deleteTokenLogs(logIds: string[]): Promise<{ message: string }> {
        const params = new URLSearchParams()
        logIds.forEach(id => params.append('log_ids', id))
        const response = await api.delete<{ deleted_count: number }>(
            `${BASE_PATH}/token-logs?${params.toString()}`
        )
        return { message: `Deleted ${response.data.deleted_count} logs` }
    },

    /**
     * Get full analytics dashboard data
     */
    async getDashboard(): Promise<AnalyticsDashboard> {
        const [summary, dailyUsage, topUsers, topModels] = await Promise.all([
            this.getUsageSummary(),
            this.getDailyUsage(),
            this.getTopUsers(),
            this.getTopModels(),
        ])
        return { summary, daily_usage: dailyUsage, top_users: topUsers, top_models: topModels }
    },
}

export default analyticsService
