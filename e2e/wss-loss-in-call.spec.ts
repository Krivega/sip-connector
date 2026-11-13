import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { SIP_PEER_HOST, SIP_PEER_NUMBER, SipPeer } from './support/SipPeer';

const CONNECT_TIMEOUT_MS = 10_000;
const TRANSPORT_RECONNECT_ATTEMPT_TIMEOUT_MS = 15_000;
const AFTER_DEAD_TRANSPORT_INFO_WAIT_MS = 5000;
/** JsSIP Timer F (64 * T1) для INFO без ответа и запас на обработку. */
const AFTER_INFO_TIMER_F_WAIT_MS = 34_000;
/** Два OPTIONS без ответа приходят не позже T + 15 + 10 + 15 секунд. */
const TWO_SILENT_PINGS_TIMEOUT_MS = 45_000;
/** Таймаут второго ping в SipOperations (10 с) и запас на reconnect-flow. */
const AFTER_SECOND_SILENT_PING_WAIT_MS = 13_000;

type TDisconnectEvents = Awaited<ReturnType<typeof observeDisconnectEvents>>;

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

  test('не переподключается и не завершает звонок, когда сервер не отвечает на периодический ping', async ({
    page,
    sipPeer,
    statusDashboard,
  }) => {
    test.setTimeout(120_000);

    const pingsBeforeSilence = sipPeer.countReceivedRequests('OPTIONS');

    sipPeer.stopAnswering(['OPTIONS']);

    await expect
      .poll(
        () => {
          return sipPeer.countReceivedRequests('OPTIONS') - pingsBeforeSilence;
        },
        { timeout: TWO_SILENT_PINGS_TIMEOUT_MS },
      )
      .toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(AFTER_SECOND_SILENT_PING_WAIT_MS);

    await expectCallAlive(sipPeer);
    expect(sipPeer.countReceivedRequests('REGISTER')).toBe(1);
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });
});
