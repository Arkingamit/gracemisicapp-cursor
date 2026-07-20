"use client";

import React, { useState } from "react";
import { Check, Loader2, Music2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getFullUrl } from "@/lib/api";
import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/prompt-kit/chat-container";
import { ScrollButton } from "@/components/prompt-kit/scroll-button";

export type ChatSongRef = {
  id: string;
  title: string;
  artist?: string;
};

export type ActiveSongSet = {
  id: string;
  name: string;
  songs: ChatSongRef[];
  link: string;
};

interface SongSetPickerProps {
  selectableSongs: ChatSongRef[];
  activeSongSet: ActiveSongSet | null;
  getAuthHeaders: () => Record<string, string>;
  onSetUpdated: (set: ActiveSongSet) => void;
  /** Called after songs are successfully added — parent can collapse checkboxes + ask follow-up */
  onSongsAdded?: (info: {
    addedTitles: string[];
    set: ActiveSongSet;
  }) => void;
}

export default function SongSetPicker({
  selectableSongs,
  activeSongSet,
  getAuthHeaders,
  onSetUpdated,
  onSongsAdded,
}: SongSetPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inSetIds = new Set(activeSongSet?.songs.map((s) => s.id) || []);
  const available = selectableSongs.filter((s) => !inSetIds.has(s.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!activeSongSet) {
      setError("Create a song set first (name + organization), then add songs.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one song.");
      return;
    }

    const selectedIds = Array.from(selected);
    const addedTitles = available
      .filter((s) => selected.has(s.id))
      .map((s) => s.title);

    setAdding(true);
    setError(null);
    try {
      const res = await fetch(getFullUrl("/api/ai/song-set/songs"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          groupId: activeSongSet.id,
          songIds: selectedIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add songs");
      const updated = data.group as ActiveSongSet;
      onSetUpdated(updated);
      setSelected(new Set());
      onSongsAdded?.({ addedTitles, set: updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add songs");
    } finally {
      setAdding(false);
    }
  };

  if (!activeSongSet && available.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 w-full">
      {/* Songs already in the set */}
      {activeSongSet && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-emerald-500/20">
            <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <Music2 className="h-3.5 w-3.5" />
              {activeSongSet.name}
            </p>
            <a
              href={activeSongSet.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-400/80 underline underline-offset-2 hover:text-emerald-300"
            >
              Open set
            </a>
          </div>
          {activeSongSet.songs.length === 0 ? (
            <p className="text-xs text-emerald-400/60 px-3 py-3">
              No songs yet — select from the list below.
            </p>
          ) : (
            <div className="relative flex max-h-[200px] w-full flex-col overflow-hidden">
              <ChatContainerRoot className="h-full max-h-[200px] w-full">
                <ChatContainerContent className="w-full">
                  {activeSongSet.songs.map((song, i) => (
                    <div
                      key={song.id}
                      className="border-b border-emerald-500/15 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-emerald-300">
                          <Check className="h-3 w-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm text-emerald-100 truncate">
                            {i + 1}. {song.title}
                          </h3>
                          {song.artist && (
                            <p className="text-xs text-emerald-400/60 truncate">
                              {song.artist}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </ChatContainerContent>
                {activeSongSet.songs.length > 4 && (
                  <div className="absolute right-3 bottom-3">
                    <ScrollButton className="border-emerald-500/40 bg-emerald-950/80 text-emerald-300 shadow-sm hover:bg-emerald-900/80" />
                  </div>
                )}
              </ChatContainerRoot>
            </div>
          )}
        </div>
      )}

      {/* Selectable suggestions */}
      {available.length > 0 && (
        <div className="rounded-2xl border border-indigo-400/25 bg-[#0c0c12]/80 overflow-hidden">
          <p className="text-xs font-medium text-zinc-400 px-3 py-2.5 border-b border-white/[0.06]">
            Select songs to add
            {!activeSongSet && (
              <span className="text-amber-400/80"> — create the set first</span>
            )}
          </p>
          <div className="relative flex h-[280px] w-full flex-col overflow-hidden">
            <ChatContainerRoot className="h-full w-full">
              <ChatContainerContent className="w-full">
                {available.map((song) => {
                  const checked = selected.has(song.id);
                  return (
                    <label
                      key={song.id}
                      className={`flex items-center gap-3 border-b border-white/[0.06] px-3 py-3 cursor-pointer transition-colors last:border-b-0 ${
                        checked
                          ? "bg-indigo-500/15"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(song.id)}
                        className="border-zinc-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm text-zinc-100 truncate">
                          {song.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate text-zinc-500">
                          {song.artist || "Tap to select"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </ChatContainerContent>
              <div className="absolute right-3 bottom-3">
                <ScrollButton className="border-indigo-400/40 bg-[#121218]/90 text-indigo-300 shadow-sm hover:bg-indigo-500/20" />
              </div>
            </ChatContainerRoot>
          </div>
          <div className="p-3 border-t border-white/[0.06]">
            <Button
              type="button"
              size="sm"
              disabled={adding || selected.size === 0 || !activeSongSet}
              onClick={handleAdd}
              className="w-full gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white"
            >
              {adding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add {selected.size > 0 ? `${selected.size} selected` : "selected"} to set
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
