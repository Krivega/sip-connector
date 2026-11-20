import { SELF_DISCONNECT_URL_PATTERN } from './selfDisconnectRoute';

import type { Page } from '@playwright/test';

/** HTTP-статус ответа; `network-error` — обрыв запроса; `hang` — без ответа до `release()`. */
export type TFakeSelfDisconnectReply = number | 'network-error' | 'hang';

export type TFakeSelfDisconnectRequest = {
  /** `Date.now()` перехвата запроса. */
  startedAt: number;
  /** `Date.now()` отдачи ответа странице; нет — ответ не отдан или страница уже отменила запрос. */
  answeredAt?: number;
  authorization?: string;
  hasBody: boolean;
  reply: TFakeSelfDisconnectReply;
};

/** Ответ сервера, когда участника на нём нет. */
const NOT_PARTICIPATING_STATUS = 401;

const ignoreClosedRoute = () => {};

/**
 * Сервер `POST /api/v2/participants/self/disconnect` для тестов с `SipPeer`: отвечает по сценарию
 * и записывает запросы. Без сценария отвечает 401. `install()` вызывать после `SipPeer.install()`:
 * Playwright проверяет позже добавленный route первым, иначе запрос оборвёт общий route `SipPeer`.
 */
export const createFakeSelfDisconnectServer = (page: Page) => {
  const requests: TFakeSelfDisconnectRequest[] = [];
  const replies: TFakeSelfDisconnectReply[] = [];
  const waiters = new Set<() => void>();
  let fallbackReply: TFakeSelfDisconnectReply = NOT_PARTICIPATING_STATUS;
  let isHeld = false;

  const waitForRelease = async () => {
    return new Promise<void>((resolve) => {
      waiters.add(resolve);
    });
  };

  return {
    install: async () => {
      await page.route(SELF_DISCONNECT_URL_PATTERN, async (route) => {
        const request = route.request();
        const allowOrigin = (await request.headerValue('origin')) ?? '*';

        // Chromium под Playwright отвечает на preflight сам; ветка страхует другой движок.
        if (request.method() === 'OPTIONS') {
          await route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': allowOrigin,
              'access-control-allow-methods': 'POST, OPTIONS',
              'access-control-allow-headers': 'Authorization, Content-Type',
            },
          });

          return;
        }

        const record: TFakeSelfDisconnectRequest = {
          startedAt: Date.now(),
          authorization: request.headers().authorization,
          hasBody: (request.postDataBuffer()?.length ?? 0) > 0,
          reply: replies.shift() ?? fallbackReply,
        };

        requests.push(record);

        if (isHeld) {
          await waitForRelease();
        }

        if (record.reply === 'hang') {
          await waitForRelease();
          await route.abort('timedout').catch(ignoreClosedRoute);

          return;
        }

        // Страница могла уже отменить запрос: тогда отдать ответ некому, `answeredAt` не ставится.
        const answer =
          record.reply === 'network-error'
            ? route.abort('failed')
            : route.fulfill({
                status: record.reply,
                headers: { 'access-control-allow-origin': allowOrigin },
                body: '',
              });

        await answer.then(() => {
          record.answeredAt = Date.now();
        }, ignoreClosedRoute);
      });
    },
    /** Ответы следующим запросам по порядку, после них — `fallback`. */
    setReplies: (
      nextReplies: TFakeSelfDisconnectReply[],
      fallback: TFakeSelfDisconnectReply = NOT_PARTICIPATING_STATUS,
    ) => {
      replies.splice(0, replies.length, ...nextReplies);
      fallbackReply = fallback;
    },
    /** Задерживает ответы следующим запросам до `release()`: видно состояние звонка во время отключения. */
    hold: () => {
      isHeld = true;
    },
    /** Снимает удержание и отпускает зависшие запросы. */
    release: () => {
      isHeld = false;
      waiters.forEach((resolve) => {
        resolve();
      });
      waiters.clear();
    },
    requests: (): TFakeSelfDisconnectRequest[] => {
      return requests.map((request) => {
        return { ...request };
      });
    },
  };
};

export type TFakeSelfDisconnectServer = ReturnType<typeof createFakeSelfDisconnectServer>;
