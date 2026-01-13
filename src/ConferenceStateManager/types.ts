import type { TChannels } from '@/ApiManager';

export type TConferenceState = {
  // Данные конференции
  room?: string;
  participantName?: string;
  channels?: TChannels;
  token?: string; // jwt
  conference?: string;
  participant?: string;
  number?: string;
  answer?: boolean;
};

export type TConferenceStateUpdate = Partial<TConferenceState>;
