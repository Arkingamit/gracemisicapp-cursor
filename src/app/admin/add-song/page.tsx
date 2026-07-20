"use client";

import AdminSongForm from '@/components/admin/AdminSongForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminAddSongPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Song</CardTitle>
          <CardDescription>Directly add a song to the global library (skips verification queue)</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminSongForm />
        </CardContent>
      </Card>
    </div>
  );
}
