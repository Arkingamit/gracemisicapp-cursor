import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/contexts/AuthContext';
import { Loader2, Users, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export default function AdminContributions() {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContributions();
  }, []);

  const fetchContributions = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/contributions');
      if (res.ok) {
        const data = await res.json();
        setContributions(data.contributions || []);
      }
    } catch (e) {
      console.error('Failed to fetch contributions', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-[10px]">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Rejected</Badge>;
      default:
        return <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 text-[10px]">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mb-4" />
          <p className="text-sm text-zinc-400">Loading contributions data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          User Contributions
        </CardTitle>
        <CardDescription>
          See which users have contributed songs and who verified them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contributions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-400">No contributions found.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {contributions.map((contributor) => (
              <AccordionItem 
                key={contributor.userId} 
                value={contributor.userId}
                className="border border-white/5 bg-zinc-900/30 rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex flex-col items-start">
                      <span className="font-semibold text-zinc-100">{contributor.userName}</span>
                      <span className="text-xs text-zinc-400 font-normal">{contributor.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                        {contributor.totalSongs} {contributor.totalSongs === 1 ? 'Song' : 'Songs'}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2 pb-4">
                    {contributor.songs.map((song: any) => (
                      <div 
                        key={song.id}
                        className="bg-black/20 rounded-md p-3 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-sm text-zinc-200">{song.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(song.status)}
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {song.createdAt ? formatDistanceToNow(new Date(song.createdAt), { addSuffix: true }) : 'Unknown time'}
                            </span>
                          </div>
                        </div>
                        
                        {song.status === 'approved' && (
                          <div className="text-xs flex items-center gap-1.5 bg-green-500/5 px-2.5 py-1.5 rounded-full border border-green-500/10">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-zinc-400">Verified by:</span>
                            <span className="font-medium text-zinc-300">
                              {song.verifiedByName || 'Unknown Admin'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
