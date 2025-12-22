import api from './api'
import type { Conversation, ConversationListItem, SearchResponse } from '@/types'

export const conversationService = {
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

  async getAllConversations(): Promise<ConversationListItem[]> {
    const response = await api.get<ConversationListItem[]>(
      '/api/v1/conversations/'
    )
    // Backend returns array directly
    return Array.isArray(response.data) ? response.data : []
  },

  async getConversation(conversationId: string, collectionId?: string): Promise<Conversation> {
    const params = new URLSearchParams()
    if (collectionId) params.append('collection_id', collectionId)
    
    const response = await api.get<Conversation>(
      `/api/v1/conversations/${conversationId}?${params.toString()}`
    )
    return response.data
  },

  async getConversationsByCollection(collectionId: string): Promise<ConversationListItem[]> {
    const response = await api.get<ConversationListItem[]>(
      `/api/v1/conversations/by-collection?collection_id=${collectionId}`
    )
    // Backend returns array directly
    return Array.isArray(response.data) ? response.data : []
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/api/v1/conversations/${conversationId}`)
  },

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
