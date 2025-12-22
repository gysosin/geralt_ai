import React, { useState } from 'react';
import { FEATURES } from '../constants';
import { ArrowRight, Lock, Mail, Github, User, ArrowLeft, CheckCircle, Loader2, AtSign } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store';
import { authService } from '@/src/services';

interface AuthProps {
  initialMode?: 'login' | 'signup' | 'forgot-password';
}

const Auth: React.FC<AuthProps> = ({ initialMode = 'login' }) => {
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuthStore();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');

  const isLogin = initialMode === 'login';
  const isSignup = initialMode === 'signup';
  const isForgot = initialMode === 'forgot-password';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isForgot) {
      setResetSent(true);
      return;
    }

    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ username, email, password, firstname, lastname });
      }
      navigate('/');
    } catch (err) {
      // Error is handled by the store
      console.error('Auth error:', err);
    }
  };

  const handleMicrosoftLogin = () => {
    window.location.href = authService.getMicrosoftLoginUrl();
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Marketing */}
      <div className="hidden lg:flex w-1/2 bg-surface relative overflow-hidden items-center justify-center p-12 border-r border-white/5">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-violet-900/20 to-black pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mb-8 shadow-2xl shadow-violet-900/30">
            <span className="text-3xl font-bold text-white">G</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            The Future of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Document Intelligence</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10 leading-relaxed">
            Experience the power of Geralt AI. Autonomous agents, semantic search, and enterprise-grade security for your data.
          </p>

          <div className="space-y-6">
            {FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-white font-medium">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background relative">
        <div className="absolute top-0 right-0 p-8">
          {!isForgot && (
            isLogin ? (
              <span className="text-sm text-gray-500">Don't have an account? <Link to="/signup" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">Sign up</Link></span>
            ) : (
              <span className="text-sm text-gray-500">Already have an account? <Link to="/login" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">Sign in</Link></span>
            )
          )}
          {isForgot && (
            <Link to="/login" className="text-sm text-gray-500 hover:text-white flex items-center gap-2 transition-colors">
              <ArrowLeft size={16} /> Back to Sign In
            </Link>
          )}
        </div>

        {isForgot && resetSent ? (
          <div className="w-full max-w-md text-center animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Check your email</h2>
            <p className="text-gray-400 mb-8">
              We've sent a password reset link to your email address. Please follow the instructions to reset your password.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-8">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold text-white">
                {isForgot ? 'Reset Password' : (isLogin ? 'Welcome back' : 'Create an account')}
              </h2>
              <p className="mt-2 text-gray-400">
                {isForgot
                  ? 'Enter your email to receive a reset link.'
                  : (isLogin ? 'Enter your credentials to access the workspace.' : 'Get started with your free enterprise workspace.')}
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <>
                  {/* Username field */}
                  <div className="animate-fade-in">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Username</label>
                    <div className="relative group">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-500 transition-colors" size={18} />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-surface border border-white/10 rounded-xl px-10 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
                        placeholder="geralt_of_rivia"
                        required={isSignup}
                        disabled={isLoading}
                        minLength={3}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-1">Used for login and identification</p>
                  </div>

                  {/* First & Last Name */}
                  <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">First Name</label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-500 transition-colors" size={18} />
                        <input
                          type="text"
                          value={firstname}
                          onChange={(e) => setFirstname(e.target.value)}
                          className="w-full bg-surface border border-white/10 rounded-xl px-10 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
                          placeholder="Geralt"
                          required={isSignup}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Last Name</label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-500 transition-colors" size={18} />
                        <input
                          type="text"
                          value={lastname}
                          onChange={(e) => setLastname(e.target.value)}
                          className="w-full bg-surface border border-white/10 rounded-xl px-10 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
                          placeholder="of Rivia"
                          required={isSignup}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-500 transition-colors" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-xl px-10 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
                    placeholder="geralt@rivia.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {!isForgot && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-500 transition-colors" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-xl px-10 py-3 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
                      placeholder="••••••••"
                      required={!isForgot}
                      disabled={isLoading}
                      minLength={isSignup ? 6 : 1}
                    />
                  </div>
                  {isSignup && (
                    <p className="text-xs text-gray-500 mt-1 ml-1">Minimum 6 characters</p>
                  )}
                  {isLogin && (
                    <div className="flex justify-end mt-2">
                      <Link to="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Forgot password?</Link>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-violet-900/25 transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {isForgot ? 'Send Reset Link' : (isLogin ? 'Sign In to Workspace' : 'Create Account')}
                    {!isForgot && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                  </>
                )}
              </button>
            </form>

            {!isForgot && (
              <div className="animate-fade-in">
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-background text-gray-500">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl hover:bg-white/5 text-gray-300 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.55 21H3v-8.55h8.55V21zM21 21h-8.55v-8.55H21V21zm-9.45-9.45H3V3h8.55v8.55zm9.45 0h-8.55V3H21v8.55z" fill="#f25022" /><path d="M21 3v8.55h-8.55V3H21z" fill="#7fba00" /><path d="M11.55 21v-8.55H3V21h8.55z" fill="#00a4ef" /><path d="M21 21v-8.55h-8.55V21H21z" fill="#ffb900" /><path d="M3 11.55V3h8.55v8.55H3z" fill="#f25022" /></svg>
                    Microsoft
                  </button>
                  <button
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl hover:bg-white/5 text-gray-300 transition-colors disabled:opacity-50"
                  >
                    <Github size={20} />
                    GitHub
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;