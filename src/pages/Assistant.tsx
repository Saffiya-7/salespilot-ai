import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Database, MessageSquarePlus, Send, Sparkles, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { LIMITS } from '../../shared/constants';
import type { ChatMessage } from '../../shared/types';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorNotice } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useConversations, useLeads, useRefresh } from '../hooks/useData';
import { askAssistant } from '../services/ai';
import { deleteConversation } from '../services/profile';
import { cn, formatRelative } from '../utils/format';
import { Markdown } from '../utils/markdown';

const SUGGESTIONS = [
  'Which leads should I prioritise today?',
  'Which leads need a follow-up?',
  'Which industries are converting best for me?',
  'How can I improve my conversion rate?',
  'Suggest a better outreach strategy for my pipeline',
  'Why is my top lead important?',
];

export default function Assistant() {
  const { data: conversations = [] } = useConversations();
  const { data: leads = [] } = useLeads();
  const refresh = useRefresh();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const ask = useMutation({
    mutationFn: (message: string) => askAssistant({ message, conversation_id: conversationId ?? undefined }),
    onMutate: (message) => {
      setMessages((m) => [...m, { role: 'user', content: message, created_at: new Date().toISOString() }]);
      setInput('');
    },
    onSuccess: async (r) => {
      setMessages((m) => [...m, r.message]);
      if (r.conversation_id) setConversationId(r.conversation_id);
      await refresh('conversations');
    },
    onError: (_e, message) => {
      // put the question back so the user can retry
      setMessages((m) => m.slice(0, -1));
      setInput(message);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: async (_d, id) => {
      if (id === conversationId) newChat();
      setToDelete(null);
      toast.success('Conversation deleted');
      await refresh('conversations');
    },
  });

  function newChat() {
    setConversationId(null);
    setMessages([]);
    ask.reset();
  }

  function openConversation(id: string) {
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    setConversationId(c.id);
    setMessages(c.messages ?? []);
    ask.reset();
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || ask.isPending) return;
    ask.mutate(t.slice(0, LIMITS.assistantMessage));
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="AI Tools"
        title="AI Sales Assistant"
        description="Ask about your pipeline in plain language. Before answering, the assistant queries your actual leads, follow-ups and activity — it never makes up numbers."
        actions={<Button variant="secondary" icon={<MessageSquarePlus className="size-4" />} onClick={newChat}>New chat</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="hidden h-[calc(100vh-230px)] min-h-[480px] flex-col overflow-hidden lg:flex">
          <div className="border-b border-ink-100 px-4 py-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Conversations</div>
          <div className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2">
            {conversations.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-400">Your chats will be saved here.</p>}
            {conversations.map((c) => (
              <div key={c.id} className={cn('group flex items-center gap-1 rounded-lg', c.id === conversationId ? 'bg-brand-50' : 'hover:bg-lavender-50')}>
                <button onClick={() => openConversation(c.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                  <span className={cn('block truncate text-[13px] font-medium', c.id === conversationId ? 'text-brand-800' : 'text-ink-800')}>{c.title}</span>
                  <span className="block text-[11px] text-ink-400">{formatRelative(c.updated_at)}</span>
                </button>
                <button onClick={() => setToDelete(c.id)} aria-label="Delete conversation" className="mr-1 rounded p-1.5 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex h-[calc(100vh-230px)] min-h-[520px] flex-col overflow-hidden">
          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-glow">
                  <Bot className="size-7" />
                </motion.div>
                <h2 className="mt-4 text-xl font-bold">How can I help you sell today?</h2>
                <p className="mt-1.5 text-sm text-ink-500">
                  {leads.length ? `I can see ${leads.length} lead${leads.length === 1 ? '' : 's'} in your workspace.` : 'Your workspace has no leads yet — I can still help with strategy, and I will tell you when data is missing.'}
                </p>
                <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl bg-lavender-25 px-4 py-3 text-left text-[13px] font-medium text-ink-700 ring-1 ring-ink-100 transition hover:bg-white hover:ring-brand-200">
                      <Sparkles className="mb-1 size-3.5 text-brand-500" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <motion.div key={`${i}-${m.created_at}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', m.role === 'user' ? 'bg-ink-900 text-white' : 'bg-linear-to-br from-brand-500 to-brand-700 text-white')}>
                        {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                      </span>
                      <div className={cn('max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-[14px]', m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-lavender-25 text-ink-700 ring-1 ring-ink-100')}>
                        {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown text={m.content} />}
                        {m.role === 'assistant' && !!m.referenced_lead_ids?.length && (
                          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                            {m.referenced_lead_ids.map((id) => {
                              const l = leadById.get(id);
                              return l ? (
                                <button key={id} onClick={() => setOpenLead(id)} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-brand-700 ring-1 ring-brand-100 hover:ring-brand-300">
                                  {l.company} · {l.contact_name}
                                </button>
                              ) : null;
                            })}
                          </div>
                        )}
                        {m.role === 'assistant' && !!m.suggested_actions?.length && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {m.suggested_actions.map((s) => (
                              <button key={s} onClick={() => setInput(s)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-left text-[12px] text-brand-800 hover:bg-brand-100">
                                → {s}
                              </button>
                            ))}
                          </div>
                        )}
                        {m.role === 'assistant' && !!m.data_used?.length && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-400">
                            <Database className="size-3" /> Checked: {m.data_used.join(' · ')}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {ask.isPending && (
                  <div className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-white"><Bot className="size-4" /></span>
                    <div className="rounded-2xl bg-lavender-25 px-4 py-3 text-[13px] text-ink-500 ring-1 ring-ink-100">
                      <span className="flex items-center gap-2">
                        <Database className="size-3.5 animate-pulse text-brand-500" /> Checking your pipeline data…
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t border-ink-100 bg-white p-3 sm:p-4">
            {ask.error && <ErrorNotice error={ask.error} className="mb-3" />}
            <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                maxLength={LIMITS.assistantMessage}
                placeholder="Ask about your leads, pipeline or strategy…"
                className="input max-h-40 min-h-[44px] flex-1 resize-none"
                aria-label="Message"
              />
              <Button type="submit" size="lg" className="h-11 px-4" disabled={!input.trim()} loading={ask.isPending} aria-label="Send">
                {!ask.isPending && <Send className="size-4" />}
              </Button>
            </form>
            <p className="mx-auto mt-2 max-w-3xl text-[11px] text-ink-400">Answers about your account are based on your stored data. AI can still make mistakes — double-check important details.</p>
          </div>
        </Card>
      </div>

      <LeadDetailDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete)} loading={del.isPending} title="Delete conversation?" message="This chat history will be permanently deleted." />
    </div>
  );
}
