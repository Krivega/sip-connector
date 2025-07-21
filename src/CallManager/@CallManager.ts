// Интерфейс стратегии звонка
export interface ICallStrategy {
  startCall: (localStream: MediaStream) => void;
  endCall: () => void;
  answerIncomingCall: (localStream: MediaStream) => void;
}

// Типы событий CallManager
export type TCallManagerEvent = 'newDTMF' | 'newInfo';

// Класс CallManager
export class CallManager {
  private strategy: ICallStrategy | undefined;

  private eventHandlers: Record<string, ((data: unknown) => void)[]> = {};

  public setStrategy(strategy: ICallStrategy): void {
    this.strategy = strategy;
  }

  public startCall(localStream: MediaStream): void {
    if (!this.strategy) {
      throw new Error('Call strategy is not set');
    }

    this.strategy.startCall(localStream);
  }

  public endCall(): void {
    if (!this.strategy) {
      throw new Error('Call strategy is not set');
    }

    this.strategy.endCall();
  }

  public handleIncomingCall(localStream: MediaStream): void {
    if (!this.strategy) {
      throw new Error('Call strategy is not set');
    }

    this.strategy.answerIncomingCall(localStream);
  }

  public on(event: TCallManagerEvent, callback: (data: unknown) => void): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }

    this.eventHandlers[event].push(callback);
  }

  public emit(event: TCallManagerEvent, data: unknown): void {
    const handlers = this.eventHandlers[event];

    if (handlers) {
      handlers.forEach((handler) => {
        handler(data);
      });
    }
  }
}

// Экспорт заглушки стратегии MCU из отдельного файла
export { MCUCallStrategy } from './MCUCallStrategy';
