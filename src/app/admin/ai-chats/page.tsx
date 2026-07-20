import AdminAIChats from '@/components/admin/AdminAIChats';

export const metadata = {
  title: 'AI Chats | Admin | Grace Music',
};

export default function AdminAIChatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">AI Chat Histories</h1>
        <p className="text-sm text-zinc-400 mt-1">View and manage users' conversations with Grace Copilot.</p>
      </div>
      
      <AdminAIChats />
    </div>
  );
}
