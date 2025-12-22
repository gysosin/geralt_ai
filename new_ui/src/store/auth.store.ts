import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, LoginCredentials, RegisterCredentials } from '@/src/types'
import { authService } from '@/src/services'

interface AuthState {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null

    // Actions
    login: (credentials: LoginCredentials) => Promise<void>
    register: (credentials: RegisterCredentials) => Promise<void>
    logout: () => void
    setToken: (token: string) => void
    fetchProfile: () => Promise<void>
    updateProfile: (data: FormData) => Promise<void>
    clearError: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (credentials) => {
                set({ isLoading: true, error: null })
                try {
                    const response = await authService.login(credentials)
                    if (response.token) {
                        localStorage.setItem('token', response.token)
                        set({
                            token: response.token,
                            isAuthenticated: true,
                            isLoading: false,
                        })
                        // Fetch profile after login
                        get().fetchProfile()
                    } else {
                        throw new Error(response.message || 'Login failed - no token received')
                    }
                } catch (error: unknown) {
                    let message = 'Login failed'
                    if (error && typeof error === 'object' && 'response' in error) {
                        const axiosError = error as { response?: { data?: { detail?: string; message?: string } } }
                        message = axiosError.response?.data?.detail || axiosError.response?.data?.message || message
                    } else if (error instanceof Error) {
                        message = error.message
                    }
                    set({ error: message, isLoading: false })
                    throw error
                }
            },

            register: async (credentials) => {
                set({ isLoading: true, error: null })
                try {
                    const response = await authService.register(credentials)
                    // After successful registration, log the user in
                    if (response.status === 201 || response.message?.toLowerCase().includes('success')) {
                        // Auto-login after registration
                        await get().login({ email: credentials.email, password: credentials.password })
                    } else {
                        throw new Error(response.message || 'Registration failed')
                    }
                } catch (error: unknown) {
                    let message = 'Registration failed'
                    if (error && typeof error === 'object' && 'response' in error) {
                        const axiosError = error as { response?: { data?: { detail?: string; message?: string } } }
                        message = axiosError.response?.data?.detail || axiosError.response?.data?.message || message
                    } else if (error instanceof Error) {
                        message = error.message
                    }
                    set({ error: message, isLoading: false })
                    throw error
                }
            },

            logout: () => {
                authService.logout()
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    error: null,
                })
            },

            setToken: (token) => {
                localStorage.setItem('token', token)
                set({ token, isAuthenticated: true })
                get().fetchProfile()
            },

            fetchProfile: async () => {
                set({ isLoading: true })
                try {
                    const user = await authService.getProfile()
                    set({ user, isLoading: false })
                } catch (error: unknown) {
                    // Profile fetch failed, but user might still be authenticated
                    // Just log and continue - user object will be null
                    console.warn('Failed to fetch profile:', error)
                    set({ isLoading: false })
                }
            },

            updateProfile: async (data) => {
                set({ isLoading: true, error: null })
                try {
                    const user = await authService.updateProfile(data)
                    set({ user, isLoading: false })
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Failed to update profile'
                    set({ error: message, isLoading: false })
                    throw error
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)

export default useAuthStore
