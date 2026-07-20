import AdminGenres from '@/components/admin/AdminGenres';

export const metadata = {
  title: 'Genres Management | Admin | Grace Music',
};

export default function AdminGenresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Music Genres</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage the list of available genres for songs in the library.</p>
      </div>
      
      <AdminGenres />
    </div>
  );
}
