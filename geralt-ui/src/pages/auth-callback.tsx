import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, XCircle, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/store'
import { useState } from 'react'

export function AuthCallbackPage() {
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
        navigate('/dashboard')
      }, 2000)
    } else {
      setStatus('error')
    }
  }, [searchParams, setToken, navigate])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center">
                <Bot className="h-8 w-8 text-white" />
              </div>
            </div>
            
            {status === 'loading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                <h2 className="text-xl font-semibold mb-2">Signing you in...</h2>
                <p className="text-muted-foreground">
                  Please wait while we complete the authentication.
                </p>
              </motion.div>
            )}
            
            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
                <p className="text-muted-foreground mb-4">
                  Authentication successful. Redirecting to dashboard...
                </p>
                <div className="flex justify-center">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            
            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Authentication Failed</h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't complete the sign-in process. Please try again.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => navigate('/login')}>
                    Back to Login
                  </Button>
                  <Button variant="gradient" onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default AuthCallbackPage
