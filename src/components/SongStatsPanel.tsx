'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/contexts/AuthContext';
import { BarChart3, Music, ChevronDown, ChevronRight, Hash, Search, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { useSongs } from '@/contexts/SongContext';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface SongStat {
  songId: string;
  totalSets: number;
  sets: Array<{ groupId: string; groupName: string; date?: string }>;
}

interface SongStatsPanelProps {
  organizationId: string;
}

export default function SongStatsPanel({ organizationId }: SongStatsPanelProps) {
  const [stats, setStats] = useState<SongStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [selectedMonth, customStart, customEnd, searchQuery]);
  
  const { getAllSongs } = useSongs();
  const allSongs = getAllSongs();
  
  // Memoize song lookup for performance
  const songMap = useMemo(() => new Map(allSongs.map(s => [s.id, s])), [allSongs]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await authFetch(`/api/organizations/${organizationId}/song-stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.songs || []);
        }
      } catch (e) {
        console.error('Failed to fetch song stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [organizationId]);

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800/60">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-zinc-500">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
            Loading song stats...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Accordion type="single" collapsible className="mt-6 border border-zinc-800 rounded-xl bg-zinc-900/20 overflow-hidden">
        <AccordionItem value="song-stats" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-zinc-800/30">
            <div className="flex items-center justify-center flex-1 gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400 shrink-0" />
              <span className="text-xl font-semibold text-center">Song Usage Stats</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 pt-2">
            <div className="text-center py-8 text-zinc-500">
              <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No song usage data yet</p>
              <p className="text-xs mt-1 text-zinc-600">Add songs to Song Sets to see stats here</p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  // Extract available filter options
  const availableMonths = Array.from(new Set(
    stats.flatMap(s => s.sets.map(set => set.date?.substring(0, 7))).filter(Boolean)
  )).sort().reverse() as string[];

  // Apply filters
  const filteredStats = stats.map(songStat => {
    const filteredSets = songStat.sets.filter(set => {
      if (selectedMonth === 'custom') {
        const d = set.date?.substring(0, 10);
        if (!d) return false;
        if (customStart && d < customStart) return false;
        if (customEnd && d > customEnd) return false;
        return true;
      }
      return selectedMonth === 'all' || set.date?.startsWith(selectedMonth);
    });

    return {
      ...songStat,
      totalSets: filteredSets.length,
      sets: filteredSets
    };
  }).filter(songStat => {
    if (songStat.totalSets === 0) return false;
    if (searchQuery.trim()) {
      const song = songMap.get(songStat.songId);
      const title = (song?.title || 'Unknown Song').toLowerCase();
      const artist = (song?.artist || 'Unknown Artist').toLowerCase();
      const q = searchQuery.toLowerCase();
      if (!title.includes(q) && !artist.includes(q)) return false;
    }
    return true;
  });

  // Sort by highest total sets
  const sorted = [...filteredStats].sort((a, b) => b.totalSets - a.totalSets);

  const handleExportCSV = () => {
    const headers = ['Song Title', 'Artist', 'Total Plays'];
    const rows = sorted.map(s => {
      const song = songMap.get(s.songId);
      return [song?.title || 'Unknown', song?.artist || 'Unknown', s.totalSets];
    });
    exportToCSV('Song_Usage_Stats', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Song Title', 'Artist', 'Total Plays'];
    const rows = sorted.map(s => {
      const song = songMap.get(s.songId);
      return [song?.title || 'Unknown', song?.artist || 'Unknown', s.totalSets];
    });
    exportToPDF('Song_Usage_Stats', 'Song Usage Stats', headers, rows);
  };

  return (
    <Accordion type="single" collapsible className="mt-6 border border-zinc-800 rounded-xl bg-zinc-900/20 overflow-hidden">
      <AccordionItem value="song-stats" className="border-none">
        <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-zinc-800/30">
          <div className="flex items-center justify-center flex-1 gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400 shrink-0" />
            <span className="text-xl font-semibold text-center">Song Usage Stats</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6 pt-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search songs..."
                className="bg-transparent border border-zinc-800 rounded-md pl-8 pr-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 bg-transparent border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary hover:bg-zinc-900 transition-colors h-8"
                  title="Export Options"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-transparent border-zinc-800 text-zinc-200 min-w-[140px]">
                <DropdownMenuItem onClick={handleExportCSV} className="text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-zinc-100">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                  Excel (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="text-xs cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 focus:text-zinc-100">
                  <FileText className="w-3.5 h-3.5 mr-2 text-red-400" />
                  PDF Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 sm:flex-none">
              <select
                className="bg-transparent border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="custom">Custom Range...</option>
                {availableMonths.map(month => {
                  const date = new Date(month + '-01T12:00:00Z');
                  const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  return <option key={month} value={month}>{label}</option>;
                })}
              </select>
              
              {selectedMonth === 'custom' && (
                <div className="flex items-center gap-1 w-full sm:w-auto">
                  <input
                    type="date"
                    className="bg-transparent border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary flex-1 sm:flex-none"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <span className="text-zinc-500 text-xs">to</span>
                  <input
                    type="date"
                    className="bg-transparent border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary flex-1 sm:flex-none"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-sm">
            No stats found for the selected month.
          </div>
        ) : (
          <>
            {sorted.slice(0, visibleCount).map(songStat => {
              const isExpanded = expandedSong === songStat.songId;
            const song = songMap.get(songStat.songId);
            const title = song?.title || 'Unknown Song';
            const artist = song?.artist || 'Unknown Artist';

            return (
            <div key={songStat.songId} className="bg-zinc-800/40 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/60 transition-colors text-left"
                onClick={() => setExpandedSong(isExpanded ? null : songStat.songId)}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-sm font-bold text-zinc-400 flex-shrink-0 mt-0.5 sm:mt-0">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200 truncate">{title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-zinc-500">
                      <span className="truncate">{artist}</span>
                      <span>•</span>
                      <span className="font-semibold text-zinc-400">
                        {songStat.totalSets} play{songStat.totalSets !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 border-t border-zinc-700/30 pt-2">
                  {/* Song set history */}
                  <div>
                    <h5 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Appeared In Sets</h5>
                    <div className="space-y-1">
                      {songStat.sets.map((s, i) => {
                        const dateObj = s.date ? new Date(s.date) : null;
                        const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
                        
                        return (
                          <div
                            key={`${s.groupId}-${i}`}
                            className="flex items-center gap-2 text-xs text-zinc-400 py-0.5"
                          >
                            <span className="truncate text-zinc-300 font-medium">{s.groupName}</span>
                            <span className="text-zinc-600">—</span>
                            <span className="text-zinc-500 whitespace-nowrap">{dateStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
            })}
            
            {sorted.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(prev => prev + 5)}
                className="w-full mt-2 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-300 bg-zinc-800/40 hover:bg-zinc-800/80 rounded-md transition-colors"
              >
                View More ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
