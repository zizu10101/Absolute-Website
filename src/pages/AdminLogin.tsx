import { useAuth } from '../context/AuthContext';
import { AdminPage } from './AdminPage';
import { ShieldAlert, LogIn } from 'lucide-react';
import React, { useState } from 'react';

export function AdminLogin() {
  const { user, isAdmin, isLoading, login, loginWithEmail, logout, devLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-zinc-200 rounded-full"></div>
          <div className="h-4 w-32 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminPage />;
  }

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoggingIn(true);
    try {
      await login();
    } catch (err: any) {
      setError(err.message || "Google login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setIsLoggingIn(true);
    try {
      await loginWithEmail(email);
    } catch (err: any) {
      setError(err.message || "Email login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="bg-white p-10 rounded-[2rem] shadow-2xl shadow-zinc-200/50 max-w-md w-full border border-zinc-100">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-[var(--primary-color)]">
            <ShieldAlert size={40} />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-zinc-900">Admin Portal</h1>
            <p className="text-zinc-500 text-sm">Please sign in with your authorized account to manage the store.</p>
          </div>

          {(error || (user && !isAdmin)) && (
            <div className="w-full space-y-4">
              <div className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
                {error || `Access Denied. Your account (${user?.email}) is not authorized.`}
              </div>
              
              {/* DEBUG SECTION */}
              <div className="text-[10px] text-zinc-400 font-mono text-left bg-zinc-100 p-2 rounded-lg">
                <p>Email: {user?.email}</p>
                <p>IsAdmin: {isAdmin ? 'TRUE' : 'FALSE'}</p>
                <p>Authorized: ['info@edgedbs.com', 'ziad@golazo.ca', 'nabil@golazo.ca'].join(', ')</p>
              </div>

              <button
                onClick={logout}
                className="w-full py-3 px-6 rounded-xl border border-zinc-200 text-zinc-600 text-xs font-bold hover:bg-zinc-50 transition-all"
              >
                Sign out and try another account
              </button>
            </div>
          )}

          <div className="w-full space-y-4">
            {!showEmailLogin ? (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white py-4 px-6 rounded-2xl font-bold hover:bg-[var(--primary-color)] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-zinc-900/10 disabled:opacity-50"
                >
                  <LogIn size={20} />
                  {isLoggingIn ? "Signing in..." : "Continue with Google"}
                </button>
                <button 
                  onClick={() => setShowEmailLogin(true)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 underline font-medium"
                >
                  Having trouble? Login with Email link instead
                </button>

                <div className="pt-4 border-t border-zinc-100 w-full space-y-2">
                  <p className="text-xs text-zinc-400 font-medium tracking-tight">Iframe/Sandbox Direct Entry Bypass</p>
                  <div className="flex flex-col gap-1.5">
                    {['info@edgedbs.com', 'ziad@golazo.ca', 'nabil@golazo.ca'].map((admEmail) => (
                      <button
                        key={admEmail}
                        onClick={async () => {
                          setIsLoggingIn(true);
                          try {
                            if (devLogin) {
                              await devLogin(admEmail);
                            }
                          } catch (err: any) {
                            setError(err.message || "Bypass login failed");
                          } finally {
                            setIsLoggingIn(false);
                          }
                        }}
                        className="py-2 px-3 bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-[var(--primary-color)] hover:text-white hover:border-[var(--primary-color)] transition-all flex items-center justify-between"
                      >
                        <span>Entry: {admEmail}</span>
                        <span className="text-[8px] bg-zinc-200/50 hover:bg-red-700 px-1 rounded text-zinc-500 font-mono">bypass</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-900 text-white py-4 px-6 rounded-2xl font-bold hover:bg-[var(--primary-color)] transition-all disabled:opacity-50"
                >
                  {isLoggingIn ? "Sending link..." : "Send Magic Link"}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowEmailLogin(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 underline font-medium"
                >
                  Back to Google login
                </button>
              </form>
            )}
          </div>
          
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
            Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
