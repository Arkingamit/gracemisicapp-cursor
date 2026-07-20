import AdminSettings from '@/components/admin/AdminSettings';

export const metadata = {
  title: 'Settings | Admin | Grace Music',
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">System Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">Configure global application settings and thresholds.</p>
      </div>
      
      <AdminSettings />
    </div>
  );
}
