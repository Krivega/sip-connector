import { EventEmitterProxy } from '@/EventEmitterProxy';
import debug from '@/logger';
import { VideoSendingBalancer } from '@/VideoSendingBalancer';
import { createEvents } from './events';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TEventMap } from './events';

type TOptions = IBalancerOptions & {
  balancingStartDelay?: number;
};

/**
 * Менеджер для управления VideoSendingBalancer
 * Автоматически запускает балансировку через 10 секунд после начала звонка
 */
class VideoSendingBalancerManager extends EventEmitterProxy<TEventMap> {
  public isBalancingActive = false;

  private readonly callManager: CallManager;

  private readonly balancingStartDelay: number;

  private readonly videoSendingBalancer: VideoSendingBalancer;

  private startBalancingTimer?: NodeJS.Timeout;

  public constructor(
    callManager: CallManager,
    apiManager: ApiManager,
    balancerOptions: TOptions = {},
  ) {
    super(createEvents());

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

  private subscribe(): void {
    // Подписываемся на начало звонка
    this.callManager.on('peerconnection:confirmed', this.handleCallStarted);
    this.callManager.on('recv-session-started', this.handleRecvSessionStarted);
    this.callManager.on('recv-session-ended', this.handleRecvSessionEnded);
    this.callManager.on('recv-quality-changed', this.handleRecvQualityChanged);

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

  private readonly handleRecvSessionStarted = (): void => {
    this.stopBalancing();
  };

  private readonly handleRecvSessionEnded = (): void => {
    this.scheduleBalancingStart();
  };

  private readonly handleRecvQualityChanged = (): void => {
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
