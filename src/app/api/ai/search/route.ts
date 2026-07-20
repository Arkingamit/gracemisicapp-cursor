import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { SongModel } from '@/server/models/song';
import { getAuthUser } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { SettingsModel } from '@/server/models/settings';
import { AiUsageModel } from '@/server/models/aiUsage';
import { resolveGroqChatModel } from '@/lib/groqModels';
import { z } from 'zod';
import { validateBody } from '@/server/validation/http';
import { groqBreaker } from '@/server/ai/groqBreaker';
import { isBreakerError } from '@/server/circuitBreaker';

const searchSchema = z.object({ query: z.string().max(500).optional() }).strict();

// POST /api/ai/search - AI-powered song search
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, searchSchema);
    if (!parsed.ok) return parsed.response;
    const { query } = parsed.data;

    if (!query || query.trim().length === 0) {
      return Response.json({ songIds: [] });
    }

    const settings = await SettingsModel.getSettings();
    const apiKey = settings.groq_api_key || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'AI search is not configured. Please set up the GROQ API key.' },
        { status: 500 }
      );
    }

    // Check auth for org-based filtering
    const auth = getAuthUser(req);
    if (!auth) {
      return Response.json({ error: 'Please sign in to use AI search.' }, { status: 401 });
    }

    let userOrgIds: string[] | undefined;
    if (auth.role !== 'super_admin') {
      const orgCollection = await getCollection(COLLECTIONS.ORGANIZATIONS);
      const userOrgs = await orgCollection
        .find({
          $or: [
            { members: auth.userId },
            { createdBy: auth.userId },
            { managerIds: auth.userId },
          ],
        })
        .toArray();
      userOrgIds = userOrgs.map((o: any) => o._id.toString());
    }

    // Fetch the lightweight catalog
    const fullCatalog = await SongModel.getLightweightCatalog(userOrgIds);

    // Pre-filter with keyword scoring (same as chat route)
    const cleanMsg = query.toLowerCase().replace(/[^\w\s]/gi, '');
    const stopWords = ['and', 'the', 'for', 'with', 'what', 'best', 'suggest', 'some', 'song', 'songs', 'can', 'you', 'find', 'search', 'show', 'me', 'give', 'get', 'play'];
    const words = cleanMsg.split(/\s+/).filter((w: string) => w.length > 1 && !stopWords.includes(w));

    let catalogForAI = fullCatalog;

    if (words.length > 0) {
      const scored = fullCatalog.map((s) => {
        let score = 0;
        const genreStr = Array.isArray(s.genre) ? s.genre.join(' ') : (s.genre || '');
        const keywordStr = Array.isArray(s.keywords) ? s.keywords.join(' ') : '';
        const searchStr = `${s.title} ${s.artist || ''} ${genreStr} ${s.originalKey || ''} ${s.language || ''} ${keywordStr}`.toLowerCase();
        
        if (searchStr.includes(cleanMsg)) score += 50;
        
        for (const w of words) {
          if (searchStr.includes(w)) score += 1;
        }

        if (s.keywords && Array.isArray(s.keywords)) {
          for (const w of words) {
            const index = s.keywords.indexOf(w);
            if (index !== -1) {
              score += (15 - index);
            }
          }
        }
        
        if (s.originalKey) score += 0.1;

        return { song: s, score };
      });
      
      scored.sort((a, b) => b.score - a.score);
      catalogForAI = scored.slice(0, 80).map((s) => s.song);
    } else {
      catalogForAI = fullCatalog.slice(0, 80);
    }

    // Build compact catalog for AI
    const catalogLines = catalogForAI
      .map((s) => {
        const lang = s.language || '';
        const genre = Array.isArray(s.genre) ? s.genre.join(', ') : (s.genre || '');
        return `${s.id}|${s.title}|${s.artist || ''}|${genre}|${s.originalKey || ''}|${lang}`;
      })
      .join('\n');

    const systemPrompt = `You are a song search engine. The user will describe what song they're looking for using natural language. Your job is to find the best matching songs from the catalog below.

SONG CATALOG (format: ID|Title|Artist|Genre|Key|Language):
${catalogLines}

RULES:
1. Return ONLY a JSON array of song IDs that match the user's query. Nothing else.
2. Return the most relevant songs first, up to 20 results max.
3. Understand natural language queries like "living hope in hindi", "worship songs in key of G", "fast praise songs", "songs by hillsong", etc.
4. If the user asks for a song in a specific language, filter by language.
5. If no songs match, return an empty array: []
6. Output ONLY valid JSON. No markdown, no explanation, no backticks.

Example output: ["id1","id2","id3"]`;

    const groq = new Groq({ apiKey });

    const aiModel = resolveGroqChatModel(settings.ai_model);

    const completion = await groqBreaker().exec(() => groq.chat.completions.create({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 512,
    }));

    const responseText = completion.choices[0]?.message?.content || '[]';
    
    // Parse the JSON response - handle potential markdown wrapping
    let songIds: string[] = [];
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      songIds = JSON.parse(cleaned);
      if (!Array.isArray(songIds)) songIds = [];
    } catch {
      // If parsing fails, try to extract IDs from the text
      const idPattern = /[a-f0-9]{24}/g;
      songIds = responseText.match(idPattern) || [];
    }

    // Log token usage
    const usage = completion.usage;
    if (usage) {
      AiUsageModel.log({
        userId: auth.userId,
        type: 'search',
        query,
        model: aiModel,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        createdAt: new Date(),
      });
    }

    return Response.json({ songIds });
  } catch (error: any) {
    console.error('AI Search Error:', error);

    if (isBreakerError(error)) {
      return Response.json(
        { error: 'AI search is temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    const message = error.message || '';
    if (message.includes('429') || message.includes('rate_limit')) {
      return Response.json(
        { error: 'AI search is rate limited. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return Response.json(
      { error: 'AI search failed. Please try again.' },
      { status: 500 }
    );
  }
}
