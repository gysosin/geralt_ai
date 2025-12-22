import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/src/store'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
    children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, token } = useAuthStore()
    const location = useLocation()

    if (!isAuthenticated || !token) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}

interface PublicRouteProps {
    children: ReactNode
}

export function PublicRoute({ children }: PublicRouteProps) {
    const { isAuthenticated } = useAuthStore()

    if (isAuthenticated) {
        return <Navigate to="/" replace />
    }

    return <>{children}</>
}

export default ProtectedRoute
