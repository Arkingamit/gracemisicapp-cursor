'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { Loader2, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Login from '@/views/Login';
import OpenInviteInApp from '@/components/organizations/OpenInviteInApp';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { submitJoinRequest, getUserOrganizations } = useOrganizations();
  
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasRequested = React.useRef(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const code = typeof params.code === 'string' ? params.code.toUpperCase() : '';

  useEffect(() => {
    if (!code) {
      setError('Invalid invite link.');
      setLoading(false);
      return;
    }

    const fetchOrg = async () => {
      try {
        const res = await fetch(`/api/invite/${code}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Organization not found');
        }
        
        setOrgName(data.organization.name);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [code]);

  // Auto-join when the user is logged in
  useEffect(() => {
    const autoJoin = async () => {
      if (currentUser && !authLoading && !loading && !error && !hasRequested.current) {
        hasRequested.current = true; // Prevent multiple submissions
        try {
          await submitJoinRequest(code);
          setIsSuccess(true);
        } catch (err: any) {
          // Redirect on error so the user sees the error toast and the organizations list
          router.push('/organizations');
        }
      }
    };

    autoJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, authLoading, loading, error, code, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent">
        <Card className="w-full max-w-md border-red-900/50 bg-zinc-900/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-red-500" />
            </div>
            <CardTitle className="text-xl text-red-500">Invite Not Found</CardTitle>
            <CardDescription className="text-zinc-400 mt-2">
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // If user is logging in or auto-joining, show loading state or success state
  if (currentUser) {
    if (isSuccess) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-transparent">
          <Card className="w-full max-w-md border-white/10 bg-zinc-900/80 backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="mx-auto bg-green-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <Building2 className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-white mb-2">Request Sent!</CardTitle>
              <CardDescription className="text-base text-zinc-400">
                After the manager accepts your request, you will be able to access <strong className="text-white">{orgName}</strong>.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center pb-8">
              <Button onClick={() => router.push('/organizations')} className="w-full" size="lg">
                Continue to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-transparent">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-zinc-400 font-medium">Sending request to join {orgName}...</p>
      </div>
    );
  }

  // User is not logged in: display the Login component with invite-specific text
  return (
    <>
      <OpenInviteInApp code={code} />
      <Login 
        title="You've been invited!"
        subtitle={
          <>
            You have received an invitation to join <strong className="text-white">{orgName}</strong> on Grace Music.
            <br /><br />
            Please sign in to accept this invitation.
          </>
        }
        redirectPath={`/invite/${code}`}
      />
    </>
  );
}
