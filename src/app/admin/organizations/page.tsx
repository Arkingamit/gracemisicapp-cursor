import AdminOrganizations from '@/components/admin/AdminOrganizations';

export const metadata = {
  title: 'Organizations Management | Admin | Grace Music',
};

export default function AdminOrganizationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Organizations</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage and monitor all organizations across the platform.</p>
      </div>
      
      <AdminOrganizations />
    </div>
  );
}
