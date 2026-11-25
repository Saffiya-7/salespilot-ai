// GET /api/ai-status
// Tells the signed-in user which server features are configured (never the
// values of any secret). Used by Settings and to show setup hints.
import { supabaseConfig } from '../lib/auth';
import { geminiModel, isGeminiConfigured } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { limits } from '../lib/rateLimit';
import { searchProvider } from '../lib/search';

export default createHandler('ai-status', { method: 'GET', ai: false }, async () => ({
  gemini_configured: isGeminiConfigured(),
  model: geminiModel(),
  live_search: searchProvider(),
  supabase_configured: supabaseConfig() !== null,
  limits: limits(),
  // SalesPilot never sends e-mail itself; drafts are copied or opened in the user's own mail app.
  email_sending: 'not_configured',
}));
