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
    role?: string
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
    username: string
    email: string
    password: string
    firstname: string
    lastname: string
    tenant_id?: string
}

// Backend auth response shape
export interface AuthResponse {
    message: string
    status: number
    token?: string
    user?: {
        email: string
        username?: string
        tenant_id?: string
        role?: string
    }
}

export interface ApiError {
    message: string
    status?: number
    detail?: string
    errors?: Record<string, string[]>
}
