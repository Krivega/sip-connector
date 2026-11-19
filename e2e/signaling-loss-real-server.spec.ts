import { connectionFormConfig } from './connection.config';
import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { SipWebSocketProxy } from './support/SipWebSocketProxy';

import type { Page } from '@playwright/test';
import type { SipConnectorFacade } from '../src';

/** Снаружи сети dev.vinteo.com ведёт себя иначе, чем через VPN, поэтому файл запускается только явно. */
const IS_REAL_SERVER_ENABLED = process.env.E2E_REAL_SERVER === '1';
const CONNECT_TIMEOUT_MS = 15_000;
/** Ping раз в 15 с с таймаутом 10 с: первый провал не позже T + 15 + 10 секунд, плюс запас. */
const SIGNALING_UNSTABLE_TIMEOUT_MS = 30_000;
/** Переоткрытие транспорта начинается сразу после signaling-unstable. */
const TRANSPORT_REOPEN_TIMEOUT_MS = 10_000;
/** После переоткрытия ping уходит сразу: REGISTER и OPTIONS по новому соединению, плюс запас на сеть. */
const PING_RESTORE_TIMEOUT_MS = 15_000;
/** JsSIP переподключает транспорт с интервалом 2–6 с. */
const TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS = 15_000;
const REGISTERED_TIMEOUT_MS = 20_000;
const SIP_RESPONSE_TIMEOUT_MS = 10_000;
/** Проверка сигнализации перед re-INVITE: таймаут ping 10 с и ожидание подтверждения до 15 с, плюс запас. */
const PRESENTATION_SETTLE_TIMEOUT_MS = 30_000;
/** Время, за которое сервер успел бы завершить звонок после смены соединения. */
const CALL_ALIVE_OBSERVATION_MS = 60_000;
const AFTER_DEAD_TRANSPORT_WAIT_MS = 10_000;

type TDemoApp = { sipConnectorFacade: SipConnectorFacade };

type TOutcome = {
  action: 'start' | 'stop';
  status: 'pending' | 'resolved' | 'rejected';
  error?: string;
  afterMs?: number;
};

type TDisconnectEvents = Awaited<ReturnType<typeof observeDisconnectEvents>>;

/** Вызывает публичные методы демонстрации, для каждого старта берёт новый видеотрек. */
const observePresentation = async (page: Page) => {
  return page.evaluateHandle(() => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

    if (app === undefined) {
      throw new Error('Демо коннектора не инициализировано');
    }

    const { sipConnector } = app.sipConnectorFacade;
    const outcomes: TOutcome[] = [];
    const tracks: MediaStreamTrack[] = [];
    const events: string[] = [];
    const unsubscribe = (['started', 'ended', 'failed'] as const).map((name) => {
      return sipConnector.on(`presentation:${name}`, () => {
        events.push(name);
      });
    });
    const run = (action: TOutcome['action'], operation: () => Promise<unknown>) => {
      const outcome: TOutcome = { action, status: 'pending' };
      const actionAt = performance.now();
      const getElapsedMs = () => {
        return Math.round(performance.now() - actionAt);
      };

      outcomes.push(outcome);
      operation().then(
        () => {
          outcome.status = 'resolved';
          outcome.afterMs = getElapsedMs();
        },
        (error: unknown) => {
          outcome.status = 'rejected';
          outcome.error = error instanceof Error ? error.message : String(error);
          outcome.afterMs = getElapsedMs();
        },
      );
    };

    return {
      start: () => {
        run('start', async () => {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const [videoTrack] = mediaStream.getVideoTracks() as MediaStreamVideoTrack[];

          tracks.push(videoTrack);

          return sipConnector.startPresentation(videoTrack);
        });
      },
      stop: () => {
        run('stop', async () => {
          return sipConnector.stopPresentation();
        });
      },
      read: () => {
        return {
          outcomes: outcomes.map((outcome) => {
            return { ...outcome };
          }),
          events: [...events],
          trackStates: tracks.map(({ readyState }) => {
            return readyState;
          }),
          liveSenderTracks: (sipConnector.connection?.getSenders() ?? []).filter((sender) => {
            return (
              sender.track !== null &&
              tracks.includes(sender.track) &&
              sender.track.readyState === 'live'
            );
          }).length,
        };
      },
      dispose: () => {
        unsubscribe.forEach((off) => {
          off();
        });
        tracks.forEach((track) => {
          track.stop();
        });
      },
    };
  });
};

type TPresentation = Awaited<ReturnType<typeof observePresentation>>;

type TFixtures = {
  sipProxy: SipWebSocketProxy;
};

const test = base.extend<TFixtures>({
  sipProxy: async ({ page }, use) => {
    await use(new SipWebSocketProxy(page));
  },
  // Прокси должен перехватить WebSocket до загрузки демо.
  connectPage: async ({ page, sipProxy }, use) => {
    await sipProxy.install();
    await page.goto('/');
    await new DemoPage(page).waitForLoaderToBeHidden();

    const connectPage = new ConnectPage(page);

    await use(connectPage);
    await connectPage.disconnect({ timeout: CONNECT_TIMEOUT_MS });
  },
});

test.describe('Потеря SIP WebSocket в звонке на реальном сервере', () => {
  test.skip(
    !IS_REAL_SERVER_ENABLED,
    'Ходит на dev.vinteo.com и зависит от сети до него; запуск: E2E_REAL_SERVER=1 yarn test:e2e e2e/signaling-loss-real-server.spec.ts',
  );
  test.describe.configure({ mode: 'serial' });

  let events: TDisconnectEvents;
  let presentation: TPresentation | undefined;

  const readEvents = async () => {
    return events.evaluate((observer) => {
      return observer.read();
    });
  };

  const readPresentation = async () => {
    if (presentation === undefined) {
      throw new Error('Наблюдатель демонстрации не создан');
    }

    return presentation.evaluate((observer) => {
      return observer.read();
    });
  };

  const getLastOutcome = async () => {
    const { outcomes } = await readPresentation();

    return outcomes.at(-1);
  };

  const report = async (label: string, sipProxy: SipWebSocketProxy) => {
    const description = JSON.stringify(
      {
        atMs: sipProxy.getElapsedMs(),
        events: await readEvents(),
        presentation: presentation === undefined ? undefined : await readPresentation(),
        sip: sipProxy.describe().split('\n'),
      },
      undefined,
      1,
    );

    test.info().annotations.push({ type: label, description });
    // eslint-disable-next-line no-console
    console.log(`[${label}] ${description}`);
  };

  const expectCallAlive = async (sipProxy: SipWebSocketProxy) => {
    expect(await readEvents()).toMatchObject({ ended: [], failed: [], isEstablished: true });
    expect(sipProxy.countServerRequestsEverywhere('BYE')).toBe(0);
  };

  const waitForRegisteredConnection = async (
    sipProxy: SipWebSocketProxy,
    previousCount: number,
  ) => {
    await expect
      .poll(
        () => {
          return sipProxy.getConnectionsCount();
        },
        { timeout: REGISTERED_TIMEOUT_MS },
      )
      .toBeGreaterThan(previousCount);
    await expect
      .poll(
        () => {
          return sipProxy.getServerResponses(sipProxy.getConnectionsCount() - 1, 'REGISTER');
        },
        { timeout: REGISTERED_TIMEOUT_MS },
      )
      .toContain(200);
  };

  const closeConnection = async (sipProxy: SipWebSocketProxy) => {
    await sipProxy.closeLatestConnectionAndReject();
    await expect
      .poll(
        () => {
          return sipProxy.getRejectedConnectionsCount();
        },
        { timeout: TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS },
      )
      .toBeGreaterThan(0);
  };

  const restoreConnection = async (sipProxy: SipWebSocketProxy) => {
    const connectionsCount = sipProxy.getConnectionsCount();

    sipProxy.acceptConnections();
    await waitForRegisteredConnection(sipProxy, connectionsCount);
  };

  /** Завершает звонок по текущему соединению и возвращает коды ответов сервера на BYE. */
  const hangUp = async (connectPage: ConnectPage, sipProxy: SipWebSocketProxy) => {
    const index = sipProxy.getConnectionsCount() - 1;

    await connectPage.hangupOnly();
    await expect
      .poll(
        () => {
          return sipProxy.countRequests(index, 'toServer', 'BYE');
        },
        { timeout: SIP_RESPONSE_TIMEOUT_MS },
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        () => {
          return sipProxy.getServerResponses(index, 'BYE').length;
        },
        { timeout: SIP_RESPONSE_TIMEOUT_MS },
      )
      .toBeGreaterThan(0);

    return sipProxy.getServerResponses(index, 'BYE');
  };

  test.beforeEach(async ({ page, connectPage, statusDashboard, sipProxy }) => {
    presentation = undefined;
    events = await observeDisconnectEvents(page);
    await connectPage.fillForm(connectionFormConfig);
    await page.locator('#autoRedialEnabled').uncheck();
    await connectPage.connect({ timeout: CONNECT_TIMEOUT_MS });
    await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
      timeout: CONNECT_TIMEOUT_MS,
    });
    await connectPage.startCallAttempt();
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive', {
      timeout: CONNECT_TIMEOUT_MS,
    });
    await expect.poll(readEvents).toMatchObject({ confirmed: 1, isEstablished: true });
    // После входа в комнату сервер присылает re-INVITE: обрыв до его ACK завершает звонок по таймеру JsSIP.
    await expect
      .poll(
        () => {
          const index = sipProxy.getConnectionsCount() - 1;
          const invites = sipProxy.countRequests(index, 'toClient', 'INVITE');

          // Сервер может повторить ACK на ретрансмиссию 200 OK
          return invites > 0 && sipProxy.countRequests(index, 'toClient', 'ACK') >= invites;
        },
        { timeout: CONNECT_TIMEOUT_MS },
      )
      .toBe(true);
  });

  test.afterEach(async ({ connectPage, sipProxy }) => {
    // Без живого соединения BYE не дойдёт до сервера и звонок учётки останется висеть.
    sipProxy.acceptConnections();

    const { isEstablished } = await readEvents();

    if (isEstablished) {
      await expect
        .poll(
          () => {
            return sipProxy.isLatestConnectionRegistered();
          },
          { timeout: REGISTERED_TIMEOUT_MS },
        )
        .toBe(true);
      await connectPage.hangupOnly();
    }

    await report('final', sipProxy);

    if (presentation !== undefined) {
      await presentation.evaluate((observer) => {
        observer.dispose();
      });
      await presentation.dispose();
    }

    await events.evaluate((observer) => {
      observer.dispose();
    });
    await events.dispose();
  });

  test('переоткрывает полуоткрытый WebSocket, сервер продолжает звонок по новому соединению', async ({
    page,
    connectPage,
    sipProxy,
    statusDashboard,
  }) => {
    test.setTimeout(300_000);

    const frozenIndex = sipProxy.freezeLatestConnection();
    const frozenAt = sipProxy.getElapsedMs();

    await expect
      .poll(readEvents, { timeout: SIGNALING_UNSTABLE_TIMEOUT_MS })
      .toMatchObject({ signalingUnstable: 1 });
    await report(`signaling-unstable after ${sipProxy.getElapsedMs() - frozenAt}ms`, sipProxy);

    await expect
      .poll(
        () => {
          return sipProxy.getConnectionsCount();
        },
        { timeout: TRANSPORT_REOPEN_TIMEOUT_MS },
      )
      .toBeGreaterThan(frozenIndex + 1);

    const reopenedIndex = sipProxy.getConnectionsCount() - 1;

    await expect
      .poll(readEvents, { timeout: PING_RESTORE_TIMEOUT_MS })
      .toMatchObject({ signalingUnstable: 1, signalingRestored: 1 });
    await report(`signaling-restored after ${sipProxy.getElapsedMs() - frozenAt}ms`, sipProxy);
    // Ping после переоткрытия уходит сразу и может ответить раньше, чем завершится REGISTER (401 → 200).
    await expect
      .poll(
        () => {
          return sipProxy.getServerResponses(reopenedIndex, 'REGISTER');
        },
        { timeout: REGISTERED_TIMEOUT_MS },
      )
      .toContain(200);
    expect(
      sipProxy.getServerResponses(reopenedIndex, 'OPTIONS').some((status) => {
        return status >= 200 && status < 300;
      }),
    ).toBe(true);
    await expectCallAlive(sipProxy);

    const infosBeforeClick = sipProxy.countRequests(reopenedIndex, 'toServer', 'INFO');
    const infoResponsesBeforeClick = sipProxy.getServerResponses(reopenedIndex, 'INFO').length;

    await connectPage.visibleMicActionButton.click();
    await expect
      .poll(() => {
        return sipProxy.countRequests(reopenedIndex, 'toServer', 'INFO') - infosBeforeClick;
      })
      .toBeGreaterThan(0);
    await expect
      .poll(
        () => {
          return sipProxy.getServerResponses(reopenedIndex, 'INFO').slice(infoResponsesBeforeClick);
        },
        { timeout: SIP_RESPONSE_TIMEOUT_MS },
      )
      .toContain(200);

    await page.waitForTimeout(CALL_ALIVE_OBSERVATION_MS);
    await expectCallAlive(sipProxy);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
    expect(sipProxy.getConnectionsCount() - 1).toBe(reopenedIndex);

    expect(await hangUp(connectPage, sipProxy)).toContain(200);
  });

  test('отклоняет старт демонстрации без завершения звонка, когда WebSocket закрыт', async ({
    page,
    connectPage,
    sipProxy,
    statusDashboard,
  }) => {
    test.setTimeout(120_000);

    presentation = await observePresentation(page);
    await closeConnection(sipProxy);
    await expectCallAlive(sipProxy);

    await presentation.evaluate((observer) => {
      observer.start();
    });
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'rejected' });
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_WAIT_MS);
    await report('after start on closed WebSocket', sipProxy);

    await expectCallAlive(sipProxy);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');

    await restoreConnection(sipProxy);
    await report('after restore', sipProxy);
    await expectCallAlive(sipProxy);
    test.info().annotations.push({
      type: 'BYE responses',
      description: JSON.stringify(await hangUp(connectPage, sipProxy)),
    });
  });

  test('останавливает демонстрацию локально без завершения звонка, когда WebSocket закрыт', async ({
    page,
    connectPage,
    sipProxy,
    statusDashboard,
  }) => {
    test.setTimeout(120_000);

    presentation = await observePresentation(page);
    await presentation.evaluate((observer) => {
      observer.start();
    });
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'resolved' });
    expect(await readPresentation()).toMatchObject({ liveSenderTracks: 1, trackStates: ['live'] });

    await closeConnection(sipProxy);
    await expectCallAlive(sipProxy);

    await presentation.evaluate((observer) => {
      observer.stop();
    });
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'stop', status: 'rejected' });
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_WAIT_MS);
    await report('after stop on closed WebSocket', sipProxy);

    expect(await readPresentation()).toMatchObject({
      liveSenderTracks: 0,
      trackStates: ['ended'],
      events: ['started', 'ended', 'failed'],
    });
    await expectCallAlive(sipProxy);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');

    await restoreConnection(sipProxy);
    await expectCallAlive(sipProxy);
    test.info().annotations.push({
      type: 'BYE responses',
      description: JSON.stringify(await hangUp(connectPage, sipProxy)),
    });
  });

  test('повторно запускает демонстрацию после возврата WebSocket', async ({
    page,
    connectPage,
    sipProxy,
    statusDashboard,
  }) => {
    test.setTimeout(150_000);

    presentation = await observePresentation(page);
    await presentation.evaluate((observer) => {
      observer.start();
    });
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'resolved' });

    await closeConnection(sipProxy);
    await presentation.evaluate((observer) => {
      observer.stop();
    });
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'stop', status: 'rejected' });

    await restoreConnection(sipProxy);
    await expectCallAlive(sipProxy);

    const restoredIndex = sipProxy.getConnectionsCount() - 1;
    const infosBeforeStart = sipProxy.countRequests(restoredIndex, 'toServer', 'INFO');

    await presentation.evaluate((observer) => {
      observer.start();
    });
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'resolved' });
    await report('after restart on restored WebSocket', sipProxy);

    expect(sipProxy.countRequests(restoredIndex, 'toServer', 'INFO')).toBeGreaterThan(
      infosBeforeStart,
    );
    expect(sipProxy.getServerResponses(restoredIndex, 'INFO')).toContain(200);
    expect(await readPresentation()).toMatchObject({
      liveSenderTracks: 1,
      trackStates: ['ended', 'live'],
    });
    await expectCallAlive(sipProxy);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');

    test.info().annotations.push({
      type: 'BYE responses',
      description: JSON.stringify(await hangUp(connectPage, sipProxy)),
    });
  });
});
