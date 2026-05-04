import { connectionFormConfig } from './connection.config';
import { test } from './fixtures';

const CONNECT_OK_TIMEOUT_MS = 10_000;
const RECONNECT_FLOW_TIMEOUT_MS = 60_000;

test.describe('Автоподключение при недоступности ws соединения', () => {
  test('если ws недоступен до connect, автоконнектор остаётся в retry-flow и не доходит до readyToCall', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + RECONNECT_FLOW_TIMEOUT_MS);

    await test.step('сделать недоступными все ws соединения до connect', async () => {
      await connectPage.blockWsMessages(connectionFormConfig.serverAddress);
      await connectPage.blockCreateNewWsTransport(connectionFormConfig.serverAddress);
    });

    await test.step('запустить connect попытку и открыть дашборд', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.startConnectionAttempt();
      await statusDashboard.open();
    });

    await test.step('проверить, что система входит в reconnect-flow', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:connecting', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:idle', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.expectState({
        diagrams: {
          system: 'system:connecting',
          connection: 'connection:idle',
        },
        nodes: {
          System: {
            state: 'system:connecting',
          },
          Connection: {
            state: 'connection:idle',
          },
        },
      });
    });

    await test.step('проверить, что в readyToCall не переходит при полностью недоступном ws', async () => {
      await statusDashboard.expectDiagramStatusNot('system', 'system:readyToCall', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
    });
  });

  test('после снятия ws-блокировок автоконнектор восстанавливает подключение до readyToCall', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + RECONNECT_FLOW_TIMEOUT_MS);

    await test.step('сделать недоступными ws и запустить connect попытку', async () => {
      await connectPage.blockWsMessages(connectionFormConfig.serverAddress);
      await connectPage.blockCreateNewWsTransport(connectionFormConfig.serverAddress);
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.startConnectionAttempt();
      await statusDashboard.open();
    });

    await test.step('дождаться, что система застряла в reconnect-flow', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:connecting', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:idle', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
    });

    await test.step('снять ws-блокировки и дождаться штатного восстановления', async () => {
      await connectPage.resetWsControls();
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring', {
        timeout: RECONNECT_FLOW_TIMEOUT_MS,
      });
      await connectPage.expectConnected({ timeout: RECONNECT_FLOW_TIMEOUT_MS });
    });
  });
});
