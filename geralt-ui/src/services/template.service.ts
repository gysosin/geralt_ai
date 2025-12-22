import api from './api'
import type { BotTemplate, CreateTemplateCommand } from '@/types'

const BASE_PATH = '/api/v1/bots'

export const templateService = {
    /**
     * Get all templates
     */
    async getAllTemplates(): Promise<BotTemplate[]> {
        const response = await api.get<{ templates: BotTemplate[] }>(`${BASE_PATH}/templates`)
        return response.data.templates || []
    },

    /**
     * Create a new template
     */
    async createTemplate(
        data: CreateTemplateCommand,
        iconFile?: File
    ): Promise<{ message: string; template_id: string }> {
        const formData = new FormData()
        formData.append('name', data.name)
        formData.append('description', data.description)
        formData.append('prompt', data.prompt)

        if (data.icon_url) formData.append('icon_url', data.icon_url)
        if (data.welcome_message) formData.append('welcome_message', data.welcome_message)
        if (data.welcome_buttons) {
            formData.append('welcome_buttons', JSON.stringify(data.welcome_buttons))
        }
        if (data.category) formData.append('category', data.category)
        if (data.is_public !== undefined) formData.append('is_public', String(data.is_public))
        if (iconFile) formData.append('image', iconFile)

        const response = await api.post<{ message: string; template_id: string }>(
            `${BASE_PATH}/templates`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        return response.data
    },
}

export default templateService
