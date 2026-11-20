import type { APIResponse, Page, Route } from '@playwright/test';

export const SELF_DISCONNECT_URL_PATTERN = '**/api/v2/participants/self/disconnect';

export type TSelfDisconnectRequest = {
  /** Миллисекунды от `startedAt`: запрос перехвачен. */
  startedT: number;
  /** Миллисекунды от `startedAt`: ответ отдан странице. */
  finishedT: number;
  authorization?: string;
  hasBody: boolean;
  /** `0` — сервер не ответил за `UPSTREAM_TIMEOUT_MS`, причина в `error`. */
  status: number;
  error?: string;
};

const CORS_ALLOW_HEADERS = 'Authorization, Content-Type';
/** Дольше предела ожидания клиента (20 с): зависание сервера не подменяется обрывом перехвата. */
const UPSTREAM_TIMEOUT_MS = 25_000;

const resolveAllowOrigin = async (route: Route): Promise<string> => {
  return (await route.request().headerValue('origin')) ?? '*';
};

/**
 * Пропускает `POST /api/v2/participants/self/disconnect` на настоящий сервер и записывает запросы.
 *
 * Обход CORS только для тестового origin демо (`http://127.0.0.1:4173`): dev-сервер не отдаёт
 * `Access-Control-Allow-Origin`, и браузер блокирует запрос ещё на preflight. Отсутствие CORS для
 * клиентских origin — продуктовый риск, этот перехват его не закрывает.
 */
export const installSelfDisconnectRoute = async (page: Page, startedAt = Date.now()) => {
  const requests: TSelfDisconnectRequest[] = [];
  let holdGate: Promise<void> | undefined;

  await page.route(SELF_DISCONNECT_URL_PATTERN, async (route) => {
    const request = route.request();
    const allowOrigin = await resolveAllowOrigin(route);

    // Chromium под Playwright отвечает на preflight сам; ветка страхует другой движок.
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': allowOrigin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': CORS_ALLOW_HEADERS,
        },
      });

      return;
    }

    const startedT = Date.now() - startedAt;
    const record = {
      startedT,
      authorization: request.headers().authorization,
      hasBody: (request.postDataBuffer()?.length ?? 0) > 0,
    };
    let response: APIResponse;

    await holdGate;

    try {
      response = await route.fetch({ timeout: UPSTREAM_TIMEOUT_MS });
    } catch (error) {
      requests.push({
        ...record,
        finishedT: Date.now() - startedAt,
        status: 0,
        error: String(error),
      });
      await route.abort('timedout').catch(() => {});

      return;
    }

    requests.push({ ...record, finishedT: Date.now() - startedAt, status: response.status() });

    // Страница могла уже отменить запрос своим таймаутом: исход записан, ответ отдавать некому.
    await route
      .fulfill({
        response,
        headers: { ...response.headers(), 'access-control-allow-origin': allowOrigin },
      })
      .catch(() => {});
  });

  return {
    requests: () => {
      return [...requests];
    },
    /** Задерживает следующие запросы до вызова возвращённой функции: видно состояние звонка во время отключения. */
    hold: () => {
      let release = () => {};

      holdGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      return () => {
        holdGate = undefined;
        release();
      };
    },
  };
};

export type TSelfDisconnectRoute = Awaited<ReturnType<typeof installSelfDisconnectRoute>>;
