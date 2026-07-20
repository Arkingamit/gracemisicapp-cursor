import AdminUsers from '@/components/admin/AdminUsers';

export const metadata = {
  title: 'User Management | Admin | Grace Music',
};

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Users</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage users, roles, and access across the application.</p>
      </div>
      
      <AdminUsers />
    </div>
  );
}
