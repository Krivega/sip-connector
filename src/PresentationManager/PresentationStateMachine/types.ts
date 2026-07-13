import type { EEvents, EState } from './constants';

type TPresentationContextBase = {
  lastError: Error | undefined;
  videoTrack: MediaStreamVideoTrack | undefined;
};

export type TPresentationMachineEvents =
  | { type: EEvents.SCREEN_STARTING; videoTrack?: MediaStreamVideoTrack }
  | { type: EEvents.SCREEN_STARTED; videoTrack?: MediaStreamVideoTrack }
  | { type: EEvents.SCREEN_UPDATING; videoTrack: MediaStreamVideoTrack }
  | { type: EEvents.SCREEN_UPDATED; videoTrack: MediaStreamVideoTrack }
  | { type: EEvents.SCREEN_ENDING }
  | { type: EEvents.SCREEN_ENDED }
  | { type: EEvents.SCREEN_FAILED; error?: unknown }
  | { type: EEvents.CALL_ENDED }
  | { type: EEvents.CALL_FAILED; error?: unknown }
  | { type: EEvents.PRESENTATION_RESET };

export type TContextMap = {
  [EState.IDLE]: TPresentationContextBase;
  [EState.STARTING]: TPresentationContextBase;
  [EState.ACTIVE]: TPresentationContextBase;
  [EState.STOPPING]: TPresentationContextBase;
  [EState.FAILED]: TPresentationContextBase;
};

export type TContext = TContextMap[keyof TContextMap];
