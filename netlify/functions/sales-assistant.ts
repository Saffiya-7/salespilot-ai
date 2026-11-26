// POST /api/sales-assistant  { message, conversation_id? }
// Conversational assistant grounded in the user's real data. Before every
// answer it queries the user's leads, follow-ups, activities and metrics
// (under RLS) and passes that snapshot to Gemini. Lead ids it cites are
// checked against the database; conversations are stored in ai_conversations.
import { assistantAiSchema, assistantRequestSchema } from '../../shared/schemas';
import { cleanList } from '../../shared/scoring';
import type { ChatMessage, LeadScore } from '../../shared/types';
import { buildSnapshot, loadAccountData, matchMentionedLeads } from '../lib/accountData';
import { dataBlock, generateJson, SHARED_RULES } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { HttpError } from '../lib/http';
import { assistantSchema } from '../lib/responseSchemas';

const SYSTEM = `You are Sumo, an AI sales assistant inside a CRM. You help the user decide what to do, write outreach, and improve results.

You receive ACCOUNT DATA: a fresh snapshot queried from the user's own database just now.
- For any question about their leads, pipeline, follow-ups, performance or numbers, answer ONLY from ACCOUNT DATA. Quote numbers exactly as given; never estimate, extrapolate or invent metrics, names or dates.
- If the data does not contain what is needed, say so plainly and suggest what to add (e.g. "score your leads", "log activities").
- If the account has few or no leads, say that instead of giving generic numbers.
- When prioritising, explain why using the data (AI score/priority, stage, overdue or due follow-ups, days in stage, deal value). AI scores are estimates, not probabilities.
- For general sales advice (strategy, objection handling, conversion tips), you may use expert knowledge, but tie it to their data where possible and label general advice as such.
- When asked to write an e-mail for a prospect, use only facts from that lead's data and use [placeholders] for unknown specifics. Never invent personal details.
- Put the ids of any leads you mention in referenced_lead_ids. Use lead names in the answer, not ids.
- Keep answers focused: short paragraphs and bullet lists, under ~250 words unless the user asks for a full e-mail or plan.
${SHARED_RULES}`;

const MAX_HISTORY = 8;

export default createHandler('sales-assistant', { schema: assistantRequestSchema }, async (input, { supabase, user }) => {
  // 1. Load (or create) the conversation
  type StoredConversation = { id: string; title: string; messages: ChatMessage[] };
  let conversation: StoredConversation | null = null;
  if (input.conversation_id) {
    const { data } = await supabase.from('ai_conversations').select('id,title,messages').eq('id', input.conversation_id).maybeSingle();
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found.');
    conversation = data as unknown as StoredConversation;
  }
  const history = (conversation?.messages ?? []).slice(-MAX_HISTORY);

  // 2. Retrieval: query the user's real data
  const account = await loadAccountData(supabase, user.id);
  const recentUserText = [input.message, ...history.filter((m) => m.role === 'user').slice(-2).map((m) => m.content)].join(' ');
  const focus = matchMentionedLeads(recentUserText, account.leads);
  let latestScores: LeadScore[] = [];
  if (focus.length) {
    const { data } = await supabase.from('lead_scores').select('*').in('lead_id', focus.map((l) => l.id)).order('created_at', { ascending: false }).limit(20);
    latestScores = (data ?? []) as LeadScore[];
  }
  const snapshot = buildSnapshot(account, { focus, latestScores });
  const dataUsed = [
    `${account.leads.length} leads`,
    `${account.followups.filter((f) => f.status === 'pending').length} pending follow-ups`,
    `${account.activities.length} recent activities`,
    ...(focus.length ? [`details for ${focus.map((l) => l.company).join(', ')}`] : []),
  ];

  // 3. Ask Gemini
  const prompt = [
    dataBlock('account_data', snapshot),
    history.length
      ? dataBlock('conversation_so_far', history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 1500)}`).join('\n\n'))
      : '',
    dataBlock('user_question', input.message),
  ]
    .filter(Boolean)
    .join('\n\n');

  const { data } = await generateJson({ system: SYSTEM, prompt, schema: assistantSchema, validator: assistantAiSchema, temperature: 0.4, maxOutputTokens: 3000 });

  // 4. Only keep lead references that really exist in this user's data
  const known = new Set(account.leads.map((l) => l.id));
  const referenced = [...new Set(data.referenced_lead_ids)].filter((id) => known.has(id)).slice(0, 10);

  const now = new Date().toISOString();
  const userMsg: ChatMessage = { role: 'user', content: input.message, created_at: now };
  const reply: ChatMessage = {
    role: 'assistant',
    content: data.answer,
    created_at: now,
    referenced_lead_ids: referenced,
    suggested_actions: cleanList(data.suggested_actions, 3),
    data_used: dataUsed,
  };

  // 5. Persist the conversation (keep the last 60 messages)
  const messages = [...(conversation?.messages ?? []), userMsg, reply].slice(-60);
  let conversationId = conversation?.id;
  if (conversationId) {
    const { error } = await supabase.from('ai_conversations').update({ messages }).eq('id', conversationId);
    if (error) console.warn('[sales-assistant] could not save conversation', error.message);
  } else {
    const title = input.message.length > 60 ? `${input.message.slice(0, 57)}…` : input.message;
    const { data: created, error } = await supabase.from('ai_conversations').insert({ title, messages }).select('id').single();
    if (error) console.warn('[sales-assistant] could not create conversation', error.message);
    conversationId = created?.id;
  }

  return { conversation_id: conversationId ?? null, message: reply };
});
