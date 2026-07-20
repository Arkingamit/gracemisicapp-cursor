import type { NextRequest } from 'next/server';
import type { ZodError, ZodType } from 'zod';

/**
 * Strict request-validation helpers built on zod.
 *
 * Philosophy: every untrusted input (JSON body, query string, route params) is
 * parsed against an explicit schema and REJECTED with HTTP 400 if it does not
 * match — we do not silently coerce/sanitize away bad data. Object schemas
 * should use `.strict()` so unexpected fields are rejected rather than ignored.
 */

/**
 * Result of a validation attempt.
 *
 * NOTE: This project compiles with `strictNullChecks: false`, where TypeScript
 * cannot reliably narrow discriminated unions. So we model the result as a
 * single shape where `data` is populated on success and `response` (a ready
 * 400) is populated on failure. Callers check `ok` and return `response` on
 * failure, then use `data`.
 */
export interface ValidationResult<T> {
  ok: boolean;
  data: T;
  response: Response;
}

function formatZodError(error: ZodError): {
  error: string;
  details: { path: string; message: string }[];
} {
  const details = error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '(body)',
    message: issue.message,
  }));
  const first = details[0];
  return {
    error: first
      ? `Invalid request: ${first.path} — ${first.message}`
      : 'Invalid request',
    details,
  };
}

function validationError(error: ZodError): Response {
  return Response.json(formatZodError(error), { status: 400 });
}

/**
 * Reads and validates a JSON request body against `schema`.
 * Returns the parsed (typed) data or a ready-to-return 400 response.
 */
export async function validateBody<T>(
  request: NextRequest | Request,
  schema: ZodType<T>
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      ),
    } as ValidationResult<T>;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: validationError(parsed.error) } as ValidationResult<T>;
  }
  return { ok: true, data: parsed.data } as ValidationResult<T>;
}

function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const key of params.keys()) {
    // Last value wins; multi-value params aren't used by these routes.
    obj[key] = params.get(key) as string;
  }
  return obj;
}

/**
 * Validates URL query parameters against `schema`. Accepts a request or a
 * `URLSearchParams`. Use `z.coerce.*` in the schema for numeric params.
 */
export function validateQuery<T>(
  source: NextRequest | Request | URLSearchParams,
  schema: ZodType<T>
): ValidationResult<T> {
  const params =
    source instanceof URLSearchParams
      ? source
      : new URL(source.url).searchParams;
  const parsed = schema.safeParse(searchParamsToObject(params));
  if (!parsed.success) {
    return { ok: false, response: validationError(parsed.error) } as ValidationResult<T>;
  }
  return { ok: true, data: parsed.data } as ValidationResult<T>;
}

/**
 * Validates dynamic route params (already-resolved object) against `schema`.
 */
export function validateParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: ZodType<T>
): ValidationResult<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return { ok: false, response: validationError(parsed.error) } as ValidationResult<T>;
  }
  return { ok: true, data: parsed.data } as ValidationResult<T>;
}
