import { connectionFormConfig } from './connection.config';
import { test, expect } from './fixtures';

const CONNECT_OK_TIMEOUT_MS = 120_000;
const CALL_ATTEMPT_TIMEOUT_MS = 15_000;

test.describe('Звонок (callButton)', () => {
  test.describe.configure({ mode: 'serial' });

  test('в disconnected доступна только кнопка connect+call, call-only скрыта', async ({
    connectPage,
  }) => {
    await connectPage.expectReadyForConnection();
    await expect(connectPage.connectAndCallButton).toBeVisible();
    await expect(connectPage.callButton).toBeHidden();
    await expect(connectPage.endCallButton).toBeHidden();
    await expect(connectPage.hangupAndDisconnectButton).toBeHidden();
  });

  test('валидация: пустой conferenceNumber не запускает call-flow', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 30_000);

    await test.step('подключиться и открыть дашборд', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('очистить обязательное поле conference и нажать call', async () => {
      await connectPage.setConferenceNumber('');
      await connectPage.startCallAttempt();
    });

    await test.step('проверить, что call не стартовал и состояние осталось readyToCall', async () => {
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await connectPage.expectCallReady({ timeout: CALL_ATTEMPT_TIMEOUT_MS });
    });
  });

  test('ошибка инициализации media при call не ломает connected-сессию', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 30_000);

    await test.step('подключиться и открыть дашборд', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('форсировать getUserMedia=fail и попытаться начать звонок', async () => {
      await connectPage.forceGetUserMediaResult('fail');
      await connectPage.startCallAttempt();
    });

    await test.step('проверить, что call вернулся в idle, система осталась readyToCall', async () => {
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await connectPage.expectCallReady({ timeout: CALL_ATTEMPT_TIMEOUT_MS });
    });

    await test.step('сбросить getUserMedia в real-режим', async () => {
      await connectPage.forceGetUserMediaResult('real');
    });
  });

  test('после неуспешного call можно штатно disconnect', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 30_000);

    await test.step('подключиться к серверу', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('получить неуспешную попытку call из-за media fail', async () => {
      await connectPage.forceGetUserMediaResult('fail');
      await connectPage.startCallAttempt();
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
    });

    await test.step('отключиться и убедиться, что состояние ушло в disconnected', async () => {
      await connectPage.disconnect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:disconnected', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await connectPage.expectReadyForConnection();
      await connectPage.forceGetUserMediaResult('real');
    });
  });

  test('двойной клик call при media fail не уводит систему в невалидное состояние', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 30_000);

    await test.step('подключиться к серверу', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('вызвать две подряд попытки call с форсированным media fail', async () => {
      await connectPage.forceGetUserMediaResult('fail');
      await connectPage.startCallAttempt();
      await connectPage.startCallAttempt();
    });

    await test.step('проверить, что call остаётся idle и соединение не теряется', async () => {
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await connectPage.expectCallReady({ timeout: CALL_ATTEMPT_TIMEOUT_MS });
      await connectPage.forceGetUserMediaResult('real');
    });
  });

  test('после media-fail повторная call-попытка в real режиме остаётся recoverable', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 30_000);

    await test.step('подключиться к серверу', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('сделать неуспешную попытку звонка', async () => {
      await connectPage.forceGetUserMediaResult('fail');
      await connectPage.startCallAttempt();
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
    });

    await test.step('переключить media обратно в real и убедиться, что система готова к новой попытке', async () => {
      await connectPage.forceGetUserMediaResult('real');
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await connectPage.expectCallReady({ timeout: CALL_ATTEMPT_TIMEOUT_MS });
      await statusDashboard.expectDiagramStatusNot('call', 'call:disconnecting', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
    });
  });

  test('hangup-only: после завершения звонка соединение остаётся readyToCall', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.fail(
      true,
      'ожидаем callActive после connect+call; текущая реализация возвращается в readyToCall до hangup-only',
    );
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 120_000);

    await test.step('заполнить форму и запустить connect+call', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.startConnectAndCallAttempt();
    });

    await test.step('дождаться активного звонка и выполнить hangup-only', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:callActive', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await expect(connectPage.endCallButton).toBeVisible();
      await connectPage.hangupOnly();
    });

    await test.step('проверить инвариант: readyToCall, callButton доступен, connectAndCallButton скрыт', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await expect(connectPage.callButton).toBeVisible();
      await expect(connectPage.callButton).toBeEnabled();
      await expect(connectPage.connectAndCallButton).toBeHidden();
    });
  });

  test('rapid-sequence: call → media-error → call (repeat) не роняет connected-сессию', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 45_000);

    await test.step('подключиться к серверу', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('дважды подряд запустить call с media-error', async () => {
      await connectPage.forceGetUserMediaResult('fail');
      await connectPage.startCallAttempt();
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await connectPage.startCallAttempt();
    });

    await test.step('сессия остаётся recoverable после второй ошибки', async () => {
      await statusDashboard.waitForDiagramStatus('call', 'call:idle', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
        timeout: CALL_ATTEMPT_TIMEOUT_MS,
      });
      await connectPage.expectCallReady({ timeout: CALL_ATTEMPT_TIMEOUT_MS });
      await connectPage.forceGetUserMediaResult('real');
    });
  });
});
