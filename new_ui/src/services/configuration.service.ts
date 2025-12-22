import api from './api'
import type { APIConfiguration, WebhookConfiguration } from '@/types'

export const configurationService = {
    /**
     * Get all API configurations
     */
    async getAPIConfigurations(): Promise<APIConfiguration[]> {
        try {
            const response = await api.get<any>('/api/v1/users/api-configurations')
            const data = response.data?.configurations || response.data || []
            return Array.isArray(data) ? data : []
        } catch {
            // Return default configurations if API not available
            return [
                {
                    id: 'default-openai',
                    name: 'OpenAI GPT-4',
                    provider: 'openai',
                    apiKey: '••••••••••••••••',
                    model: 'gpt-4-turbo-preview',
                    isDefault: true,
                    isActive: true,
                    rateLimit: 100,
                },
                {
                    id: 'default-gemini',
                    name: 'Google Gemini',
                    provider: 'gemini',
                    apiKey: '••••••••••••••••',
                    model: 'gemini-1.5-pro',
                    isDefault: false,
                    isActive: true,
                    rateLimit: 60,
                },
            ]
        }
    },

    /**
     * Create or update an API configuration
     */
    async saveAPIConfiguration(config: APIConfiguration): Promise<APIConfiguration> {
        if (config.id) {
            const response = await api.put<APIConfiguration>(
                `/api/v1/users/api-configurations/${config.id}`,
                config
            )
            return response.data
        } else {
            const response = await api.post<APIConfiguration>(
                '/api/v1/users/api-configurations',
                config
            )
            return response.data
        }
    },

    /**
     * Delete an API configuration
     */
    async deleteAPIConfiguration(configId: string): Promise<void> {
        await api.delete(`/api/v1/users/api-configurations/${configId}`)
    },

    /**
     * Set a configuration as default
     */
    async setDefaultConfiguration(configId: string): Promise<void> {
        await api.post(`/api/v1/users/api-configurations/${configId}/set-default`)
    },

    /**
     * Test an API configuration
     */
    async testAPIConfiguration(config: Partial<APIConfiguration>): Promise<{ success: boolean; message: string }> {
        try {
            const response = await api.post<{ success: boolean; message: string }>(
                '/api/v1/users/api-configurations/test',
                config
            )
            return response.data
        } catch (error: any) {
            return {
                success: false,
                message: error?.response?.data?.message || 'Connection test failed'
            }
        }
    },

    /**
     * Get all webhook configurations
     */
    async getWebhookConfigurations(): Promise<WebhookConfiguration[]> {
        try {
            const response = await api.get<any>('/api/v1/users/webhooks')
            const data = response.data?.webhooks || response.data || []
            return Array.isArray(data) ? data : []
        } catch {
            return []
        }
    },

    /**
     * Create or update a webhook configuration
     */
    async saveWebhookConfiguration(webhook: WebhookConfiguration): Promise<WebhookConfiguration> {
        if (webhook.id) {
            const response = await api.put<WebhookConfiguration>(
                `/api/v1/users/webhooks/${webhook.id}`,
                webhook
            )
            return response.data
        } else {
            const response = await api.post<WebhookConfiguration>(
                '/api/v1/users/webhooks',
                webhook
            )
            return response.data
        }
    },

    /**
     * Delete a webhook configuration
     */
    async deleteWebhookConfiguration(webhookId: string): Promise<void> {
        await api.delete(`/api/v1/users/webhooks/${webhookId}`)
    },

    /**
     * Test a webhook
     */
    async testWebhook(webhookId: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await api.post<{ success: boolean; message: string }>(
                `/api/v1/users/webhooks/${webhookId}/test`
            )
            return response.data
        } catch (error: any) {
            return {
                success: false,
                message: error?.response?.data?.message || 'Webhook test failed'
            }
        }
    },

    /**
     * Get available AI models for a provider
     */
    getAvailableModels(provider: APIConfiguration['provider']): string[] {
        const models: Record<string, string[]> = {
            openai: ['gpt-4-turbo', 'gpt-4', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
            gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-pro'],
            mistral: ['mistral-large', 'mistral-medium', 'mistral-small', 'codestral'],
            anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'],
            custom: [],
        }
        return models[provider] || []
    },
}

export default configurationService
