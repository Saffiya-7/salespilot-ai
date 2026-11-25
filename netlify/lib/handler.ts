import type { z } from 'zod';
import { requireUser, type AuthContext } from './auth';
import { isGeminiConfigured } from './gemini';
import { HttpError, errorResponse, json, readJson, requireMethod } from './http';
import { enforceRateLimit } from './rateLimit';

interface Options<S extends z.ZodType | undefined> {
  method?: 'GET' | 'POST';
  /** Request body schema (POST). Validated BEFORE the rate limit, so bad input never costs quota. */
  schema?: S;
  /** AI endpoints need GEMINI_API_KEY and count toward the per-user rate limit. */
  ai?: boolean;
}

type Input<S> = S extends z.ZodType ? z.output<S> : undefined;

/**
 * Standard pipeline for every function:
 * method check → verify Supabase JWT → validate body → AI config check → rate limit → handler → safe errors.
 */
export function createHandler<S extends z.ZodType | undefined = undefined>(
  name: string,
  opts: Options<S>,
  fn: (input: Input<S>, auth: AuthContext, req: Request) => Promise<unknown>,
) {
  const { method = 'POST', ai = true, schema } = opts;
  return async (req: Request): Promise<Response> => {
    try {
      requireMethod(req, method);
      const auth = await requireUser(req);
      const input = (schema ? await readJson(req, schema) : undefined) as Input<S>;
      if (ai) {
        if (!isGeminiConfigured()) {
          throw new HttpError(
            503,
            'AI_NOT_CONFIGURED',
            'AI is not configured: GEMINI_API_KEY is missing on the server. Add it to .env (local) or the Netlify environment variables, then restart/redeploy.',
          );
        }
        await enforceRateLimit(auth.supabase, auth.user.id, name);
      }
      const result = await fn(input, auth, req);
      return result instanceof Response ? result : json(result);
    } catch (err) {
      return errorResponse(err, name);
    }
  };
}
