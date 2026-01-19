import type { EContentedStreamCodec } from '@/ApiManager';

export type TContentedStreamStateInfo =
  | { isAvailable: true; codec?: EContentedStreamCodec }
  | { isAvailable: false };
