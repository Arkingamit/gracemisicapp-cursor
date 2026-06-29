import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const Register = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect all manual registration attempts to the unified Google-login page
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full border-t-2 border-primary animate-spin" />
        <p className="text-zinc-400 font-medium">Redirecting to Secure Sign-in...</p>
      </div>
    </div>
  );
};

export default Register;

