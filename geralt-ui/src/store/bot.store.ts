import { create } from 'zustand'
import type { Bot, Collection, CreateBotCommand, UpdateBotCommand, ShareBotCommand } from '@/types'
import { botService } from '@/services'
import { useAuthStore } from './auth.store'

// Helper to get tenant_id from auth store
const getTenantId = (): string => {
  const user = useAuthStore.getState().user
  return user?.tenant_id || 'default'
}

interface BotState {
  bots: Bot[]
  collections: Collection[]
  currentBot: Bot | null
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchBots: () => Promise<void>
  fetchBotByToken: (token: string) => Promise<void>
  createBot: (data: CreateBotCommand, iconFile?: File) => Promise<string>
  updateBot: (data: UpdateBotCommand, iconFile?: File) => Promise<void>
  deleteBot: (token: string) => Promise<void>
  shareBot: (data: ShareBotCommand) => Promise<void>
  generateEmbedCode: (token: string) => Promise<string>
  fetchCollections: () => Promise<void>
  clearError: () => void
  setCurrentBot: (bot: Bot | null) => void
}

export const useBotStore = create<BotState>((set) => ({
  bots: [],
  collections: [],
  currentBot: null,
  isLoading: false,
  error: null,

  fetchBots: async () => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      const bots = await botService.getAllBots(tenantId)
      set({ bots, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bots'
      set({ error: message, isLoading: false })
    }
  },

  fetchBotByToken: async (token) => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      const bot = await botService.getBotByToken(token, tenantId)
      set({ currentBot: bot, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bot'
      set({ error: message, isLoading: false })
    }
  },

  createBot: async (data, iconFile) => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      const response = await botService.createBot({ ...data, tenant_id: tenantId }, iconFile)
      set({ isLoading: false })
      return response.bot_token
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create bot'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  updateBot: async (data, iconFile) => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      await botService.updateBot({ ...data, tenant_id: tenantId }, iconFile)
      set({ isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update bot'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  deleteBot: async (token) => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      await botService.deleteBot(token, tenantId)
      set((state) => ({
        bots: state.bots.filter((b) => b.bot_token !== token),
        currentBot: state.currentBot?.bot_token === token ? null : state.currentBot,
        isLoading: false,
      }))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete bot'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  shareBot: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      await botService.shareBot({ ...data, tenant_id: tenantId })
      set({ isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to share bot'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  generateEmbedCode: async (token) => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      const response = await botService.generateEmbedCode(token, tenantId)
      set({ isLoading: false })
      return response.embed_code
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate embed code'
      set({ error: message, isLoading: false })
      throw error
    }
  },

  fetchCollections: async () => {
    set({ isLoading: true, error: null })
    try {
      const tenantId = getTenantId()
      const collections = await botService.getAllCollections(tenantId)
      set({ collections, isLoading: false })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch collections'
      set({ error: message, isLoading: false })
    }
  },

  setCurrentBot: (bot) => set({ currentBot: bot }),
  clearError: () => set({ error: null }),
}))

export default useBotStore
