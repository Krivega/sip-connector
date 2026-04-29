import { connectionFormConfigSpectator } from './connection.config';
import { test } from './fixtures';

const CONNECT_OK_TIMEOUT_MS = 10_000;
const CALL_ATTEMPT_TIMEOUT_MS = 5000;

test.describe('Режим зрителя', () => {
  test.describe.configure({ mode: 'serial' });
  test.afterEach(async ({ connectPage }) => {
    await connectPage.disconnect({ timeout: CONNECT_OK_TIMEOUT_MS });
  });

  test('Call Session показывает spectator, камера и микрофон disabled', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 15_000);

    await test.step('заполнить форму и запустить connect+call в конференцию зрителя', async () => {
      await connectPage.fillForm(connectionFormConfigSpectator);
      await connectPage.startConnectAndCallAttempt();
    });

    await test.step('дождаться активного звонка и открыть дашборд статусов', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:callActive', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.open();
    });

    await test.step('проверить статусы Call Session для режима зрителя', async () => {
      await statusDashboard.waitForNodeFieldText({
        nodeTitle: 'Call Session',
        fieldLabel: /role type:/i,
        expectedText: 'spectator',
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.expectState({
        nodes: {
          'Call Session': {
            fields: {
              'license:': 'VIDEO',
              'role type:': 'spectator',
              'is spectator any:': 'true',
              'is recv session expected:': 'true',
              'is duplex sending media mode:': 'false',
              'is available sending media:': 'false',
            },
          },
        },
      });
    });

    await test.step('проверить, что кнопки камеры и микрофона недоступны', async () => {
      await connectPage.expectVisibleMediaActionButtonsDisabled({
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
    });
  });
});
