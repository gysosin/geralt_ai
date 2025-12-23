import api from './api'

export interface AIModel {
    id: string
    name: string
    provider: string
}

export const configurationService = {
    /**
     * Get available AI models
     */
    async getAvailableModels(): Promise<{ models: AIModel[], default_model: string }> {
        try {
            const response = await api.get<any>('/api/v1/bots/config')
            return response.data
        } catch {
            return { models: [], default_model: '' }
        }
    }
}

export default configurationService