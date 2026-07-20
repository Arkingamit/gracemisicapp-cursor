"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/contexts/AuthContext';
import { Settings as SettingsIcon, Globe, MessageSquare, Lock, Smartphone, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import {
  DEFAULT_GROQ_CHAT_MODEL,
  GROQ_CHAT_MODEL_PRESETS,
  resolveGroqChatModel,
} from '@/lib/groqModels';

export default function AdminSettings() {
  const { toast } = useToast();
  
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [loadingData, setLoadingData] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await authFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const settings = data.settings || {};
        // Show remapped model if the saved ID was decommissioned
        if (settings.ai_model) {
          settings.ai_model = resolveGroqChatModel(settings.ai_model);
        }
        setSystemSettings(settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdateSettings = async (updates: any) => {
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const { settings } = await res.json();
        setSystemSettings(settings);
        toast({ title: "Success", description: "Settings updated successfully" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to update settings", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  if (loadingData && Object.keys(systemSettings).length === 0) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <SettingsIcon className="w-6 h-6 text-primary" />
              <CardTitle>System Configuration</CardTitle>
            </div>
            <CardDescription>Manage global permissions and application state</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loadingData}>
            {loadingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07] gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <Label className="text-base font-bold text-white cursor-pointer" htmlFor="org-creation">
                  Enable Organization Creation
                </Label>
              </div>
              <p className="text-sm text-zinc-400 max-w-md">
                When enabled, regular users can create their own organizations. When disabled, they are prompted to contact you.
              </p>
            </div>
            <Switch
              id="org-creation"
              checked={systemSettings.allow_user_org_creation}
              onCheckedChange={(checked) => handleUpdateSettings({ allow_user_org_creation: checked })}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07] gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <Label className="text-base font-bold text-white cursor-pointer" htmlFor="ai-chat">
                  Enable AI Copilot Chat
                </Label>
              </div>
              <p className="text-sm text-zinc-400 max-w-md">
                When enabled, users can interact with the Grace Copilot AI assistant across the app.
              </p>
            </div>
            <Switch
              id="ai-chat"
              checked={systemSettings.enable_ai_chat}
              onCheckedChange={(checked) => handleUpdateSettings({ enable_ai_chat: checked })}
            />
          </div>

          <div className="flex flex-col gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <Label className="text-base font-bold text-white cursor-pointer" htmlFor="groq-api-key">
                  GROQ API Key
                </Label>
              </div>
              <p className="text-sm text-zinc-400 max-w-md">
                Update the API key used for the Grace Copilot. This key overrides any locally configured environment variables.
              </p>
            </div>
            <div className="flex items-center gap-2 max-w-md mt-2">
              <Input
                id="groq-api-key"
                type="password"
                placeholder="gsk_..."
                value={systemSettings.groq_api_key || ''}
                onChange={(e) => setSystemSettings((s: any) => ({ ...s, groq_api_key: e.target.value }))}
                className="bg-zinc-900 border-white/10"
              />
              <Button 
                variant="secondary" 
                onClick={() => handleUpdateSettings({ groq_api_key: systemSettings.groq_api_key })}
              >
                Save Key
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <Label className="text-base font-bold text-white cursor-pointer" htmlFor="ai-model">
                  Groq AI Model
                </Label>
              </div>
              <p className="text-sm text-zinc-400 max-w-md">
                Select a Groq chat model for Grace Copilot. Only currently supported Groq model IDs are listed.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 max-w-md mt-2">
              <Input
                id="ai-model"
                type="text"
                placeholder={DEFAULT_GROQ_CHAT_MODEL}
                value={systemSettings.ai_model || ''}
                onChange={(e) => setSystemSettings((s: any) => ({ ...s, ai_model: e.target.value }))}
                className="bg-zinc-900 border-white/10 flex-1 min-w-0"
              />
              <Select 
                value={systemSettings.ai_model || DEFAULT_GROQ_CHAT_MODEL} 
                onValueChange={(val) => setSystemSettings((s: any) => ({ ...s, ai_model: val }))}
              >
                <SelectTrigger className="w-full sm:w-[200px] bg-zinc-900 border-white/10 text-white flex-shrink-0">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {GROQ_CHAT_MODEL_PRESETS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="secondary" 
                onClick={() =>
                  handleUpdateSettings({
                    ai_model: resolveGroqChatModel(systemSettings.ai_model),
                  })
                }
                className="flex-shrink-0"
              >
                Save Model
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Groups Per User</h4>
                <p className="text-xs text-zinc-500">Maximum number of song sets a standard user can create.<br/>Leave empty or 0 for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_groups_per_user || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_groups_per_user: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_groups_per_user: systemSettings.max_groups_per_user })}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Custom Songs</h4>
                <p className="text-xs text-zinc-500">Maximum number of custom songs an organization can add (excluding global library).<br/>Leave empty or 0 for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_custom_songs_per_org || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_custom_songs_per_org: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_custom_songs_per_org: systemSettings.max_custom_songs_per_org })}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Global AI Chat Limit</h4>
                <p className="text-xs text-zinc-500">Maximum chat history stored per user (in MB).</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="1"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.global_ai_chat_limit_mb || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, global_ai_chat_limit_mb: isNaN(val) ? 2 : val }));
                  }}
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ global_ai_chat_limit_mb: systemSettings.global_ai_chat_limit_mb })}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Songs Per Song Set</h4>
                <p className="text-xs text-zinc-500">Leave empty or 0 for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_songs_per_group || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_songs_per_group: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_songs_per_group: systemSettings.max_songs_per_group })}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Collections Per User</h4>
                <p className="text-xs text-zinc-500">Organize favorite songs limit. Leave empty for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_collections_per_user || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_collections_per_user: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_collections_per_user: systemSettings.max_collections_per_user })}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Songs Per Collection</h4>
                <p className="text-xs text-zinc-500">Maximum limit of songs in a personal collection. Leave empty for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_songs_per_collection || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_songs_per_collection: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_songs_per_collection: systemSettings.max_songs_per_collection })}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Members Per Org</h4>
                <p className="text-xs text-zinc-500">Leave empty or 0 for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_members_per_org || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_members_per_org: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_members_per_org: systemSettings.max_members_per_org })}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Max Activity Logs Limit</h4>
                <p className="text-xs text-zinc-500">Auto-deletes older logs when exceeded. Leave empty for unlimited.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <Input 
                  type="number" 
                  min="0"
                  className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                  value={systemSettings.max_activity_logs || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSystemSettings((s: any) => ({ ...s, max_activity_logs: (isNaN(val) || val === 0) ? null : val }));
                  }}
                  placeholder="∞"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => handleUpdateSettings({ max_activity_logs: systemSettings.max_activity_logs })}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* ── Spam Prevention ── */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-400" />
              <div>
                <h3 className="text-base font-bold text-white">Spam Prevention</h3>
                <p className="text-xs text-zinc-500">
                  Auto-detect spam contributors and limit submissions. Leave empty or 0 to disable a rule.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Max Song Submissions / Day</h4>
                  <p className="text-xs text-zinc-500">
                    Blocks further submissions when a user exceeds this count in one day.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input
                    type="number"
                    min="0"
                    className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                    value={systemSettings.max_song_submissions_per_day ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSystemSettings((s: any) => ({
                        ...s,
                        max_song_submissions_per_day: (isNaN(val) || val === 0) ? null : val,
                      }));
                    }}
                    placeholder="∞"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleUpdateSettings({
                        max_song_submissions_per_day: systemSettings.max_song_submissions_per_day,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Rejection Threshold</h4>
                  <p className="text-xs text-zinc-500">
                    Auto-restrict a contributor after this many rejected songs.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input
                    type="number"
                    min="0"
                    className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                    value={systemSettings.spam_rejection_threshold ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSystemSettings((s: any) => ({
                        ...s,
                        spam_rejection_threshold: (isNaN(val) || val === 0) ? null : val,
                      }));
                    }}
                    placeholder="∞"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleUpdateSettings({
                        spam_rejection_threshold: systemSettings.spam_rejection_threshold,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Public Song Report Threshold</h4>
                  <p className="text-xs text-zinc-500">
                    Auto-flag a contributor when this many unique users report their songs.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input
                    type="number"
                    min="0"
                    className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                    value={systemSettings.spam_song_report_threshold ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSystemSettings((s: any) => ({
                        ...s,
                        spam_song_report_threshold: (isNaN(val) || val === 0) ? null : val,
                      }));
                    }}
                    placeholder="∞"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleUpdateSettings({
                        spam_song_report_threshold: systemSettings.spam_song_report_threshold,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Verifier Spam-Report Threshold</h4>
                  <p className="text-xs text-zinc-500">
                    Auto-restrict after this many verifier “user is spamming” flags.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input
                    type="number"
                    min="0"
                    className="bg-zinc-900 border-white/10 text-white w-full sm:w-24"
                    value={systemSettings.spam_user_report_threshold ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSystemSettings((s: any) => ({
                        ...s,
                        spam_user_report_threshold: (isNaN(val) || val === 0) ? null : val,
                      }));
                    }}
                    placeholder="∞"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleUpdateSettings({
                        spam_user_report_threshold: systemSettings.spam_user_report_threshold,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── App Version Control Section ── */}
          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">App Version Control</h3>
                <p className="text-xs text-zinc-500">Force mobile users to update when a new version is released</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <h4 className="text-sm font-bold text-zinc-300">Minimum Version</h4>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Users below this version will be <span className="text-red-400 font-semibold">forced to update</span>.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input 
                    type="text" 
                    className="bg-zinc-900 border-white/10 text-white w-full sm:w-32 font-mono"
                    value={systemSettings.app_minimum_version || ''}
                    onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_minimum_version: e.target.value }))}
                    placeholder="0.1.0"
                  />
                  <Button 
                    variant="secondary" 
                    onClick={() => handleUpdateSettings({ app_minimum_version: systemSettings.app_minimum_version })}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Latest Version</h4>
                  <p className="text-xs text-zinc-500 mt-1">Users below this get an <span className="text-emerald-400 font-semibold">optional update</span> prompt.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <Input 
                    type="text" 
                    className="bg-zinc-900 border-white/10 text-white w-full sm:w-32 font-mono"
                    value={systemSettings.app_latest_version || ''}
                    onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_latest_version: e.target.value }))}
                    placeholder="0.1.0"
                  />
                  <Button 
                    variant="secondary" 
                    onClick={() => handleUpdateSettings({ app_latest_version: systemSettings.app_latest_version })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Android Store URL</h4>
                  <p className="text-xs text-zinc-500 mt-1">Google Play Store link for the app.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="url" 
                    className="bg-zinc-900 border-white/10 text-white w-full text-xs"
                    value={systemSettings.app_update_url_android || ''}
                    onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_update_url_android: e.target.value }))}
                    placeholder="https://play.google.com/store/apps/details?id=..."
                  />
                  <Button 
                    variant="secondary" 
                    className="self-start"
                    onClick={() => handleUpdateSettings({ app_update_url_android: systemSettings.app_update_url_android })}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">iOS Store URL</h4>
                  <p className="text-xs text-zinc-500 mt-1">Apple App Store link for the app.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Input 
                    type="url" 
                    className="bg-zinc-900 border-white/10 text-white w-full text-xs"
                    value={systemSettings.app_update_url_ios || ''}
                    onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_update_url_ios: e.target.value }))}
                    placeholder="https://apps.apple.com/app/id..."
                  />
                  <Button 
                    variant="secondary" 
                    className="self-start"
                    onClick={() => handleUpdateSettings({ app_update_url_ios: systemSettings.app_update_url_ios })}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-transparent/50 border border-white/5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-zinc-300">Force Update Message</h4>
                <p className="text-xs text-zinc-500 mt-1">Custom message shown when a force update is required.</p>
              </div>
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full bg-zinc-900 border border-white/10 text-white rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  value={systemSettings.app_force_update_message || ''}
                  onChange={(e) => setSystemSettings((s: any) => ({ ...s, app_force_update_message: e.target.value }))}
                  placeholder="A critical update is required to continue using Grace Music."
                />
                <Button 
                  variant="secondary" 
                  className="self-start"
                  onClick={() => handleUpdateSettings({ app_force_update_message: systemSettings.app_force_update_message })}
                >
                  Save Message
                </Button>
              </div>
            </div>
          </div>

        </CardContent>
        <CardFooter className="bg-white/5 border-t border-white/5 py-4">
          <p className="text-[10px] text-zinc-500 tracking-tight">
            Last system-wide settings sync: <span className="font-mono">{new Date().toLocaleTimeString()}</span>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
