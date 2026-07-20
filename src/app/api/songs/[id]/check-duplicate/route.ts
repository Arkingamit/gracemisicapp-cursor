import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { SongModel } from '@/server/models/song';
import { getAuthUser } from '@/lib/auth';
import { UserModel } from '@/server/models/user';
import { SettingsModel } from '@/server/models/settings';
import { resolveGroqChatModel, DEFAULT_GROQ_CHAT_MODEL } from '@/lib/groqModels';
import { z } from 'zod';
import { validateParams } from '@/server/validation/http';
import { objectId } from '@/server/validation/schemas';
import { groqBreaker } from '@/server/ai/groqBreaker';
import { isBreakerError } from '@/server/circuitBreaker';

const idParamsSchema = z.object({ id: objectId });

// POST /api/songs/[id]/check-duplicate - AI-powered duplicate detection for verifiers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const dbUser = await UserModel.findById(auth.userId);
    const actualRole = dbUser?.role || auth.role;

    // Only super_admin, editor and verifier can use this feature
    if (actualRole !== 'super_admin' && actualRole !== 'editor' && actualRole !== 'verifier') {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const parsedParams = validateParams(await params, idParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;
    const { id } = parsedParams.data;
    const pendingSong = await SongModel.findById(id);
    if (!pendingSong) {
      return Response.json({ error: 'Song not found' }, { status: 404 });
    }

    if (pendingSong.status !== 'pending') {
      return Response.json({ error: 'Song is not in pending state' }, { status: 400 });
    }

    // Get AI settings
    const settings = await SettingsModel.getSettings();
    const apiKey = settings.groq_api_key || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'AI is not configured. Please set up the GROQ API key in settings.' },
        { status: 500 }
      );
    }

    // Fetch approved global song catalog with aliases
    const fullCatalog = await SongModel.getLightweightCatalog();
    const approvedCatalog = fullCatalog.filter((s: any) => s.status !== 'pending' && s.status !== 'rejected');

    // Pre-filter catalog to avoid hitting AI token limits.
    // Only include songs that share at least one word in title, artist, or keywords.
    const getWords = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const pendingWords = new Set([
      ...getWords(pendingSong.title),
      ...getWords(pendingSong.artist || ''),
      ...(pendingSong.keywords || [])
    ]);

    // Keep if the candidate shares any meaningful word, to reduce from thousands to dozens.
    const candidateCatalog = approvedCatalog.filter((s: any) => {
      const candidateWords = new Set([
        ...getWords(s.title),
        ...getWords(s.artist || ''),
        ...getWords((s.aliases || []).join(' '))
      ]);
      for (const w of Array.from(pendingWords)) {
        if (candidateWords.has(w)) return true;
      }
      return false;
    });

    // Build compact catalog string for AI (include aliases)
    const catalogLines = candidateCatalog
      .map((s: any) => {
        const aliasStr = (s.aliases || []).length > 0 ? ` [also known as: ${s.aliases.join(', ')}]` : '';
        return `${s.id}|${s.title}${aliasStr}|${s.artist || ''}|${s.language || ''}`;
      })
      .join('\n');

    // Use keywords instead of raw lyrics for the comparison
    const keywordsStr = (pendingSong.keywords || []).join(', ');

    const systemPrompt = `You are a music librarian AI. Your job is to detect if a newly submitted song already exists in the library under a different title.

EXISTING SONG LIBRARY (format: ID|Title [also known as: aliases]|Artist|Language):
${catalogLines}

A NEW SONG has been submitted for approval. Compare it carefully against the library above.

NEW SONG:
- Title: "${pendingSong.title}"
- Artist: "${pendingSong.artist || 'Unknown'}"  
- Language: "${pendingSong.language || 'Unknown'}"
- Keywords: "${keywordsStr}"

TASK: Determine if this new song is a DUPLICATE of any song already in the library. A duplicate means it's the same song but with:
- A different title (e.g. "Amazing Grace" vs "Amaizing Grace", or translated title)
- A nickname or shortened title
- A regional name variation

Respond ONLY with a valid JSON object in this exact format, nothing else:
{
  "isDuplicate": true or false,
  "matchedSongId": "the_24_char_mongo_id_here" or null,
  "matchedTitle": "the matched song title" or null,
  "confidence": "high" or "medium" or "low",
  "reason": "Brief explanation of why you think it is or isn't a duplicate"
}`;

    const groq = new Groq({ apiKey });
    const aiModel = resolveGroqChatModel(settings.ai_model) || DEFAULT_GROQ_CHAT_MODEL;

    const completion = await groqBreaker().exec(() => groq.chat.completions.create({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Check if this newly submitted song is a duplicate.' },
      ],
      temperature: 0.1, // Low temp for more deterministic factual response
      max_tokens: 400,
    }));

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse the JSON response
    let result: {
      isDuplicate: boolean;
      matchedSongId?: string | null;
      matchedTitle?: string | null;
      confidence?: string;
      reason?: string;
    } = {
      isDuplicate: false,
      matchedSongId: null,
      matchedTitle: null,
      confidence: 'low',
      reason: 'Could not parse AI response.',
    };

    try {
      // Find JSON block in case there's extra text
      const jsonStr = responseText.substring(
        responseText.indexOf('{'),
        responseText.lastIndexOf('}') + 1
      );
      const parsed = JSON.parse(jsonStr);
      if (parsed.matchedSongId) {
        parsed.matchedSongId = String(parsed.matchedSongId).trim();
      }
      result = { ...result, ...parsed };
    } catch (e) {
      console.error('Failed to parse AI response:', responseText);
    }

    // Include the top 5 similar candidates from the pre-filter
    const similarSongs = candidateCatalog.slice(0, 5).map((s: any) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      aliases: s.aliases,
    }));

    return Response.json({ ...result, similarSongs }, { status: 200 });
  } catch (error: any) {
    console.error('Duplicate check error:', error);

    if (isBreakerError(error)) {
      return Response.json(
        { error: 'AI duplicate check is temporarily unavailable. Please verify manually or retry shortly.' },
        { status: 503 }
      );
    }

    if (error.message?.includes('429') || error.message?.includes('rate_limit')) {
      return Response.json(
        { error: 'AI is rate limited. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return Response.json(
      { error: 'Duplicate check failed. Please try again.' },
      { status: 500 }
    );
  }
}
