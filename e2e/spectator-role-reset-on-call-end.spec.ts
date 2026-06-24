import { connectionFormConfigSpectator } from './connection.config';
import { expect, test } from './fixtures';

const CONNECT_OK_TIMEOUT_MS = 10_000;
const WAIT_SPECTATOR_ROLE_TIMEOUT_MS = 25_000;

const NOTIFICATION_CALLS_GLOBAL_KEY = '__e2eMovedToParticipantNotificationCalls';

type TNotificationCall = { text: string };

type TSessionSnapshot = {
  call: { value: string };
  callSessionState: { role: { type: string } };
};

type TInstrumentedSipConnector = {
  sessionManager: {
    getSnapshot: () => TSessionSnapshot;
    subscribe: (listener: (snapshot: TSessionSnapshot) => void) => unknown;
  };
};

type TDemoApp = { sipConnectorFacade?: { sipConnector?: TInstrumentedSipConnector } };

const hasSpectatorRole = (roleType: string) => {
  return roleType === 'spectator' || roleType === 'spectator_synthetic';
};

const hasParticipantRole = (roleType: string) => {
  return roleType === 'participant';
};

test.describe('завершение звонка в роли зрителя', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ connectPage }) => {
    await connectPage.disconnect({ timeout: CONNECT_OK_TIMEOUT_MS });
  });

  test('не вызывает уведомление о переводе в участники при завершении звонка', async ({
    page,
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 45_000);

    await test.step('подключиться и дождаться активного звонка в роли зрителя', async () => {
      await connectPage.fillForm(connectionFormConfigSpectator);
      await connectPage.startConnectAndCallAttempt();
      await statusDashboard.waitForDiagramStatus('system', 'system:callActive', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await connectPage.expectCallSessionRole('spectator', {
        timeout: WAIT_SPECTATOR_ROLE_TIMEOUT_MS,
      });
    });

    await test.step('установить клиентскую реакцию на перевод зрителя в участники', async () => {
      await page.evaluate((notificationCallsKey) => {
        const demoApp = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;
        const sipConnector = demoApp?.sipConnectorFacade?.sipConnector;

        if (sipConnector === undefined) {
          throw new Error('sipConnector недоступен на demo-странице');
        }

        const activeCallStates = new Set([
          'call:inRoom',
          'call:roomPendingAuth',
          'call:purgatory',
          'call:p2pRoom',
          'call:directP2pRoom',
          'call:presentationCall',
        ]);

        const notificationCalls: TNotificationCall[] = [];
        let previousSnapshot = sipConnector.sessionManager.getSnapshot();

        sipConnector.sessionManager.subscribe((snapshot) => {
          const wasSpectator = hasSpectatorRole(previousSnapshot.callSessionState.role.type);
          const isBecameParticipant = hasParticipantRole(snapshot.callSessionState.role.type);

          if (activeCallStates.has(snapshot.call.value) && wasSpectator && isBecameParticipant) {
            notificationCalls.push({
              text: 'Вы переведены в участники, теперь можно использовать камеру и микрофон',
            });
          }

          previousSnapshot = snapshot;
        });

        Reflect.set(window, notificationCallsKey, notificationCalls);
      }, NOTIFICATION_CALLS_GLOBAL_KEY);
    });

    await test.step('завершить звонок', async () => {
      await connectPage.hangupOnly();
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await connectPage.expectCallSessionRole('participant', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
    });

    await test.step('проверить, что уведомление не было вызвано', async () => {
      const notificationCalls = await page.evaluate((notificationCallsKey) => {
        return (Reflect.get(window, notificationCallsKey) as TNotificationCall[] | undefined) ?? [];
      }, NOTIFICATION_CALLS_GLOBAL_KEY);

      expect(notificationCalls).toEqual([]);
    });
  });
});
