import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listActivities } from '../services/activities';
import { countEmails, listEmails } from '../services/emails';
import { listFollowups } from '../services/followups';
import { listLeads, listScores } from '../services/leads';
import { getProfile, listConversations } from '../services/profile';

export const qk = {
  leads: ['leads'] as const,
  followups: ['followups'] as const,
  activities: ['activities'] as const,
  emails: ['emails'] as const,
  emailCount: ['emails', 'count'] as const,
  profile: ['profile'] as const,
  conversations: ['conversations'] as const,
  scores: (leadId: string) => ['scores', leadId] as const,
};

export const useLeads = () => useQuery({ queryKey: qk.leads, queryFn: listLeads });
export const useFollowups = () => useQuery({ queryKey: qk.followups, queryFn: () => listFollowups() });
export const useActivities = (limit = 500) => useQuery({ queryKey: [...qk.activities, limit], queryFn: () => listActivities({ limit }) });
export const useLeadActivities = (leadId: string | undefined) =>
  useQuery({ queryKey: [...qk.activities, 'lead', leadId], queryFn: () => listActivities({ leadId, limit: 100 }), enabled: !!leadId });
export const useEmails = (savedOnly = false) => useQuery({ queryKey: [...qk.emails, savedOnly ? 'saved' : 'all'], queryFn: () => listEmails({ savedOnly }) });
export const useEmailCount = () => useQuery({ queryKey: qk.emailCount, queryFn: countEmails });
export const useLeadScores = (leadId: string | undefined) =>
  useQuery({ queryKey: qk.scores(leadId ?? ''), queryFn: () => listScores(leadId as string), enabled: !!leadId });
export const useConversations = () => useQuery({ queryKey: qk.conversations, queryFn: listConversations });

export function useProfile() {
  const { user } = useAuth();
  return useQuery({ queryKey: [...qk.profile, user?.id], queryFn: () => getProfile(user!.id), enabled: !!user });
}

/** Invalidate several cached collections after a change. */
export function useRefresh() {
  const qc = useQueryClient();
  return useCallback(
    (...keys: (keyof typeof qk)[]) =>
      Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: typeof qk[k] === 'function' ? ['scores'] : (qk[k] as readonly string[]) }))),
    [qc],
  );
}
