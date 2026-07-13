import type { EContentMainCAM } from '@/ApiManager';
import type { TOnSetParameters, TResultSetParametersToSender } from '@/tools';
import type { TResolutionSize } from '@/types';

// Конфигурация балансировщика
export interface IBalancerOptions {
  ignoreForCodec?: string;
  onSetParameters?: TOnSetParameters;
  getMaxResolution: () => TResolutionSize | undefined;
}

// Заголовки от сервера
export interface IMainCamHeaders {
  mainCam?: EContentMainCAM;
  resolutionMainCam?: string;
}

// Контекст для балансировки
export interface IBalancingContext {
  sender: RTCRtpSender;
  videoTrack: MediaStreamVideoTrack;
  codec?: string;
}

// Интерфейсы для внедрения зависимостей
export interface ISenderFinder {
  findVideoSender: (senders: RTCRtpSender[]) => RTCRtpSender | undefined;
}

export interface ICodecProvider {
  getCodecFromSender: (sender: RTCRtpSender) => Promise<string>;
}

export interface IEncodingParameters {
  scaleResolutionDownBy: number;
  maxBitrate: number;
}

export interface IParametersSetter {
  setEncodingsToSender: (
    sender: RTCRtpSender,
    parameters: IEncodingParameters,
    onSetParameters?: TOnSetParameters,
  ) => Promise<TResultSetParametersToSender>;
}

export type TMainCamControlHandler = (headers: IMainCamHeaders) => void;

// Интерфейс для обработчика событий
export interface IEventHandler {
  subscribe: (handler: TMainCamControlHandler) => void;
  unsubscribe: () => void;
}

// Интерфейс для очереди задач
export interface ITaskQueue<T> {
  add: (task: () => Promise<T>) => Promise<T>;
}
