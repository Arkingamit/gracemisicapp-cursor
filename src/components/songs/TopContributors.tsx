import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Contributor {
  id: string;
  count: number;
}

const TopContributors = () => {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const res = await fetch('/api/contributors');
        if (res.ok) {
          const data = await res.json();
          setContributors(data.contributors || []);
        }
      } catch (error) {
        console.error('Failed to fetch contributors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, []);

  if (loading || contributors.length === 0) {
    return null; // Hide if no data or loading
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 1: return <Medal className="w-4 h-4 text-gray-400" />;
      case 2: return <Medal className="w-4 h-4 text-amber-600" />;
      default: return <Award className="w-4 h-4 text-zinc-600" />;
    }
  };

  return (
    <Card className="bg-zinc-900/40 border-zinc-800/50 mb-6">
      <CardHeader className="py-3 px-4 flex flex-row items-center gap-2 bg-zinc-900/60 rounded-t-xl border-b border-zinc-800/50">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <CardTitle className="text-sm font-semibold text-zinc-200">Top Global Contributors</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {contributors.map((c, idx) => (
            <div key={c.id || idx} className="flex items-center gap-2 bg-zinc-800/40 px-3 py-1.5 rounded-full border border-zinc-700/30">
              {getRankIcon(idx)}
              <Badge variant="secondary" className="bg-zinc-950/50 text-xs px-1.5 py-0">
                {c.count} {c.count === 1 ? 'song' : 'songs'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopContributors;
