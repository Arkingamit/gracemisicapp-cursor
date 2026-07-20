"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Filter, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LogObjectViewer = ({ obj }: { obj: any }) => {
  if (!obj || typeof obj !== 'object') return null;
  return (
    <div className="space-y-3">
      {Object.entries(obj).map(([key, value]) => {
        if (key === '_id' || key === 'updatedAt' || key === 'createdAt') return null;
        
        let displayValue = String(value);
        if (Array.isArray(value)) {
          displayValue = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          displayValue = JSON.stringify(value);
        } else if (value === null) {
          displayValue = 'None';
        } else if (value === '') {
          displayValue = '(empty)';
        }

        const isLongText = typeof value === 'string' && value.length > 80;

        return (
          <div key={key} className="text-sm border-b border-white/5 pb-2 last:border-0">
            <span className="text-zinc-400 font-medium capitalize block sm:inline-block sm:w-32 mb-1 sm:mb-0">
              {key.replace(/([A-Z])/g, ' $1').trim()}:
            </span>
            {isLongText ? (
              <div className="mt-2 bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                  {displayValue}
                </pre>
              </div>
            ) : (
              <span className="text-zinc-100 font-medium">{displayValue}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function AdminActivityLogs() {
  const { toast } = useToast();
  
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('all');
  const [auditFilterModule, setAuditFilterModule] = useState('all');
  const [auditFilterItem, setAuditFilterItem] = useState('');
  const [auditFilterDateFrom, setAuditFilterDateFrom] = useState('');
  const [auditFilterDateTo, setAuditFilterDateTo] = useState('');
  
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);
  const [auditFilterExcludeUser, setAuditFilterExcludeUser] = useState('');
  const [isExcludeUserFocused, setIsExcludeUserFocused] = useState(false);

  const [selectedLogChanges, setSelectedLogChanges] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [auditRes, usersRes] = await Promise.all([
        authFetch('/api/admin/audit-logs'),
        authFetch('/api/users?limit=1000')
      ]);

      if (auditRes.ok && usersRes.ok) {
        const [auditData, usersData] = await Promise.all([
          auditRes.json(),
          usersRes.json()
        ]);
        setAuditLogs(auditData.logs || []);
        setUsers(usersData.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast({ title: "Error", description: "Failed to load audit logs", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loadingData && auditLogs.length === 0) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const filteredLogs = auditLogs.filter((log) => {
    if (auditFilterUser) {
      const userStr = log.user ? `${log.user.name} ${log.user.email}`.toLowerCase() : '';
      if (!userStr.includes(auditFilterUser.toLowerCase())) return false;
    }
    if (excludedUserIds.length > 0) {
      const logUserId = log.userId || (log.user ? log.user.id : '');
      if (!logUserId && excludedUserIds.includes('_system')) {
        return false;
      }
      if (logUserId && excludedUserIds.includes(logUserId)) {
        return false;
      }
    }
    if (auditFilterAction !== 'all' && log.action !== auditFilterAction) return false;
    if (auditFilterModule !== 'all' && log.collectionName !== auditFilterModule) return false;
    if (auditFilterItem) {
      const itemStr = (log.itemName || '').toLowerCase();
      if (!itemStr.includes(auditFilterItem.toLowerCase())) return false;
    }
    if (auditFilterDateFrom) {
      const logDate = new Date(log.timestamp);
      const fromDate = new Date(auditFilterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (logDate < fromDate) return false;
    }
    if (auditFilterDateTo) {
      const logDate = new Date(log.timestamp);
      const toDate = new Date(auditFilterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (logDate > toDate) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>Track all major actions across the system</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loadingData} className="w-full sm:w-auto">
            {loadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl bg-zinc-900/50 border border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              <div className="relative">
                <Input
                  placeholder="Exclude user..."
                  value={auditFilterExcludeUser}
                  onChange={(e) => setAuditFilterExcludeUser(e.target.value)}
                  onFocus={() => setIsExcludeUserFocused(true)}
                  onBlur={() => setIsExcludeUserFocused(false)}
                  className="h-8 text-xs w-[140px] bg-transparent border-red-500/20 focus-visible:ring-red-500/30"
                />
                {isExcludeUserFocused && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-white/10 bg-zinc-950 p-1 text-white shadow-md">
                    {!excludedUserIds.includes('_system') && (
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setExcludedUserIds([...excludedUserIds, '_system']);
                          setAuditFilterExcludeUser('');
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-zinc-900 text-white"
                      >
                        System / Unknown User
                      </div>
                    )}
                    {users
                      .filter(user =>
                        (user.name?.toLowerCase().includes(auditFilterExcludeUser.toLowerCase()) || 
                         user.email?.toLowerCase().includes(auditFilterExcludeUser.toLowerCase())) &&
                        !excludedUserIds.includes(user.id)
                      )
                      .slice(0, 20) // Limit to 20 to avoid huge lists
                      .map((user) => (
                        <div
                          key={user.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setExcludedUserIds([...excludedUserIds, user.id]);
                            setAuditFilterExcludeUser('');
                          }}
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-zinc-900 text-white"
                        >
                          {user.name} ({user.email})
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Search user..."
                value={auditFilterUser}
                onChange={(e) => setAuditFilterUser(e.target.value)}
                className="h-8 text-xs w-[140px] bg-transparent border-white/10"
              />
              <select
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
              >
                <option value="all">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
              <select
                value={auditFilterModule}
                onChange={(e) => setAuditFilterModule(e.target.value)}
                className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
              >
                <option value="all">All Modules</option>
                <option value="songs">Songs</option>
                <option value="groups">Song Sets</option>
                <option value="organizations">Organizations</option>
                <option value="playlists">Playlists</option>
                <option value="users">Users</option>
              </select>
              <Input
                placeholder="Search item..."
                value={auditFilterItem}
                onChange={(e) => setAuditFilterItem(e.target.value)}
                className="h-8 text-xs w-[140px] bg-transparent border-white/10"
              />
              <input
                type="date"
                value={auditFilterDateFrom}
                onChange={(e) => setAuditFilterDateFrom(e.target.value)}
                className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
                title="From date"
              />
              <input
                type="date"
                value={auditFilterDateTo}
                onChange={(e) => setAuditFilterDateTo(e.target.value)}
                className="h-8 text-xs rounded-md bg-transparent border border-white/10 px-2 text-zinc-300"
                title="To date"
              />
              {(auditFilterUser || auditFilterAction !== 'all' || auditFilterModule !== 'all' || auditFilterItem || auditFilterDateFrom || auditFilterDateTo || auditFilterExcludeUser || excludedUserIds.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-white px-2"
                  onClick={() => {
                    setAuditFilterUser('');
                    setAuditFilterAction('all');
                    setAuditFilterModule('all');
                    setAuditFilterItem('');
                    setAuditFilterDateFrom('');
                    setAuditFilterDateTo('');
                    setAuditFilterExcludeUser('');
                    setExcludedUserIds([]);
                  }}
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          {excludedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 p-3 rounded-xl bg-red-500/5 border border-red-500/10 items-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-400/80 mr-1 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Excluded Users:
              </span>
              {excludedUserIds.map((id) => {
                const userObj = users.find(u => u.id === id);
                const name = id === '_system' ? 'System / Unknown User' : (userObj ? `${userObj.name} (${userObj.email})` : 'Unknown');
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-transparent border border-red-500/20 text-red-300 shadow-sm"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => setExcludedUserIds(excludedUserIds.filter(x => x !== id))}
                      className="hover:text-red-100 text-red-500/80 hover:bg-white/5 rounded-full p-0.5 transition-colors focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-xs text-muted-foreground mb-2">
            Showing {filteredLogs.length} of {auditLogs.length} log entries
          </div>
          <div className="overflow-x-auto pb-4 scrollbar-hide">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Module</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Item</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">{log.user ? `${log.user.name} (${log.user.email})` : 'System/Unknown'}</td>
                    <td className="px-4 py-3 capitalize">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.action === 'update' ? 'bg-blue-500/10 text-blue-500' : log.action === 'create' ? 'bg-green-500/10 text-green-500' : log.action === 'delete' ? 'bg-red-500/10 text-red-500' : 'bg-secondary text-muted-foreground'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize">{log.collectionName}</td>
                    <td className="px-4 py-3">
                      {log.itemName ? (
                        <span className="font-medium" title={log.documentId}>{log.itemName}</span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Unknown item</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(log.changes || log.previousState) ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-xs"
                          onClick={() => setSelectedLogChanges(log)}
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-zinc-500 italic px-2">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                      {auditLogs.length === 0 ? 'No activity logs yet.' : 'No logs match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Dialog open={!!selectedLogChanges} onOpenChange={(open) => { if (!open) setSelectedLogChanges(null); }}>
            <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800">
              <DialogHeader>
                <DialogTitle>Activity Log Details</DialogTitle>
                <DialogDescription>
                  {selectedLogChanges?.action.toUpperCase()} action on {selectedLogChanges?.collectionName} item "{selectedLogChanges?.itemName || selectedLogChanges?.documentId}"
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                {selectedLogChanges?.changes && (
                  <div className="bg-transparent/50 border border-white/10 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-zinc-200 mb-4 pb-2 border-b border-white/5">Changes Made</h4>
                    <LogObjectViewer obj={selectedLogChanges.changes} />
                  </div>
                )}
                {selectedLogChanges?.previousState && (
                  <div className="bg-transparent/50 border border-white/10 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-zinc-200 mb-4 pb-2 border-b border-white/5">Previous State</h4>
                    <LogObjectViewer obj={selectedLogChanges.previousState} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSelectedLogChanges(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
