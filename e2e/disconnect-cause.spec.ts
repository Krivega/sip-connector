import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { SIP_PEER_HOST, SIP_PEER_NUMBER, SipPeer } from './support/SipPeer';

import type { StatusDashboard } from './page-objects/StatusDashboard';

const CONNECT_TIMEOUT_MS = 10_000;
const CONFERENCE_DISCONNECT_CAUSE = {
  raw: '1004',
  code: 1004,
  key: 'CONFERENCE_FINISHED',
};
const MODERATOR_DISCONNECT_CAUSE = {
  raw: '1003',
  code: 1003,
  key: 'DISCONNECTED_BY_MODERATOR',
};

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
  // Устанавливаем routeWebSocket до загрузки демо. Общий перехватчик сетевых
  // сбоев из fixtures здесь не нужен: серверную сторону контролирует Playwright.
  connectPage: async ({ page, sipPeer }, use) => {
    await sipPeer.install();
    await page.goto('/');
    await new DemoPage(page).waitForLoaderToBeHidden();

    const connectPage = new ConnectPage(page);

    await use(connectPage);
    await connectPage.disconnect({ timeout: CONNECT_TIMEOUT_MS });
  },
});

test.describe('Причина отключения через SIP over WebSocket', () => {
  let events: TDisconnectEvents;

  const readEvents = async () => {
    return events.evaluate((observer) => {
      return observer.read();
    });
  };

  const enterConference = async (sipPeer: SipPeer, statusDashboard: StatusDashboard) => {
    await expect.poll(readEvents).toMatchObject({ confirmed: 1, isEstablished: true });
    await sipPeer.waitForMediaConnected();
    sipPeer.enterRoom();
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  };

  const expectCallFinished = async (statusDashboard: StatusDashboard) => {
    await statusDashboard.waitForDiagramStatus('call', 'call:idle');
    await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
  };

  test.beforeEach(async ({ page, connectPage, statusDashboard }) => {
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
  });

  test.afterEach(async () => {
    await events.evaluate((observer) => {
      observer.dispose();
    });
    await events.dispose();
  });

  test.describe('Исходящий звонок', () => {
    test.beforeEach(async ({ connectPage, sipPeer, statusDashboard }) => {
      await connectPage.startCallAttempt();
      await enterConference(sipPeer, statusDashboard);
    });

    test('должен передать причину BYE после звонка в конференцию', async ({
      statusDashboard,
      sipPeer,
    }) => {
      await sipPeer.bye('1004');

      await expect.poll(readEvents).toMatchObject({
        ended: [
          {
            originator: 'remote',
            cause: 'Terminated',
            disconnectCause: CONFERENCE_DISCONNECT_CAUSE,
          },
        ],
        failed: [],
        incomingFailed: [],
        isEstablished: false,
      });
      await expectCallFinished(statusDashboard);
    });

    test('должен завершить звонок по прежнему сценарию при BYE без заголовка причины', async ({
      statusDashboard,
      sipPeer,
    }) => {
      await sipPeer.bye();

      await expect.poll(readEvents).toMatchObject({
        ended: [{ originator: 'remote', cause: 'Terminated', disconnectCause: undefined }],
        failed: [],
        incomingFailed: [],
        isEstablished: false,
      });
      await expectCallFinished(statusDashboard);
    });
  });

  test.describe('Входящий звонок', () => {
    test.beforeEach(async ({ sipPeer, statusDashboard }) => {
      await sipPeer.invite();
      await statusDashboard.waitForDiagramStatus('incoming', 'incoming:ringing');
      await expect.poll(readEvents).toMatchObject({ ringing: 1, isAvailableIncomingCall: true });
    });

    test('должен передать BYE после ответа через основной звонок без повторного входящего события', async ({
      statusDashboard,
      sipPeer,
    }) => {
      const answered = await events.evaluate(async (observer) => {
        return observer.answer();
      });

      expect(answered).toBe(true);
      await enterConference(sipPeer, statusDashboard);

      await sipPeer.bye('1003');

      await expect.poll(readEvents).toMatchObject({
        ended: [
          {
            originator: 'remote',
            cause: 'Terminated',
            disconnectCause: MODERATOR_DISCONNECT_CAUSE,
          },
        ],
        failed: [],
        incomingFailed: [],
        ringing: 1,
        isEstablished: false,
        isAvailableIncomingCall: false,
      });
      await expectCallFinished(statusDashboard);
    });

    test('должен передать причину CANCEL до ответа', async ({ statusDashboard, sipPeer }) => {
      await sipPeer.cancel('1004');

      await expect.poll(readEvents).toMatchObject({
        incomingFailed: [
          {
            incomingNumber: SIP_PEER_NUMBER,
            disconnectCause: CONFERENCE_DISCONNECT_CAUSE,
          },
        ],
        ended: [],
        failed: [],
        confirmed: 0,
        isEstablished: false,
        isAvailableIncomingCall: false,
      });
      await statusDashboard.waitForDiagramStatus('incoming', 'incoming:failed');
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
    });
  });
});
