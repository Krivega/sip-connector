import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { SIP_PEER_HOST, SIP_PEER_NUMBER, SipPeer } from './support/SipPeer';

import type { Page } from '@playwright/test';
import type { SipConnectorFacade, TCallEndEvent } from '../src';

const CONNECT_TIMEOUT_MS = 10_000;
const TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS = 15_000;
const PRESENTATION_SETTLE_TIMEOUT_MS = 10_000;
const AFTER_DEAD_TRANSPORT_WAIT_MS = 5000;
/** JsSIP Timer F (64 * T1) для INFO без ответа и запас на обработку. */
const AFTER_SILENT_TRANSACTION_WAIT_MS = 40_000;
/** Ping раз в 15 с: следующий успешный ping по текущему соединению, плюс запас. */
const ANSWERED_PING_TIMEOUT_MS = 20_000;
/**
 * Проверка сигнализации перед re-INVITE: таймаут ping 10 с и ожидание подтверждения
 * по новому соединению до 15 с, плюс запас. Меньше Timer B/F JsSIP (32 с).
 */
const SIGNALING_CHECK_TIMEOUT_MS = 30_000;

type TDemoApp = { sipConnectorFacade: SipConnectorFacade };

type TAction = 'start' | 'stop';

type TOutcome = {
  action: TAction;
  status: 'pending' | 'resolved' | 'rejected';
  error?: string;
  afterMs?: number;
};

type TCallEnd = {
  type: 'ended' | 'failed';
  originator: string;
  cause: string;
  afterMs: number;
};

/** Исходящий запрос звонка по событиям JsSIP RTCSession: INFO (newInfo) или re-INVITE (локальный offer). */
type TSentRequest = {
  method: 'INFO' | 're-INVITE';
  contentType?: string;
  afterMs: number;
};

type TDisconnectEvents = Awaited<ReturnType<typeof observeDisconnectEvents>>;

/** Вызывает публичные методы демонстрации и записывает их исход и время завершения звонка. */
const observePresentation = async (page: Page) => {
  return page.evaluateHandle(async () => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

    if (app === undefined) {
      throw new Error('Демо коннектора не инициализировано');
    }

    const { sipConnector } = app.sipConnectorFacade;
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const [videoTrack] = mediaStream.getVideoTracks() as MediaStreamVideoTrack[];
    const outcomes: TOutcome[] = [];
    const callEnds: TCallEnd[] = [];
    const sentRequests: TSentRequest[] = [];
    const rtcSession = sipConnector.getEstablishedRTCSession();

    if (rtcSession === undefined) {
      throw new Error('Нет установленного звонка');
    }

    let actionAt = performance.now();

    const getElapsedMs = () => {
      return Math.round(performance.now() - actionAt);
    };
    const saveCallEnd = (type: TCallEnd['type']) => {
      return ({ originator, cause }: TCallEndEvent) => {
        callEnds.push({ type, originator, cause, afterMs: getElapsedMs() });
      };
    };
    const handleNewInfo = ({
      originator,
      info,
    }: {
      originator: string;
      info: { contentType: string };
    }) => {
      if (originator === 'local') {
        sentRequests.push({
          method: 'INFO',
          contentType: info.contentType,
          afterMs: getElapsedMs(),
        });
      }
    };
    const handleSdp = ({ originator, type }: { originator: string; type: string }) => {
      if (originator === 'local' && type === 'offer') {
        sentRequests.push({ method: 're-INVITE', afterMs: getElapsedMs() });
      }
    };

    rtcSession.on('newInfo', handleNewInfo);
    rtcSession.on('sdp', handleSdp);

    const unsubscribe = [
      () => {
        rtcSession.off('newInfo', handleNewInfo);
        rtcSession.off('sdp', handleSdp);
      },
      app.sipConnectorFacade.on('call:ended', saveCallEnd('ended')),
      app.sipConnectorFacade.on('call:failed', saveCallEnd('failed')),
    ];
    const run = (action: TAction, operation: () => Promise<unknown>) => {
      const outcome: TOutcome = { action, status: 'pending' };

      actionAt = performance.now();
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
          sentRequests: [...sentRequests],
          callEnds: [...callEnds],
        };
      },
      dispose: () => {
        unsubscribe.forEach((off) => {
          off();
        });
        mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      },
    };
  });
};

type TPresentation = Awaited<ReturnType<typeof observePresentation>>;

type TFixtures = {
  sipPeer: SipPeer;
};

const test = base.extend<TFixtures>({
  sipPeer: async ({ page }, use) => {
    const peer = new SipPeer(page);

    await use(peer);
    await peer.dispose();
  },
  connectPage: async ({ page, sipPeer }, use) => {
    await sipPeer.install();
    await page.goto('/');
    await new DemoPage(page).waitForLoaderToBeHidden();

    const connectPage = new ConnectPage(page);

    await use(connectPage);
    await connectPage.disconnect({ timeout: CONNECT_TIMEOUT_MS });
  },
});

test.describe('Демонстрация в активном звонке при потере SIP WebSocket', () => {
  let events: TDisconnectEvents;
  let presentation: TPresentation;

  const readEvents = async () => {
    return events.evaluate((observer) => {
      return observer.read();
    });
  };

  const readPresentation = async () => {
    return presentation.evaluate((observer) => {
      return observer.read();
    });
  };

  const startPresentation = async () => {
    await presentation.evaluate((observer) => {
      observer.start();
    });
  };

  const stopPresentation = async () => {
    await presentation.evaluate((observer) => {
      observer.stop();
    });
  };

  const getLastOutcome = async () => {
    const { outcomes } = await readPresentation();

    return outcomes.at(-1);
  };

  const reportObserved = async (label: string, sipPeer: SipPeer) => {
    const observed = { ...(await readPresentation()), ...(await readEvents()) };
    const description = JSON.stringify({
      outcomes: observed.outcomes,
      sentRequests: observed.sentRequests,
      callEnds: observed.callEnds,
      isEstablished: observed.isEstablished,
      serverReceived: Object.fromEntries(
        ['INFO', 'INVITE', 'BYE'].map((method) => {
          return [method, sipPeer.countReceivedRequests(method)];
        }),
      ),
    });

    test.info().annotations.push({ type: label, description });
    // eslint-disable-next-line no-console
    console.log(`[${label}] ${description}`);
  };

  const expectCallAlive = async (sipPeer: SipPeer) => {
    expect(await readEvents()).toMatchObject({ ended: [], failed: [], isEstablished: true });
    expect(sipPeer.countReceivedRequests('BYE')).toBe(0);
  };

  const dropConnection = async (sipPeer: SipPeer) => {
    await sipPeer.dropConnection();
    await expect
      .poll(
        () => {
          return sipPeer.getRejectedConnectionsCount();
        },
        { timeout: TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS },
      )
      .toBeGreaterThan(0);
  };

  /** Сразу после успешного периодического ping следующий будет не раньше чем через 15 с. */
  const waitForAnsweredPing = async (sipPeer: SipPeer) => {
    const pingsBefore = sipPeer.countLatestConnectionRequests('OPTIONS');

    await expect
      .poll(
        () => {
          return sipPeer.countLatestConnectionRequests('OPTIONS');
        },
        { timeout: ANSWERED_PING_TIMEOUT_MS, intervals: [100] },
      )
      .toBeGreaterThan(pingsBefore);
  };

  test.beforeEach(async ({ page, connectPage, statusDashboard, sipPeer }) => {
    events = await observeDisconnectEvents(page);
    await connectPage.fillForm({
      serverAddress: SIP_PEER_HOST,
      displayName: 'Test participant',
      conferenceNumber: SIP_PEER_NUMBER,
      userNumber: '100',
      password: 'test-password',
    });
    await page.locator('#autoRedialEnabled').uncheck();
    await connectPage.connect({ timeout: CONNECT_TIMEOUT_MS });
    await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
      timeout: CONNECT_TIMEOUT_MS,
    });
    await connectPage.startCallAttempt();
    await expect.poll(readEvents).toMatchObject({ confirmed: 1, isEstablished: true });
    await sipPeer.waitForMediaConnected();
    sipPeer.enterRoom();
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
    presentation = await observePresentation(page);
  });

  test.afterEach(async () => {
    await presentation.evaluate((observer) => {
      observer.dispose();
    });
    await presentation.dispose();
    await events.evaluate((observer) => {
      observer.dispose();
    });
    await events.dispose();
  });

  test('запускает и останавливает демонстрацию при живом WebSocket', async ({
    sipPeer,
    statusDashboard,
  }) => {
    await startPresentation();
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'resolved' });
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
    await expectCallAlive(sipPeer);

    await stopPresentation();
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'stop', status: 'resolved' });
    await reportObserved('observed', sipPeer);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('не завершает звонок при старте демонстрации после обрыва WebSocket', async ({
    page,
    sipPeer,
    statusDashboard,
  }) => {
    await dropConnection(sipPeer);
    await expectCallAlive(sipPeer);

    await startPresentation();
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_WAIT_MS);
    await reportObserved('observed', sipPeer);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('не завершает звонок при старте демонстрации, когда сервер молчит по открытому WebSocket', async ({
    page,
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(90_000);

    sipPeer.stopAnswering(['INFO', 'OPTIONS']);

    await startPresentation();
    // Без ответа остаётся проверочный ping или INFO SHARE_STATE: старт отклоняется по таймауту.
    await expect
      .poll(getLastOutcome, { timeout: AFTER_SILENT_TRANSACTION_WAIT_MS })
      .toMatchObject({ action: 'start', status: 'rejected' });
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_WAIT_MS);
    await reportObserved('observed', sipPeer);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('не завершает звонок при остановке демонстрации после обрыва WebSocket', async ({
    page,
    sipPeer,
    statusDashboard,
  }) => {
    await startPresentation();
    await expect
      .poll(getLastOutcome, { timeout: PRESENTATION_SETTLE_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'resolved' });

    await dropConnection(sipPeer);
    await expectCallAlive(sipPeer);

    await stopPresentation();
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_WAIT_MS);
    await reportObserved('observed', sipPeer);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('запускает демонстрацию по новому WebSocket, когда соединение стало полуоткрытым после успешного ping', async ({
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(90_000);

    await waitForAnsweredPing(sipPeer);

    const connectionsBeforeHalfOpen = sipPeer.getConnectionsCount();

    sipPeer.makeConnectionHalfOpen();
    await startPresentation();
    await expect
      .poll(getLastOutcome, { timeout: SIGNALING_CHECK_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'resolved' });
    await reportObserved('observed', sipPeer);

    // По полуоткрытому соединению ушёл только проверочный ping.
    expect(sipPeer.countLostRequests('OPTIONS')).toBeGreaterThan(0);
    expect(sipPeer.countLostRequests('INFO')).toBe(0);
    expect(sipPeer.countLostRequests('INVITE')).toBe(0);
    expect(sipPeer.getConnectionsCount()).toBeGreaterThan(connectionsBeforeHalfOpen);

    const requests = sipPeer.getLatestConnectionRequestMethods();
    const order = requests.join(' → ');
    const [pingAt, infoAt, reInviteAt] = ['OPTIONS', 'INFO', 'INVITE'].map((method) => {
      return requests.indexOf(method);
    });

    expect(pingAt, order).toBeGreaterThanOrEqual(0);
    expect(infoAt, order).toBeGreaterThan(pingAt);
    expect(reInviteAt, order).toBeGreaterThan(infoAt);
    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('отклоняет старт демонстрации без re-INVITE и завершения звонка, когда сигнализация не восстанавливается', async ({
    page,
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(90_000);

    await waitForAnsweredPing(sipPeer);

    const invitesBeforeStart = sipPeer.countReceivedRequests('INVITE');

    sipPeer.stopAcceptingConnections();
    sipPeer.makeConnectionHalfOpen();
    await startPresentation();
    await expect
      .poll(getLastOutcome, { timeout: SIGNALING_CHECK_TIMEOUT_MS })
      .toMatchObject({ action: 'start', status: 'rejected' });
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_WAIT_MS);
    await reportObserved('observed', sipPeer);

    // Сигнализация проверяется до INFO SHARE_STATE и re-INVITE.
    expect(sipPeer.countLostRequests('OPTIONS')).toBeGreaterThan(0);
    expect(sipPeer.countLostRequests('INVITE')).toBe(0);
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(invitesBeforeStart);
    expect(await readPresentation()).toMatchObject({ sentRequests: [] });
    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });
});
