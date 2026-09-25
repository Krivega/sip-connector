import type { Page } from '@playwright/test';
import type { SipConnectorFacade, TCallEndEvent, TDisconnectCause } from '../../src';

type TDemoApp = { sipConnectorFacade: SipConnectorFacade };

type TCallEnd = {
  originator: string;
  cause: string;
  disconnectCause?: TDisconnectCause;
};

type TIncomingEnd = {
  incomingNumber: string;
  disconnectCause?: TDisconnectCause;
};

/** Слушает только публичные события; не заменяет методы и состояние коннектора. */
export const observeDisconnectEvents = async (page: Page) => {
  return page.evaluateHandle(() => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

    if (app === undefined) {
      throw new Error('Демо коннектора не инициализировано');
    }

    const facade = app.sipConnectorFacade;
    const ended: TCallEnd[] = [];
    const failed: TCallEnd[] = [];
    const incomingFailed: TIncomingEnd[] = [];
    let confirmed = 0;
    let ringing = 0;
    let mediaStream: MediaStream | undefined;

    const saveEnded = ({ originator, cause, disconnectCause }: TCallEndEvent) => {
      ended.push({ originator, cause, disconnectCause });
    };
    const saveFailed = ({ originator, cause, disconnectCause }: TCallEndEvent) => {
      failed.push({ originator, cause, disconnectCause });
    };
    const unsubscribe = [
      facade.on('call:ended', saveEnded),
      facade.on('call:failed', saveFailed),
      facade.on('call:confirmed', () => {
        confirmed += 1;
      }),
      facade.on('incoming-call:ringing', () => {
        ringing += 1;
      }),
      facade.on('incoming-call:failedIncomingCall', ({ incomingNumber, disconnectCause }) => {
        incomingFailed.push({ incomingNumber, disconnectCause });
      }),
    ];

    return {
      read: () => {
        return {
          ended,
          failed,
          incomingFailed,
          confirmed,
          ringing,
          isEstablished: facade.sipConnector.getEstablishedRTCSession() !== undefined,
          isAvailableIncomingCall: facade.sipConnector.isAvailableIncomingCall,
        };
      },
      // В демо нет кнопки ответа. Используем тот же публичный метод, что и приложение.
      answer: async () => {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        return (await facade.answerToIncomingCall({ mediaStream, iceServers: [] })) !== undefined;
      },
      dispose: () => {
        unsubscribe.forEach((off) => {
          off();
        });
        mediaStream?.getTracks().forEach((track) => {
          track.stop();
        });
      },
    };
  });
};
