import { EventEmitterProxy } from 'events-constructor';

import resolveDebug from '@/logger';
import { RESULT_NO_CHANGED, VideoSendingBalancer } from '@/VideoSendingBalancer';
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

    await this.videoSendingBalancer.start();

    // за время первой балансировки её могли остановить, сужение типа этого не учитывает
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.isBalancingActive) {
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
    // во время прогрева скалирование применять нельзя
    if (this.isBalancingScheduled) {
      return RESULT_NO_CHANGED;
    }

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
    if (this.isBalancingActive) {
      this.videoSendingBalancer.setServerHeaders(headers);
      this.videoSendingBalancer.balance().catch((error: unknown) => {
        debug('balance on main-cam-control: error', error);
      });

      return;
    }

    // во время прогрева только запоминаем: последнюю команду применит старт балансировки
    if (this.isBalancingScheduled) {
      this.videoSendingBalancer.setServerHeaders(headers);
    }
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
