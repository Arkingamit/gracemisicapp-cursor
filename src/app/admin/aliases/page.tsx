"use client";

import AdminAliases from '@/components/admin/AdminAliases';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminAliasesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Song Aliases</CardTitle>
          <CardDescription>Manage alternative titles for songs submitted by users</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAliases />
        </CardContent>
      </Card>
    </div>
  );
}
