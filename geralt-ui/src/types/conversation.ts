export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isLoading?: boolean
  // Extended fields from API response
  sources?: Source[]
  suggestions?: string[]
  metadata?: Record<string, unknown>
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  collectionId?: string
  createdAt: string
  updatedAt: string
}

export interface ConversationListItem {
  id: string
  title: string
  lastMessage?: string
  createdAt?: string
  updatedAt?: string
  messageCount?: number
  // Backend fields (snake_case)
  conversation_id?: string
  first_message?: string
  created_at?: string
  bot_token?: string
}

export interface SearchQuery {
  query: string
  conversationId?: string
  collectionId?: string
}

export interface SearchResponse {
  answer?: string
  response?: string
  sources?: Source[]
  conversationId?: string
  conversation_id?: string
  metadata?: Record<string, unknown>
  suggestions?: string[]
  top_documents?: unknown[]
}

export interface Source {
  id: string
  title: string
  content: string
  score: number
  metadata?: Record<string, unknown>
}
