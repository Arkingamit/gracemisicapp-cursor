import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSongs } from '@/contexts/SongContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Song } from '@/lib/types';
import { User, Mail, Shield, LogOut, Music, Plus, Eye, Edit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Profile = () => {
  const { currentUser, logout, updateProfile } = useAuth();
  const { songs } = useSongs();
  const router = useRouter();

  const userSongs = useMemo(() => {
    if (!currentUser) return [];
    return songs.filter(song => song.createdBy === currentUser.id);
  }, [currentUser, songs]);

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
  }, [currentUser, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    church: '',
    age: '',
    instrument: ''
  });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        displayName: currentUser.displayName || currentUser.username || '',
        church: currentUser.church || '',
        age: currentUser.age?.toString() || '',
        instrument: currentUser.instrument || ''
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: formData.displayName,
        church: formData.church,
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        instrument: formData.instrument
      });
      setIsEditing(false);
    } catch (e) {
      // Handled in context
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 md:p-8 pb-32 relative overflow-hidden">
      {/* Aesthetic Background Effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] opacity-60 pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[30rem] h-[30rem] bg-blue-500/10 rounded-full blur-[128px] opacity-50 pointer-events-none" />

      <div className="container mx-auto max-w-4xl relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        <header className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <Avatar className="w-28 h-28 border-4 border-zinc-900 shadow-2xl shadow-black/50">
              <AvatarImage src={currentUser.photoURL || ''} alt={currentUser.displayName || currentUser.username} />
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-blue-600/80 text-3xl font-bold text-white">
                {getInitials(currentUser.displayName || currentUser.username)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
                {currentUser.displayName || currentUser.username}
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-2 text-zinc-400">
                <Mail className="w-4 h-4" />
                <span>{currentUser.email}</span>
              </div>
              <div className="mt-3 flex items-center justify-center md:justify-start gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs">
                  <Shield className="w-3 h-3 mr-1 inline" />
                  {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 mt-4 md:mt-0">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleLogout}
                  className="rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Account Details Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-zinc-100">
                <User className="w-5 h-5 text-primary" />
                Profile Info
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Username</label>
                  <p className="font-medium text-zinc-200 mt-1">{currentUser.username}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email Address</label>
                  <p className="font-medium text-zinc-200 mt-1 truncate">{currentUser.email}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Account Role</label>
                  <p className="font-medium text-zinc-200 mt-1 capitalize">{currentUser.role.replace('_', ' ')}</p>
                </div>

                {isEditing ? (
                  <>
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Display Name</label>
                        <input 
                          type="text" 
                          value={formData.displayName} 
                          onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                          className="w-full bg-zinc-950/50 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" 
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Church / Organization</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Grace Fellowship"
                          value={formData.church} 
                          onChange={(e) => setFormData({...formData, church: e.target.value})}
                          className="w-full bg-zinc-950/50 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Age</label>
                          <input 
                            type="number" 
                            min="1" max="120"
                            placeholder="e.g. 28"
                            value={formData.age} 
                            onChange={(e) => setFormData({...formData, age: e.target.value})}
                            className="w-full bg-zinc-950/50 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Instrument / Role</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Guitarist"
                            value={formData.instrument} 
                            onChange={(e) => setFormData({...formData, instrument: e.target.value})}
                            className="w-full bg-zinc-950/50 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50" 
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {(currentUser.church || currentUser.age || currentUser.instrument) && (
                      <div className="space-y-5 pt-4 border-t border-white/10 mt-4">
                        {currentUser.church && (
                          <div>
                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Church / Organization</label>
                            <p className="font-medium text-zinc-200 mt-1">{currentUser.church}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {currentUser.age && (
                            <div>
                              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Age</label>
                              <p className="font-medium text-zinc-200 mt-1">{currentUser.age}</p>
                            </div>
                          )}
                          {currentUser.instrument && (
                            <div>
                              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Instrument / Role</label>
                              <p className="font-medium text-zinc-200 mt-1">{currentUser.instrument}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Songs Section */}
          <div className="md:col-span-2 space-y-6">
            {(currentUser.role === 'super_admin' || currentUser.role === 'manager') ? (
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
                    <Music className="w-5 h-5 text-blue-400" />
                    Your Authored Songs
                  </h2>
                  <Button 
                    onClick={() => router.push('/songs/new')} 
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Song
                  </Button>
                </div>

                {userSongs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
                    <Music className="w-12 h-12 text-zinc-700 mb-3" />
                    <h3 className="text-lg font-medium text-zinc-300">No songs yet</h3>
                    <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                      You haven't added any songs to the database. Start building your library!
                    </p>
                    <Button 
                      onClick={() => router.push('/songs/new')} 
                      variant="outline"
                      className="mt-6 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                    >
                      Create First Song
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userSongs.map(song => (
                      <div 
                        key={song.id} 
                        className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-zinc-950/50 border border-white/5 hover:bg-zinc-800/50 hover:border-white/10 transition-all gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-zinc-100 truncate text-lg group-hover:text-blue-400 transition-colors">{song.title}</h3>
                          <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
                        </div>
                        <div className="flex space-x-2 w-full sm:w-auto justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => router.push(`/songs/view?id=${song.id}`)}
                            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            View
                          </Button>
                          <Button 
                            size="sm"
                            variant="secondary"
                            onClick={() => router.push(`/songs/edit?id=${song.id}`)}
                            className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                          >
                            <Edit className="w-4 h-4 mr-1.5" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-zinc-100 mb-2">Standard Account</h3>
                <p className="text-zinc-400 max-w-md">
                  You have a standard user account. If you need to add or edit songs, please contact an administrator to upgrade your role.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
