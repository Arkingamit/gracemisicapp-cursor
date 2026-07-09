'use client';

import { useState, useEffect } from 'react';
import { MusicianAssignment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { authFetch } from '@/contexts/AuthContext';
import { Music, Plus, X, ChevronDown, ChevronUp, Save, Users } from 'lucide-react';

const DEFAULT_INSTRUMENTS = [
  'Vocals',
  'Acoustic Guitar',
  'Electric Guitar',
  'Bass Guitar',
  'Piano / Keyboard',
  'Drums',
  'Cajon',
  'Violin',
  'Flute',
  'Saxophone',
  'Trumpet',
  'Ukulele',
  'Tambourine',
  'Harmonica',
  'Cello',
  'Mandolin',
];

const INSTRUMENT_ICONS: Record<string, string> = {
  'Vocals': '🎤',
  'Acoustic Guitar': '🎸',
  'Electric Guitar': '🎸',
  'Bass Guitar': '🎸',
  'Piano / Keyboard': '🎹',
  'Drums': '🥁',
  'Cajon': '🪘',
  'Violin': '🎻',
  'Flute': '🪈',
  'Saxophone': '🎷',
  'Trumpet': '🎺',
  'Ukulele': '🎸',
  'Tambourine': '🪘',
  'Harmonica': '🎵',
  'Cello': '🎻',
  'Mandolin': '🎸',
};

interface MemberInfo {
  id: string;
  name: string;
  email: string;
}

interface MusicianAssignmentPanelProps {
  groupId: string;
  organizationId: string;
  assignments: MusicianAssignment[];
  canEdit: boolean;
}

export default function MusicianAssignmentPanel({
  groupId,
  organizationId,
  assignments,
  canEdit,
}: MusicianAssignmentPanelProps) {
  const { updateMusicianAssignments } = useGroups();
  const { getOrganization } = useOrganizations();
  const [localAssignments, setLocalAssignments] = useState<MusicianAssignment[]>(assignments || []);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [customInstrument, setCustomInstrument] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newInstrument, setNewInstrument] = useState('');

  const organization = getOrganization(organizationId);
  const availableInstruments = organization?.customInstruments || [];

  // Fetch org members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await authFetch(`/api/organizations/${organizationId}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
        }
      } catch (e) {
        console.error('Failed to fetch members:', e);
      }
    };
    fetchMembers();
  }, [organizationId]);

  // Sync local state when prop changes
  useEffect(() => {
    setLocalAssignments(assignments || []);
    setHasChanges(false);
  }, [assignments]);

  const getMemberName = (userId: string) => {
    const m = members.find(m => m.id === userId);
    return m?.name || m?.email || userId;
  };

  const getInstrumentIcon = (instrument: string) => {
    return INSTRUMENT_ICONS[instrument] || '🎵';
  };

  const handleRemoveAssignment = async (index: number) => {
    const updated = localAssignments.filter((_, i) => i !== index);
    setLocalAssignments(updated);
    
    setIsSaving(true);
    try {
      await updateMusicianAssignments(groupId, updated);
      setHasChanges(false);
    } catch (e) {
      // toast is handled in context
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!newUserId || !newInstrument) return;
    const instrument = newInstrument === '__custom__' ? customInstrument.trim() : newInstrument;
    if (!instrument) return;

    const updated = [...localAssignments, { userId: newUserId, instrument }];
    setLocalAssignments(updated);
    setNewUserId('');
    setNewInstrument('');
    setCustomInstrument('');
    setShowAddRow(false);
    
    setIsSaving(true);
    try {
      await updateMusicianAssignments(groupId, updated);
      setHasChanges(false);
    } catch (e) {
      // toast is handled in context
    } finally {
      setIsSaving(false);
    }
  };

  // Get unassigned members (members not yet in the assignments)
  const assignedUserIds = new Set(localAssignments.map(a => a.userId));
  // Allow re-assignment (same person, different instrument), so don't filter

  return (
    <Card className="bg-zinc-900/50 border-zinc-800/60 overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none hover:bg-zinc-800/30 transition-colors py-4 px-5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-zinc-100">Musicians</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">
                {localAssignments.length} musician{localAssignments.length !== 1 ? 's' : ''} assigned
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-zinc-500 mr-2 flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                Saving...
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-5 pb-5 pt-0 space-y-3">
          {/* Assignments List */}
          {localAssignments.length === 0 && !showAddRow && (
            <div className="text-center py-6 text-zinc-500 text-sm">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No musicians assigned yet</p>
              {canEdit && (
                <p className="text-xs mt-1">Click "Add Musician" to assign instruments</p>
              )}
            </div>
          )}

          {localAssignments.length > 0 && (
            <div className="space-y-2">
              {localAssignments.map((a, idx) => (
                <div
                  key={`${a.userId}-${a.instrument}-${idx}`}
                  className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3.5 py-2.5 group hover:bg-zinc-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">{getInstrumentIcon(a.instrument)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {getMemberName(a.userId)}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{a.instrument}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveAssignment(idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add New Assignment Row */}
          {showAddRow && canEdit && (
            <div className="bg-zinc-800/30 rounded-lg p-3 space-y-3 border border-zinc-700/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={newUserId}
                  onChange={e => setNewUserId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Select member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>

                <select
                  value={newInstrument}
                  onChange={e => { setNewInstrument(e.target.value); if (e.target.value !== '__custom__') setCustomInstrument(''); }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">Select instrument...</option>
                  {availableInstruments.map(i => (
                    <option key={i} value={i}>{getInstrumentIcon(i)} {i}</option>
                  ))}
                  <option value="__custom__">✏️ Custom instrument...</option>
                </select>
              </div>

              {newInstrument === '__custom__' && (
                <input
                  type="text"
                  placeholder="Enter custom instrument name..."
                  value={customInstrument}
                  onChange={e => setCustomInstrument(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowAddRow(false); setNewUserId(''); setNewInstrument(''); setCustomInstrument(''); }}
                  className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddAssignment}
                  disabled={!newUserId || (!newInstrument || (newInstrument === '__custom__' && !customInstrument.trim()))}
                  className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-full"
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Add Button */}
          {canEdit && !showAddRow && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddRow(true)}
              className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 hover:border-violet-500/50 transition-all rounded-lg h-9"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Musician
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
