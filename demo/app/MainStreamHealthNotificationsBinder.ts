import type NotificationManager from '../NotificationManager';

type TInboundVideoProblemPayload = {
  reason: string;
  consecutiveProblemSamplesCount: number;
};

type THealthSnapshot = Record<string, boolean>;

type TMainStreamHealthOn = ((
  event: 'main-stream-health:inbound-video-problem-detected',
  handler: (payload: TInboundVideoProblemPayload) => void,
) => void) &
  ((
    event: 'main-stream-health:health-snapshot',
    handler: (snapshot: THealthSnapshot) => void,
  ) => void) &
  ((
    event:
      | 'main-stream-health:inbound-video-problem-resolved'
      | 'main-stream-health:inbound-video-problem-reset',
    handler: () => void,
  ) => void);

/**
 * Минимальный контракт шины событий (DIP): не зависим от всего фасада SIP.
 */
export type TMainStreamHealthEventSource = {
  on: TMainStreamHealthOn;
};

const INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID = 'inbound-video-problem-detected';

/**
 * Подписка на события здоровья входящего видео: одна ответственность — уведомления UI.
 */
export class MainStreamHealthNotificationsBinder {
  private readonly notifications: Pick<NotificationManager, 'show' | 'hide'>;

  private readonly eventSource: TMainStreamHealthEventSource;

  public constructor(
    notifications: Pick<NotificationManager, 'show' | 'hide'>,
    eventSource: TMainStreamHealthEventSource,
  ) {
    this.notifications = notifications;
    this.eventSource = eventSource;
  }

  public subscribe(): void {
    this.eventSource.on(
      'main-stream-health:inbound-video-problem-detected',
      ({ reason, consecutiveProblemSamplesCount }) => {
        this.notifications.show({
          type: 'error',
          message: `Обнаружена проблема: ${reason} (подряд ${consecutiveProblemSamplesCount} раз)`,
          id: INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID,
        });
      },
    );

    this.eventSource.on('main-stream-health:health-snapshot', (healthSnapshot) => {
      const problemStatuses = Object.entries(healthSnapshot).filter(([, value]) => {
        return value;
      });

      if (problemStatuses.length === 0) {
        return;
      }

      this.notifications.show({
        type: 'info',
        message: `Текущее состояние основного входящего видеопотока: ${problemStatuses
          .map(([key]) => {
            return key;
          })
          .join(', ')}`,
        isAutoHide: true,
        timeoutMs: 3000,
      });
    });

    this.eventSource.on('main-stream-health:inbound-video-problem-resolved', () => {
      this.notifications.hide(INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID);
    });

    this.eventSource.on('main-stream-health:inbound-video-problem-reset', () => {
      this.notifications.hide(INBOUND_VIDEO_PROBLEM_NOTIFICATION_ID);
    });
  }
}
