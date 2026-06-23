import { connectionFormConfigSpectator } from './connection.config';
import { expect, test } from './fixtures';

const CONNECT_OK_TIMEOUT_MS = 10_000;
const WAIT_SPECTATOR_ROLE_TIMEOUT_MS = 25_000;

const NOTIFICATION_CALLS_GLOBAL_KEY = '__e2eMovedToParticipantNotificationCalls';

type TNotificationCall = { text: string };

type TInstrumentedSipConnector = {
  sessionManager: {
    getSnapshot: () => { call: { value: string } };
    subscribe: (listener: (snapshot: { call: { value: string } }) => void) => unknown;
  };
  callSessionState: {
    getSnapshot: () => { role: { type: string } };
    subscribe: (listener: (snapshot: { role: { type: string } }) => void) => unknown;
  };
};

type TDemoApp = { sipConnectorFacade?: { sipConnector?: TInstrumentedSipConnector } };

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
        let isCallActive = activeCallStates.has(
          sipConnector.sessionManager.getSnapshot().call.value,
        );
        let previousRoleType = sipConnector.callSessionState.getSnapshot().role.type;

        const hasSpectatorRole = (roleType: string) => {
          return roleType === 'spectator' || roleType === 'spectator_synthetic';
        };

        sipConnector.sessionManager.subscribe((snapshot) => {
          isCallActive = activeCallStates.has(snapshot.call.value);
        });

        sipConnector.callSessionState.subscribe((snapshot) => {
          const nextRoleType = snapshot.role.type;

          if (
            isCallActive &&
            hasSpectatorRole(previousRoleType) &&
            nextRoleType === 'participant'
          ) {
            notificationCalls.push({
              text: 'Вы переведены в участники, теперь можно использовать камеру и микрофон',
            });
          }

          previousRoleType = nextRoleType;
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
