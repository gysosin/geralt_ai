import api from './api'
import type {
  Bot,
  CreateBotCommand,
  UpdateBotCommand,
  ShareBotCommand,
  BotEmbedCode,
  Collection,
} from '@/types'

const BASE_PATH = '/api/v1'

export const botService = {
  async getAllBots(tenantId: string): Promise<Bot[]> {
    const response = await api.get<{ tokens: any[] }>(
      `${BASE_PATH}/bots/tokens?tenant_id=${tenantId}`
    )
    // Normalize backend response
    const tokens = response.data.tokens || []
    return tokens.map((b: any) => ({
      id: b._id || b.id || b.bot_token,
      bot_token: b.bot_token,
      bot_name: b.name || b.bot_name,
      icon_url: b.icon_url,
      welcome_message: b.welcome_message,
      welcome_buttons: b.welcome_buttons,
      collection_ids: b.collection_ids,
      created_at: b.created_at,
      updated_at: b.updated_at,
      owner_id: b.owner || b.owner_id,
      shared_with: b.shared_with,
    }))
  },

  async getBotByToken(botToken: string, tenantId: string): Promise<Bot> {
    const response = await api.get<{ bot_details: Bot }>(
      `${BASE_PATH}/bots/tokens/${botToken}?tenant_id=${tenantId}`
    )
    return response.data.bot_details
  },

  async createBot(data: CreateBotCommand & { tenant_id: string }, iconFile?: File): Promise<{ bot_token: string }> {
    const formData = new FormData()
    formData.append('name', data.bot_name)
    formData.append('tenant_id', data.tenant_id)
    
    if (data.collection_ids && data.collection_ids.length > 0) {
      formData.append('collection_ids', JSON.stringify(data.collection_ids))
    }
    if (data.welcome_message) formData.append('welcome_message', data.welcome_message)
    if (data.welcome_buttons) formData.append('welcome_buttons', JSON.stringify(data.welcome_buttons))
    if (data.icon_url) formData.append('icon_url', data.icon_url)
    if (iconFile) formData.append('icon', iconFile)
    
    const response = await api.post<{ bot_token: string }>(
      `${BASE_PATH}/bots/tokens`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  async updateBot(data: UpdateBotCommand & { tenant_id: string }, iconFile?: File): Promise<Bot> {
    const formData = new FormData()
    formData.append('bot_token', data.bot_token)
    formData.append('tenant_id', data.tenant_id)
    
    if (data.bot_name) formData.append('name', data.bot_name)
    if (data.collection_ids) formData.append('collection_ids', JSON.stringify(data.collection_ids))
    if (data.welcome_message) formData.append('welcome_message', data.welcome_message)
    if (data.welcome_buttons) formData.append('welcome_buttons', JSON.stringify(data.welcome_buttons))
    if (data.icon_url) formData.append('icon_url', data.icon_url)
    if (iconFile) formData.append('icon', iconFile)
    
    const response = await api.put<Bot>(
      `${BASE_PATH}/bots/tokens`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  async deleteBot(botToken: string, tenantId: string): Promise<void> {
    await api.delete(`${BASE_PATH}/bots/tokens`, {
      data: { bot_token: botToken, tenant_id: tenantId },
    })
  },

  async shareBot(data: ShareBotCommand & { tenant_id?: string }): Promise<void> {
    await api.post(`${BASE_PATH}/bots/share`, {
      bot_token: data.bot_token,
      user: data.user_email,
      role: data.role === 'viewer' ? 'read-only' : data.role,
      tenant_id: data.tenant_id,
    })
  },

  async generateEmbedCode(botToken: string, tenantId: string): Promise<BotEmbedCode> {
    const response = await api.post<BotEmbedCode>(`${BASE_PATH}/bots/embed-codes`, {
      bot_token: botToken,
      tenant_id: tenantId,
    })
    return response.data
  },

  async searchBotQuery(botToken: string, query: string, conversationId?: string): Promise<any> {
    const response = await api.post(`${BASE_PATH}/bots/search`, {
      bot_token: botToken,
      query,
      conversation_id: conversationId,
    })
    return response.data
  },

  async getAllCollections(tenantId: string): Promise<Collection[]> {
    const response = await api.get<any[]>(
      `${BASE_PATH}/collections/?tenant_id=${tenantId}`
    )
    // Backend returns array, normalize _id to id
    const data = Array.isArray(response.data) ? response.data : (response.data as any).collections || []
    return data.map((c: any) => ({
      id: c._id || c.id || c.collection_id,
      collection_name: c.collection_name || c.name,
      description: c.description,
      file_count: c.file_count || c.document_count || 0,
      created_at: c.created_at,
      tenant_id: c.tenant_id,
    }))
  },

  async createCollection(name: string, tenantId: string, description?: string): Promise<Collection> {
    const response = await api.post<Collection>(`${BASE_PATH}/collections/`, {
      name,
      description,
      tenant_id: tenantId,
    })
    return response.data
  },

  async deleteCollection(collectionId: string): Promise<void> {
    await api.delete(`${BASE_PATH}/collections/${collectionId}`)
  },

  async getSharedUsers(botToken: string, tenantId: string): Promise<any[]> {
    const response = await api.get<{ shared_users: any[] }>(
      `${BASE_PATH}/bots/shared-users?bot_token=${botToken}&tenant_id=${tenantId}`
    )
    return response.data.shared_users || []
  },

  async removeSharedUser(botToken: string, userEmail: string): Promise<void> {
    await api.post(`${BASE_PATH}/bots/shared-users/remove`, {
      bot_token: botToken,
      user: userEmail,
    })
  },
}

export default botService
