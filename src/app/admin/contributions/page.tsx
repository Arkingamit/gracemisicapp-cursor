"use client";

import AdminContributions from '@/components/admin/AdminContributions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminContributionsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contributions</CardTitle>
          <CardDescription>View all song contributions made by users</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminContributions />
        </CardContent>
      </Card>
    </div>
  );
}
