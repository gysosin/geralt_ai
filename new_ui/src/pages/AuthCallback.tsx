import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/src/store'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export function AuthCallback() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { setToken } = useAuthStore()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

    useEffect(() => {
        const token = searchParams.get('token')

        if (token) {
            setToken(token)
            setStatus('success')
            setTimeout(() => {
                navigate('/')
            }, 2000)
        } else {
            setStatus('error')
        }
    }, [searchParams, setToken, navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md bg-surface rounded-2xl border border-white/10 p-8 text-center">
                <div className="flex justify-center mb-6">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">G</span>
                    </div>
                </div>

                {status === 'loading' && (
                    <div>
                        <Loader2 className="h-12 w-12 text-violet-500 mx-auto mb-4 animate-spin" />
                        <h2 className="text-xl font-semibold text-white mb-2">Signing you in...</h2>
                        <p className="text-gray-400">
                            Please wait while we complete the authentication.
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div>
                        <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Welcome!</h2>
                        <p className="text-gray-400 mb-4">
                            Authentication successful. Redirecting to dashboard...
                        </p>
                        <div className="flex justify-center gap-1">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-2 w-2 rounded-full bg-violet-500 animate-pulse"
                                    style={{ animationDelay: `${i * 200}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div>
                        <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <XCircle className="h-8 w-8 text-red-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
                        <p className="text-gray-400 mb-6">
                            We couldn't complete the sign-in process. Please try again.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-4 py-2 border border-white/10 rounded-xl text-white hover:bg-white/5 transition-colors"
                            >
                                Back to Login
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl text-white hover:shadow-lg transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AuthCallback
