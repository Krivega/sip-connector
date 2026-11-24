import { SetTimeoutRequest } from '@krivega/timeout-requester';

type TCheck = () => Promise<boolean>;

type TSubscription = { readonly check: TCheck };

/**
 * TrackMonitor — тикер сверки: вызывает проверку с адаптивным интервалом.
 * Проверка сообщает, изменились ли параметры отправителя; следующий опрос планируется после её завершения,
 * поэтому при зависшей проверке опросы не копятся.
 */
export class TrackMonitor {
  private readonly maxPollIntervalMs: number;

  private currentPollIntervalMs: number;

  private readonly pollIntervalMs: number;

  private readonly setTimeoutRequest: SetTimeoutRequest;

  // новый объект на каждую подписку: проверка, завершившаяся после её снятия или смены, опрос не продолжает
  private subscription?: TSubscription;

  public constructor({
    pollIntervalMs = 1000,
    maxPollIntervalMs,
  }: {
    pollIntervalMs?: number;
    maxPollIntervalMs?: number;
  }) {
    this.pollIntervalMs = pollIntervalMs;
    // default max ~ 16x initial
    this.maxPollIntervalMs = maxPollIntervalMs ?? pollIntervalMs * 16;
    this.currentPollIntervalMs = this.pollIntervalMs;
    this.setTimeoutRequest = new SetTimeoutRequest();
  }

  /**
   * Запускает опрос проверки с начального интервала.
   */
  public subscribe(check: TCheck): void {
    this.unsubscribe();

    const subscription = { check };

    this.subscription = subscription;
    this.currentPollIntervalMs = this.pollIntervalMs;
    this.schedulePoll(subscription);
  }

  /** Останавливает всю активность мониторинга */
  public unsubscribe(): void {
    this.setTimeoutRequest.cancelRequest();
    this.subscription = undefined;
  }

  /** Возвращает опрос к начальному интервалу; без подписки ничего не делает */
  public resetInterval(): void {
    if (this.subscription) {
      this.subscribe(this.subscription.check);
    }
  }

  /**
   * Планирует опрос с экспоненциальной адаптацией частоты.
   * Пока проверка не сообщает об изменениях, интервал удваивается до maxPollIntervalMs,
   * при изменениях сбрасывается до начального.
   */
  private schedulePoll(subscription: TSubscription): void {
    const scheduleNextPoll = (isChanged: boolean) => {
      if (this.subscription !== subscription) {
        return;
      }

      this.currentPollIntervalMs = isChanged
        ? this.pollIntervalMs
        : Math.min(this.currentPollIntervalMs * 2, this.maxPollIntervalMs);
      this.schedulePoll(subscription);
    };

    this.setTimeoutRequest.request(() => {
      // ошибка проверки отодвигает следующий опрос так же, как отсутствие изменений
      subscription.check().then(scheduleNextPoll, () => {
        scheduleNextPoll(false);
      });
    }, this.currentPollIntervalMs);
  }
}
