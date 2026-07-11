'use client';

import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { BarChart, Music, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface UserStatOrg {
  organizationId: string;
  organizationName: string;
  totalSets: number;
  instruments: Record<string, number>;
  sets: Array<{ groupId: string; groupName: string; instrument: string; date: string }>;
}

export function UserStatsCard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<UserStatOrg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await authFetch('/api/users/me/stats');
        const data = await res.json();
        if (res.ok) {
          setStats(data.organizations || []);
        }
      } catch (error) {
        console.error('Failed to fetch user stats', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchStats();
    }
  }, [currentUser]);

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-md animate-pulse">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-white">
            <BarChart className="w-5 h-5 text-primary" />
            My Performance Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-zinc-800/50 rounded-md mb-4" />
          <div className="h-20 bg-zinc-800/50 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-white">
            <BarChart className="w-5 h-5 text-primary" />
            My Performance Stats
          </CardTitle>
          <CardDescription className="text-zinc-400">
            You haven't been assigned to any song sets yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const overallTotalSets = stats.reduce((acc, org) => acc + org.totalSets, 0);

  return (
    <Card className="bg-zinc-900/50 border-white/5 backdrop-blur-md overflow-hidden">
      <CardHeader>
        <div className="flex flex-col xl:flex-row justify-between items-start gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-white">
              <BarChart className="w-5 h-5 text-primary flex-shrink-0" />
              My Performance Stats
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-1">
              Your historical song set assignments across organizations
            </CardDescription>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30 whitespace-nowrap self-start flex-shrink-0">
            {overallTotalSets} Total {overallTotalSets === 1 ? 'Set' : 'Sets'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <Accordion type="single" collapsible className="w-full space-y-3">
          {stats.map((org, index) => (
            <AccordionItem 
              key={org.organizationId} 
              value={`org-${org.organizationId}`}
              className="border border-white/10 rounded-lg px-4 bg-black/40 overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex justify-between items-center w-full pr-4 gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-left">
                    <span className="font-semibold text-zinc-100">{org.organizationName}</span>
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 whitespace-nowrap self-start sm:self-auto">
                      {org.totalSets} {org.totalSets === 1 ? 'Set' : 'Sets'}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 text-zinc-400 space-y-6">
                
                {/* Instruments Summary */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                    <Music className="w-4 h-4" /> Instruments Played
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(org.instruments)
                      .sort(([, a], [, b]) => b - a)
                      .map(([instrument, count]) => (
                        <div key={instrument} className="flex items-center gap-2 bg-zinc-800/60 rounded-full pl-3 pr-2 py-1 text-xs text-zinc-200">
                          {instrument}
                          <Badge className="bg-zinc-200 text-zinc-900 ml-1 h-5 min-w-[20px] flex items-center justify-center rounded-full px-1 font-bold hover:bg-zinc-300">
                            {count}
                          </Badge>
                        </div>
                    ))}
                  </div>
                </div>

                {/* Song Sets History */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> History
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {org.sets
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((set, i) => (
                      <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-md bg-zinc-900/50 border border-white/5 gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-200">{set.groupName}</span>
                          <span className="text-xs text-zinc-500">{format(new Date(set.date), 'MMMM d, yyyy')}</span>
                        </div>
                        <Badge variant="outline" className="border-white/10 text-zinc-300 bg-black/40">
                          {set.instrument}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
