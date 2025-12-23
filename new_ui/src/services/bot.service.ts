import api from './api'
import type { Bot, Collection } from '@/types'

export const botService = {
    /**
     * Get all bots for a tenant
     */
    async getAllBots(tenantId: string): Promise<Bot[]> {
        try {
            const response = await api.get<{ tokens: any[] }>(
                `/api/v1/bots/tokens?tenant_id=${tenantId}`
            )
            // Normalize backend response
            const tokens = response.data.tokens || []
            return tokens.map((b: any) => ({
                id: b._id || b.id || b.bot_token,
                name: b.name || b.bot_name || 'Unnamed Bot',
                description: b.description || b.welcome_message || '',
                icon: b.icon_url || 'https://picsum.photos/id/1/200/200',
                collectionIds: b.collection_ids || [],
                stats: {
                    chats: b.stats?.chats || b.chat_count || 0,
                    rating: b.stats?.rating || b.rating || 4.5,
                },
                bot_token: b.bot_token,
                bot_name: b.name || b.bot_name,
                icon_url: b.icon_url,
                welcome_message: b.welcome_message,
                welcome_buttons: b.welcome_buttons,
                collection_ids: b.collection_ids,
                created_at: b.created_at,
                updated_at: b.updated_at,
                owner_id: b.owner || b.owner_id,
            }))
        } catch {
            return []
        }
    },

    /**
     * Get bot by token
     */
    async getBotByToken(botToken: string, tenantId: string): Promise<Bot | null> {
        try {
            const response = await api.get<any>(
                `/api/v1/bots/tokens/${botToken}?tenant_id=${tenantId}`
            )
            const b = response.data
            return {
                id: b._id || b.id || b.bot_token,
                name: b.name || b.bot_name || 'Unnamed Bot',
                description: b.description || b.welcome_message || '',
                icon: b.icon_url || 'https://picsum.photos/id/1/200/200',
                collectionIds: b.collection_ids || [],
                stats: {
                    chats: b.stats?.chats || b.chat_count || 0,
                    rating: b.stats?.rating || b.rating || 4.5,
                },
                bot_token: b.bot_token,
                bot_name: b.name || b.bot_name,
                icon_url: b.icon_url,
                welcome_message: b.welcome_message,
                welcome_buttons: b.welcome_buttons,
                collection_ids: b.collection_ids,
                created_at: b.created_at,
                updated_at: b.updated_at,
                owner_id: b.owner || b.owner_id,
            }
        } catch (error) {
            console.error("Error in getBotByToken:", error);
            return null
        }
    },

    /**
     * Create a new bot
     */
    async createBot(data: {
        bot_name: string
        tenant_id: string
        collection_ids?: string[]
        welcome_message?: string
        icon_url?: string
    }, iconFile?: File): Promise<{ bot_token: string }> {
        const formData = new FormData()
        formData.append('bot_name', data.bot_name)
        formData.append('tenant_id', data.tenant_id)

        // collection_ids is required by backend - send at least an empty array
        const collectionIds = data.collection_ids || []
        collectionIds.forEach((id) => formData.append('collection_ids', id))

        if (data.welcome_message) formData.append('welcome_message', data.welcome_message)
        if (data.icon_url) formData.append('icon_url', data.icon_url)
        if (iconFile) formData.append('icon', iconFile)

        const response = await api.post<{ bot_token: string }>(
            '/api/v1/bots/tokens',
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        return response.data
    },

    /**
     * Delete a bot
     */
    async deleteBot(botToken: string, tenantId: string): Promise<void> {
        await api.delete('/api/v1/bots/tokens', {
            data: { bot_token: botToken, tenant_id: tenantId },
        })
    },

    /**
     * Share a bot with another user
     */
    async shareBot(data: {
        bot_token: string
        user_email: string
        role: 'viewer' | 'contributor' | 'admin'
        tenant_id?: string
    }): Promise<void> {
        await api.post('/api/v1/bots/share', {
            bot_token: data.bot_token,
            user: data.user_email,
            role: data.role === 'viewer' ? 'read-only' : data.role,
            tenant_id: data.tenant_id,
        })
    },

    /**
     * Update an existing bot
     */
    async updateBot(data: {
        bot_token: string
        bot_name?: string
        tenant_id: string
        collection_ids?: string[]
        welcome_message?: string
        welcome_buttons?: Array<{ label: string; action: string }>
        icon_url?: string
    }, iconFile?: File): Promise<any> {
        const formData = new FormData()
        formData.append('bot_token', data.bot_token)
        formData.append('tenant_id', data.tenant_id)

        if (data.bot_name) formData.append('name', data.bot_name)
        if (data.collection_ids) formData.append('collection_ids', JSON.stringify(data.collection_ids))
        if (data.welcome_message) formData.append('welcome_message', data.welcome_message)
        if (data.welcome_buttons) formData.append('welcome_buttons', JSON.stringify(data.welcome_buttons))
        if (data.icon_url) formData.append('icon_url', data.icon_url)
        if (iconFile) formData.append('icon', iconFile)

        const response = await api.put(
            '/api/v1/bots/tokens',
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        return response.data
    },

    /**
     * Generate embed code for a bot
     */
    async generateEmbedCode(botToken: string, tenantId: string): Promise<{ embed_code: string }> {
        const response = await api.post<{ embed_code: string }>('/api/v1/bots/embed-codes', {
            bot_token: botToken,
            tenant_id: tenantId,
        })
        return response.data
    },

    /**
     * Get users a bot is shared with
     */
    async getSharedUsers(botToken: string, tenantId: string): Promise<any[]> {
        try {
            const response = await api.get<{ shared_users: any[] }>(
                `/api/v1/bots/shared-users?bot_token=${botToken}&tenant_id=${tenantId}`
            )
            return response.data.shared_users || []
        } catch {
            return []
        }
    },

    /**
     * Remove a shared user from a bot
     */
    async removeSharedUser(botToken: string, userEmail: string): Promise<void> {
        await api.post('/api/v1/bots/shared-users/remove', {
            bot_token: botToken,
            user: userEmail,
        })
    },

    /**
     * Search with bot
     */
    async searchBotQuery(botToken: string, query: string, conversationId?: string): Promise<any> {
        const response = await api.post('/api/v1/bots/search', {
            bot_token: botToken,
            query,
            conversation_id: conversationId,
        })
        return response.data
    },
}

export const collectionService = {
    /**
     * Get all collections for a tenant
     */
    async getAllCollections(tenantId: string): Promise<Collection[]> {
        try {
            const response = await api.get<any>(
                `/api/v1/collections/?tenant_id=${tenantId}`
            )
            // Backend returns array with collection_id - use that as the primary ID
            const data = Array.isArray(response.data) ? response.data : (response.data as any).collections || []
            return data.map((c: any) => ({
                // IMPORTANT: Use collection_id as the id since that's what the bot creation API expects
                id: c.collection_id || c._id || c.id,
                name: c.collection_name || c.name || 'Unnamed',
                fileCount: c.file_count || c.document_count || 0,
                size: c.size || 'Unknown',
                lastUpdated: c.updated_at || c.created_at || 'Unknown',
                type: c.type || 'general',
                collection_name: c.collection_name || c.name,
                description: c.description,
                file_count: c.file_count || c.document_count || 0,
                document_count: c.document_count || c.file_count || 0,
                created_at: c.created_at,
                tenant_id: c.tenant_id,
            }))
        } catch {
            return []
        }
    },

    /**
     * Get collection details
     */
    async getCollectionDetails(collectionId: string): Promise<Collection | null> {
        try {
            const response = await api.get<any>(
                `/api/v1/collections/${collectionId}`
            )
            const c = response.data
            return {
                id: c._id || c.id || c.collection_id,
                name: c.collection_name || c.name || 'Unnamed',
                fileCount: c.file_count || c.document_count || 0,
                size: c.size || 'Unknown',
                lastUpdated: c.updated_at || c.created_at || 'Unknown',
                type: c.type || 'general',
                collection_name: c.collection_name || c.name,
                description: c.description,
                file_count: c.file_count || c.document_count || 0,
                document_count: c.document_count || c.file_count || 0,
                created_at: c.created_at,
                tenant_id: c.tenant_id,
            }
        } catch {
            return null
        }
    },

    /**
     * Create a new collection
     */
    async createCollection(name: string, tenantId: string, description?: string): Promise<Collection> {
        const response = await api.post<any>('/api/v1/collections/', {
            name,
            description,
            tenant_id: tenantId,
        })
        const c = response.data
        return {
            id: c._id || c.id || c.collection_id,
            name: c.collection_name || c.name || name,
            fileCount: 0,
            size: '0 MB',
            lastUpdated: 'Just now',
            type: 'general',
        }
    },

    /**
     * Delete a collection
     */
    async deleteCollection(collectionId: string): Promise<void> {
        await api.delete(`/api/v1/collections/${collectionId}`)
    },

    /**
     * Upload documents to a collection
     */
    async uploadDocuments(
        collectionId: string,
        files: File[],
        onProgress?: (progress: number) => void
    ): Promise<{ message: string }> {
        const formData = new FormData()
        formData.append('collection_id', collectionId)
        files.forEach((file) => {
            formData.append('files', file)
        })

        const response = await api.post<{ message: string }>(
            '/api/v1/collections/upload',
            formData,
            {
                headers: { 'Content-Type': undefined },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total && onProgress) {
                        const progress = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        )
                        onProgress(progress)
                    }
                },
            }
        )
        return response.data
    },

    /**
     * Get documents in a collection
     */
    async getDocuments(collectionId: string): Promise<any[]> {
        try {
            const response = await api.post<any>(
                '/api/v1/collections/documents',
                { collection_id: collectionId }
            )
            return Array.isArray(response.data) ? response.data : (response.data.documents || [])
        } catch {
            return []
        }
    },

    /**
     * Get storage and vector database statistics
     */
    async getStorageStats(tenantId: string): Promise<{
        storage: {
            used_bytes: number;
            used_formatted: string;
            limit_bytes: number;
            limit_formatted: string;
            usage_percent: number;
            file_count: number;
        };
        vectors: {
            total_vectors: number;
            total_formatted: string;
            index_status: string;
        };
        documents: {
            total: number;
            processed: number;
            pending: number;
            by_type: Record<string, number>;
        };
    } | null> {
        try {
            const response = await api.get<any>(
                `/api/v1/collections/stats?tenant_id=${tenantId}`
            )
            return response.data
        } catch {
            return null
        }
    },
}

export default { botService, collectionService }
