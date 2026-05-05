import { connectionFormConfig } from './connection.config';
import { expect, test } from './fixtures';

const CONNECTING_TIMEOUT_MS = 15_000;
const DISCONNECT_TIMEOUT_MS = 15_000;
const FAST_DISCONNECT_TIMEOUT_MS = 5000;

test.describe('Disconnect во время connecting', () => {
  test('disconnect срабатывает сразу в процессе connect attempt', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECTING_TIMEOUT_MS + DISCONNECT_TIMEOUT_MS + 10_000);

    await test.step('заблокировать ws-ответы и начать connect', async () => {
      await connectPage.blockWsResponseMessages(connectionFormConfig.serverAddress);
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.startConnectionAttempt();
      await statusDashboard.open();
    });

    await test.step('дождаться входа в connecting', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:connecting', {
        timeout: CONNECTING_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatusOneOf(
        'connection',
        ['connection:connecting', 'connection:preparing'],
        {
          timeout: CONNECTING_TIMEOUT_MS,
        },
      );
    });

    await test.step('вызвать disconnect по кнопке и убедиться в быстром выходе', async () => {
      const startedAt = Date.now();

      await connectPage.disconnect({ timeout: FAST_DISCONNECT_TIMEOUT_MS });

      await statusDashboard.waitForDiagramStatus('system', 'system:disconnected', {
        timeout: FAST_DISCONNECT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:idle', {
        timeout: FAST_DISCONNECT_TIMEOUT_MS,
      });
      await connectPage.expectReadyForConnection({ timeout: DISCONNECT_TIMEOUT_MS });

      const elapsedMs = Date.now() - startedAt;

      expect(elapsedMs).toBeLessThanOrEqual(FAST_DISCONNECT_TIMEOUT_MS);
    });

    await connectPage.resetWsControls();
  });
});
