import AdminActivityLogs from '@/components/admin/AdminActivityLogs';

export const metadata = {
  title: 'Activity Logs | Admin | Grace Music',
};

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">System Activity Logs</h1>
        <p className="text-sm text-zinc-400 mt-1">Review system actions, user edits, and database changes.</p>
      </div>
      
      <AdminActivityLogs />
    </div>
  );
}
