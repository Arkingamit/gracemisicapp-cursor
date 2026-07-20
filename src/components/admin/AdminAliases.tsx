"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/contexts/AuthContext';
import { Loader2, Link2, ChevronDown, ChevronUp, CheckCircle2, Clock, User, Search, Music } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';

interface AliasInfo {
  title: string;
  submittedByName: string;
  submittedByUserId: string;
  submittedByEmail: string;
  verifiedByName: string;
  verifiedByUserId: string;
  verifiedByEmail: string;
  verifiedAt: string | null;
  submittedAt: string | null;
}

interface SongWithAliases {
  songId: string;
  songTitle: string;
  songArtist: string;
  aliasCount: number;
  aliases: AliasInfo[];
}

export default function AdminAliases() {
  const [songs, setSongs] = useState<SongWithAliases[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSongs, setTotalSongs] = useState(0);
  const [totalAliases, setTotalAliases] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSongs, setExpandedSongs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAliases();
  }, []);

  const fetchAliases = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/aliases');
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs || []);
        setTotalSongs(data.totalSongsWithAliases || 0);
        setTotalAliases(data.totalAliases || 0);
      }
    } catch (e) {
      console.error('Failed to fetch aliases', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (songId: string) => {
    setExpandedSongs(prev => ({
      ...prev,
      [songId]: !prev[songId]
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-4" />
          <p className="text-sm text-zinc-400">Loading alias data...</p>
        </CardContent>
      </Card>
    );
  }

  // Filter songs based on search term
  const filteredSongs = songs.filter(song => {
    const term = searchTerm.toLowerCase();
    
    // Check if the original song matches
    if (song.songTitle.toLowerCase().includes(term) || song.songArtist.toLowerCase().includes(term)) {
      return true;
    }
    
    // Check if any alias inside the song matches
    const hasMatchingAlias = song.aliases.some(alias => 
      alias.title.toLowerCase().includes(term) ||
      alias.submittedByName.toLowerCase().includes(term) ||
      (alias.submittedByEmail && alias.submittedByEmail.toLowerCase().includes(term)) ||
      alias.verifiedByName.toLowerCase().includes(term) ||
      (alias.verifiedByEmail && alias.verifiedByEmail.toLowerCase().includes(term))
    );
    
    return hasMatchingAlias;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-orange-400" />
          Song Aliases
        </CardTitle>
        <CardDescription>
          Track all alternate titles (aliases) added to songs, who submitted them, and who verified them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{totalSongs}</p>
              <p className="text-xs text-zinc-400 mt-1">Songs with Aliases</p>
            </div>
            <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{totalAliases}</p>
              <p className="text-xs text-zinc-400 mt-1">Total Aliases</p>
            </div>
          </div>
          
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search by title, song, name, email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-zinc-900/50 border-white/10 text-white w-full text-sm"
            />
          </div>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="text-center py-8 border border-white/5 rounded-lg bg-black/20">
            <p className="text-sm text-zinc-400">
              {searchTerm ? "No songs or aliases match your search." : "No aliases found yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSongs.map(song => (
              <div key={song.songId} className="rounded-xl border border-white/5 bg-zinc-900/50 overflow-hidden">
                {/* Song Header - Clickable to expand */}
                <div 
                  onClick={() => toggleExpand(song.songId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-base">{song.songTitle}</h3>
                      <p className="text-xs text-zinc-400">{song.songArtist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right flex items-center gap-2">
                      <Badge variant="secondary" className="bg-white/5 text-zinc-300 hover:bg-white/10">
                        {song.aliasCount} {song.aliasCount === 1 ? 'Alias' : 'Aliases'}
                      </Badge>
                    </div>
                    <div className="text-zinc-500">
                      {expandedSongs[song.songId] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content - Alias List */}
                {expandedSongs[song.songId] && (
                  <div className="border-t border-white/5 bg-black/20">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider border-b border-white/5">
                          <tr>
                            <th className="px-6 py-3 font-medium">Alias Title</th>
                            <th className="px-6 py-3 font-medium">Submitted By</th>
                            <th className="px-6 py-3 font-medium">Verified By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {song.aliases.filter(alias => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            // If the song matches, show all aliases, else only show matching aliases
                            if (song.songTitle.toLowerCase().includes(term) || song.songArtist.toLowerCase().includes(term)) return true;
                            
                            return alias.title.toLowerCase().includes(term) ||
                                   alias.submittedByName.toLowerCase().includes(term) ||
                                   (alias.submittedByEmail && alias.submittedByEmail.toLowerCase().includes(term)) ||
                                   alias.verifiedByName.toLowerCase().includes(term) ||
                                   (alias.verifiedByEmail && alias.verifiedByEmail.toLowerCase().includes(term));
                          }).map((alias, idx) => (
                            <tr key={`${song.songId}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <Link2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                  <span className="font-medium text-orange-300">&quot;{alias.title}&quot;</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-zinc-200 font-medium">{alias.submittedByName}</span>
                                  {alias.submittedByEmail && (
                                    <span className="text-[11px] text-zinc-400">{alias.submittedByEmail}</span>
                                  )}
                                  {alias.submittedByUserId && alias.submittedByUserId !== 'N/A' && (
                                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {alias.submittedByUserId}</span>
                                  )}
                                  {alias.submittedAt && (
                                    <span className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {formatDistanceToNow(new Date(alias.submittedAt), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-zinc-200 font-medium">{alias.verifiedByName}</span>
                                  {alias.verifiedByEmail && (
                                    <span className="text-[11px] text-zinc-400">{alias.verifiedByEmail}</span>
                                  )}
                                  {alias.verifiedByUserId && alias.verifiedByUserId !== 'N/A' && (
                                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {alias.verifiedByUserId}</span>
                                  )}
                                  {alias.verifiedAt && (
                                    <span className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {formatDistanceToNow(new Date(alias.verifiedAt), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
