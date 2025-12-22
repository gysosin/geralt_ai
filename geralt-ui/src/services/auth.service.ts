import api from './api'
import type { LoginCredentials, RegisterCredentials, AuthResponse, User } from '@/types'

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/v1/auth/login', credentials)
    return response.data
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/v1/auth/register', credentials)
    return response.data
  },

  async getProfile(): Promise<User> {
    const response = await api.get<User>('/api/v1/users/profile')
    return response.data
  },

  async updateProfile(data: FormData): Promise<User> {
    const response = await api.put<User>('/api/v1/users/profile', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  async deleteProfile(): Promise<void> {
    await api.delete('/api/v1/users/profile')
  },

  getMicrosoftLoginUrl(): string {
    return `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/auth/login/microsoft`
  },

  logout(): void {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
}

export default authService
