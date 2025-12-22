import { create } from 'zustand'
import type { Message, ConversationSummary, Conversation, Source } from '@/types'
import { conversationService } from '../services'

interface ChatState {
    conversations: ConversationSummary[]
    currentConversation: Conversation | null
    currentCollectionId: string | null
    messages: Message[]
    areConversationsLoading: boolean // Added for sidebar
    isConversationLoading: boolean  // Renamed from isLoading for active chat
    isSending: boolean
    error: string | null

    // Actions
    fetchConversations: () => Promise<void>
    fetchConversation: (id: string) => Promise<void>
    sendMessage: (query: string) => Promise<void>
    deleteConversation: (id: string) => Promise<void>
    renameConversation: (id: string, title: string) => Promise<void>
    startNewConversation: (collectionId?: string | null) => void
    setCollectionId: (id: string | null) => void
    clearError: () => void
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    currentConversation: null,
    currentCollectionId: null,
    messages: [],
    areConversationsLoading: false,
    isConversationLoading: false,
    isSending: false,
    error: null,

    fetchConversations: async () => {
        const { conversations } = get()
        // Only show loading if we don't have any conversations yet
        if (conversations.length === 0) {
            set({ areConversationsLoading: true })
        }
        set({ error: null })
        try {
            const rawConversations = await conversationService.getAllConversations()
            // Sort by timestamp descending (newest first)
            const sortedConversations = rawConversations.sort((a, b) => {
                const dateA = new Date(a.timestamp || a.created_at || 0).getTime()
                const dateB = new Date(b.timestamp || b.created_at || 0).getTime()
                return dateB - dateA
            })
            set({ conversations: sortedConversations, areConversationsLoading: false })
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch conversations'
            set({ error: message, areConversationsLoading: false })
        }
    },

    fetchConversation: async (id) => {
        set({ isConversationLoading: true, error: null })
        try {
            const conversation = await conversationService.getConversation(id)
            if (!conversation) {
                set({ error: 'Conversation not found', isConversationLoading: false })
                return
            }

            // Normalize messages
            const normalizedMessages = (conversation.messages || []).map((msg: any, index: number) => {
                let content = msg.content
                let sources: Source[] = []
                let suggestions: string[] = []

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

                    // Extract actual response text
                    content = content.response || content.answer || JSON.stringify(content)
                }

                return {
                    id: msg.id || `msg-${index}`,
                    role: msg.role,
                    content: content,
                    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                    sources: sources.length > 0 ? sources : undefined,
                    suggestions: suggestions.length > 0 ? suggestions : undefined,
                }
            })

            set({
                currentConversation: { ...conversation, id: (conversation as any)._id || conversation.id || id },
                messages: normalizedMessages,
                isConversationLoading: false,
            })
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch conversation'
            set({ error: message, isConversationLoading: false })
        }
    },

    sendMessage: async (query) => {
        const { currentConversation, messages, currentCollectionId } = get()

        // Add user message
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: query,
            timestamp: new Date(),
        }

        // Add loading assistant message
        const loadingMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
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

            // Handle response
            const answerContent = response.response || response.answer || 'No response received'

            // Parse sources from API response (backend returns top_documents)
            const rawDocs = response.top_documents || response.sources || []
            const sources: Source[] = rawDocs.map((doc: any) => ({
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

            // Replace loading message with actual response
            const assistantMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: answerContent,
                timestamp: new Date(),
                sources: sources.length > 0 ? sources : undefined,
                suggestions: response.suggestions || [],
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
        // Optimistically remove or just wait for API, but don't show full loading state
        // set({ areConversationsLoading: true, error: null }) 
        try {
            await conversationService.deleteConversation(id)
            set((state) => ({
                conversations: state.conversations.filter(c => c.id !== id),
                currentConversation: state.currentConversation?.id === id ? null : state.currentConversation,
                messages: state.currentConversation?.id === id ? [] : state.messages,
                areConversationsLoading: false,
            }))
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to delete conversation'
            set({ error: message, areConversationsLoading: false })
        }
    },

    renameConversation: async (id, title) => {
        try {
            // Optimistic update
            set((state) => ({
                conversations: state.conversations.map(c => 
                    c.id === id ? { ...c, title } : c
                ),
                currentConversation: state.currentConversation?.id === id 
                    ? { ...state.currentConversation, title } 
                    : state.currentConversation
            }))
            
            await conversationService.renameConversation(id, title)
        } catch (error: unknown) {
            // Revert on failure (could implement more robust rollback)
            const message = error instanceof Error ? error.message : 'Failed to rename conversation'
            set({ error: message })
            // Fetch to restore state
            get().fetchConversations()
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
