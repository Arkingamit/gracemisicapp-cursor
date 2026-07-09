import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { SongModel } from '@/server/models/song';
import { getAuthUser } from '@/lib/auth';
import { getCollection } from '@/server/db/connection';
import { COLLECTIONS } from '@/server/db/collections';
import { SettingsModel } from '@/server/models/settings';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const settings = await SettingsModel.getSettings();

    const apiKey = settings.groq_api_key || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'GROQ_API_KEY not configured. Get a free key at console.groq.com and configure it in Admin Settings.' },
        { status: 500 }
      );
    }

    // Check auth to determine org-based filtering for the catalog
    const auth = getAuthUser(req);
    if (!auth) {
      return Response.json(
        { error: 'Please sign in to start chatting.' },
        { status: 401 }
      );
    }

    if (!settings.enable_ai_chat) {
      return Response.json(
        { error: 'AI Assistant is currently disabled by the administrator.' },
        { status: 403 }
      );
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

    // Fetch the full catalog
    const fullCatalog = await SongModel.getLightweightCatalog(userOrgIds);

    // --- SMART CATALOG FILTERING (Poor-man's RAG) ---
    // Groq's free tier has a 6,000 Tokens-Per-Minute limit.
    // The full catalog is ~23,000 tokens. So we filter down to the 200 most relevant songs.
    const lastUserMsg = messages[messages.length - 1]?.content.toLowerCase() || '';
    const cleanMsg = lastUserMsg.replace(/[^\w\s]/gi, '');

    // Check if the user is asking about the developer of the app
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

    const isAskingAboutDeveloper = developerKeywords.some(keyword => cleanMsg.includes(keyword));

    if (isAskingAboutDeveloper) {
      return Response.json({
        content: 'The developer of this app is Arkin Gamit. You can visit his website at [arkin.codes/](https://arkin.codes/).'
      });
    }
    const stopWords = ['and', 'the', 'for', 'with', 'what', 'best', 'suggest', 'some', 'song', 'songs', 'can', 'you'];
    const words = cleanMsg.split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.includes(w));

    let filteredCatalog = fullCatalog;
    
    if (words.length > 0) {
      const scored = fullCatalog.map((s) => {
        let score = 0;
        const genreStr = Array.isArray(s.genre) ? s.genre.join(' ') : (s.genre || '');
        const keywordStr = Array.isArray(s.keywords) ? s.keywords.join(' ') : '';
        const searchStr = `${s.title} ${s.artist || ''} ${genreStr} ${s.originalKey || ''} ${keywordStr}`.toLowerCase();
        
        // Exact match of the entire query gets a huge boost
        if (searchStr.includes(cleanMsg)) score += 50;
        
        // Individual word matches
        for (const w of words) {
          if (searchStr.includes(w)) score += 1;
        }

        // Boost heavily if the word is an exact match for one of the song's top keywords
        if (s.keywords && Array.isArray(s.keywords)) {
          for (const w of words) {
            const index = s.keywords.indexOf(w);
            if (index !== -1) {
              // Higher rank (lower index) gives more points
              score += (15 - index); 
            }
          }
        }
        
        // Boost slightly if it has an original key (better for setlists)
        if (s.originalKey) score += 0.1;

        return { song: s, score };
      });
      
      // Sort by highest score first
      scored.sort((a, b) => b.score - a.score);
      
      // Take the top 50 songs (super lightweight)
      filteredCatalog = scored.slice(0, 50).map((s) => s.song);
    } else {
      // If no words to search, just take 50 random/top songs
      filteredCatalog = fullCatalog.slice(0, 50);
    }

    // Build an ultra-compact catalog with all necessary info
    const catalogLines = filteredCatalog
      .map((s) => `ID: ${s.id} | Title: ${s.title}`)
      .join('\n');

    const systemPrompt = `You are Grace, a worship ministry assistant for Indian churches. Help worship leaders build setlists, check vocal ranges, and plan services.

RELEVANT SONG CATALOG:
${catalogLines}

RULES:
2. SUGGESTING SONGS: You can suggest songs BOTH from the provided catalog and outside of it.
3. FORMATTING SUGGESTIONS: When suggesting songs, you MUST output them as a simple bulleted list. Do NOT output a table.
   - CRITICAL: For in-catalog songs, you MUST use the exact ID provided in the RELEVANT SONG CATALOG above to create a markdown link.
   - Link Format: - [Song Title](/songs/view?id=<EXACT_ID_FROM_CATALOG>)
   - CRITICAL: If a song is NOT explicitly listed in the RELEVANT SONG CATALOG, you MUST NOT create a link for it. You must just write the title and append "⚪". DO NOT hallucinate or make up IDs!
   
   Example Format:
   - [Way Maker](/songs/view?id=66d582e5765686eeef875abc)
   - Same God ⚪

4. Consider key compatibility when building setlists.
5. Use markdown formatting for clean responses.`;

    const groq = new Groq({ apiKey });

    // Only keep the last 6 messages to prevent token bloat from long conversations
    const recentMessages = messages.slice(-6);

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentMessages.map((m: any) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
    ];

    const completion = await groq.chat.completions.create({
      model: settings.ai_model || 'llama-3.3-70b-versatile',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const responseText =
      completion.choices[0]?.message?.content ||
      'Sorry, I could not generate a response.';

    return Response.json({ content: responseText });
  } catch (error: any) {
    console.error('AI Chat Error:', error);

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
            'Groq API key is invalid. Please check your GROQ_API_KEY in .env.local',
        },
        { status: 401 }
      );
    }

    return Response.json(
      { error: 'Something went wrong. Please try again in a moment.' },
      { status: 500 }
    );
  }
}

