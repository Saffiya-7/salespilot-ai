import type { EmailTone } from '../../shared/constants';

export const TONE_GUIDE: Record<EmailTone, string> = {
  Professional: 'clear, credible and polite; business-like without being stiff',
  Friendly: 'warm, conversational and human; light but still respectful',
  Persuasive: 'confident and benefit-driven, with a compelling reason to reply now — no pressure tactics or false urgency',
  Formal: 'formal register, complete sentences, no contractions or slang',
  'Short and Direct': 'very brief (under 80 words), plain language, straight to the point',
};
