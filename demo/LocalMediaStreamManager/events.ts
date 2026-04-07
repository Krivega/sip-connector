/* eslint-disable @typescript-eslint/no-unnecessary-template-expression */
import { TypedEvents } from 'events-constructor';

enum EEvent {
  CAM_ENABLE = 'cam:enable',
  CAM_DISABLE = 'cam:disable',
  MIC_ENABLE = 'mic:enable',
  MIC_DISABLE = 'mic:disable',
  ENABLE_ALL = 'enable-all',
  DISABLE_ALL = 'disable-all',
}

export const EVENT_NAMES = [
  `${EEvent.CAM_ENABLE}`,
  `${EEvent.CAM_DISABLE}`,
  `${EEvent.MIC_ENABLE}`,
  `${EEvent.MIC_DISABLE}`,
  `${EEvent.ENABLE_ALL}`,
  `${EEvent.DISABLE_ALL}`,
] as const;

export type TState = {
  isEnabledCam: boolean;
  isEnabledMic: boolean;
};

export type TEventMap = {
  'cam:enable': TState;
  'cam:disable': TState;
  'mic:enable': TState;
  'mic:disable': TState;
  'enable-all': TState;
  'disable-all': TState;
};

export type TEvents = TypedEvents<TEventMap>;

export const createEvents = () => {
  return new TypedEvents<TEventMap>(EVENT_NAMES);
};
