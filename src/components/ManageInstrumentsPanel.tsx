'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { Music, Plus, X, Settings2 } from 'lucide-react';
import { Organization } from '@/lib/types';

export const DEFAULT_INSTRUMENTS = [
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

interface ManageInstrumentsPanelProps {
  organization: Organization;
}

export default function ManageInstrumentsPanel({ organization }: ManageInstrumentsPanelProps) {
  const { addInstrument, removeInstrument } = useOrganizations();
  const [newInstrument, setNewInstrument] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingInstrument, setRemovingInstrument] = useState<string | null>(null);

  const instruments = organization.customInstruments || [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstrument.trim()) return;

    setIsAdding(true);
    try {
      await addInstrument(organization.id, newInstrument.trim());
      setNewInstrument('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (instrument: string) => {
    setRemovingInstrument(instrument);
    try {
      await removeInstrument(organization.id, instrument);
    } finally {
      setRemovingInstrument(null);
    }
  };

  return (
    <div className="pt-6 mt-6 border-t border-white/5">
      <label className="text-sm font-medium text-zinc-300 mb-1 block">
        Manage Instruments
      </label>
      <p className="text-xs text-muted-foreground mb-3">
        Customize the list of available instruments for this organization.
      </p>
      
      {/* Add Instrument Form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Add new instrument (e.g. Kazoo)"
          value={newInstrument}
          onChange={(e) => setNewInstrument(e.target.value)}
          className="flex-1 bg-transparent border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={isAdding}
        />
        <Button 
          type="submit" 
          disabled={!newInstrument.trim() || isAdding}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </form>

      {/* Instruments List */}
      <div className="flex flex-wrap gap-2">
        {instruments.map(instrument => (
          <Badge 
            key={instrument} 
            variant="outline" 
            className="bg-zinc-900 border-zinc-800 text-zinc-200 pl-3 pr-1.5 py-1.5 flex items-center gap-2 text-sm"
          >
            <span>{instrument}</span>
            <button
              onClick={() => handleRemove(instrument)}
              disabled={removingInstrument === instrument}
              className="hover:bg-red-500/20 hover:text-red-400 rounded-full p-0.5 transition-colors text-zinc-500 disabled:opacity-50"
              title={`Remove ${instrument}`}
            >
              {removingInstrument === instrument ? (
                <span className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin inline-block" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

