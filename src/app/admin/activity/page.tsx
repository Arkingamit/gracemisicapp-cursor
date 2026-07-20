"use client";

import AdminActivityLedger from '@/components/admin/AdminActivityLedger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminActivityPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payouts & Activity</CardTitle>
          <CardDescription>Track user contributions and calculate payouts based on points.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminActivityLedger />
        </CardContent>
      </Card>
    </div>
  );
}
