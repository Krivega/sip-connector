import { connectionFormConfig } from './connection.config';
import { expect, test } from './fixtures';

const CONNECT_OK_TIMEOUT_MS = 10_000;
/** Две попытки OPTIONS с интервалом ~15s и таймаутом JsSIP (Timer F) ~32s на транзакцию. */
const WS_OPTIONS_TWO_FAILS_TIMEOUT_MS = 120_000;
const RECONNECT_FLOW_TIMEOUT_MS = 60_000;

test.describe('Автопереподключение по периодическому SIP OPTIONS ping', () => {
  test('недоступный сервер в текущем WS-соединении запускает reconnect после ping без ответа', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(
      CONNECT_OK_TIMEOUT_MS * 2 + WS_OPTIONS_TWO_FAILS_TIMEOUT_MS + RECONNECT_FLOW_TIMEOUT_MS,
    );

    await test.step('подключиться и дождаться режима мониторинга', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.open();
    });

    await test.step('сымитировать зависший текущий WS: OPTIONS уходит, ответов нет (WrappedWebSocket)', async () => {
      await connectPage.blockWsResponseMessages(connectionFormConfig.serverAddress);
      await connectPage.blockCreateNewWsTransport(connectionFormConfig.serverAddress);
    });

    await test.step('дождаться двух отправок SIP OPTIONS по текущему WS (ответы глушатся)', async () => {
      await expect
        .poll(
          async () => {
            return connectPage.getSentWsOptionsCount(connectionFormConfig.serverAddress);
          },
          {
            timeout: WS_OPTIONS_TWO_FAILS_TIMEOUT_MS,
            message: 'ожидаем две отправки SIP OPTIONS по WebSocket',
          },
        )
        .toBeGreaterThanOrEqual(2);
    });

    await test.step('проверить переход автоконнектора в reconnect-flow', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:disconnecting', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:connecting', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });

      const autoConnectorReconnectStates = [
        'disconnecting',
        'attemptingGate',
        'attemptingConnect',
        'waitingBeforeRetry',
      ] as const;

      await statusDashboard.waitForDiagramStatusOneOf(
        'autoConnectorManager',
        autoConnectorReconnectStates,
        {
          timeout: RECONNECT_FLOW_TIMEOUT_MS,
        },
      );
      await statusDashboard.waitForNodeStateOneOf('Auto Connector', autoConnectorReconnectStates, {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.waitForNodeStateOneOf('System', ['system:connecting'], {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
    });
  });
});
