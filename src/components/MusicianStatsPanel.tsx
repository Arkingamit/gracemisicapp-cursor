'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/contexts/AuthContext';
import { BarChart3, Music, ChevronDown, ChevronRight, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MusicianStat {
  userId: string;
  userName: string;
  userEmail: string;
  totalSets: number;
  instruments: Record<string, number>;
  sets: Array<{ groupId: string; groupName: string; instrument: string; date?: string }>;
}

interface MusicianStatsPanelProps {
  organizationId: string;
}

// Emoji and icon helpers removed per user request

export default function MusicianStatsPanel({ organizationId }: MusicianStatsPanelProps) {
  const [stats, setStats] = useState<MusicianStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [selectedMonth, selectedInstrument, customStart, customEnd]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await authFetch(`/api/organizations/${organizationId}/musician-stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.members || []);
        }
      } catch (e) {
        console.error('Failed to fetch musician stats:', e);
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
            Loading musician stats...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            Musician Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-zinc-500">
            <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No musician assignments yet</p>
            <p className="text-xs mt-1 text-zinc-600">Assign instruments in Song Sets to see stats here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extract available filters
  const availableMonths = Array.from(new Set(
    stats.flatMap(s => s.sets.map(set => set.date?.substring(0, 7))).filter(Boolean)
  )).sort().reverse() as string[];

  const availableInstruments = Array.from(new Set(
    stats.flatMap(s => Object.keys(s.instruments))
  )).sort();

  // Apply filters
  const filteredStats = stats.map(member => {
    const filteredSets = member.sets.filter(set => {
      if (selectedMonth === 'custom') {
        const d = set.date?.substring(0, 10);
        if (!d) return false;
        if (customStart && d < customStart) return false;
        if (customEnd && d > customEnd) return false;
        return true;
      }
      return selectedMonth === 'all' || set.date?.startsWith(selectedMonth);
    });

    const instrumentsCount: Record<string, number> = {};
    filteredSets.forEach(set => {
      instrumentsCount[set.instrument] = (instrumentsCount[set.instrument] || 0) + 1;
    });

    return {
      ...member,
      totalSets: filteredSets.length,
      instruments: instrumentsCount,
      sets: filteredSets
    };
  }).filter(member => {
    if (member.totalSets === 0) return false;
    if (selectedInstrument !== 'all' && !member.instruments[selectedInstrument]) return false;
    return true;
  });

  // Sort: If an instrument is selected, sort by that instrument count, otherwise by total sets
  const sorted = [...filteredStats].sort((a, b) => {
    if (selectedInstrument !== 'all') {
      return (b.instruments[selectedInstrument] || 0) - (a.instruments[selectedInstrument] || 0);
    }
    return b.totalSets - a.totalSets;
  });

  const handleExportCSV = () => {
    const headers = ['Musician Name', 'Total Sets', 'Instruments'];
    const rows = sorted.map(m => [
      m.userName, 
      m.totalSets, 
      Object.entries(m.instruments).map(([k, v]) => `${k} (${v})`).join('; ')
    ]);
    exportToCSV('Musician_Stats', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Musician Name', 'Total Sets', 'Instruments'];
    const rows = sorted.map(m => [
      m.userName, 
      m.totalSets, 
      Object.entries(m.instruments).map(([k, v]) => `${k} (${v})`).join(', ')
    ]);
    exportToPDF('Musician_Stats', 'Individual Musician Details', headers, rows);
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            Individual Musician Details
          </CardTitle>
          
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
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
            
            <select
              className="bg-transparent border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary flex-1 sm:flex-none capitalize"
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
            >
              <option value="all">All Instruments</option>
              {availableInstruments.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-sm">
            No stats found for the selected filters.
          </div>
        ) : (
          <>
            {sorted.slice(0, visibleCount).map(member => {
              const isExpanded = expandedUser === member.userId;

            return (
            <div key={member.userId} className="bg-zinc-800/40 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/60 transition-colors text-left"
                onClick={() => setExpandedUser(isExpanded ? null : member.userId)}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0 mt-0.5 sm:mt-0">
                    {(member.userName || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200 truncate">{member.userName}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-400">
                        {member.totalSets} set{member.totalSets !== 1 ? 's' : ''}
                      </span>
                      {Object.keys(member.instruments).length > 0 && <span>•</span>}
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(member.instruments)
                          .sort((a, b) => b[1] - a[1])
                          .map(([instr, count]) => (
                            <Badge
                              key={instr}
                              variant="secondary"
                              className="bg-zinc-800/80 text-zinc-300 text-[10px] px-2 py-0.5 border border-zinc-700/40 flex items-center gap-1 font-normal hover:bg-zinc-800/80"
                            >
                              <span className="capitalize">{instr}</span>
                              <span className="bg-zinc-700/60 text-violet-300 font-bold text-[9px] px-1 rounded-sm ml-0.5 min-w-[14px] text-center">
                                {count}
                              </span>
                            </Badge>
                          ))}
                      </div>
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
                  {/* Instrument breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(member.instruments)
                      .sort((a, b) => b[1] - a[1])
                      .map(([instr, count]) => (
                        <div
                          key={instr}
                          className="flex items-center gap-2 bg-zinc-900/50 rounded-md px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-zinc-300 truncate capitalize">{instr}</p>
                            <p className="text-[10px] text-zinc-500">{count} time{count !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Song set history */}
                  <div>
                    <h5 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Song Set History</h5>
                    <div className="space-y-1">
                      {member.sets.map((s, i) => (
                        <div
                          key={`${s.groupId}-${i}`}
                          className="flex items-center gap-2 text-xs text-zinc-400 py-0.5"
                        >
                          <span className="truncate">{s.groupName}</span>
                          <span className="text-zinc-600">—</span>
                          <span className="text-zinc-500 truncate capitalize">{s.instrument}</span>
                        </div>
                      ))}
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
                className="w-full mt-2 py-2 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-md transition-colors"
              >
                View More ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

