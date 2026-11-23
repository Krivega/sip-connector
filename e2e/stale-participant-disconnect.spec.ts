import { connectionFormConfig } from './connection.config';
import { expect, test as base } from './fixtures';
import { ConnectPage } from './page-objects/ConnectPage';
import { DemoPage } from './page-objects/DemoPage';
import { installE2ENetworkControls } from './support/networkControls';
import { observeDisconnectEvents } from './support/observeDisconnectEvents';
import { installSelfDisconnectRoute } from './support/selfDisconnectRoute';
import { installE2ESilentCallControls } from './support/silentCallControls';
import { createSipFrameJournal } from './support/sipFrameJournal';
import { installE2EWebSocketControls } from './support/webSocketControls';

import type { Page, TestInfo } from '@playwright/test';
import type { StatusDashboard } from './page-objects/StatusDashboard';
import type { TSelfDisconnectRoute } from './support/selfDisconnectRoute';
import type { TSipFrameJournal } from './support/sipFrameJournal';

const SERVER_ADDRESS = connectionFormConfig.serverAddress;
const CONNECT_TIMEOUT_MS = 15_000;
const CALL_ACTIVE_TIMEOUT_MS = 30_000;
const TOKEN_TIMEOUT_MS = 5000;
const SELF_DISCONNECT_URL = `https://${SERVER_ADDRESS}/api/v2/participants/self/disconnect`;
const REMOVAL_INTERVAL_MS = 1000;
const REMOVAL_LIMIT_MS = 15_000;
const CALL_HOLD_MS = 5000;
const CALL_SETTLE_TIMEOUT_MS = 10_000;
/** Хвост служебных INFO сервера после его re-INVITE (лицензия, токен участника). */
const CALL_SETTLE_QUIET_MS = 1000;

type TFixtures = {
  sipFrames: TSipFrameJournal;
  selfDisconnect: TSelfDisconnectRoute;
};

type TTimelineEntry = { t: number; event: string };

const test = base.extend<TFixtures>({
  sipFrames: async ({ page }, use) => {
    await use(createSipFrameJournal(page));
  },
  selfDisconnect: async ({ page, sipFrames }, use) => {
    await use(await installSelfDisconnectRoute(page, sipFrames.startedAt));
  },
  // Как в общем фикстуре, но с глушением кадров выбранного Call-ID: без него сервер
  // получает 481 на запросы старого диалога и убирает прежнее подключение сам за доли секунды.
  connectPage: async ({ page, context }, use) => {
    await context.addInitScript(installE2ENetworkControls);
    await context.addInitScript(installE2EWebSocketControls);
    await context.addInitScript(installE2ESilentCallControls);
    await context.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.goto('/');
    await new DemoPage(page).waitForLoaderToBeHidden();

    const connectPage = new ConnectPage(page);

    await use(connectPage);
    // Зависший в call:connecting звонок без BYE оставит на dev ещё одно прежнее подключение для 777.
    await connectPage.hangUpEstablishedCall();
    await connectPage.disconnect({ timeout: CONNECT_TIMEOUT_MS });
  },
});

const isAcceptedDisconnectStatus = (status: number): boolean => {
  return status === 401 || (status >= 200 && status < 300);
};

const createTimeline = () => {
  const marks: TTimelineEntry[] = [];

  return {
    mark: (t: number, event: string) => {
      marks.push({ t, event });
    },
    build: ({
      sipFrames,
      selfDisconnect,
      oldCallId,
      breakT,
      newCallStartT,
    }: {
      sipFrames: TSipFrameJournal;
      selfDisconnect: TSelfDisconnectRoute;
      oldCallId?: string;
      breakT?: number;
      newCallStartT?: number;
    }): TTimelineEntry[] => {
      const newCallId =
        newCallStartT === undefined ? undefined : sipFrames.findSentInvite(newCallStartT)?.callId;
      const requests = selfDisconnect.requests().flatMap((request) => {
        return [
          { t: request.startedT, event: 'POST self/disconnect отправлен' },
          { t: request.finishedT, event: `POST self/disconnect → ${request.status}` },
        ];
      });
      const oldDialogFrames = sipFrames
        .byCallId(oldCallId)
        .filter((frame) => {
          return breakT !== undefined && frame.t >= breakT;
        })
        .map((frame) => {
          const cause = frame.headers['x-webrtc-hangup-cause'];

          return {
            t: frame.t,
            event: `старое подключение ${frame.direction === 'sent' ? '→' : '←'} ${frame.firstLine.replace(/ sip:\S+ SIP\/2\.0$/, '')}${cause === undefined ? '' : ` (${cause})`}`,
          };
        });
      const newCallFrames = sipFrames
        .byCallId(newCallId)
        .filter((frame) => {
          return (
            (frame.direction === 'sent' && frame.firstLine.startsWith('INVITE ')) ||
            (frame.direction === 'received' &&
              (frame.firstLine.startsWith('CANCEL ') ||
                (frame.firstLine.startsWith('SIP/2.0 ') && (frame.cseq ?? '').endsWith(' INVITE'))))
          );
        })
        .map((frame) => {
          return {
            t: frame.t,
            event: `${frame.direction === 'sent' ? '→' : '←'} ${frame.firstLine.replace(/ sip:\S+ SIP\/2\.0$/, '')}`,
          };
        });

      return [...marks, ...requests, ...oldDialogFrames, ...newCallFrames].sort((first, second) => {
        return first.t - second.t;
      });
    },
  };
};

/** Только первые строки и идентификаторы: заголовки SIP несут токены конференции. */
const attachSipFrames = async (testInfo: TestInfo, sipFrames: TSipFrameJournal) => {
  await testInfo.attach('sip-frames', {
    body: JSON.stringify(
      sipFrames.frames().map(({ t, direction, firstLine, callId, cseq }) => {
        return { t, direction, firstLine, callId, cseq };
      }),
      undefined,
      2,
    ),
    contentType: 'application/json',
  });
};

const attachTimeline = async (testInfo: TestInfo, timeline: TTimelineEntry[]) => {
  testInfo.annotations.push({
    type: 'timeline',
    description: timeline
      .map(({ t, event }) => {
        return `${t} мс ${event}`;
      })
      .join(' | '),
  });
  await testInfo.attach('stale-timeline', {
    body: JSON.stringify(timeline, undefined, 2),
    contentType: 'application/json',
  });
};

/** Первый звонок страницы: предыстории нет, POST self/disconnect не уходит. */
const startActiveCall = async ({
  page,
  connectPage,
  statusDashboard,
  sipFrames,
  selfDisconnect,
}: {
  page: Page;
  connectPage: ConnectPage;
  statusDashboard: StatusDashboard;
  sipFrames: TSipFrameJournal;
  selfDisconnect: TSelfDisconnectRoute;
}) => {
  await connectPage.fillForm(connectionFormConfig);
  await page.locator('#autoRedialEnabled').uncheck();
  await connectPage.connect({ timeout: CONNECT_TIMEOUT_MS });
  await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall', {
    timeout: CONNECT_TIMEOUT_MS,
  });

  const callStartT = sipFrames.now();

  await connectPage.startCallAttempt();
  await statusDashboard.waitForDiagramStatus('system', 'system:callActive', {
    timeout: CALL_ACTIVE_TIMEOUT_MS,
  });

  const callId = sipFrames.findSentInvite(callStartT)?.callId;

  expect(
    selfDisconnect.requests(),
    'первый звонок без предыстории отправил self/disconnect',
  ).toEqual([]);

  // Обрыв до ответа на re-INVITE сервера оставляет подключение, которое self/disconnect
  // с 204 не убирает (на dev его снимает только DTLS-FAILED через ~15 с). Ждём ACK сервера.
  await expect
    .poll(
      () => {
        return sipFrames.byCallId(callId).some((frame) => {
          return frame.direction === 'received' && frame.firstLine.startsWith('ACK ');
        });
      },
      {
        message: 'сервер не завершил re-INVITE после входа в комнату',
        timeout: CALL_SETTLE_TIMEOUT_MS,
      },
    )
    .toBe(true);
  await page.waitForTimeout(CALL_SETTLE_QUIET_MS);
  await expect
    .poll(
      async () => {
        return connectPage.getConferenceToken();
      },
      { message: 'dev не выдал токен конференции', timeout: TOKEN_TIMEOUT_MS },
    )
    .toBeDefined();

  return {
    oldToken: (await connectPage.getConferenceToken()) as string,
    oldCallId: callId,
  };
};

/** Ждёт входа в комнату; паттерн 200 OK → CANCEL от сервера объясняет причину провала. */
const waitForCallActive = async ({
  statusDashboard,
  sipFrames,
  newCallStartT,
}: {
  statusDashboard: StatusDashboard;
  sipFrames: TSipFrameJournal;
  newCallStartT: number;
}) => {
  try {
    await statusDashboard.waitForDiagramStatus('system', 'system:callActive', {
      timeout: CALL_ACTIVE_TIMEOUT_MS,
    });
  } catch (error) {
    const newCallId = sipFrames.findSentInvite(newCallStartT)?.callId;
    const isCancelledByServer = sipFrames.byCallId(newCallId).some((frame) => {
      return frame.direction === 'received' && frame.firstLine.startsWith('CANCEL ');
    });

    if (isCancelledByServer) {
      throw new Error(
        'Новый звонок попал на ещё не отключённое прежнее подключение: 200 OK → CANCEL, вход в комнату не пришёл',
        { cause: error },
      );
    }

    throw error;
  }
};

/**
 * Убирает подключение тем же API в обход приложения (page.request не идёт через route), повторяя
 * запрос раз в секунду, как продуктовый цикл: сервер иногда отвечает 204, не отключив.
 * Подключение убрано, когда сервер прислал BYE старому диалогу или ответил 401.
 */
const removeConnectionDirectly = async ({
  page,
  token,
  callId,
  sipFrames,
  timeline,
}: {
  page: Page;
  token: string;
  callId?: string;
  sipFrames: TSipFrameJournal;
  timeline: ReturnType<typeof createTimeline>;
}) => {
  const hasBye = () => {
    return sipFrames.byCallId(callId).some((frame) => {
      return frame.direction === 'received' && frame.firstLine.startsWith('BYE ');
    });
  };
  const startedAt = Date.now();
  const statuses: number[] = [];
  const isRemoved = () => {
    return hasBye() || statuses.at(-1) === 401;
  };

  for (
    let attempt = 0;
    attempt * REMOVAL_INTERVAL_MS < REMOVAL_LIMIT_MS && !isRemoved();
    attempt += 1
  ) {
    const waitMs = startedAt + attempt * REMOVAL_INTERVAL_MS - Date.now();

    if (waitMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(waitMs);
    }

    // eslint-disable-next-line no-await-in-loop
    const removal = await page.request.post(SELF_DISCONNECT_URL, {
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });
    const status = removal.status();

    statuses.push(status);
    timeline.mark(sipFrames.now(), `тест убирает подключение напрямую → ${status}`);
    expect(isAcceptedDisconnectStatus(status), `прямой self/disconnect вернул ${status}`).toBe(
      true,
    );
  }

  await expect
    .poll(isRemoved, {
      message: 'сервер не убрал подключение за 15 с повторов self/disconnect',
      timeout: REMOVAL_INTERVAL_MS,
    })
    .toBe(true);

  return { hasBye };
};

const waitForLocalCallEnd = async ({
  events,
  statusDashboard,
}: {
  events: Awaited<ReturnType<typeof observeDisconnectEvents>>;
  statusDashboard: StatusDashboard;
}) => {
  await expect
    .poll(async () => {
      return events.evaluate((observer) => {
        return observer.read().ended;
      });
    })
    .toContainEqual(expect.objectContaining({ originator: 'local', cause: 'RTP Timeout' }));
  await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
};

test.describe('Отключение прежнего подключения перед повторным звонком (dev)', () => {
  test.describe.configure({ mode: 'serial' });

  test('молчащее устаревшее подключение: POST self/disconnect повторяется до 401 до нового INVITE и вход в комнату', async ({
    page,
    connectPage,
    statusDashboard,
    sipFrames,
    selfDisconnect,
  }, testInfo) => {
    test.setTimeout(120_000);

    const events = await observeDisconnectEvents(page);
    const timeline = createTimeline();
    let oldCallId: string | undefined;
    let breakT: number | undefined;
    let newCallStartT: number | undefined;

    try {
      const call = await startActiveCall({
        page,
        connectPage,
        statusDashboard,
        sipFrames,
        selfDisconnect,
      });

      ({ oldCallId } = call);
      expect(oldCallId, 'Call-ID первого звонка не найден в журнале').toBeDefined();

      breakT = sipFrames.now();
      timeline.mark(breakT, 'ICE failed без BYE, старый Call-ID заглушён');
      await connectPage.breakCallWithoutBye({
        serverAddress: SERVER_ADDRESS,
        silenceCallId: oldCallId,
      });
      await waitForLocalCallEnd({ events, statusDashboard });
      timeline.mark(sipFrames.now(), 'звонок завершён локально (RTP Timeout)');

      newCallStartT = sipFrames.now();
      timeline.mark(newCallStartT, 'повторный звонок');
      await connectPage.startCallAttempt();
      await waitForCallActive({ statusDashboard, sipFrames, newCallStartT });
      timeline.mark(sipFrames.now(), 'system:callActive');

      const requests = selfDisconnect.requests();
      const newInvite = sipFrames.findSentInvite(newCallStartT);

      const lastRequest = requests.at(-1);

      expect(requests.length, 'self/disconnect не отправлен').toBeGreaterThan(0);
      expect(newInvite, 'новый INVITE не найден в журнале').toBeDefined();

      for (const request of requests) {
        expect(request.authorization).toBe(`Bearer ${call.oldToken}`);
        expect(request.hasBody).toBe(false);
      }

      for (const request of requests.slice(0, -1)) {
        expect(
          request.status >= 200 && request.status < 300,
          `до подтверждения ожидается 2xx, получен ${request.status}`,
        ).toBe(true);
      }

      expect(
        lastRequest?.status,
        `последний self/disconnect не 401${lastRequest?.error === undefined ? '' : `: ${lastRequest.error}`}`,
      ).toBe(401);
      expect(lastRequest?.finishedT ?? Number.POSITIVE_INFINITY).toBeLessThan(
        newInvite?.t ?? Number.NEGATIVE_INFINITY,
      );

      if (requests.length === 1) {
        testInfo.annotations.push({
          type: 'self-disconnect',
          description: 'первый ответ 401: прежнего подключения уже не было',
        });
      }

      const endsBeforeHold = await events.evaluate((observer) => {
        const { ended, failed } = observer.read();

        return ended.length + failed.length;
      });

      await page.waitForTimeout(CALL_HOLD_MS);
      await statusDashboard.waitForDiagramStatus('system', 'system:callActive', { timeout: 1000 });
      await expect
        .poll(async () => {
          return events.evaluate((observer) => {
            const { ended, failed } = observer.read();

            return ended.length + failed.length;
          });
        })
        .toBe(endsBeforeHold);
      await expect
        .poll(
          async () => {
            const token = await connectPage.getConferenceToken();

            return token !== undefined && token !== call.oldToken;
          },
          { message: 'новый токен конференции не пришёл', timeout: TOKEN_TIMEOUT_MS },
        )
        .toBe(true);
    } finally {
      await attachTimeline(
        testInfo,
        timeline.build({ sipFrames, selfDisconnect, oldCallId, breakT, newCallStartT }),
      );
      await attachSipFrames(testInfo, sipFrames);
      await events.evaluate((observer) => {
        observer.dispose();
      });
      await events.dispose();
    }
  });

  test('прежнее подключение уже убрано: POST self/disconnect → 401 и вход в комнату', async ({
    page,
    connectPage,
    statusDashboard,
    sipFrames,
    selfDisconnect,
  }, testInfo) => {
    test.setTimeout(120_000);

    const events = await observeDisconnectEvents(page);
    const timeline = createTimeline();
    let oldCallId: string | undefined;
    let breakT: number | undefined;
    let newCallStartT: number | undefined;

    try {
      const call = await startActiveCall({
        page,
        connectPage,
        statusDashboard,
        sipFrames,
        selfDisconnect,
      });

      ({ oldCallId } = call);
      breakT = sipFrames.now();
      timeline.mark(breakT, 'ICE failed без BYE');
      await connectPage.breakCallWithoutBye({ serverAddress: SERVER_ADDRESS });
      await waitForLocalCallEnd({ events, statusDashboard });

      // Сам сервер на dev убирает подключение только после 481 на свой запрос в старом диалоге,
      // а после завершённого re-INVITE запросов нет и за 25 с подключение не убирается.
      await removeConnectionDirectly({
        page,
        token: call.oldToken,
        callId: oldCallId,
        sipFrames,
        timeline,
      });

      newCallStartT = sipFrames.now();
      timeline.mark(newCallStartT, 'повторный звонок');
      await connectPage.startCallAttempt();
      await waitForCallActive({ statusDashboard, sipFrames, newCallStartT });
      timeline.mark(sipFrames.now(), 'system:callActive');

      const requests = selfDisconnect.requests();

      expect(requests, 'подключения уже нет: один self/disconnect с ответом 401').toHaveLength(1);
      expect(requests[0].authorization).toBe(`Bearer ${call.oldToken}`);
      expect(requests[0].status).toBe(401);
      expect(requests[0].finishedT).toBeLessThan(
        sipFrames.findSentInvite(newCallStartT)?.t ?? Number.NEGATIVE_INFINITY,
      );
    } finally {
      await attachTimeline(
        testInfo,
        timeline.build({ sipFrames, selfDisconnect, oldCallId, breakT, newCallStartT }),
      );
      await attachSipFrames(testInfo, sipFrames);
      await events.evaluate((observer) => {
        observer.dispose();
      });
      await events.dispose();
    }
  });

  test('ручной отбой: сервер ответил на BYE, звонок сразу после отбоя уходит без POST self/disconnect и входит в комнату', async ({
    page,
    connectPage,
    statusDashboard,
    sipFrames,
    selfDisconnect,
  }, testInfo) => {
    test.setTimeout(90_000);

    const events = await observeDisconnectEvents(page);
    const timeline = createTimeline();
    let oldCallId: string | undefined;
    let breakT: number | undefined;
    let newCallStartT: number | undefined;

    try {
      const call = await startActiveCall({
        page,
        connectPage,
        statusDashboard,
        sipFrames,
        selfDisconnect,
      });

      ({ oldCallId } = call);
      breakT = sipFrames.now();
      timeline.mark(breakT, 'ручной отбой');
      await connectPage.hangupOnly();
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');

      // Без ответа 2xx на BYE клиент считает подключение оставшимся: это предусловие сценария.
      await expect
        .poll(
          () => {
            return sipFrames.byCallId(oldCallId).some((frame) => {
              return (
                frame.direction === 'received' &&
                /^SIP\/2\.0 2\d\d /.test(frame.firstLine) &&
                (frame.cseq ?? '').endsWith(' BYE')
              );
            });
          },
          {
            message: 'сервер не подтвердил BYE ручного отбоя ответом 2xx',
            timeout: TOKEN_TIMEOUT_MS,
          },
        )
        .toBe(true);

      newCallStartT = sipFrames.now();
      timeline.mark(newCallStartT, 'повторный звонок');
      await connectPage.startCallAttempt();
      await waitForCallActive({ statusDashboard, sipFrames, newCallStartT });
      timeline.mark(sipFrames.now(), 'system:callActive');

      expect(
        selfDisconnect.requests(),
        'сервер ответил 2xx на BYE: self/disconnect не нужен',
      ).toEqual([]);
      expect(
        sipFrames.findSentInvite(newCallStartT),
        'новый INVITE не найден в журнале',
      ).toBeDefined();

      // Прежнее подключение не осталось на сервере: новый звонок держится и получает свой токен.
      const endsBeforeHold = await events.evaluate((observer) => {
        const { ended, failed } = observer.read();

        return ended.length + failed.length;
      });

      await page.waitForTimeout(CALL_HOLD_MS);
      await statusDashboard.waitForDiagramStatus('system', 'system:callActive', { timeout: 1000 });
      expect(
        await events.evaluate((observer) => {
          const { ended, failed } = observer.read();

          return ended.length + failed.length;
        }),
      ).toBe(endsBeforeHold);
      await expect
        .poll(
          async () => {
            const token = await connectPage.getConferenceToken();

            return token !== undefined && token !== call.oldToken;
          },
          { message: 'новый токен конференции не пришёл', timeout: TOKEN_TIMEOUT_MS },
        )
        .toBe(true);
    } finally {
      await attachTimeline(
        testInfo,
        timeline.build({ sipFrames, selfDisconnect, oldCallId, breakT, newCallStartT }),
      );
      await attachSipFrames(testInfo, sipFrames);
      await events.evaluate((observer) => {
        observer.dispose();
      });
      await events.dispose();
    }
  });

  test('звонок завершён сервером (BYE): следующий звонок уходит без POST self/disconnect', async ({
    page,
    connectPage,
    statusDashboard,
    sipFrames,
    selfDisconnect,
  }, testInfo) => {
    test.setTimeout(90_000);

    const events = await observeDisconnectEvents(page);
    const timeline = createTimeline();
    let oldCallId: string | undefined;
    let breakT: number | undefined;
    let newCallStartT: number | undefined;

    try {
      const call = await startActiveCall({
        page,
        connectPage,
        statusDashboard,
        sipFrames,
        selfDisconnect,
      });

      ({ oldCallId } = call);
      breakT = sipFrames.now();
      timeline.mark(breakT, 'тест просит сервер отключить участника живого звонка');

      // Звонок жив и отвечает серверу: сервер сам завершает его BYE, как при исключении из комнаты.
      const { hasBye } = await removeConnectionDirectly({
        page,
        token: call.oldToken,
        callId: oldCallId,
        sipFrames,
        timeline,
      });

      await expect
        .poll(hasBye, { message: 'сервер убрал подключение без BYE звонку', timeout: 5000 })
        .toBe(true);
      await expect
        .poll(async () => {
          return events.evaluate((observer) => {
            return observer.read().ended;
          });
        })
        .toContainEqual(expect.objectContaining({ originator: 'remote' }));
      await statusDashboard.waitForDiagramStatus('system', 'system:readyToCall');
      timeline.mark(sipFrames.now(), 'звонок завершён сервером');

      newCallStartT = sipFrames.now();
      timeline.mark(newCallStartT, 'повторный звонок');
      await connectPage.startCallAttempt();
      await waitForCallActive({ statusDashboard, sipFrames, newCallStartT });
      timeline.mark(sipFrames.now(), 'system:callActive');

      expect(
        selfDisconnect.requests(),
        'после завершения звонка сервером self/disconnect не нужен',
      ).toEqual([]);
      expect(
        sipFrames.findSentInvite(newCallStartT),
        'новый INVITE не найден в журнале',
      ).toBeDefined();
    } finally {
      await attachTimeline(
        testInfo,
        timeline.build({ sipFrames, selfDisconnect, oldCallId, breakT, newCallStartT }),
      );
      await attachSipFrames(testInfo, sipFrames);
      await events.evaluate((observer) => {
        observer.dispose();
      });
      await events.dispose();
    }
  });
});
