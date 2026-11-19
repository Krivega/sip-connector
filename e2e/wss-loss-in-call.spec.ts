import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { SIP_PEER_HOST, SIP_PEER_NUMBER, SipPeer } from './support/SipPeer';

import type { Page } from '@playwright/test';
import type { SipConnectorFacade } from '../src';

const CONNECT_TIMEOUT_MS = 10_000;
const TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS = 15_000;
const AFTER_DEAD_TRANSPORT_INFO_WAIT_MS = 5000;
/** JsSIP Timer F (64 * T1) для INFO без ответа и запас на обработку. */
const AFTER_INFO_TIMER_F_WAIT_MS = 34_000;
/** Ping раз в 15 с с таймаутом 10 с: первый провал не позже T + 15 + 10 секунд, плюс запас. */
const SIGNALING_UNSTABLE_TIMEOUT_MS = 30_000;
/** Таймаут ping, отправленного до возобновления ответов (10 с), переоткрытие и сразу следующий ping. */
const PING_RESTORE_TIMEOUT_MS = 15_000;
/** Переоткрытие транспорта начинается сразу после signaling-unstable. */
const TRANSPORT_REOPEN_TIMEOUT_MS = 10_000;
/** После переоткрытия ping уходит сразу, без ожидания интервала 15 с. */
const REOPENED_PING_TIMEOUT_MS = 5000;
/** Таймаут ping, отправленного до возобновления ответов (10 с), и интервал до следующего ping (15 с). */
const PENDING_REINVITE_RESEND_TIMEOUT_MS = 30_000;

type TDemoApp = { sipConnectorFacade: SipConnectorFacade };

type TDisconnectEvents = Awaited<ReturnType<typeof observeDisconnectEvents>>;

/** Заменяет потоки звонка тем же публичным методом, что и приложение. */
const replaceMediaStream = async (page: Page, constraints: MediaStreamConstraints) => {
  await page.evaluate(async (streamConstraints) => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

    if (app === undefined) {
      throw new Error('Демо коннектора не инициализировано');
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia(streamConstraints);

    await app.sipConnectorFacade.sipConnector.replaceMediaStream(mediaStream);
  }, constraints);
};

/** Направление отправляемого видеоканала после ответа сервера; `null`, пока сервер о канале не знает. */
const getVideoSenderDirection = async (page: Page) => {
  return page.evaluate(() => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;
    const transceiver = app?.sipConnectorFacade.sipConnector
      .getEstablishedRTCSession()
      ?.connection.getTransceivers()
      .find(({ sender }) => {
        return sender.track?.kind === 'video';
      });

    return transceiver?.currentDirection ?? null;
  });
};

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

test.describe('Активный звонок при потере SIP WebSocket', () => {
  let events: TDisconnectEvents;

  const readEvents = async () => {
    return events.evaluate((observer) => {
      return observer.read();
    });
  };

  const expectCallAlive = async (sipPeer: SipPeer) => {
    expect(await readEvents()).toMatchObject({ ended: [], failed: [], isEstablished: true });
    expect(sipPeer.countReceivedRequests('BYE')).toBe(0);
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
  });

  test.afterEach(async () => {
    await events.evaluate((observer) => {
      observer.dispose();
    });
    await events.dispose();
  });

  test('не завершает звонок при переключении микрофона после обрыва WebSocket', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
  }) => {
    await sipPeer.dropConnection();
    await expect
      .poll(
        () => {
          return sipPeer.getRejectedConnectionsCount();
        },
        { timeout: TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS },
      )
      .toBeGreaterThan(0);
    await expectCallAlive(sipPeer);

    await connectPage.visibleMicActionButton.click();
    await page.waitForTimeout(AFTER_DEAD_TRANSPORT_INFO_WAIT_MS);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('не завершает звонок, когда сервер не отвечает на INFO и OPTIONS по открытому WebSocket', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(90_000);

    sipPeer.stopAnswering(['INFO', 'OPTIONS']);

    const infosBeforeClick = sipPeer.countReceivedRequests('INFO');

    await connectPage.visibleMicActionButton.click();
    await expect
      .poll(() => {
        return sipPeer.countReceivedRequests('INFO') - infosBeforeClick;
      })
      .toBeGreaterThan(0);
    await page.waitForTimeout(AFTER_INFO_TIMER_F_WAIT_MS);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('не завершает звонок, когда сервер не отвечает на периодический ping', async ({
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(90_000);

    const connectionsBeforeSilence = sipPeer.getConnectionsCount();

    sipPeer.stopAnswering(['OPTIONS']);

    await expect
      .poll(readEvents, { timeout: SIGNALING_UNSTABLE_TIMEOUT_MS })
      .toMatchObject({ signalingUnstable: 1 });
    // Ping по переоткрытому соединению тоже остаётся без ответа.
    await expect
      .poll(
        () => {
          return (
            sipPeer.getConnectionsCount() > connectionsBeforeSilence &&
            sipPeer.countLatestConnectionRequests('OPTIONS') > 0
          );
        },
        { timeout: TRANSPORT_REOPEN_TIMEOUT_MS },
      )
      .toBe(true);

    await expectCallAlive(sipPeer);
    expect(await readEvents()).toMatchObject({ signalingUnstable: 1, signalingRestored: 0 });
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');

    sipPeer.resumeAnswering(['OPTIONS']);

    await expect
      .poll(readEvents, { timeout: PING_RESTORE_TIMEOUT_MS })
      .toMatchObject({ signalingUnstable: 1, signalingRestored: 1 });
    await expectCallAlive(sipPeer);
  });

  test('переоткрывает полуоткрытый WebSocket без завершения звонка, когда ping не проходит', async ({
    connectPage,
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(90_000);

    const connectionsBeforeSilence = sipPeer.getConnectionsCount();

    sipPeer.makeConnectionHalfOpen();

    await expect
      .poll(readEvents, { timeout: SIGNALING_UNSTABLE_TIMEOUT_MS })
      .toMatchObject({ signalingUnstable: 1 });
    await expect
      .poll(
        () => {
          return sipPeer.getConnectionsCount();
        },
        { timeout: TRANSPORT_REOPEN_TIMEOUT_MS },
      )
      .toBeGreaterThan(connectionsBeforeSilence);
    await expect
      .poll(readEvents, { timeout: REOPENED_PING_TIMEOUT_MS })
      .toMatchObject({ signalingUnstable: 1, signalingRestored: 1 });
    expect(sipPeer.countLatestConnectionRequests('OPTIONS')).toBeGreaterThan(0);
    await expectCallAlive(sipPeer);

    await connectPage.visibleMicActionButton.click();
    await expect
      .poll(() => {
        return sipPeer.countLatestConnectionRequests('INFO');
      })
      .toBeGreaterThan(0);

    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test('досылает re-INVITE нового видеоканала, не отправленный без подтверждённой сигнализации', async ({
    page,
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(120_000);

    // Демо звонит с камерой: видеоканал убирается штатным re-INVITE, пока WebSocket жив.
    await replaceMediaStream(page, { audio: true });
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);

    sipPeer.makeConnectionHalfOpen();
    sipPeer.stopAnswering(['OPTIONS']);
    // Проверка сигнализации не подтверждается: replaceMediaStream завершается без re-INVITE.
    await replaceMediaStream(page, { audio: true, video: true });

    expect(sipPeer.countLostRequests('INVITE')).toBe(0);
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
    expect(await getVideoSenderDirection(page)).toBeNull();
    await expectCallAlive(sipPeer);

    sipPeer.resumeAnswering(['OPTIONS']);

    await expect
      .poll(
        () => {
          return sipPeer.countReceivedRequests('INVITE');
        },
        { timeout: PENDING_REINVITE_RESEND_TIMEOUT_MS },
      )
      .toBe(3);
    await expect
      .poll(async () => {
        return getVideoSenderDirection(page);
      })
      .toBe('sendonly');
    expect(sipPeer.countLostRequests('INVITE')).toBe(0);
    await expectCallAlive(sipPeer);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });
});
