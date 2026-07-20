import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const RegisterContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect all manual registration attempts to the unified Google-login page
    // Preserve any existing search params (e.g. redirectTo)
    const queryString = searchParams.toString();
    const destination = queryString ? `/login?${queryString}` : '/login';
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full border-t-2 border-primary animate-spin" />
        <p className="text-zinc-400 font-medium">Redirecting to Secure Sign-in...</p>
      </div>
    </div>
  );
};

const Register = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center text-zinc-500">Loading...</div>}>
      <RegisterContent />
    </Suspense>
  );
};

export default Register;

