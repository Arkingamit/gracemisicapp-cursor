"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Music } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { SignInWithApple, type SignInWithAppleOptions } from '@capacitor-community/apple-sign-in';

export interface LoginProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  redirectPath?: string;
}

/** Web OAuth client ID — must match Google Cloud / google-services.json */
const GOOGLE_WEB_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '810353645969-dmsbou0itk6475tap5j8qq7ejvs68dm7.apps.googleusercontent.com';

/** Apple Services ID (web) or bundle ID (native). */
const APPLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || 'org.graceahmedabad.music.ios';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code?: string };
          user?: { name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}

function isSignInCanceled(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error ?? '');
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return (
    code === 'SIGN_IN_CANCELED' ||
    /cancel(ed|lation)?/i.test(message)
  );
}

function formatAppleFullName(name?: { firstName?: string; lastName?: string }): string | undefined {
  if (!name) return undefined;
  const full = [name.firstName, name.lastName].filter(Boolean).join(' ').trim();
  return full || undefined;
}

async function loadAppleScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.AppleID) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-apple-signin]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Apple script failed')));
      return;
    }
    const script = document.createElement('script');
    script.src =
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.dataset.appleSignin = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Apple Sign In script'));
    document.head.appendChild(script);
  });
}

const Login = ({ title, subtitle, redirectPath }: LoginProps = {}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const { loginWithGoogle, loginWithApple, currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = redirectPath || searchParams.get('redirectTo') || '/';

  const platform = Capacitor.getPlatform();
  const showAppleSignIn =
    platform === 'ios' || (!Capacitor.isNativePlatform() && !!process.env.NEXT_PUBLIC_APPLE_CLIENT_ID);

  useEffect(() => {
    if (currentUser) {
      router.replace(redirectTo);
    }
  }, [currentUser, router, redirectTo]);

  const handleGoogleLogin = async (credentialResponse: { credential?: string }) => {
    setIsSubmitting(true);
    setNativeError(null);
    try {
      if (credentialResponse.credential) {
        await loginWithGoogle(credentialResponse.credential);
        router.push(redirectTo);
      }
    } catch (error) {
      console.error('Google Login failed:', error);
      setNativeError('Sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNativeGoogleLogin = async () => {
    setIsSubmitting(true);
    setNativeError(null);
    try {
      await GoogleSignIn.initialize({
        clientId: GOOGLE_WEB_CLIENT_ID,
      });

      const result = await GoogleSignIn.signIn();
      if (!result?.idToken) {
        throw new Error('Google did not return an ID token. Try again.');
      }

      await loginWithGoogle(result.idToken);
      router.replace(redirectTo);
    } catch (error: unknown) {
      if (isSignInCanceled(error)) {
        setNativeError('Sign-in was interrupted. Please tap Continue with Google again.');
        return;
      }
      console.error('Native Google Login failed:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Google Sign-In failed. Please try again.';
      setNativeError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsSubmitting(true);
    setNativeError(null);
    try {
      if (platform === 'ios') {
        const options: SignInWithAppleOptions = {
          clientId: APPLE_CLIENT_ID,
          redirectURI: 'https://music.graceahmedabad.org/login',
          scopes: 'email name',
        };
        const result = await SignInWithApple.authorize(options);
        const idToken = result?.response?.identityToken;
        if (!idToken) {
          throw new Error('Apple did not return an identity token. Try again.');
        }
        const fullName = formatAppleFullName({
          firstName: result.response?.givenName,
          lastName: result.response?.familyName,
        });
        await loginWithApple(idToken, fullName);
        router.replace(redirectTo);
        return;
      }

      await loadAppleScript();
      if (!window.AppleID) {
        throw new Error('Apple Sign In is unavailable in this browser.');
      }

      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: `${window.location.origin}/login`,
        usePopup: true,
      });

      const response = await window.AppleID.auth.signIn();
      const idToken = response?.authorization?.id_token;
      if (!idToken) {
        throw new Error('Apple did not return an identity token. Try again.');
      }
      await loginWithApple(idToken, formatAppleFullName(response.user?.name));
      router.replace(redirectTo);
    } catch (error: unknown) {
      if (isSignInCanceled(error)) {
        setNativeError('Sign-in was canceled. Please try again.');
        return;
      }
      console.error('Apple Login failed:', error);
      setNativeError(
        error instanceof Error ? error.message : 'Apple Sign-In failed. Please try again.'
      );
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

              <div className="flex justify-center flex-col items-center gap-4 w-full">
                <div className="w-full relative">
                  <div className="relative">
                    {Capacitor.isNativePlatform() ? (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleNativeGoogleLogin()}
                        className="w-full bg-zinc-900 text-white border border-zinc-700 hover:bg-zinc-800 disabled:opacity-60 rounded-full py-3 px-4 flex items-center justify-center gap-3 transition-colors text-[14px] font-medium"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
                        onError={() => {
                          console.error('Google login error');
                          setNativeError('Google Sign-In failed. Please try again.');
                        }}
                        width="100%"
                        size="large"
                        text="continue_with"
                        shape="pill"
                        theme="filled_black"
                      />
                    )}
                  </div>
                </div>

                {showAppleSignIn && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleAppleLogin()}
                    className="w-full bg-white text-black hover:bg-zinc-100 disabled:opacity-60 rounded-full py-3 px-4 flex items-center justify-center gap-3 transition-colors text-[14px] font-medium"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
                      <path d="M16.365 1.43c0 1.14-.42 2.2-1.18 3.03-.8.88-2.13 1.56-3.27 1.47-.14-1.1.44-2.27 1.2-3.08.8-.87 2.2-1.5 3.25-1.42zM20.9 17.3c-.55 1.27-.82 1.83-1.53 2.95-.99 1.55-2.39 3.48-4.13 3.5-1.54.02-1.94-.99-4.04-.98-2.1.01-2.55 1-4.09.98-1.74-.02-3.07-1.76-4.06-3.3C1.3 17.2.4 13.4 2.2 10.8c1.13-1.66 2.92-2.63 4.61-2.63 1.72 0 2.8 1 4.23 1 1.38 0 2.22-1.01 4.22-1.01 1.5 0 3.09.81 4.2 2.21-3.7 2.03-3.1 7.32.44 6.93z" />
                    </svg>
                    Continue with Apple
                  </button>
                )}

                {nativeError && (
                  <p className="text-center text-sm text-red-400 px-2">{nativeError}</p>
                )}

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
          By signing in, you agree to our{" "}
          <a href="/terms" className="text-zinc-500 hover:text-white underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-zinc-500 hover:text-white underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;
