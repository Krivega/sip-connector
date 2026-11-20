# E2E Scenarios Matrix

Матрица сценариев для команды: что уже стабильно, что зафиксировано как ожидаемо-падающее, и что потенциально флаки.

## Legend

- `stable` — стабильно проходит в локальном прогоне.
- `expected-fail` — намеренно помечен как `test.fail` (маяк на известный баг/расхождение).
- `flaky-risk` — чувствителен к внешним условиям (сеть, сервер, конференция, время отклика).

## Connection

- `stable` — успешное подключение и проверка статусов/connectionConfiguration (`e2e/connect.spec.ts`).
- `stable` — ручной `disconnect` после `connect` возвращает `system:disconnected` (`e2e/connect.spec.ts`).
- `stable` — после `connect` доступен `call-only`, скрыт `connect+call` (`e2e/connect.spec.ts`).
- `stable` — rapid-sequence `connect → disconnect → connect` сохраняет корректные состояния (`e2e/connect.spec.ts`).
- `stable` — `network-change + ping OK` не запускает reconnect (`e2e/connect.spec.ts`).
- `stable` — `network-change + ping FAIL` приводит к reconnect-флоу (`e2e/connect.spec.ts`).
- `stable` — при `ping FAIL` ожидается явный `waitingBeforeRetry` перед восстановлением (`e2e/connect.spec.ts`).
- `stable` — неверный пароль переводит auto-connector в `errorTerminal` без retry-цикла (`e2e/connect.spec.ts`).
- `flaky-risk` — half-open WebSocket (нет входящих кадров): после порога периодического SIP OPTIONS ожидается reconnect-флоу (`e2e/ping-reconnect.spec.ts`, зависит от реального сервера и таймаутов JsSIP).

## Call

- `stable` — в disconnected видна только кнопка `connect+call`, `call-only` скрыта (`e2e/call.spec.ts`).
- `stable` — валидация формы: пустой conference не стартует call-flow (`e2e/call.spec.ts`).
- `stable` — `media init fail` не ломает connected-сессию (`e2e/call.spec.ts`).
- `stable` — после неуспешного `call` возможен штатный `disconnect` (`e2e/call.spec.ts`).
- `stable` — rapid-sequence `call (fail) → call (fail)` не роняет connected-сессию (`e2e/call.spec.ts`).
- `stable` — double-click call при media-fail не уводит в невалидное состояние (`e2e/call.spec.ts`).
- `stable` — `hangup` после `connect+call` выполняет полный cleanup и возвращает систему в `disconnected` (`e2e/call.spec.ts`).
- `flaky-risk` — потеря SIP WebSocket во время активного звонка не завершает звонок: после обрыва транспорта и переключения микрофона, при INFO и OPTIONS без ответа по открытому WebSocket, при неуспешных периодических ping. В звонке reconnect не запускается: после первого неуспешного ping транспорт переоткрывается, `signaling-unstable` приходит не позже 30 с, а `signaling-restored` — не позже 5 с после переоткрытия, потому что ping по новому транспорту уходит сразу (`e2e/wss-loss-in-call.spec.ts`; сервер заменён тестовым SIP-пиром `e2e/support/SipPeer.ts`; зависит от реальных таймеров JsSIP: Timer F 32 с при ожидании ~34 с, таймаут ping 10 с).
- `flaky-risk` — перед стартом демонстрации и перед re-INVITE сигнализация проверяется ping: по полуоткрытому WebSocket старт проходит по новому соединению (ping, затем INFO и re-INVITE), а если сигнализация не восстанавливается, старт отклоняется не позже 30 с без INFO и re-INVITE, звонок продолжается (`e2e/presentation-on-signaling-loss.spec.ts`; тестовый SIP-пир `e2e/support/SipPeer.ts`).

## Stale participant

- `flaky-risk` — молчащее устаревшее подключение после обрыва: перед новым INVITE POST `self/disconnect` повторяется до `401`, затем вход в комнату (`e2e/stale-participant-disconnect.spec.ts`; живой dev-сервер).
- `flaky-risk` — прежнее подключение сервер уже убрал: первый POST получает `401`, звонок входит в комнату (`e2e/stale-participant-disconnect.spec.ts`; живой dev-сервер).
- `flaky-risk` — после ручного отбоя следующий звонок ждёт в `call:connecting`, пока POST не получит `401`, и входит в комнату (`e2e/stale-participant-disconnect.spec.ts`; живой dev-сервер).
- `flaky-risk` — первый звонок страницы уходит без POST; после завершения звонка сервером (`BYE`) следующий звонок тоже без POST (`e2e/stale-participant-disconnect.spec.ts`; живой dev-сервер).
- `stable` — первый звонок без предыстории уходит без POST (`e2e/stale-participant-disconnect-sip-peer.spec.ts`; тестовый SIP-пир `e2e/support/SipPeer.ts` и подменённый маршрут `self/disconnect`).
- `stable` — после ручного отбоя ответы `204, 204, 401` с токеном прежнего звонка: POST повторяется раз в 1 с, INVITE уходит после `401`; новый вход в комнату заменяет токен (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).
- `stable` — звонок завершён сервером (`BYE`): следующий звонок уходит без POST (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).
- `stable` — `hangUp` во время POST: INVITE нет, `call:failed` с `Canceled`, `call:idle`; прежнее подключение запомнено, и следующий звонок снова отправляет POST (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).
- `stable` — `disconnect` во время POST: INVITE нет, `call:failed` с `Canceled`, `call:idle` (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).
- `stable` — второй `callToServer` во время POST тихо заменяет первый: один INVITE после `401` и вход в комнату (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).
- `stable` — ответ `500`, `204` → `500` или сетевой отказ на POST: INVITE нет, `call:failed` с `Internal Error`; следующий звонок уходит без POST (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).
- `flaky-risk` — предел 20 с при зависшем POST и при бесконечных `204`: звонок ждёт в `call:connecting` и уходит через 20 с после первого POST (`e2e/stale-participant-disconnect-sip-peer.spec.ts`; реальные таймеры, допустимое окно 19–23 с).
- `stable` — срок 60 с после завершения звонка: при часах страницы, сдвинутых на 55 с, POST уходит, при сдвиге на 65 с — нет (`e2e/stale-participant-disconnect-sip-peer.spec.ts`; `page.clock`).
- `stable` — ответ на входящий во время POST тихо отменяет исходящий: его INVITE нет, ответ проходит, автоперезвон в `idle` (`e2e/stale-participant-disconnect-sip-peer.spec.ts`).

## Participant role

- `stable` — браузерный эквивалент трёх переключений микрофона (`spectator → participant → spectator` с интервалом 100 мс) создаёт только одну spectator-сессию без промежуточного завершения (`e2e/microphone-role-transition.spec.ts`; внешний медиавызов заменён детерминированным тестовым адаптером).
- `stable` — UI роли spectator, управление качеством и сброс роли после завершения звонка проверяются детерминированным входным событием; конфигурация внешней конференции не используется как тестовая фикстура (`e2e/spectator.spec.ts`, `e2e/spectator-role-reset-on-call-end.spec.ts`).

## Execution isolation

- Сетевые E2E выполняются одним worker: все сценарии используют одну SIP-учётную запись, и параллельные регистрации взаимно прерывают сессии.

## Team Feedback Loop

- При каждом падении сценария обновляйте статус в этой матрице: `stable` → `flaky-risk` или `expected-fail`.
- Для `expected-fail` добавляйте ссылку на задачу/issue и критерий снятия `test.fail`.
- Раз в спринт пересматривайте `flaky-risk` сценарии: либо стабилизировать окружение/хуки, либо перевести в deterministic-проверки.
