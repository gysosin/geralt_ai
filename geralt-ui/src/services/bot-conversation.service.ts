import api from './api'

export interface BotConversation {
    conversation_id: string
    first_question: string
    name: string
    created_at?: string
}

export interface BotConversationDetail {
    _id: string
    messages: BotMessage[]
    username: string
}

export interface BotMessage {
    content: string
    role: 'user' | 'assistant'
    timestamp: string
}

const BASE_PATH = '/api/v1/bots'

export const botConversationService = {
    /**
     * Get all conversations for a bot
     */
    async getAllBotConversations(botToken: string): Promise<BotConversation[]> {
        const response = await api.get<{ conversations: BotConversation[] }>(
            `${BASE_PATH}/conversations?bot_token=${botToken}`
        )
        return response.data.conversations || []
    },

    /**
     * Get a specific conversation by ID
     */
    async getBotConversation(
        botToken: string,
        conversationId: string
    ): Promise<BotConversationDetail> {
        const response = await api.get<BotConversationDetail>(
            `${BASE_PATH}/conversations/${conversationId}?bot_token=${botToken}`
        )
        return response.data
    },

    /**
     * Rename a conversation
     */
    async renameConversation(
        botToken: string,
        conversationId: string,
        name: string
    ): Promise<{ message: string }> {
        const response = await api.put<{ message: string }>(
            `${BASE_PATH}/conversations`,
            {
                bot_token: botToken,
                conversation_id: conversationId,
                name,
            }
        )
        return response.data
    },

    /**
     * Delete a conversation
     */
    async deleteConversation(
        botToken: string,
        conversationId: string
    ): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(
            `${BASE_PATH}/conversations/${conversationId}?bot_token=${botToken}`
        )
        return response.data
    },
}

export default botConversationService
