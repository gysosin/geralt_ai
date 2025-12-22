import api from './api'
import type { ConversationSummary, Conversation, SearchResponse } from '@/types'

export const conversationService = {
    /**
     * Search with AI using conversation context
     */
    async searchWithConversation(
        query: string,
        conversationId?: string,
        collectionId?: string
    ): Promise<SearchResponse> {
        const response = await api.post<SearchResponse>('/api/v1/conversations/search', {
            query,
            conversation_id: conversationId,
            collection_id: collectionId,
        })
        return response.data
    },

    /**
     * Get all conversations for the current user
     */
    async getAllConversations(): Promise<ConversationSummary[]> {
        try {
            const response = await api.get<any>('/api/v1/conversations/')
            // Backend returns array directly
            const data = Array.isArray(response.data) ? response.data : []
            return data.map((c: any) => ({
                id: c.conversation_id || c.id,
                title: c.title || c.first_message || 'Untitled',
                lastMessage: c.first_message || c.last_message || '',
                timestamp: c.created_at || c.createdAt || new Date().toISOString(),
                botId: c.bot_token,
                conversation_id: c.conversation_id,
                first_message: c.first_message,
                created_at: c.created_at,
                updated_at: c.updated_at,
                messageCount: c.message_count || 0,
            }))
        } catch {
            return []
        }
    },

    /**
     * Get a single conversation by ID
     */
    async getConversation(conversationId: string, collectionId?: string): Promise<Conversation | null> {
        try {
            const params = new URLSearchParams()
            if (collectionId) params.append('collection_id', collectionId)

            const response = await api.get<Conversation>(
                `/api/v1/conversations/${conversationId}?${params.toString()}`
            )
            return response.data
        } catch {
            return null
        }
    },

    /**
     * Get conversations by collection
     */
    async getConversationsByCollection(collectionId: string): Promise<ConversationSummary[]> {
        try {
            const response = await api.get<any>(
                `/api/v1/conversations/by-collection?collection_id=${collectionId}`
            )
            const data = Array.isArray(response.data) ? response.data : []
            return data.map((c: any) => ({
                id: c.conversation_id || c.id,
                title: c.title || c.first_message || 'Untitled',
                lastMessage: c.first_message || c.last_message || '',
                timestamp: c.created_at || new Date().toISOString(),
                botId: c.bot_token,
            }))
        } catch {
            return []
        }
    },

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId: string): Promise<void> {
        await api.delete(`/api/v1/conversations/${conversationId}`)
    },

    /**
     * Rename a conversation
     */
    async renameConversation(conversationId: string, title: string): Promise<void> {
        await api.put(`/api/v1/conversations/${conversationId}`, { title })
    },

    /**
     * Public search (no auth required)
     */
    async searchPublic(query: string, collectionId?: string): Promise<SearchResponse> {
        const params = new URLSearchParams({ query })
        if (collectionId) params.append('collection_id', collectionId)

        const response = await api.get<SearchResponse>(
            `/api/v1/conversations/search/public?${params.toString()}`
        )
        return response.data
    },
}

export default conversationService
