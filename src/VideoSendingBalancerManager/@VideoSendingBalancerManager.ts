import { EventEmitterProxy } from 'events-constructor';

import resolveDebug from '@/logger';
import { VideoSendingBalancer } from '@/VideoSendingBalancer';
import { createEvents } from './events';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions, IMainCamHeaders } from '@/VideoSendingBalancer/types';
import type { TEventMap } from './events';

type TOptions = IBalancerOptions & {
  balancingStartDelay?: number;
};

const debug = resolveDebug('VideoSendingBalancerManager');

/**
 * Менеджер для управления VideoSendingBalancer
 * Автоматически запускает балансировку через 10 секунд после начала звонка:
 * пока браузер прогревает отправку (постепенно наращивает разрешение), скалирование применять нельзя
 */
class VideoSendingBalancerManager extends EventEmitterProxy<TEventMap> {
  public isBalancingActive = false;

  private readonly callManager: CallManager;

  private readonly apiManager: ApiManager;

  private readonly balancingStartDelay: number;

  private readonly videoSendingBalancer: VideoSendingBalancer;

  private startBalancingTimer?: NodeJS.Timeout;

  public constructor(callManager: CallManager, apiManager: ApiManager, balancerOptions: TOptions) {
    super(createEvents());

    this.callManager = callManager;
    this.apiManager = apiManager;
    this.balancingStartDelay = balancerOptions.balancingStartDelay ?? 10_000;
    this.videoSendingBalancer = new VideoSendingBalancer(
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

    this.isBalancingActive = true;

    const starting = this.videoSendingBalancer.start();
    const { runToken } = this.videoSendingBalancer;

    // запуск включает режим, а первая балансировка — только первая попытка: неудавшуюся повторит сверка по тику
    try {
      await starting;
    } catch (error: unknown) {
      debug('startBalancing: error', error);
    }

    // за время первой балансировки запуск могли остановить или начать заново: сверка прямо перед событием
    if (this.videoSendingBalancer.runToken === runToken) {
      this.events.trigger('balancing-started', { delay: this.balancingStartDelay });
    }
  }

  /**
   * Остановить балансировку
   */
  public stopBalancing(): void {
    this.clearStartTimer();

    this.videoSendingBalancer.stop();
    this.isBalancingActive = false;
    this.events.trigger('balancing-stopped', {});
  }

  /**
   * Выполнить ручную балансировку
   */
  public async balance() {
    return this.videoSendingBalancer.balance();
  }

  private subscribe(): void {
    // Подписываемся на начало звонка
    this.callManager.on('peerconnection:confirmed', this.handleCallStarted);
    this.callManager.on('recv-session-started', this.handleRecvSessionStarted);
    this.callManager.on('recv-session-ended', this.handleRecvSessionEnded);
    this.callManager.on('recv-quality-changed', this.handleRecvQualityChanged);

    // Подписываемся на окончание звонка
    this.callManager.on('ended', this.handleCallEnded);
    this.callManager.on('failed', this.handleCallEnded);

    this.apiManager.on('main-cam-control', this.handleMainCamControl);
  }

  private readonly handleCallStarted = (): void => {
    this.scheduleBalancingStart();
  };

  private readonly handleCallEnded = (): void => {
    this.stopBalancing();
  };

  private readonly handleRecvSessionStarted = (): void => {
    this.stopBalancing();
  };

  private readonly handleRecvSessionEnded = (): void => {
    this.scheduleBalancingStart();
  };

  private readonly handleRecvQualityChanged = (): void => {
    this.stopBalancing();
  };

  private readonly handleMainCamControl = (headers: IMainCamHeaders): void => {
    this.videoSendingBalancer.handleServerHeaders(headers);
  };

  private scheduleBalancingStart(): void {
    // Очищаем предыдущий таймер, если есть
    this.clearStartTimer();

    this.videoSendingBalancer.warmUp();

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
