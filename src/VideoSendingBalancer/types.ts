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
    parameters: { scaleResolutionDownBy: number; maxBitrate?: number },
    onSetParameters?: TOnSetParameters,
  ) => Promise<TResultSetParametersToSender>;
}

// Интерфейс для очереди задач
export interface ITaskQueue {
  add: <T>(task: () => Promise<T>) => Promise<T>;
}
