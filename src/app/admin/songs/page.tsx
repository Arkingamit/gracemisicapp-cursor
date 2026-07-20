"use client";

import AdminSongList from '@/components/admin/AdminSongList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AdminSongsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Song Library</CardTitle>
          <CardDescription>Manage all songs in the global library</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminSongList />
        </CardContent>
      </Card>
    </div>
  );
}
