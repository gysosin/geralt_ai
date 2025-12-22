import { create } from 'zustand'
import type { Message, ConversationListItem, Conversation } from '@/types'
import { conversationService } from '@/services'
import { generateId } from '@/lib/utils'

interface ChatState {
  conversations: ConversationListItem[]
  currentConversation: Conversation | null
  currentCollectionId: string | null  // Added
  messages: Message[]
  isLoading: boolean
  isSending: boolean
  error: string | null

  // Actions
  fetchConversations: () => Promise<void>
  fetchConversation: (id: string) => Promise<void>
  sendMessage: (query: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  startNewConversation: (collectionId?: string | null) => void
  setCollectionId: (id: string | null) => void // Added
  clearError: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  currentCollectionId: null, // Added
  messages: [],
  isLoading: false,
  isSending: false,
  error: null,

  fetchConversations: async () => {
    set({ isLoading: true, error: null })
    try {
      const rawConversations = await conversationService.getAllConversations()
      // Normalize backend response to frontend format
      const conversations = rawConversations.map((conv: any, index: number) => ({
        id: conv.conversation_id || conv.id || conv._id || `conv-${index}`,
        title: conv.first_message || conv.name || 'New Conversation',
        updatedAt: conv.created_at || conv.createdAt || new Date().toISOString(),
        createdAt: conv.created_at || conv.createdAt || new Date().toISOString(),
      }))
      set({ conversations, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch conversations'
      set({ error: message, isLoading: false })
    }
  },

  fetchConversation: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const conversation = await conversationService.getConversation(id)
      // Normalize messages - assistant content might be an object with 'response' field
      const normalizedMessages = (conversation.messages || []).map((msg: any, index: number) => {
        let content = msg.content
        let sources: any[] = []
        let suggestions: string[] = []
        let metadata: Record<string, unknown> = {}

        // If content is an object (from backend), extract the response text AND sources
        if (typeof content === 'object' && content !== null) {
          // Extract sources from saved message
          if (content.top_documents && Array.isArray(content.top_documents)) {
            sources = content.top_documents.map((doc: any) => ({
              id: doc.document_id || doc.id || '',
              title: doc.other_metadata?.file_name || doc.file_name || 'Document',
              content: doc.chunk_snippets?.[0] || doc.content || '',
              score: doc.score || 0,
              metadata: {
                document_id: doc.document_id,
                collection_id: doc.collection_id,
                file_type: doc.file_type,
                url: doc.other_metadata?.url || doc.url || '',
                page_numbers: doc.page_numbers || [],
                chunk_count: doc.chunk_count || 1,
                chunk_snippets: doc.chunk_snippets || [],
                ...doc.other_metadata,
              }
            }))
          }

          // Extract suggestions
          if (content.suggestions && Array.isArray(content.suggestions)) {
            suggestions = content.suggestions
          }

          // Extract metadata
          if (content.metadata) {
            metadata = content.metadata
          }

          // Extract actual response text
          content = content.response || content.answer || JSON.stringify(content)
        }

        return {
          id: msg.id || `msg-${index}`,
          role: msg.role,
          content: content,
          timestamp: msg.timestamp || new Date().toISOString(),
          sources: sources.length > 0 ? sources : undefined,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }
      })

      // If conversation has a collection_id, set it? 
      // Backend conversation object might have it. Let's check type definition later or assume it might.
      // For now, just set state.
      set({
        currentConversation: { ...conversation, id: (conversation as any)._id || conversation.id || id },
        messages: normalizedMessages,
        isLoading: false,
        // Optional: currentCollectionId: conversation.collection_id || null
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch conversation'
      set({ error: message, isLoading: false })
    }
  },

  sendMessage: async (query) => {
    const { currentConversation, messages, currentCollectionId } = get()

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    }

    // Add loading assistant message
    const loadingMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    }

    set({
      messages: [...messages, userMessage, loadingMessage],
      isSending: true,
      error: null
    })

    try {
      const response = await conversationService.searchWithConversation(
        query,
        currentConversation?.id,
        currentCollectionId || undefined
      )

      // Handle response (backend returns 'response' or 'answer')
      const answerContent = response.response || response.answer || 'No response received'

      // Parse sources from API response
      // Backend returns: { document_id, collection_id, file_type, other_metadata, page_numbers, chunk_snippets, score }
      const sources = response.sources || response.top_documents?.map((doc: any) => ({
        id: doc.document_id || doc.id || '',
        title: doc.other_metadata?.file_name || doc.file_name || doc.document_name || doc.title || `Document`,
        content: doc.chunk_snippets?.[0] || doc.content || '',
        score: doc.score || doc.relevance_score || 0,
        metadata: {
          document_id: doc.document_id,
          collection_id: doc.collection_id,
          file_type: doc.file_type,
          url: doc.other_metadata?.url || doc.url || '',
          original_url: doc.other_metadata?.original_url || '',
          page_numbers: doc.page_numbers || [],
          chunk_count: doc.chunk_count || 1,
          chunk_snippets: doc.chunk_snippets || [],
          ...doc.other_metadata,
        }
      })) || []

      // Replace loading message with actual response including sources and suggestions
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: answerContent,
        timestamp: new Date().toISOString(),
        sources: sources,
        suggestions: response.suggestions || [],
        metadata: response.metadata || {},
      }

      set((state) => {
        // Save conversation ID from response for continuation
        const convId = response.conversation_id
        const updatedConversation = convId
          ? { id: convId, title: query.slice(0, 50), messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : state.currentConversation

        return {
          messages: state.messages.map(m =>
            m.isLoading ? assistantMessage : m
          ),
          currentConversation: updatedConversation,
          isSending: false,
        }
      })

      // Refresh conversations list
      get().fetchConversations()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send message'
      set((state) => ({
        messages: state.messages.filter(m => !m.isLoading),
        error: message,
        isSending: false,
      }))
    }
  },

  deleteConversation: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await conversationService.deleteConversation(id)
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        currentConversation: state.currentConversation?.id === id ? null : state.currentConversation,
        messages: state.currentConversation?.id === id ? [] : state.messages,
        isLoading: false,
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete conversation'
      set({ error: message, isLoading: false })
    }
  },

  startNewConversation: (collectionId = null) => {
    set({
      currentConversation: null,
      messages: [],
      error: null,
      currentCollectionId: collectionId,
    })
  },

  setCollectionId: (id) => set({ currentCollectionId: id }),

  clearError: () => set({ error: null }),
}))

export default useChatStore
