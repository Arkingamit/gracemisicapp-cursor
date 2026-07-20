import AdminGroups from '@/components/admin/AdminGroups';

export const metadata = {
  title: 'Song Sets Management | Admin | Grace Music',
};

export default function AdminSongSetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Song Sets</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage and monitor all song sets (groups) created across organizations.</p>
      </div>
      
      <AdminGroups />
    </div>
  );
}
