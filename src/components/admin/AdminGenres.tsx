"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Search, X, Trash2, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminGenres() {
  const { toast } = useToast();
  
  const [genres, setGenres] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Genre State
  const [newGenreName, setNewGenreName] = useState('');
  const [isSubmittingGenre, setIsSubmittingGenre] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');

  const fetchGenres = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await authFetch('/api/genres');
      if (res.ok) {
        const data = await res.json();
        setGenres(data.genres || []);
      }
    } catch (error) {
      console.error('Failed to fetch genres:', error);
      toast({ title: "Error", description: "Failed to load genres", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  const handleAddGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) return;

    setIsSubmittingGenre(true);
    try {
      const res = await authFetch('/api/genres', {
        method: 'POST',
        body: JSON.stringify({ name: newGenreName.trim() }),
      });

      if (res.ok) {
        const { genre } = await res.json();
        toast({ title: "Success", description: "Genre created successfully" });
        setGenres([...genres, genre]);
        setNewGenreName('');
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to create genre", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsSubmittingGenre(false);
    }
  };

  const handleDeleteGenre = async (id: string) => {
    try {
      const res = await authFetch(`/api/genres/${id}`, { method: 'DELETE' });

      if (res.ok) {
        toast({ title: "Success", description: "Genre deleted successfully" });
        setGenres(genres.filter(g => g.id !== id));
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to delete genre", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  const filteredGenres = genres.filter(g => 
    g.name.toLowerCase().includes(genreSearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Add New Genre</CardTitle>
          <CardDescription>Create a new song genre for the library</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddGenre} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="genre-name" className="text-zinc-300 font-medium">Genre Name</Label>
              <Input
                id="genre-name"
                placeholder="e.g. Acoustic, Rock Gospel"
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                className="bg-transparent/50 border-white/10 text-white placeholder-zinc-500"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold" 
              disabled={isSubmittingGenre || !newGenreName.trim()}
            >
              {isSubmittingGenre ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isSubmittingGenre ? 'Adding...' : 'Add Genre'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 border-white/5 bg-zinc-900/40 backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Library Genres</CardTitle>
              <CardDescription>View and manage genres available in the application</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search genres..."
                value={genreSearch}
                onChange={(e) => setGenreSearch(e.target.value)}
                className="pl-9 bg-transparent/50 border-white/10 text-white placeholder-zinc-500 text-sm"
              />
              {genreSearch && (
                <button
                  onClick={() => setGenreSearch('')}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="text-center py-8 text-zinc-400 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              {filteredGenres.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  {genreSearch ? 'No genres found matching your search.' : 'No genres available.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left pb-3 font-semibold text-zinc-400">Genre Name</th>
                        <th className="text-left pb-3 font-semibold text-zinc-400">Date Created</th>
                        <th className="text-right pb-3 font-semibold text-zinc-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGenres.map((genre) => (
                        <tr key={genre.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
                          <td className="py-3 font-bold text-white text-base">
                            {genre.name}
                          </td>
                          <td className="py-3 text-zinc-400">
                            {genre.createdAt ? new Date(genre.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent size="sm" className="bg-zinc-950 border border-white/10 text-white">
                                <AlertDialogHeader>
                                  <AlertDialogMedia className="bg-red-950/60 text-red-400">
                                    <Trash2 />
                                  </AlertDialogMedia>
                                  <AlertDialogTitle>Delete Genre</AlertDialogTitle>
                                  <AlertDialogDescription className="text-zinc-400">
                                    This will permanently delete the genre "{genre.name}". Existing songs with this genre will still keep it, but new songs won't be able to select it.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-zinc-900 border-white/10 hover:bg-zinc-800 text-white">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteGenre(genre.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
