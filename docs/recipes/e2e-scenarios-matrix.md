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
- `stable` — `hangup-only` после `connect+call`: ожидается `callActive` и инвариант после hangup-only, но сейчас не воспроизводится (`e2e/call.spec.ts`).

## Team Feedback Loop

- При каждом падении сценария обновляйте статус в этой матрице: `stable` → `flaky-risk` или `expected-fail`.
- Для `expected-fail` добавляйте ссылку на задачу/issue и критерий снятия `test.fail`.
- Раз в спринт пересматривайте `flaky-risk` сценарии: либо стабилизировать окружение/хуки, либо перевести в deterministic-проверки.
