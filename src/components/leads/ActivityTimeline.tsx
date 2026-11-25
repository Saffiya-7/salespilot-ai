import {
  ArrowRightLeft,
  CalendarCheck,
  CalendarPlus,
  FileUp,
  Gauge,
  Mail,
  MailCheck,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActivityType } from '../../../shared/constants';
import type { SalesActivity } from '../../../shared/types';
import { cn, formatDateTime, formatRelative } from '../../utils/format';

export const ACTIVITY_META: Record<ActivityType, { icon: ReactNode; color: string; label: string }> = {
  lead_created: { icon: <UserPlus className="size-3.5" />, color: 'bg-brand-100 text-brand-700', label: 'Lead added' },
  lead_updated: { icon: <Pencil className="size-3.5" />, color: 'bg-ink-100 text-ink-600', label: 'Lead updated' },
  stage_changed: { icon: <ArrowRightLeft className="size-3.5" />, color: 'bg-violet-100 text-violet-700', label: 'Stage changed' },
  note: { icon: <MessageSquare className="size-3.5" />, color: 'bg-sky-100 text-sky-700', label: 'Note' },
  call: { icon: <Phone className="size-3.5" />, color: 'bg-emerald-100 text-emerald-700', label: 'Call' },
  meeting: { icon: <Users className="size-3.5" />, color: 'bg-amber-100 text-amber-700', label: 'Meeting' },
  email_generated: { icon: <Mail className="size-3.5" />, color: 'bg-brand-100 text-brand-700', label: 'E-mail drafted' },
  email_sent: { icon: <MailCheck className="size-3.5" />, color: 'bg-emerald-100 text-emerald-700', label: 'E-mail sent' },
  followup_scheduled: { icon: <CalendarPlus className="size-3.5" />, color: 'bg-sky-100 text-sky-700', label: 'Follow-up scheduled' },
  followup_completed: { icon: <CalendarCheck className="size-3.5" />, color: 'bg-emerald-100 text-emerald-700', label: 'Follow-up done' },
  lead_scored: { icon: <Gauge className="size-3.5" />, color: 'bg-rose-100 text-rose-700', label: 'AI score' },
  research_completed: { icon: <Search className="size-3.5" />, color: 'bg-violet-100 text-violet-700', label: 'AI research' },
  import: { icon: <FileUp className="size-3.5" />, color: 'bg-ink-100 text-ink-600', label: 'Import' },
};

export function ActivityTimeline({ activities, leadNames, compact }: { activities: SalesActivity[]; leadNames?: Map<string, string>; compact?: boolean }) {
  return (
    <ol className="relative space-y-4">
      {activities.map((a, i) => {
        const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.note;
        return (
          <li key={a.id} className="relative flex gap-3">
            {i < activities.length - 1 && <span className="absolute top-7 bottom-[-14px] left-[13px] w-px bg-ink-100" aria-hidden />}
            <span className={cn('relative grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-white', meta.color)}>{meta.icon}</span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn('text-ink-800', compact ? 'line-clamp-2 text-[13px]' : 'text-sm')}>{a.description}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-400" title={formatDateTime(a.created_at)}>
                {meta.label}
                {leadNames && a.lead_id && leadNames.get(a.lead_id) ? ` · ${leadNames.get(a.lead_id)}` : ''} · {formatRelative(a.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
