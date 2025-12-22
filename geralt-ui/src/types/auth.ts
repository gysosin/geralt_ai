export interface User {
  id: string
  email: string
  firstname: string
  lastname: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
  tenant_id?: string
  username?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  firstname: string
  lastname: string
}

export interface AuthResponse {
  token: string
  user: User
  message?: string
}

export interface ApiError {
  message: string
  status?: number
  errors?: Record<string, string[]>
}
