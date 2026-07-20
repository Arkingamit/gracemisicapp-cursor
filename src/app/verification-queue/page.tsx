"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { hasAnyRole } from "@/lib/roles";

const AdminVerificationQueue = dynamic(() => import("@/components/admin/AdminVerificationQueue"), {
  loading: () => (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-secondary rounded w-64" />
        <div className="h-12 bg-secondary rounded" />
      </div>
    </div>
  ),
});

export default function VerificationQueuePage() {
  const { currentUser, loading, refreshUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [accessChecked, setAccessChecked] = useState(false);
  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const verifyAccess = async () => {
      if (loading) return;
      const user = await refreshUser();
      if (cancelled) return;
      const allowed = hasAnyRole(user, 'verifier', 'editor');
      setCanAccess(allowed);
      setAccessChecked(true);
      if (!user || !allowed) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        router.push('/');
      }
    };
    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [loading, refreshUser, router, toast]);

  if (loading || !accessChecked || !currentUser || !canAccess) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Verification Queue</h1>
      <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
        <AdminVerificationQueue />
      </Suspense>
    </div>
  );
}
