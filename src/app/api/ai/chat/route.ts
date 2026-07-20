import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { SongModel } from '@/server/models/song';
import { GroupModel } from '@/server/models/group';
import { getAuthUser } from '@/lib/auth';
import { SettingsModel } from '@/server/models/settings';
import { AiUsageModel } from '@/server/models/aiUsage';
import {
  createSongSetForUser,
  resolveCreatableOrgs,
} from '@/server/utils/createSongSet';
import { resolveGroqChatModel } from '@/lib/groqModels';
import { enforceRateLimit } from '@/server/rateLimit';
import { z } from 'zod';
import { validateBody } from '@/server/validation/http';
import { groqBreaker } from '@/server/ai/groqBreaker';
import { isBreakerError } from '@/server/circuitBreaker';

const chatSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.string().max(20).optional(),
            content: z.string().max(20000),
          })
          .passthrough()
      )
      .min(1)
      .max(100),
    mode: z.string().max(30).optional(),
    activeSongSetId: z.string().max(100).nullish(),
  })
  .strict();

type SongRef = { id: string; title: string; artist?: string };

function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveSongRefs(songIds: string[]): Promise<SongRef[]> {
  const unique = [...new Set(songIds.filter(Boolean))];
  const out: SongRef[] = [];
  for (const id of unique) {
    try {
      const song = await SongModel.findById(id);
      if (song) out.push({ id: song.id, title: song.title, artist: song.artist || undefined });
    } catch {
      // skip
    }
  }
  return out;
}

/** Fuzzy library search — token + stem matching so "bajaye" still hits "bajae". */
async function findSongsByQuery(
  query: string,
  catalog: { id: string; title: string; artist?: string }[],
  limit = 12
): Promise<SongRef[]> {
  const raw = query.trim();
  if (!raw) return [];

  const cleaned = normalizeSearchText(
    raw.replace(/^(add|please|ok|okay|the|a|an|song|songs|to|set|my)\s+/gi, '').trim()
  );
  if (!cleaned) return [];

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  const scored = catalog.map((s) => {
    const title = normalizeSearchText(s.title || '');
    const artist = normalizeSearchText(s.artist || '');
    const hay = `${title} ${artist}`;
    let score = 0;

    if (title.includes(cleaned) || hay.includes(cleaned)) score += 100;

    for (const w of words) {
      if (hay.includes(w)) score += 12;
      // stem: drop last 1–2 chars for spelling variants (bajaye → bajay/baja)
      const stem1 = w.length > 4 ? w.slice(0, -1) : w;
      const stem2 = w.length > 5 ? w.slice(0, -2) : stem1;
      if (stem1.length >= 3 && hay.includes(stem1)) score += 6;
      if (stem2.length >= 3 && hay.includes(stem2)) score += 3;
    }

    return { song: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const fromCatalog = scored
    .filter((x) => x.score >= 6)
    .slice(0, limit)
    .map((x) => ({
      id: x.song.id,
      title: x.song.title,
      artist: x.song.artist || undefined,
    }));

  if (fromCatalog.length > 0) return fromCatalog;

  // Fallback: DB regex on first significant word (broader, global + will catch titles)
  const primary = words[0] || cleaned;
  try {
    const dbHits = await SongModel.searchLibrary(primary, limit);
    return dbHits.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist || undefined,
    }));
  } catch {
    return [];
  }
}

function extractSongIdsFromMarkdown(text: string): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const re = /\/songs\/view\?id=([a-f0-9]{24})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ids.push(m[1]);
  }
  return [...new Set(ids)];
}

/**
 * Ensure catalog songs mentioned in the reply become markdown links
 * so the chat UI can render them as blue song chips.
 */
function linkifyCatalogSongsInText(
  text: string,
  catalog: { id: string; title: string }[]
): string {
  if (!text || !catalog.length) return text;

  let out = text;
  const alreadyLinked = new Set(extractSongIdsFromMarkdown(out));

  // Longest titles first so shorter substrings don't win
  const byTitleLen = [...catalog].sort(
    (a, b) => (b.title?.length || 0) - (a.title?.length || 0)
  );

  for (const song of byTitleLen) {
    const title = (song.title || '').trim();
    if (title.length < 3 || alreadyLinked.has(song.id)) continue;

    // Skip if this id is already linked somewhere
    if (out.includes(`/songs/view?id=${song.id}`)) {
      alreadyLinked.add(song.id);
      continue;
    }

    // Don't replace inside existing markdown links
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Avoid matching inside already-linked markdown: [title](...)
    const re = new RegExp(`(?<!\\[)${escaped}(?!\\]\\()`, 'gi');
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, `[${title}](/songs/view?id=${song.id})`);
    alreadyLinked.add(song.id);
  }

  return out;
}

/** If the model forgot links but the user asked for songs, append catalog picks as blue links. */
function ensureCatalogSongLinks(
  text: string,
  catalog: { id: string; title: string }[],
  userMessage: string
): string {
  let out = linkifyCatalogSongsInText(text, catalog);
  const linkedIds = extractSongIdsFromMarkdown(out);
  if (linkedIds.length > 0) return out;

  const msg = userMessage.toLowerCase();
  const wantsSongs =
    /suggest|recommend|song|songs|setlist|hymn|worship|theme|prodigal|english|hindi/.test(
      msg
    );
  if (!wantsSongs || catalog.length === 0) return out;

  const picks = catalog.slice(0, 8);
  const bullets = picks
    .map((s) => `- [${s.title}](/songs/view?id=${s.id})`)
    .join('\n');
  return `${out.trim()}\n\nHere are some songs from your library:\n\n${bullets}`;
}

function looksLikeSongRequest(message: string): boolean {
  const msg = message.toLowerCase();
  const verbs = ['add', 'include', 'put', 'find', 'search', 'suggest', 'want', 'need'];
  const hasVerb = verbs.some((v) => msg.includes(v));
  // Short messages that are likely song titles while a set is active
  const words = msg.trim().split(/\s+/);
  return hasVerb || (words.length >= 1 && words.length <= 8 && msg.length > 2);
}

/** Strip raw DB ids from assistant text (keep ids inside markdown URLs). */
function scrubInternalIdsFromReply(text: string): string {
  if (!text) return text;

  // Temporarily shield markdown links so URL ids are never stripped
  const shielded: string[] = [];
  let out = text.replace(/\[[^\]]*\]\([^)]*\)/g, (m) => {
    shielded.push(m);
    return `\u0000MD${shielded.length - 1}\u0000`;
  });

  out = out
    .replace(/\s*\(\s*ID\s*:?\s*[a-f0-9]{24}\s*\)/gi, "")
    .replace(/\s*\(\s*id\s*:?\s*[a-f0-9]{24}\s*\)/gi, "")
    .replace(/\b(?:organization\s*)?id\s*[:=]\s*[a-f0-9]{24}\b/gi, "")
    .replace(/\btool_org_id\s*[:=]?\s*[a-f0-9]{24}\b/gi, "")
    .replace(/(?<!id=)(?<![\w/])([a-f0-9]{24})(?![\w/])/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ \./g, ".")
    .trim();

  return out.replace(/\u0000MD(\d+)\u0000/g, (_, i) => shielded[Number(i)] ?? "");
}

async function loadActiveSongSet(groupId: string): Promise<{
  id: string;
  name: string;
  songs: SongRef[];
  link: string;
} | null> {
  const group = await GroupModel.findById(groupId);
  if (!group) return null;
  const songs: SongRef[] = [];
  for (const sid of group.songs || []) {
    try {
      const s = await SongModel.findById(sid);
      if (s) songs.push({ id: s.id, title: s.title, artist: s.artist || undefined });
    } catch {
      // skip
    }
  }
  return {
    id: group.id,
    name: group.name,
    songs,
    link: `/groups/view?id=${group.id}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, chatSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const messages = body.messages;
    const songSetMode = body.mode === 'song-set';
    const activeSongSetId =
      songSetMode && typeof body.activeSongSetId === 'string'
        ? body.activeSongSetId
        : null;

    const settings = await SettingsModel.getSettings();

    const apiKey = settings.groq_api_key || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'GROQ_API_KEY not configured. Get a free key at console.groq.com and configure it in Admin Settings.' },
        { status: 500 }
      );
    }

    const auth = getAuthUser(req);
    if (!auth) {
      return Response.json(
        { error: 'Please sign in to start chatting.' },
        { status: 401 }
      );
    }

    // Sensitive (LLM-backed) endpoint — tighter per-user limit.
    const limited = await enforceRateLimit(req, {
      policy: 'sensitive',
      bucket: 'ai-chat',
      identifier: auth.userId,
    });
    if (limited) return limited;

    if (!settings.enable_ai_chat) {
      return Response.json(
        { error: 'AI Assistant is currently disabled by the administrator.' },
        { status: 403 }
      );
    }

    const isSuperAdmin = auth.role === 'super_admin';
    const creatableOrgs = await resolveCreatableOrgs(auth.userId, isSuperAdmin);
    const userOrgIds = isSuperAdmin ? undefined : creatableOrgs.map((o) => o.id);

    const fullCatalog = await SongModel.getLightweightCatalog(userOrgIds);

    const lastUserMsg = messages[messages.length - 1]?.content.toLowerCase() || '';
    const cleanMsg = lastUserMsg.replace(/[^\w\s]/gi, '');

    const developerKeywords = [
      'who is the developer',
      'who is developer',
      'who developed this app',
      'who developed this',
      'who created this app',
      'who created you',
      'who is your developer',
      'who built this app',
      'who built you',
      'who is the creator',
      'who made this app',
      'who made you',
    ];

    if (developerKeywords.some((keyword) => cleanMsg.includes(keyword))) {
      return Response.json({
        content:
          'The developer of this app is Arkin Gamit. You can visit his website at [arkin.codes/](https://arkin.codes/).',
      });
    }

    const stopWords = ['and', 'the', 'for', 'with', 'what', 'best', 'suggest', 'some', 'song', 'songs', 'can', 'you'];
    const words = cleanMsg.split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.includes(w));

    let filteredCatalog = fullCatalog;

    if (words.length > 0) {
      const scored = fullCatalog.map((s) => {
        let score = 0;
        const genreStr = Array.isArray(s.genre) ? s.genre.join(' ') : s.genre || '';
        const keywordStr = Array.isArray(s.keywords) ? s.keywords.join(' ') : '';
        const searchStr = `${s.title} ${s.artist || ''} ${genreStr} ${s.originalKey || ''} ${keywordStr}`.toLowerCase();

        if (searchStr.includes(cleanMsg)) score += 50;
        for (const w of words) {
          if (searchStr.includes(w)) score += 1;
        }
        if (s.keywords && Array.isArray(s.keywords)) {
          for (const w of words) {
            const index = s.keywords.indexOf(w);
            if (index !== -1) score += 15 - index;
          }
        }
        if (s.originalKey) score += 0.1;
        return { song: s, score };
      });
      scored.sort((a, b) => b.score - a.score);
      filteredCatalog = scored.slice(0, 50).map((s) => s.song);
    } else {
      filteredCatalog = fullCatalog.slice(0, 50);
    }

    const catalogLines = filteredCatalog
      .map((s) => `ID: ${s.id} | Title: ${s.title}`)
      .join('\n');

    let activeSetContext = 'ACTIVE SONG SET: none yet.';
    if (songSetMode && activeSongSetId) {
      const active = await loadActiveSongSet(activeSongSetId);
      if (active) {
        activeSetContext = `ACTIVE SONG SET:
- tool_set_id: ${active.id} (for your reference only — NEVER show this id to the user)
- name: ${active.name}
- songs already in set: ${active.songs.map((s) => s.title).join(', ') || '(empty)'}
When the user asks to add songs, call find_songs / suggest_songs — the UI shows checkboxes. Do NOT claim songs were added; the user adds them by checking boxes. Refer to the set by name only.`;
      }
    }

    const orgContext =
      creatableOrgs.length === 0
        ? `USER ORGANIZATIONS: none.
If the user asks to create a song set, tell them to [join an organization](/organizations) or [create a new organization](/organizations/new) first.${songSetMode ? ' Do NOT call create_song_set.' : ''}`
        : creatableOrgs.length === 1
          ? `USER ORGANIZATIONS (can create song sets):
- ${creatableOrgs[0].name} (tool_org_id=${creatableOrgs[0].id}, role: ${creatableOrgs[0].role})
${songSetMode ? 'When creating a song set, use this tool_org_id as organizationId. NEVER show tool_org_id or any database id to the user — only the organization name.' : ''}`
          : `USER ORGANIZATIONS (can create song sets in these):
${creatableOrgs.map((o) => `- ${o.name} (tool_org_id=${o.id}, role: ${o.role})`).join('\n')}
${songSetMode ? 'If they have not chosen an organization, ASK which one by NAME only (never list ids). Use tool_org_id only inside create_song_set.' : ''}`;

    const systemPrompt = songSetMode
      ? `You are Grace, helping the user CREATE A SONG SET in this chat.

RELEVANT SONG CATALOG:
${catalogLines}

${orgContext}

${activeSetContext}

RULES:
1. STRICT DOMAIN RESTRICTION: Only music, worship ministry, chords, setlists, and church planning. Decline off-topic requests.
2. Use markdown. Consider key compatibility for setlists.
3. NEVER SHOW INTERNAL IDS TO THE USER:
   - Do not write organization ids, song ids, group ids, MongoDB ObjectIds, or phrases like "(ID …)".
   - Speak only in human names (organization name, set name, song title).
   - tool_org_id / catalog IDs are for tool calls and markdown song links only — never print them as plain text.
4. SONG SETS + CHECKBOXES (CRITICAL):
   - create_song_set creates a REAL empty (or seeded) song set. Only call when you know name + organizationId.
   - After create, tell the user briefly and that they can check songs below to add them. Link: [set name](/groups/view?id=<id>).
   - NEVER claim songs were added to the set yourself. The chat UI shows CHECKBOXES — the user selects songs and taps Add.
   - When the user wants songs (by title, theme, or "suggest songs"), you MUST call find_songs with their query and/or suggest_songs with catalog IDs. NEVER only mention a song in text — without the tool, NO CHECKBOXES appear and the user cannot add it.
   - find_songs searches the full library (handles typos / partial titles). Prefer it when the user names a song.
   - Do NOT call create_song_set again for the same set when adding songs.
   - If no active set exists and they ask to add songs, ask them to create/name the set first (or create it if name+org are known).`
      : `You are Grace, a worship ministry assistant for Indian churches. Help worship leaders with songs, keys, chords, and service planning.

RELEVANT SONG CATALOG:
${catalogLines}

${orgContext}

RULES:
1. STRICT DOMAIN RESTRICTION: Only music, worship ministry, chords, setlists, and church planning. Decline off-topic requests.
2. SUGGESTING SONGS (CRITICAL — blue links):
   - ALWAYS prefer songs from RELEVANT SONG CATALOG first.
   - Every catalog song MUST be a markdown link using its exact ID:
     - [Exact Song Title](/songs/view?id=<exact-id-from-catalog>)
   - Put each catalog song on its own bullet line. The app turns these into blue song buttons.
   - NEVER invent fake IDs. Only use IDs from the catalog above.
   - Songs NOT in the catalog: mark with ⚪ and plain text only (no link).
   - If the user asks for English / other songs and the catalog is mostly Hindi, still list matching catalog songs as blue links first, then optionally add ⚪ non-catalog suggestions.
3. Use markdown. Keep replies clear and helpful. Consider key compatibility when discussing setlists.
4. SONG SET CREATION: You cannot create song sets in this chat. If the user wants to create a song set with AI, tell them to open Sets → Create Song Set → Create with AI.`;

    const groq = new Groq({ apiKey });

    const aiModel = resolveGroqChatModel(settings.ai_model);

    const recentMessages = messages.slice(-8);

    const tools: Groq.Chat.Completions.ChatCompletionTool[] = songSetMode
      ? [
          {
            type: 'function',
            function: {
              name: 'create_song_set',
              description:
                'Create a real song set. Prefer leaving songIds empty — user adds songs via checkboxes. Only call when name and organizationId are known.',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  organizationId: { type: 'string' },
                  songIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional. Prefer empty; user selects songs with checkboxes.',
                  },
                },
                required: ['name', 'organizationId'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'find_songs',
              description:
                'Search the song library by title/keywords (handles partial names and typos). Returns verified songs for checkbox selection. Use when the user names a song or asks to find songs.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search text, e.g. "ashameri" or "amazing grace"',
                  },
                },
                required: ['query'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'suggest_songs',
              description:
                'Offer verified catalog song IDs as checkbox options. Does NOT add them to the set.',
              parameters: {
                type: 'object',
                properties: {
                  songIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'IDs from RELEVANT SONG CATALOG only',
                  },
                },
                required: ['songIds'],
              },
            },
          },
        ]
      : [];

    type ChatMsg = Groq.Chat.Completions.ChatCompletionMessageParam;
    const chatMessages: ChatMsg[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map((m: any) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      })),
    ];

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let activeSongSet: Awaited<ReturnType<typeof loadActiveSongSet>> = null;
    let selectableSongs: SongRef[] = [];

    if (activeSongSetId) {
      activeSongSet = await loadActiveSongSet(activeSongSetId);
    }

    let completion = await groqBreaker().exec(() => groq.chat.completions.create({
      model: aiModel,
      messages: chatMessages,
      ...(tools.length
        ? { tools, tool_choice: 'auto' as const }
        : {}),
      temperature: 0.7,
      max_tokens: 1024,
    }));

    if (completion.usage) {
      totalPromptTokens += completion.usage.prompt_tokens || 0;
      totalCompletionTokens += completion.usage.completion_tokens || 0;
    }

    for (let round = 0; round < 2 && tools.length > 0; round++) {
      const assistantMessage = completion.choices[0]?.message;
      const toolCalls = assistantMessage?.tool_calls;
      if (!toolCalls || toolCalls.length === 0) break;

      chatMessages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: toolCalls,
      } as ChatMsg);

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') {
          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: false, error: 'Unknown tool' }),
          });
          continue;
        }

        const fnName = toolCall.function.name;
        let args: any = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        if (fnName === 'create_song_set') {
          const result = await createSongSetForUser({
            userId: auth.userId,
            isSuperAdmin,
            name: args.name || '',
            organizationId: args.organizationId || '',
            songIds: args.songIds || [],
            allowedOrgs: creatableOrgs,
          });

          if (result.ok) {
            activeSongSet = {
              id: result.groupId,
              name: result.name,
              songs: result.songs,
              link: result.link,
            };
          }

          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(
              result.ok
                ? {
                    ok: true,
                    groupId: result.groupId,
                    name: result.name,
                    link: result.link,
                    info: 'Set created. Tell user to use checkboxes below to add songs. Do not claim songs were added.',
                  }
                : result
            ),
          });
        } else if (fnName === 'find_songs') {
          const found = await findSongsByQuery(args.query || '', fullCatalog, 15);
          selectableSongs = mergeSongRefs(selectableSongs, found);
          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              ok: true,
              count: found.length,
              songs: found.map((s) => ({ id: s.id, title: s.title })),
              info:
                found.length > 0
                  ? 'Songs shown as checkboxes. User must select and tap Add. Do not say they were added.'
                  : 'No library matches. Ask for another spelling or suggest alternatives via suggest_songs.',
            }),
          });
        } else if (fnName === 'suggest_songs') {
          const verified = await resolveSongRefs(args.songIds || []);
          selectableSongs = mergeSongRefs(selectableSongs, verified);
          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              ok: true,
              count: verified.length,
              songs: verified.map((s) => ({ id: s.id, title: s.title })),
              info: 'Shown as checkboxes only. User adds them.',
            }),
          });
        } else {
          chatMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: false, error: 'Unknown tool' }),
          });
        }
      }

      completion = await groqBreaker().exec(() => groq.chat.completions.create({
        model: aiModel,
        messages: chatMessages,
        tools,
        tool_choice: 'none',
        temperature: 0.5,
        max_tokens: 1024,
      }));

      if (completion.usage) {
        totalPromptTokens += completion.usage.prompt_tokens || 0;
        totalCompletionTokens += completion.usage.completion_tokens || 0;
      }
    }

    let responseText =
      completion.choices[0]?.message?.content ||
      'Sorry, I could not generate a response.';

    responseText = scrubInternalIdsFromReply(responseText);

    // Normal chat: keep DB songs as blue markdown links
    if (!songSetMode) {
      const lastUserContent = messages[messages.length - 1]?.content || '';
      responseText = ensureCatalogSongLinks(
        responseText,
        filteredCatalog.map((s) => ({ id: s.id, title: s.title })),
        lastUserContent
      );
    }

    // Checkbox safety nets only in song-set mode
    if (songSetMode) {
      const idsInReply = extractSongIdsFromMarkdown(responseText);
      if (idsInReply.length) {
        selectableSongs = mergeSongRefs(
          selectableSongs,
          await resolveSongRefs(idsInReply)
        );
      }

      const lastUserContent = messages[messages.length - 1]?.content || '';
      if (
        activeSongSet &&
        selectableSongs.length === 0 &&
        looksLikeSongRequest(lastUserContent)
      ) {
        const fallback = await findSongsByQuery(lastUserContent, fullCatalog, 15);
        selectableSongs = mergeSongRefs(selectableSongs, fallback);
      }

      if (activeSongSet?.songs?.length && selectableSongs.length) {
        const inSet = new Set(activeSongSet.songs.map((s) => s.id));
        selectableSongs = selectableSongs.filter((s) => !inSet.has(s.id));
      }
    }

    AiUsageModel.log({
      userId: auth.userId,
      type: 'chat',
      query: messages[messages.length - 1]?.content || '',
      model: aiModel,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      createdAt: new Date(),
    });

    return Response.json({
      content: responseText,
      ...(songSetMode && activeSongSet ? { activeSongSet } : {}),
      ...(songSetMode && selectableSongs.length ? { selectableSongs } : {}),
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);

    if (isBreakerError(error)) {
      return Response.json(
        {
          error:
            'Grace Copilot is temporarily unavailable while the AI service recovers. Please try again in a minute.',
        },
        { status: 503 }
      );
    }

    const message = error.message || '';
    if (
      message.includes('429') ||
      message.includes('413') ||
      message.includes('rate_limit') ||
      message.includes('too large')
    ) {
      return Response.json(
        {
          error:
            'Grace Copilot is taking a breather 😊 — too many requests. Please wait a moment and try again.',
        },
        { status: 429 }
      );
    }
    if (message.includes('401') || message.includes('invalid_api_key')) {
      return Response.json(
        {
          error:
            'The AI service is not configured correctly. Please contact your administrator.',
        },
        { status: 401 }
      );
    }

    if (
      message.includes('model_decommissioned') ||
      message.includes('decommissioned') ||
      message.includes('model_not_found')
    ) {
      return Response.json(
        {
          error:
            'The selected Groq model is no longer available. Open Admin → Settings and choose a current model (e.g. openai/gpt-oss-20b).',
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 }
    );
  }
}

function mergeSongRefs(existing: SongRef[], incoming: SongRef[]): SongRef[] {
  const map = new Map(existing.map((s) => [s.id, s]));
  for (const s of incoming) {
    if (!map.has(s.id)) map.set(s.id, s);
  }
  return Array.from(map.values());
}
