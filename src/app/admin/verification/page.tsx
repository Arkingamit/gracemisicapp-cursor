"use client";

import AdminVerificationQueue from '@/components/admin/AdminVerificationQueue';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminVerificationPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Verification Queue</CardTitle>
          <CardDescription>Review and approve songs submitted by users to the global library.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminVerificationQueue />
        </CardContent>
      </Card>
    </div>
  );
}
