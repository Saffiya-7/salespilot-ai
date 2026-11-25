// App-wide types. Row and AI-result types live in /shared so the Netlify
// Functions use exactly the same definitions as the browser.
export type * from '../../shared/types';
export type {
  ActivityType,
  CompanySize,
  EmailAction,
  EmailTone,
  FollowupChannel,
  FollowupStatus,
  LeadSource,
  PipelineStage,
  ScoreFactorKey,
  ScoreLabel,
} from '../../shared/constants';
export type { AiStatus } from '../services/ai';
