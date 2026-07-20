import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'zlib';

/**
 * Response compression for API route handlers.
 *
 * Next.js's `compress: true` gzips page HTML but does NOT compress App Router
 * route handler responses, and the production nginx proxy passes them through
 * uncompressed. This helper negotiates `Accept-Encoding` (brotli preferred,
 * then gzip) and compresses JSON bodies above a small threshold.
 *
 * Double-compression safety: we only ever compress the JSON we serialize
 * here (never already-encoded payloads), and proxies like nginx skip
 * responses that already carry a Content-Encoding header.
 */

// Below this size compression overhead outweighs the gain.
const MIN_COMPRESS_BYTES = 1024;

// Brotli quality 4 ≈ gzip-6 speed with better ratios; the default (11) is
// far too slow for dynamic per-request payloads.
const BROTLI_OPTS = {
  params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
};

function pickEncoding(request: Request): 'br' | 'gzip' | null {
  const accept = request.headers.get('accept-encoding') || '';
  if (/\bbr\b/i.test(accept)) return 'br';
  if (/\bgzip\b/i.test(accept)) return 'gzip';
  return null;
}

/**
 * Like `Response.json()`, but compresses the body when the client supports it
 * and the payload is large enough to benefit.
 */
export function compressedJson(
  request: Request,
  data: unknown,
  init?: Omit<ResponseInit, 'headers'> & { headers?: Record<string, string> }
): Response {
  const body = JSON.stringify(data);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Caches must key on encoding even when we return identity.
    'Vary': 'Accept-Encoding',
    ...(init?.headers || {}),
  };

  const encoding = pickEncoding(request);
  const raw = Buffer.from(body, 'utf-8');

  if (!encoding || raw.byteLength < MIN_COMPRESS_BYTES) {
    return new Response(raw, { ...init, headers });
  }

  const compressed =
    encoding === 'br' ? brotliCompressSync(raw, BROTLI_OPTS) : gzipSync(raw);

  return new Response(compressed, {
    ...init,
    headers: {
      ...headers,
      'Content-Encoding': encoding,
      'Content-Length': String(compressed.byteLength),
    },
  });
}
