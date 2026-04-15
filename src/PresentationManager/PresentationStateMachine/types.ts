import type { EEvents, EState } from './constants';

export type TPresentationMachineEvents =
  | { type: EEvents.SCREEN_STARTING }
  | { type: EEvents.SCREEN_STARTED }
  | { type: EEvents.SCREEN_ENDING }
  | { type: EEvents.SCREEN_ENDED }
  | { type: EEvents.SCREEN_FAILED; error?: unknown }
  | { type: EEvents.CALL_ENDED }
  | { type: EEvents.CALL_FAILED; error?: unknown }
  | { type: EEvents.PRESENTATION_RESET };

export type TContextMap = {
  [EState.IDLE]: {
    lastError: undefined;
  };
  [EState.STARTING]: {
    lastError: undefined;
  };
  [EState.ACTIVE]: {
    lastError: undefined;
  };
  [EState.STOPPING]: {
    lastError: undefined;
  };
  [EState.FAILED]: {
    lastError: Error | undefined;
  };
};

export type TContext = TContextMap[keyof TContextMap];
