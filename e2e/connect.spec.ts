import { connectionFormConfig } from './connection.config';
import { test, expect } from './fixtures';

import type { TExpectedDashboardState, TStatusNodeTitle } from './page-objects/StatusDashboard';

/** Подключение к реальному хосту + получение server parameters; нужен доступ к серверу по сети. */
const CONNECT_OK_TIMEOUT_MS = 10_000;
const CONNECT_AUTH_ERROR_TIMEOUT_MS = 10_000;
const NETWORK_INTERFACE_CHANGE_TIMEOUT_MS = 10_000;
const WRONG_PASSWORD_CONFIG = {
  ...connectionFormConfig,
  password: 'wrong-password',
};

const IPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

// ---------------------------------------------------------------------------
// Декларативное описание ожидаемого состояния после успешного подключения
// ---------------------------------------------------------------------------

const EXPECTED_CONNECTED_STATE: TExpectedDashboardState = {
  diagrams: {
    connection: 'connection:established',
    autoConnectorManager: 'connectedMonitoring',
    callReconnect: 'idle',
    call: 'call:idle',
    incoming: 'incoming:idle',
    presentation: 'presentation:idle',
    system: 'system:readyToCall',
  },
  nodes: {
    Connection: {
      state: 'connection:established',
      fields: {
        'connection config:': '-',
      },
    },
    'Auto Connector': {
      state: 'connectedMonitoring',
      fields: {
        'after disconnect:': 'attempt',
        'stop reason:': '-',
        'last error:': '-',
      },
      jsonFields: {
        'parameters:': 'getParameters',
      },
    },
    'Call Reconnect': {
      state: 'idle',
      fields: {
        'attempt:': '0',
        'next delay ms:': '0',
        'last failure cause:': '-',
        'last error:': '-',
        'cancelled reason:': '-',
        'parameters:': '-',
      },
    },
    Call: {
      state: 'idle',
      fields: {
        'has pending disconnect:': '-',
        'number:': '-',
        'is answered:': '-',
        'extra headers:': '-',
        'is confirmed:': '-',
        'room:': '-',
        'participant name:': '-',
        'is direct p2 p:': '-',
        'token:': '-',
        'conference for token:': '-',
        'started timestamp:': '-',
      },
    },
    'Call Session': {
      fields: {
        'license:': 'VIDEO',
        'role type:': 'participant',
        'role audio id:': '-',
        'is spectator any:': 'false',
        'is recv session expected:': 'false',
        'is duplex sending media mode:': 'false',
        'is available sending media:': 'true',
      },
    },
    Incoming: {
      state: 'incoming:idle',
      fields: {
        'remote caller data:': '-',
        'terminal reason:': '-',
      },
    },
    Presentation: {
      state: 'presentation:idle',
      fields: {
        'last error:': '-',
      },
    },
    System: {
      state: 'system:readyToCall',
    },
  },
};

// ---------------------------------------------------------------------------
// Дополнительные проверки connectionConfiguration из JSON-полей
// ---------------------------------------------------------------------------

type TConnectionConfig = {
  sipServerUrl: unknown;
  displayName: unknown;
  user: unknown;
  authorizationUser: unknown;
  password: unknown;
  register: unknown;
  iceServers: unknown;
  sipServerIp: unknown;
  remoteAddress: unknown;
};

type TContextJson = {
  connectionConfiguration?: TConnectionConfig;
};

function isConnectionConfig(value: unknown): value is TConnectionConfig {
  return typeof value === 'object' && value !== null && 'sipServerUrl' in value;
}

function expectStunUrl(urls: unknown, serverAddress: string) {
  const expected = `stun:${serverAddress}:3478`;

  if (Array.isArray(urls)) {
    expect(urls[0]).toBe(expected);
  } else if (typeof urls === 'string') {
    expect(urls).toBe(expected);
  } else {
    throw new TypeError(`Unexpected ice urls: ${String(urls)}`);
  }
}

function normalizeSipDisplayName(value: string) {
  return value.trim().replaceAll(/\s+/g, '_');
}

type TNodeReader = {
  getNodeFieldJson: (nodeTitle: TStatusNodeTitle, fieldLabel: RegExp) => Promise<unknown>;
};

async function expectConnectionConfig(statusDashboard: TNodeReader) {
  const contextJson = (await statusDashboard.getNodeFieldJson(
    'Connection',
    /context:/i,
  )) as TContextJson;

  const { connectionConfiguration: cfg } = contextJson;

  expect(cfg, 'connectionConfiguration присутствует в context').toBeDefined();

  if (!isConnectionConfig(cfg)) {
    throw new TypeError('connectionConfiguration имеет неверный формат');
  }

  const c = connectionFormConfig;

  expect(cfg.sipServerUrl).toBe(c.serverAddress);
  expect(typeof cfg.displayName).toBe('string');
  expect(cfg.displayName as string).toBe(normalizeSipDisplayName(c.displayName));
  expect(cfg.user).toBe(c.userNumber);
  expect(cfg.authorizationUser).toBe(c.userNumber);
  expect(cfg.password).toBe(c.password);
  expect(cfg.register).toBe(true);

  const iceServers = cfg.iceServers as { urls?: string | string[] }[];
  const firstIceServer = iceServers[0];

  expectStunUrl(firstIceServer.urls, c.serverAddress);

  expect(typeof cfg.sipServerIp).toBe('string');
  expect(typeof cfg.remoteAddress).toBe('string');
  expect(cfg.sipServerIp as string).toMatch(IPv4);
  expect(cfg.remoteAddress as string).toMatch(IPv4);
}

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------

test.describe('Подключение (connectButton)', () => {
  test.describe.configure({ mode: 'serial' });
  test.afterEach(async ({ connectPage }) => {
    await connectPage.disconnect({ timeout: CONNECT_OK_TIMEOUT_MS });
  });

  test('успешное подключение: смена connect → disconnect', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('заполнить форму и подключиться', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
    });

    await test.step('открыть дашборд статусов', async () => {
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established');
      await statusDashboard.open();
    });

    await test.step('проверить состояние всех машин состояний', async () => {
      await statusDashboard.expectState(EXPECTED_CONNECTED_STATE);
    });

    await test.step('проверить connectionConfiguration в JSON', async () => {
      await expectConnectionConfig(statusDashboard);
    });
  });

  test('ручное отключение после connect возвращает в disconnected', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('подключиться к серверу', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      await statusDashboard.open();
    });

    await test.step('вручную отключиться от сервера', async () => {
      await connectPage.disconnect({ timeout: CONNECT_OK_TIMEOUT_MS });
    });

    await test.step('проверить переход в disconnected и готовность к повторному connect', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:disconnected', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.expectState({
        diagrams: {
          system: 'system:disconnected',
          autoConnectorManager: 'idle',
        },
        nodes: {
          System: {
            state: 'system:disconnected',
          },
          'Auto Connector': {
            state: 'idle',
          },
        },
      });
      await connectPage.expectReadyForConnection();
    });
  });

  test('после connect доступна кнопка call-only, а connect+call скрыта', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('подключиться к серверу', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
    });

    await test.step('проверить переключение кнопок действий', async () => {
      await expect(connectPage.callButton).toBeVisible();
      await expect(connectPage.connectAndCallButton).toBeHidden();
      await expect(connectPage.endCallButton).toBeHidden();
      await expect(connectPage.hangupAndDisconnectButton).toBeHidden();
    });
  });

  test('двойной клик connect не должен ломать авто-коннектор', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('заполнить форму и быстро нажать connect дважды', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.startConnectionAttemptTwiceFast();
    });

    await test.step('ожидать штатного выхода в connectedMonitoring', async () => {
      await connectPage.expectConnected({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.open();
      await statusDashboard.expectDiagramStatusNot('autoConnectorManager', 'errorTerminal', {
        timeout: NETWORK_INTERFACE_CHANGE_TIMEOUT_MS,
      });
    });
  });

  test('rapid-sequence: connect → disconnect → connect сохраняет корректные состояния', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 60_000);

    await test.step('первый connect', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
    });

    await test.step('быстрый disconnect', async () => {
      await connectPage.disconnect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:disconnected', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
    });

    await test.step('повторный connect', async () => {
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await connectPage.expectConnected({ timeout: CONNECT_OK_TIMEOUT_MS });
    });
  });

  test('смена интерфейса (network-change) + ping OK: reconnect НЕ происходит', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('авторизоваться на доступном сервере через первый интерфейс', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
    });

    await test.step('открыть дашборд и дождаться успешного мониторинга', async () => {
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring');
      await statusDashboard.open();
    });

    await test.step('сымитировать смену сетевого интерфейса при доступном сервере', async () => {
      await connectPage.forcePingProbeResult('ok');
      await connectPage.simulateNetworkInterfaceChange();
    });

    await test.step('проверить, что реконнект не запускается', async () => {
      await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
        timeout: NETWORK_INTERFACE_CHANGE_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring', {
        timeout: NETWORK_INTERFACE_CHANGE_TIMEOUT_MS,
      });
      await statusDashboard.expectState({
        diagrams: {
          connection: 'connection:established',
          autoConnectorManager: 'connectedMonitoring',
          system: 'system:readyToCall',
        },
        nodes: {
          Connection: {
            state: 'connection:established',
          },
          'Auto Connector': {
            state: 'connectedMonitoring',
          },
          System: {
            state: 'system:readyToCall',
          },
        },
      });
    });

    await test.step('сбросить принудительный результат ping в real-режим', async () => {
      await connectPage.forcePingProbeResult('real');
    });
  });

  test('смена интерфейса (network-change) + ping FAIL: reconnect происходит', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('авторизоваться на сервере и дождаться connected monitoring', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring');
      await statusDashboard.open();
    });

    await test.step('сымитировать смену сети и недоступность сервера для ping', async () => {
      await connectPage.forcePingProbeResult('fail');
      await connectPage.simulateNetworkInterfaceChange();
    });

    await test.step('проверить, что автоконнект перешёл в reconnect-флоу', async () => {
      await statusDashboard.waitForDiagramStatus('system', 'system:disconnecting', {
        timeout: NETWORK_INTERFACE_CHANGE_TIMEOUT_MS,
      });
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
        timeout: CONNECT_OK_TIMEOUT_MS,
      });
      await statusDashboard.expectState({
        diagrams: {
          autoConnectorManager: 'connectedMonitoring',
          system: 'system:readyToCall',
        },
        nodes: {
          'Auto Connector': {
            state: 'connectedMonitoring',
          },
          System: {
            state: 'system:readyToCall',
          },
        },
      });
    });

    await test.step('сбросить принудительный результат ping в real-режим', async () => {
      await connectPage.forcePingProbeResult('real');
    });
  });

  test('регрессия: при ping FAIL должен наблюдаться waitingBeforeRetry перед восстановлением', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.fail(
      true,
      'ожидаем увидеть явный retry-cycle у autoConnectorManager, а не мгновенный восстановленный readyToCall',
    );
    test.setTimeout(CONNECT_OK_TIMEOUT_MS + 10_000);

    await test.step('подключиться и открыть дашборд', async () => {
      await connectPage.fillForm(connectionFormConfig);
      await connectPage.connect({ timeout: CONNECT_OK_TIMEOUT_MS });
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'connectedMonitoring');
      await statusDashboard.open();
    });

    await test.step('спровоцировать network-change с ping FAIL', async () => {
      await connectPage.forcePingProbeResult('fail');
      await connectPage.simulateNetworkInterfaceChange();
    });

    await test.step('ожидать переход в waitingBeforeRetry', async () => {
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'waitingBeforeRetry', {
        timeout: NETWORK_INTERFACE_CHANGE_TIMEOUT_MS,
      });
    });

    await test.step('сбросить ping-override', async () => {
      await connectPage.forcePingProbeResult('real');
    });
  });

  test('неверный пароль: авто-соединение останавливается без retry-цикла', async ({
    connectPage,
    statusDashboard,
  }) => {
    test.setTimeout(CONNECT_AUTH_ERROR_TIMEOUT_MS + 15_000);

    await test.step('заполнить форму с неверным паролем и начать подключение', async () => {
      await connectPage.fillForm(WRONG_PASSWORD_CONFIG);
      await connectPage.startConnectionAttempt();
    });

    await test.step('проверить, что автоконнектор остановился на терминальной ошибке', async () => {
      await statusDashboard.waitForDiagramStatus('autoConnectorManager', 'errorTerminal', {
        timeout: CONNECT_AUTH_ERROR_TIMEOUT_MS,
      });
      await statusDashboard.open();
      await statusDashboard.expectState({
        diagrams: {
          connection: 'connection:idle',
          autoConnectorManager: 'errorTerminal',
          system: 'system:disconnected',
        },
        nodes: {
          'Auto Connector': {
            state: 'errorTerminal',
            fields: {
              'stop reason:': 'halted',
            },
          },
          System: {
            state: 'system:disconnected',
          },
        },
      });
    });

    await test.step('проверить, что UI снова готов к ручному подключению', async () => {
      await connectPage.expectReadyForConnection();
    });
  });
});
