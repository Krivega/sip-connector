export { confirmCall, sendMainCamInfo, setConnection } from './callEvents';
export { BALANCING_START_DELAY, CODEC, TRACK_SIZE_POLLING_WINDOW } from './constants';
export { default as createObservedSender } from './createObservedSender';
export {
  createVideoTrack,
  deferNextGetStats,
  hangGetStats,
  hangNextGetStats,
  setSenderCodec,
} from '@/VideoSendingBalancer/__fixtures__';
export { default as getSettledResult } from './getSettledResult';
export {
  ENCODING_4K_BY_TRACK,
  ENCODING_4K_LIMITED_TO_1080P,
  ENCODING_4K_LIMITED_TO_360P,
  ENCODING_4K_LIMITED_TO_720P,
  ENCODING_720P_BY_TRACK,
  ENCODING_PAUSED,
} from './encodings';
export {
  HEADERS_MAX_360P,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  HEADERS_RESUME,
} from './mainCamHeaders';
export { default as settle } from './settle';

export type { TObservedSender } from './createObservedSender';
