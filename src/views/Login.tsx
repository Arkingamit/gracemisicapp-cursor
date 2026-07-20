import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Music } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';

export interface LoginProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  redirectPath?: string;
}

const Login = ({ title, subtitle, redirectPath }: LoginProps = {}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithGoogle, currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = redirectPath || searchParams.get('redirectTo') || '/';

  // Redirect to target if already logged in
  useEffect(() => {
    if (currentUser) {
      router.replace(redirectTo);
    }
  }, [currentUser, router, redirectTo]);

  const handleGoogleLogin = async (credentialResponse: any) => {
    setIsSubmitting(true);
    try {
      if (credentialResponse.credential) {
        await loginWithGoogle(credentialResponse.credential);
        router.push(redirectTo);
      }
    } catch (error) {
      console.error('Google Login failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-transparent">
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl mb-6 group transition-transform hover:scale-110">
            <Music className="w-10 h-10 text-primary animate-bounce-slow" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-3">
            Grace <span className="text-primary">Music</span>
          </h1>

        </div>

        <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-8 md:p-12">
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-white">{title || 'Welcome'}</h2>
                <div className="text-sm text-zinc-500">
                  {subtitle || 'Please sign in to access your library and sets.'}
                </div>
              </div>

              <div className="flex justify-center flex-col items-center gap-6">
                <div className="w-full relative">
                  <div className="relative">
                    {Capacitor.isNativePlatform() ? (
                      <button 
                        onClick={async () => {
                          setIsSubmitting(true);
                          try {
                            const result = await GoogleSignIn.signIn();
                            if (result.idToken) {
                              await loginWithGoogle(result.idToken);
                              router.push(redirectTo);
                            }
                          } catch (error: any) {
                            alert(`Google Login Error: ${error?.message || JSON.stringify(error)}`);
                            console.error('Native Google Login failed:', error);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        className="w-full bg-zinc-900 text-white border border-zinc-700 hover:bg-zinc-800 rounded-full py-3 px-4 flex items-center justify-center gap-3 transition-colors text-[14px] font-medium"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                          <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                          </g>
                        </svg>
                        Continue with Google
                      </button>
                    ) : (
                      <GoogleLogin
                        onSuccess={handleGoogleLogin}
                        onError={() => console.error('Google login error')}
                        width="100%"
                        size="large"
                        text="continue_with"
                        shape="pill"
                        theme="filled_black"
                      />
                    )}
                  </div>
                </div>
                
                {isSubmitting && (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs animate-pulse">
                    <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    Authenticating...
                  </div>
                )}
              </div>


            </div>
          </CardContent>
        </Card>
        
        <p className="mt-8 text-center text-zinc-600 text-xs tracking-tight">
          By signing in, you agree to our <span className="text-zinc-500 hover:text-white cursor-pointer underline">Terms of Service</span>
        </p>
      </div>
    </div>
  );
};

export default Login;

