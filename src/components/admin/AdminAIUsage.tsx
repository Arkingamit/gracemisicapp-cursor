"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminAIUsage() {
  const { toast } = useToast();
  
  const [aiUsageStats, setAiUsageStats] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAIUsage = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await authFetch('/api/admin/ai-usage-stats');
      if (res.ok) {
        const data = await res.json();
        setAiUsageStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch AI usage stats:', error);
      toast({ title: "Error", description: "Failed to load AI usage stats", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAIUsage();
  }, [fetchAIUsage]);

  if (loadingData && !aiUsageStats) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Token Usage
          </CardTitle>
          <CardDescription>Track AI token consumption per user for chat and search.</CardDescription>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex gap-4 border-r border-white/10 pr-4">
            <div className="text-center px-2">
              <div className="text-2xl font-bold text-white">{aiUsageStats?.globalTotals?.totalTokens?.toLocaleString() || 0}</div>
              <div className="text-xs text-zinc-400">Total Tokens</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl font-bold text-white">{aiUsageStats?.globalTotals?.totalRequests?.toLocaleString() || 0}</div>
              <div className="text-xs text-zinc-400">Total Requests</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAIUsage} disabled={loadingData}>
            {loadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Chat Tokens</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Search Tokens</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Total Tokens</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Last Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!aiUsageStats || !aiUsageStats.summaries || aiUsageStats.summaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No AI usage recorded yet.
                  </td>
                </tr>
              ) : (
                aiUsageStats.summaries.map((summary: any) => (
                  <tr key={summary.userId} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{summary.userName}</div>
                      <div className="text-xs text-zinc-400">{summary.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {summary.chatTokens.toLocaleString()}
                      <div className="text-[10px] text-zinc-500">{summary.chatRequests} reqs</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {summary.searchTokens.toLocaleString()}
                      <div className="text-[10px] text-zinc-500">{summary.searchRequests} reqs</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-purple-400">
                      {summary.totalTokens.toLocaleString()}
                      <div className="text-[10px] text-zinc-500">{summary.totalRequests} total reqs</div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {summary.lastUsed ? new Date(summary.lastUsed).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
