import AdminStats from '@/components/admin/AdminStats';

export const metadata = {
  title: 'Admin Stats | Grace Music',
};

export default function AdminStatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Statistics</h1>
        <p className="text-sm text-zinc-400 mt-1">Overview of your app's performance and data.</p>
      </div>
      
      <AdminStats />
    </div>
  );
}
