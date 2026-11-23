import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { createFakeSelfDisconnectServer } from './support/fakeSelfDisconnectServer';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { SIP_PEER_HOST, SIP_PEER_NUMBER, SipPeer } from './support/SipPeer';

import type { Page } from '@playwright/test';
import type { SipConnectorFacade } from '../src';
import type { StatusDashboard } from './page-objects/StatusDashboard';
import type {
  TFakeSelfDisconnectReply,
  TFakeSelfDisconnectRequest,
  TFakeSelfDisconnectServer,
} from './support/fakeSelfDisconnectServer';

const CONNECT_TIMEOUT_MS = 10_000;
const STALE_TOKEN = 'stale-participant-token';
const NEXT_TOKEN = 'next-participant-token';
const LAST_TOKEN = 'last-participant-token';
/** Пауза между запросами после ответа 2xx. */
const CONFIRM_INTERVAL_MS = 1000;
/** Запас на перехват запроса Playwright и планирование таймеров страницы. */
const CONFIRM_INTERVAL_TOLERANCE_MS = { early: 100, late: 1000 };
/** Предел ожидания 401 — 20 с от первого запроса; окно учитывает перехват и запуск INVITE. */
const CONFIRM_LIMIT_WINDOW_MS = { min: 19_000, max: 23_000 };
/** Запросов за предел при паузе 1 с после каждого 2xx: меньше — повторов нет, больше — пауза не соблюдается. */
const CONFIRM_LIMIT_REQUESTS = { min: 15, max: 21 };
/** Срок, дольше которого клиент не помнит прежнее подключение (60 с), с запасом в обе стороны. */
const BEFORE_STALE_TTL_SHIFT_MS = 55_000;
const AFTER_STALE_TTL_SHIFT_MS = 65_000;
/** За это время после снятия удержания INVITE уже ушёл бы. */
const NO_INVITE_WAIT_MS = 2000;

const PEER_FORM = {
  serverAddress: SIP_PEER_HOST,
  displayName: 'Test participant',
  conferenceNumber: SIP_PEER_NUMBER,
  userNumber: '100',
  password: 'test-password',
};

type TDemoApp = { sipConnectorFacade: SipConnectorFacade };

type TDisconnectEvents = Awaited<ReturnType<typeof observeDisconnectEvents>>;

type TOptions = {
  /** Поддельные часы страницы с начала загрузки: тест сдвигает `Date.now()` без ожидания. */
  isClockInstalled: boolean;
};

type TFixtures = {
  sipPeer: SipPeer;
  selfDisconnect: TFakeSelfDisconnectServer;
};

type TCallFixtures = {
  connectPage: ConnectPage;
  sipPeer: SipPeer;
  statusDashboard: StatusDashboard;
};

const test = base.extend<TOptions & TFixtures>({
  isClockInstalled: [false, { option: true }],
  sipPeer: async ({ page }, use) => {
    const peer = new SipPeer(page);

    await use(peer);
    await peer.dispose();
  },
  selfDisconnect: async ({ page }, use) => {
    await use(createFakeSelfDisconnectServer(page));
  },
  connectPage: async ({ page, sipPeer, selfDisconnect, isClockInstalled }, use) => {
    await sipPeer.install();
    await selfDisconnect.install();

    if (isClockInstalled) {
      await page.clock.install();
    }

    await page.goto('/');
    await new DemoPage(page).waitForLoaderToBeHidden();

    const connectPage = new ConnectPage(page);

    await use(connectPage);
    // Удержанный запрос иначе оставит звонок в ожидании, а лоадер демо — поверх кнопки отключения.
    selfDisconnect.release();
    await connectPage.disconnect({ timeout: CONNECT_TIMEOUT_MS });
  },
});

/** Кнопки демо во время звонка перекрыты лоадером: те же методы фасада вызываются напрямую. */
const hangUpThroughFacade = async (page: Page) => {
  await page.evaluate(async () => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

    if (app === undefined) {
      throw new Error('Демо коннектора не инициализировано');
    }

    await app.sipConnectorFacade.hangUp();
  });
};

const disconnectThroughFacade = async (page: Page) => {
  return page.evaluate(async () => {
    const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

    if (app === undefined) {
      throw new Error('Демо коннектора не инициализировано');
    }

    return app.sipConnectorFacade.disconnectFromServer();
  });
};

/** Исход звонка без отказа промиса: тест запускает звонок и проверяет ожидание до его завершения. */
const settleCall = async (call: Promise<unknown>): Promise<'resolved' | 'rejected'> => {
  try {
    await call;

    return 'resolved';
  } catch {
    return 'rejected';
  }
};

const startCallThroughFacade = async (page: Page) => {
  return settleCall(
    page.evaluate(async (conference) => {
      const app = Reflect.get(window, '__sipConnectorDemoApp') as TDemoApp | undefined;

      if (app === undefined) {
        throw new Error('Демо коннектора не инициализировано');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      await app.sipConnectorFacade.callToServer({
        conference,
        mediaStream,
        iceServers: [],
        autoRedial: false,
      });
    }, SIP_PEER_NUMBER),
  );
};

/** После 2xx следующий запрос уходит через паузу 1 с от ответа. */
const expectConfirmIntervals = (requests: TFakeSelfDisconnectRequest[]) => {
  for (let index = 1; index < requests.length; index += 1) {
    const previous = requests[index - 1];
    const intervalMs = requests[index].startedAt - (previous.answeredAt ?? Number.NaN);

    expect(intervalMs, `пауза перед запросом №${index + 1}`).toBeGreaterThanOrEqual(
      CONFIRM_INTERVAL_MS - CONFIRM_INTERVAL_TOLERANCE_MS.early,
    );
    expect(intervalMs, `пауза перед запросом №${index + 1}`).toBeLessThanOrEqual(
      CONFIRM_INTERVAL_MS + CONFIRM_INTERVAL_TOLERANCE_MS.late,
    );
  }
};

const expectStaleToken = (requests: TFakeSelfDisconnectRequest[], token: string) => {
  for (const request of requests) {
    expect(request).toMatchObject({ authorization: `Bearer ${token}`, hasBody: false });
  }
};

test.describe('Отключение прежнего подключения перед звонком (SipPeer)', () => {
  let events: TDisconnectEvents;

  const readEvents = async () => {
    return events.evaluate((observer) => {
      return observer.read();
    });
  };

  /** `confirmed` — ожидаемое число ответов на звонки с начала теста. */
  const enterRoom = async ({
    sipPeer,
    statusDashboard,
    confirmed,
    bearerToken,
  }: Omit<TCallFixtures, 'connectPage'> & { confirmed: number; bearerToken: string }) => {
    await expect.poll(readEvents).toMatchObject({ confirmed, isEstablished: true });
    await sipPeer.waitForMediaConnected();
    sipPeer.enterRoom({ bearerToken });
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  };

  const callAndEnterRoom = async ({
    connectPage,
    sipPeer,
    statusDashboard,
    bearerToken,
  }: TCallFixtures & { bearerToken: string }) => {
    const { confirmed } = await readEvents();

    await connectPage.startCallAttempt();
    await enterRoom({ sipPeer, statusDashboard, confirmed: confirmed + 1, bearerToken });
  };

  /** Ручной отбой, на BYE которого сервер не ответил: подключение могло остаться на сервере. */
  const hangUpWithoutByeAnswer = async ({
    connectPage,
    sipPeer,
    statusDashboard,
  }: TCallFixtures) => {
    const byeCount = sipPeer.countReceivedRequests('BYE');

    sipPeer.stopAnswering(['BYE']);
    await connectPage.hangupOnly();
    await expect
      .poll(() => {
        return sipPeer.countReceivedRequests('BYE');
      })
      .toBe(byeCount + 1);
    sipPeer.resumeAnswering(['BYE']);
    await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
  };

  /** Звонок с токеном комнаты и ручной отбой без ответа на BYE. */
  const leaveStaleParticipant = async (fixtures: TCallFixtures) => {
    await callAndEnterRoom({ ...fixtures, bearerToken: STALE_TOKEN });
    await hangUpWithoutByeAnswer(fixtures);
  };

  /** Лоадер демо висит до конца звонка: ждём не его, а запрос отключения и статус исходящего. */
  const startCallUntilSelfDisconnect = async ({
    connectPage,
    statusDashboard,
    selfDisconnect,
  }: Omit<TCallFixtures, 'sipPeer'> & { selfDisconnect: TFakeSelfDisconnectServer }) => {
    const requestsBefore = selfDisconnect.requests().length;

    await connectPage.callButton.click();
    await expect
      .poll(() => {
        return selfDisconnect.requests().length;
      })
      .toBeGreaterThan(requestsBefore);
    await statusDashboard.waitForDiagramStatus('call', 'call:connecting');
  };

  test.beforeEach(async ({ page, connectPage, statusDashboard }) => {
    events = await observeDisconnectEvents(page);
    await connectPage.fillForm(PEER_FORM);
    await page.locator('#autoRedialEnabled').uncheck();
    await connectPage.connect({ timeout: CONNECT_TIMEOUT_MS });
    await statusDashboard.waitForDiagramStatus('connection', 'connection:established', {
      timeout: CONNECT_TIMEOUT_MS,
    });
  });

  test.afterEach(async ({ selfDisconnect, sipPeer }, testInfo) => {
    await testInfo.attach('self-disconnect', {
      body: JSON.stringify(
        {
          requests: selfDisconnect.requests(),
          invitesReceivedAt: sipPeer.getReceivedRequestTimes('INVITE'),
        },
        undefined,
        2,
      ),
      contentType: 'application/json',
    });
    await events.evaluate((observer) => {
      observer.dispose();
    });
    await events.dispose();
  });

  test('первый звонок без предыстории уходит без POST self/disconnect', async ({
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    await callAndEnterRoom({
      connectPage,
      sipPeer,
      statusDashboard,
      bearerToken: STALE_TOKEN,
    });

    expect(selfDisconnect.requests()).toEqual([]);
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(1);
  });

  test('ручной отбой с ответом 200 на BYE: звонок сразу после отбоя уходит без POST self/disconnect', async ({
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    const fixtures = { connectPage, sipPeer, statusDashboard };

    await callAndEnterRoom({ ...fixtures, bearerToken: STALE_TOKEN });
    await connectPage.hangupOnly();
    await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
    await callAndEnterRoom({ ...fixtures, bearerToken: NEXT_TOKEN });

    expect(sipPeer.countReceivedRequests('BYE')).toBe(1);
    expect(selfDisconnect.requests()).toEqual([]);
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
  });

  test('ответ 200 на BYE прежнего звонка во время POST: повторы прекращаются без ошибки, INVITE уходит без 401', async ({
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    await leaveStaleParticipant({ connectPage, sipPeer, statusDashboard });
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });

    expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE ушёл до ответа на BYE').toBe(1);

    // Ответ на POST удержан: INVITE может уйти только после остановки повторов ответом на BYE.
    sipPeer.answerLastRequest('BYE');
    await enterRoom({ sipPeer, statusDashboard, confirmed: 2, bearerToken: NEXT_TOKEN });

    expect(selfDisconnect.requests(), 'POST после ответа на BYE').toHaveLength(1);
    expectStaleToken(selfDisconnect.requests(), STALE_TOKEN);
    expect(await readEvents()).toMatchObject({ failed: [] });
  });

  test('ответ 500 на BYE ручного отбоя не снимает прежнее подключение: INVITE ждёт 401 на POST', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    await leaveStaleParticipant({ connectPage, sipPeer, statusDashboard });
    sipPeer.answerLastRequest('BYE', '500 Server Internal Error');
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });
    await page.waitForTimeout(NO_INVITE_WAIT_MS);

    // Ответ на POST удержан: ушедший INVITE значил бы, что ошибку на BYE приняли за снятие подключения.
    expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE ушёл до ответа на POST').toBe(1);

    selfDisconnect.release();
    await enterRoom({ sipPeer, statusDashboard, confirmed: 2, bearerToken: NEXT_TOKEN });

    const requests = selfDisconnect.requests();

    expect(requests).toHaveLength(1);
    expect(requests[0].reply).toBe(401);
    expectStaleToken(requests, STALE_TOKEN);
    expect(await readEvents()).toMatchObject({ failed: [] });
  });

  test('после ручного отбоя без ответа на BYE POST повторяется после 2xx до 401 с токеном прежнего звонка, INVITE уходит после 401', async ({
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    test.setTimeout(60_000);

    const fixtures = { connectPage, sipPeer, statusDashboard };

    await leaveStaleParticipant(fixtures);
    selfDisconnect.setReplies([204, 204, 401]);
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });

    expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE ушёл до ответа на POST').toBe(1);

    selfDisconnect.release();
    await enterRoom({ sipPeer, statusDashboard, confirmed: 2, bearerToken: NEXT_TOKEN });

    const requests = selfDisconnect.requests();
    const invitesReceivedAt = sipPeer.getReceivedRequestTimes('INVITE');

    expect(
      requests.map(({ reply }) => {
        return reply;
      }),
    ).toEqual([204, 204, 401]);
    expectStaleToken(requests, STALE_TOKEN);
    expectConfirmIntervals(requests);
    expect(invitesReceivedAt).toHaveLength(2);
    expect(invitesReceivedAt[1], 'INVITE ушёл до запроса, получившего 401').toBeGreaterThan(
      requests[2].startedAt,
    );
    expect(await readEvents()).toMatchObject({ failed: [] });

    // Вход второго звонка заменил прежнее подключение: следующий POST идёт уже с его токеном.
    await hangUpWithoutByeAnswer(fixtures);
    await callAndEnterRoom({ ...fixtures, bearerToken: LAST_TOKEN });

    const nextRequests = selfDisconnect.requests().slice(requests.length);

    expect(nextRequests).toHaveLength(1);
    expect(nextRequests[0].reply).toBe(401);
    expectStaleToken(nextRequests, NEXT_TOKEN);
  });

  test('звонок завершён сервером (BYE): следующий звонок уходит без POST self/disconnect', async ({
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    const fixtures = { connectPage, sipPeer, statusDashboard };

    await callAndEnterRoom({ ...fixtures, bearerToken: STALE_TOKEN });
    await sipPeer.bye();
    await expect.poll(readEvents).toMatchObject({ ended: [{ originator: 'remote' }] });
    await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');

    await callAndEnterRoom({ ...fixtures, bearerToken: NEXT_TOKEN });

    expect(selfDisconnect.requests()).toEqual([]);
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
  });

  test('отбой во время POST: INVITE нет, call:failed Canceled, call:idle; следующий звонок снова отключает прежнее подключение', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    test.setTimeout(60_000);

    const fixtures = { connectPage, sipPeer, statusDashboard };

    await leaveStaleParticipant(fixtures);
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });
    await hangUpThroughFacade(page);

    await expect
      .poll(readEvents)
      .toMatchObject({ failed: [{ originator: 'local', cause: 'Canceled' }] });
    await statusDashboard.waitForDiagramStatus('call', 'call:idle');
    await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');

    selfDisconnect.release();
    await page.waitForTimeout(NO_INVITE_WAIT_MS);

    expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE после отбоя').toBe(1);
    expect(await readEvents()).toMatchObject({ failed: [{ cause: 'Canceled' }] });

    await callAndEnterRoom({ ...fixtures, bearerToken: NEXT_TOKEN });

    const requests = selfDisconnect.requests();

    expect(
      requests,
      'после отбоя ожидания прежнее подключение должно остаться запомненным',
    ).toHaveLength(2);
    expect(requests[1].reply).toBe(401);
    expectStaleToken(requests, STALE_TOKEN);
    expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
  });

  test('disconnect() во время POST: INVITE нет, call:failed Canceled, call:idle', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    await leaveStaleParticipant({ connectPage, sipPeer, statusDashboard });
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });

    expect(await disconnectThroughFacade(page)).toEqual({ isSuccessful: true });
    await expect
      .poll(readEvents)
      .toMatchObject({ failed: [{ originator: 'local', cause: 'Canceled' }] });
    await statusDashboard.waitForDiagramStatus('call', 'call:idle');

    selfDisconnect.release();
    await page.waitForTimeout(NO_INVITE_WAIT_MS);

    expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE после disconnect()').toBe(1);
    expect(await readEvents()).toMatchObject({ failed: [{ cause: 'Canceled' }] });
  });

  test('новый звонок во время POST тихо заменяет прежний: один INVITE после 401 и вход в комнату', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    await leaveStaleParticipant({ connectPage, sipPeer, statusDashboard });
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });

    const replacingCall = startCallThroughFacade(page);

    // Новый звонок тоже отключает прежнее подключение: иначе INVITE застал бы его на сервере.
    await expect
      .poll(() => {
        return selfDisconnect.requests().length;
      })
      .toBe(2);
    expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE ушёл до ответа на POST').toBe(1);

    selfDisconnect.release();
    await enterRoom({ sipPeer, statusDashboard, confirmed: 2, bearerToken: NEXT_TOKEN });

    expect(await replacingCall).toBe('resolved');

    await page.waitForTimeout(NO_INVITE_WAIT_MS);

    const requests = selfDisconnect.requests();

    expect(sipPeer.countReceivedRequests('INVITE'), 'заменённый звонок отправил INVITE').toBe(2);
    expect(
      sipPeer.getReceivedRequestTimes('INVITE')[1],
      'INVITE ушёл до запроса нового звонка',
    ).toBeGreaterThan(requests[1].startedAt);
    expectStaleToken(requests, STALE_TOKEN);
    expect(await readEvents()).toMatchObject({ failed: [] });
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  const failedDisconnectCases: { title: string; replies: TFakeSelfDisconnectReply[] }[] = [
    { title: 'ответ 500', replies: [500] },
    { title: 'ответ 500 после 204', replies: [204, 500] },
    { title: 'сетевой отказ', replies: ['network-error'] },
  ];

  for (const { title, replies } of failedDisconnectCases) {
    test(`${title} на POST: INVITE нет, call:failed Internal Error; следующий звонок без POST`, async ({
      connectPage,
      sipPeer,
      statusDashboard,
      selfDisconnect,
    }) => {
      test.setTimeout(60_000);

      const fixtures = { connectPage, sipPeer, statusDashboard };

      await leaveStaleParticipant(fixtures);
      selfDisconnect.setReplies(replies);
      await connectPage.callButton.click();

      await expect
        .poll(readEvents)
        .toMatchObject({ failed: [{ originator: 'local', cause: 'Internal Error' }] });
      await statusDashboard.waitForDiagramStatus('call', 'call:idle');
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');

      expect(sipPeer.countReceivedRequests('INVITE'), 'INVITE после отказа отключения').toBe(1);
      expect(
        selfDisconnect.requests().map(({ reply }) => {
          return reply;
        }),
      ).toEqual(replies);

      await callAndEnterRoom({ ...fixtures, bearerToken: NEXT_TOKEN });

      expect(selfDisconnect.requests(), 'после отказа прежнее подключение забыто').toHaveLength(
        replies.length,
      );
      expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
    });
  }

  const unconfirmedDisconnectCases: { title: string; fallback: TFakeSelfDisconnectReply }[] = [
    { title: 'зависший POST', fallback: 'hang' },
    { title: 'ответы 2xx без 401', fallback: 204 },
  ];

  for (const { title, fallback } of unconfirmedDisconnectCases) {
    test(`${title}: звонок ждёт в call:connecting и уходит через 20 с после первого POST`, async ({
      connectPage,
      sipPeer,
      statusDashboard,
      selfDisconnect,
    }) => {
      test.setTimeout(90_000);

      await leaveStaleParticipant({ connectPage, sipPeer, statusDashboard });
      selfDisconnect.setReplies([], fallback);
      await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });

      const [firstRequest] = selfDisconnect.requests();

      await expect
        .poll(
          () => {
            return sipPeer.countReceivedRequests('INVITE');
          },
          { timeout: CONFIRM_LIMIT_WINDOW_MS.max },
        )
        .toBe(2);

      const waitedMs = sipPeer.getReceivedRequestTimes('INVITE')[1] - firstRequest.startedAt;

      expect(waitedMs, 'INVITE раньше предела ожидания').toBeGreaterThanOrEqual(
        CONFIRM_LIMIT_WINDOW_MS.min,
      );
      expect(waitedMs, 'INVITE позже предела ожидания').toBeLessThanOrEqual(
        CONFIRM_LIMIT_WINDOW_MS.max,
      );
      expect(await readEvents()).toMatchObject({ failed: [] });

      await enterRoom({ sipPeer, statusDashboard, confirmed: 2, bearerToken: NEXT_TOKEN });

      const requests = selfDisconnect.requests();

      expectStaleToken(requests, STALE_TOKEN);

      if (fallback !== 'hang') {
        expect(requests.length).toBeGreaterThanOrEqual(CONFIRM_LIMIT_REQUESTS.min);
        expect(requests.length).toBeLessThanOrEqual(CONFIRM_LIMIT_REQUESTS.max);
        expectConfirmIntervals(
          requests.filter(({ answeredAt }) => {
            return answeredAt !== undefined;
          }),
        );
      }
    });
  }

  test('ответ на входящий во время POST тихо отменяет исходящий: его INVITE нет, ответ проходит, автоперезвон разоружён', async ({
    page,
    connectPage,
    sipPeer,
    statusDashboard,
    selfDisconnect,
  }) => {
    test.setTimeout(60_000);

    await leaveStaleParticipant({ connectPage, sipPeer, statusDashboard });
    await page.locator('#autoRedialEnabled').check();
    selfDisconnect.hold();
    await startCallUntilSelfDisconnect({ connectPage, statusDashboard, selfDisconnect });
    await statusDashboard.waitForDiagramStatus('callReconnect', 'armed');

    await sipPeer.invite();
    await statusDashboard.waitForDiagramStatus('incoming', 'incoming:ringing');

    const isAnswered = await events.evaluate(async (observer) => {
      return observer.answer();
    });

    expect(isAnswered).toBe(true);
    await enterRoom({ sipPeer, statusDashboard, confirmed: 2, bearerToken: NEXT_TOKEN });

    selfDisconnect.release();
    await page.waitForTimeout(NO_INVITE_WAIT_MS);

    expect(sipPeer.countReceivedRequests('INVITE'), 'отменённый исходящий отправил INVITE').toBe(1);
    expect(await readEvents()).toMatchObject({
      ended: [{ originator: 'local' }],
      failed: [],
      ringing: 1,
      isEstablished: true,
    });
    await statusDashboard.waitForDiagramStatus('callReconnect', 'idle');
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive');
  });

  test.describe('срок 60 с после завершения звонка', () => {
    test.use({ isClockInstalled: true });

    const ttlCases = [
      { title: 'до истечения срока POST уходит', shiftMs: BEFORE_STALE_TTL_SHIFT_MS, posts: 1 },
      { title: 'после истечения срока POST нет', shiftMs: AFTER_STALE_TTL_SHIFT_MS, posts: 0 },
    ];

    for (const { title, shiftMs, posts } of ttlCases) {
      test(`${title} (часы страницы сдвинуты на ${shiftMs / 1000} с)`, async ({
        page,
        connectPage,
        sipPeer,
        statusDashboard,
        selfDisconnect,
      }) => {
        const fixtures = { connectPage, sipPeer, statusDashboard };

        await leaveStaleParticipant(fixtures);

        const pageNow = await page.evaluate(() => {
          return Date.now();
        });

        // Сдвиг без срабатывания таймеров: JsSIP и ping не замечают прошедших секунд.
        await page.clock.setSystemTime(pageNow + shiftMs);
        await callAndEnterRoom({ ...fixtures, bearerToken: NEXT_TOKEN });

        expect(selfDisconnect.requests()).toHaveLength(posts);
        expect(sipPeer.countReceivedRequests('INVITE')).toBe(2);
      });
    }
  });
});
