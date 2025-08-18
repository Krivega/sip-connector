import { TypedEvents } from 'events-constructor';

import debug from '@/logger';
import { VideoSendingBalancer } from '@/VideoSendingBalancer';
import { EVENT_NAMES } from './eventNames';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TEventMap, TEvents } from './eventNames';

type TOptions = IBalancerOptions & {
  balancingStartDelay?: number;
};

/**
 * Менеджер для управления VideoSendingBalancer
 * Автоматически запускает балансировку через 10 секунд после начала звонка
 */
class VideoSendingBalancerManager {
  public isBalancingActive = false;

  public readonly events: TEvents;

  private readonly callManager: CallManager;

  private readonly balancingStartDelay: number;

  private readonly videoSendingBalancer: VideoSendingBalancer;

  private startBalancingTimer?: NodeJS.Timeout;

  public constructor(
    callManager: CallManager,
    apiManager: ApiManager,
    balancerOptions: TOptions = {},
  ) {
    this.events = new TypedEvents<TEventMap>(EVENT_NAMES);
    this.callManager = callManager;
    this.balancingStartDelay = balancerOptions.balancingStartDelay ?? 10_000;

    this.videoSendingBalancer = new VideoSendingBalancer(
      apiManager,
      () => {
        return callManager.connection;
      },
      {
        ...balancerOptions,
        onSetParameters: (result) => {
          this.events.trigger('parameters-updated', result);
          balancerOptions.onSetParameters?.(result);
        },
      },
    );

    this.subscribe();
  }

  /**
   * Проверить, запланирован ли запуск балансировки
   */
  public get isBalancingScheduled(): boolean {
    return this.startBalancingTimer !== undefined;
  }

  /**
   * Принудительно запустить балансировку
   */
  public async startBalancing(): Promise<void> {
    if (this.isBalancingActive) {
      return; // Уже запущена
    }

    this.clearStartTimer();

    await this.videoSendingBalancer.balance();
    this.videoSendingBalancer.subscribe();
    this.isBalancingActive = true;

    this.events.trigger('balancing-started', { delay: this.balancingStartDelay });
  }

  /**
   * Остановить балансировку
   */
  public stopBalancing(): void {
    this.clearStartTimer();

    this.videoSendingBalancer.unsubscribe();
    this.isBalancingActive = false;
    this.events.trigger('balancing-stopped', {});
  }

  /**
   * Выполнить ручную балансировку
   */
  public async balance() {
    return this.videoSendingBalancer.balance();
  }

  public on<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.on(eventName, handler);
  }

  public once<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    return this.events.once(eventName, handler);
  }

  public onceRace<T extends keyof TEventMap>(
    eventNames: T[],
    handler: (data: TEventMap[T], eventName: string) => void,
  ) {
    return this.events.onceRace(eventNames, handler);
  }

  public async wait<T extends keyof TEventMap>(eventName: T): Promise<TEventMap[T]> {
    return this.events.wait(eventName);
  }

  public off<T extends keyof TEventMap>(eventName: T, handler: (data: TEventMap[T]) => void) {
    this.events.off(eventName, handler);
  }

  private subscribe(): void {
    // Подписываемся на начало звонка
    this.callManager.on('peerconnection:confirmed', this.handleCallStarted);

    // Подписываемся на окончание звонка
    this.callManager.on('ended', this.handleCallEnded);
    this.callManager.on('failed', this.handleCallEnded);
  }

  private readonly handleCallStarted = (): void => {
    this.scheduleBalancingStart();
  };

  private readonly handleCallEnded = (): void => {
    this.stopBalancing();
  };

  private scheduleBalancingStart(): void {
    // Очищаем предыдущий таймер, если есть
    this.clearStartTimer();

    // Запланируем запуск балансировки через настраиваемое время
    this.startBalancingTimer = setTimeout(() => {
      this.startBalancingTimer = undefined;
      this.startBalancing().catch((error: unknown) => {
        debug('startBalancing: error', error);
      });
    }, this.balancingStartDelay);

    this.events.trigger('balancing-scheduled', { delay: this.balancingStartDelay });
  }

  private clearStartTimer(): void {
    if (this.startBalancingTimer) {
      clearTimeout(this.startBalancingTimer);
      this.startBalancingTimer = undefined;
    }
  }
}

export default VideoSendingBalancerManager;
