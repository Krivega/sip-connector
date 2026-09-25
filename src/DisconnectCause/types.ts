import type { EndEvent } from '@krivega/jssip';
import type { EDisconnectCause } from './constants';

export type TDisconnectCause = {
  raw: string;
  code?: number;
  key?: EDisconnectCause;
};

export type TCallEndEvent = EndEvent & {
  disconnectCause?: TDisconnectCause;
};
