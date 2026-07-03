
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSongs } from '@/contexts/SongContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Song } from '@/lib/types';


const Profile = () => {
  const { currentUser, logout } = useAuth();
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

  if (!currentUser) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Your Profile</h1>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="text-lg font-medium">{currentUser.username}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-lg font-medium">{currentUser.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge>{currentUser.role}</Badge>
            </div>
            
            <div className="flex gap-4 mt-4">

              <Button variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>



        {(currentUser.role === 'super_admin' || currentUser.role === 'manager') && (
          <Card>
            <CardHeader>
              <CardTitle>Your Songs</CardTitle>
            </CardHeader>
            <CardContent>
              {userSongs.length === 0 ? (
                <p className="text-muted-foreground">You haven't created any songs yet.</p>
              ) : (
                <div className="space-y-4">
                  {userSongs.map(song => (
                    <div key={song.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{song.title}</p>
                        <p className="text-sm text-muted-foreground">{song.artist}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/songs/view?id=${song.id}`)}
                        >
                          View
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => router.push(`/songs/edit?id=${song.id}`)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                onClick={() => router.push('/songs/new')} 
                className="w-full mt-4"
              >
                Add New Song
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
