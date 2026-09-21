import { expect, test } from './fixtures';

import type { Page } from '@playwright/test';

const ROLE_CHANGE_INTERVAL_MS = 100;
const ROLE_STABILIZATION_MS = 1000;
const ROLE_CHANGE_TIMEOUT_MS = 5000;
const RECV_SESSION_COUNTERS_KEY = '__e2eRecvSessionCounters';

type TRecvSessionCounters = {
  started: number;
  ended: number;
};

type TFakeRecvSession = {
  close: () => void;
};

type TCallManagerHarness = {
  recvSession?: TFakeRecvSession;
  startRecvSession: (params: { audioChannel: string }) => Promise<{
    session: TFakeRecvSession;
    callResult: boolean;
  }>;
  stateMachine: {
    getInRoomCredentials: () => { token: string; conferenceForToken: string } | undefined;
  };
};

type TInstrumentedSipConnector = {
  apiManager: {
    events: {
      trigger: (eventName: string, payload?: unknown) => void;
    };
  };
  callManager: TCallManagerHarness;
  on: (eventName: 'call:recv-session-ended', listener: () => void) => unknown;
};

type TDemoApp = { sipConnectorFacade?: { sipConnector?: TInstrumentedSipConnector } };

const getRecvSessionCounters = async (page: Page) => {
  return page.evaluate((countersKey) => {
    return Reflect.get(window, countersKey) as TRecvSessionCounters | undefined;
  }, RECV_SESSION_COUNTERS_KEY);
};

test.describe('быстрое переключение микрофона и роли', () => {
  test('эквивалент трёх кликов создаёт только одну spectator-сессию', async ({
    page,
    connectPage,
  }) => {
    await test.step('подменить только внешний медиавызов и начать считать spectator-сессии', async () => {
      await page.evaluate((countersKey) => {
        const demoApp = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;
        const sipConnector = demoApp?.sipConnectorFacade?.sipConnector;

        if (sipConnector === undefined) {
          throw new Error('sipConnector недоступен на demo-странице');
        }

        const counters: TRecvSessionCounters = { started: 0, ended: 0 };
        const { callManager } = sipConnector;

        callManager.stateMachine.getInRoomCredentials = () => {
          return { token: 'e2e-token', conferenceForToken: 'e2e-conference' };
        };
        callManager.startRecvSession = async () => {
          const session: TFakeRecvSession = { close: () => {} };

          counters.started += 1;
          callManager.recvSession = session;

          return { session, callResult: true };
        };
        sipConnector.on('call:recv-session-ended', () => {
          counters.ended += 1;
        });

        Reflect.set(window, countersKey, counters);
      }, RECV_SESSION_COUNTERS_KEY);
    });

    await test.step('проверить исходную роль participant', async () => {
      await connectPage.expectCallSessionRole('participant', {
        timeout: ROLE_CHANGE_TIMEOUT_MS,
      });
    });

    await test.step('воспроизвести spectator → participant → spectator с интервалом 100 мс', async () => {
      await page.evaluate(async (intervalMs) => {
        const demoApp = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;
        const sipConnector = demoApp?.sipConnectorFacade?.sipConnector;

        if (sipConnector === undefined) {
          throw new Error('sipConnector недоступен на demo-странице');
        }

        const spectatorPayload = {
          audioId: 'e2e-audio-id',
          isAvailableSendingMedia: false,
        };

        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-with-audio-id',
          spectatorPayload,
        );
        await new Promise((resolve) => {
          setTimeout(resolve, intervalMs);
        });
        sipConnector.apiManager.events.trigger('participant:move-request-to-participants');
        await new Promise((resolve) => {
          setTimeout(resolve, intervalMs);
        });
        sipConnector.apiManager.events.trigger(
          'participant:move-request-to-spectators-with-audio-id',
          spectatorPayload,
        );
      }, ROLE_CHANGE_INTERVAL_MS);
    });

    await test.step('проверить итоговую роль и дождаться окончания защитного интервала', async () => {
      await connectPage.expectCallSessionRole('spectator', {
        timeout: ROLE_CHANGE_TIMEOUT_MS,
      });
      await page.waitForTimeout(ROLE_STABILIZATION_MS);
    });

    await test.step('проверить единственный старт без промежуточного завершения spectator-сессии', async () => {
      expect(await getRecvSessionCounters(page)).toEqual({
        started: 1,
        ended: 0,
      });
    });
  });
});
