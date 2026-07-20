import AdminStorage from '@/components/admin/AdminStorage';

export const metadata = {
  title: 'Database Storage | Admin | Grace Music',
};

export default function AdminStoragePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Database Storage</h1>
        <p className="text-sm text-zinc-400 mt-1">Monitor database storage consumption and limits across modules and organizations.</p>
      </div>
      
      <AdminStorage />
    </div>
  );
}
