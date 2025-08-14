import type { EEventsMainCAM } from '@/ApiManager';
import type { TOnSetParameters, TResultSetParametersToSender } from '@/tools';

// Конфигурация балансировщика
export interface IBalancerOptions {
  ignoreForCodec?: string;
  onSetParameters?: TOnSetParameters;
}

// Заголовки от сервера
export interface IMainCamHeaders {
  mainCam?: EEventsMainCAM;
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

// Интерфейс для обработчика событий
export interface IEventHandler {
  subscribe: (handler: (headers: IMainCamHeaders) => void) => void;
  unsubscribe: () => void;
  getConnection: () => RTCPeerConnection | undefined;
}

// Интерфейс для очереди задач
export interface ITaskQueue<T> {
  add: (task: () => Promise<T>) => Promise<T>;
}
