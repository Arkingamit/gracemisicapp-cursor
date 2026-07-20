import AdminAIUsage from '@/components/admin/AdminAIUsage';

export const metadata = {
  title: 'AI Usage Stats | Admin | Grace Music',
};

export default function AdminAIUsagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Usage</h1>
        <p className="text-sm text-zinc-400 mt-1">Track token consumption for AI chat and semantic search operations.</p>
      </div>
      
      <AdminAIUsage />
    </div>
  );
}
