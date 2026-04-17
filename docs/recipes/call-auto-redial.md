# Автоматический редиал звонка при сетевых обрывах

Менеджер `CallReconnectManager` восстанавливает активный звонок, когда транспортный уровень (WebSocket/UA) или сигнализация прерывают его по сетевой причине. В отличие от [auto-reconnection](./auto-reconnection.md), работающего уровнем выше (переподключение к SIP-серверу), этот компонент действует исключительно внутри уже установленного подключения и восстанавливает только сам звонок.

## Когда включать автоматический редиал

- Требуется бесшовное переподключение к конференции после кратковременных сетевых обрывов.
- Пользователь не должен повторно нажимать «Позвонить» — UI показывает индикацию процесса.
- Бизнес-сценарий допускает до `maxAttempts` повторов с экспоненциальной задержкой.

Не подходит для:

- Роли spectator — менеджер делает ранний `cancelled('spectator-role')`.
- Ошибок `BUSY`, `REJECTED`, `NOT_FOUND` и т.п.: `NetworkFailurePolicy` не посчитает их сетевым сбоем.

## Включение в SipConnectorFacade

Передайте `autoRedial: true` в `callToServer`:

```typescript
await sipConnectorFacade.callToServer({
  conference,
  mediaStream,
  autoRedial: true,
  extraHeaders,
  iceServers,
});
```

SipConnector автоматически вооружится после успешного старта звонка и начнёт слушать `call:failed` с сетевыми причинами.

## Включение напрямую через SipConnector

Если вы используете низкоуровневый `sipConnector.call`:

```typescript
await sipConnector.call(
  {
    mediaStream,
    number: '100',
    /* ... */
  },
  { autoRedial: true },
);
```

Либо отдельно управляйте вооружением:

```typescript
sipConnector.armCallAutoRedial({
  getCallParameters: async () => {
    return { mediaStream, number: '100' /* ... */ };
  },
});

// Отключить:
sipConnector.disarmCallAutoRedial('manual');

// Принудительно повторить после LIMIT_REACHED:
sipConnector.forceCallReconnect();

// Отменить только in-flight (delay + startCall), оставив менеджер вооружённым:
sipConnector.cancelCurrentCallReconnectAttempt();
```

## Настройка backoff и политик

Передайте `callReconnectOptions` в конструктор `SipConnector`:

```typescript
const sipConnector = new SipConnector(
  { JsSIP },
  {
    callReconnectOptions: {
      maxAttempts: 5,
      baseBackoffMs: 1000,
      maxBackoffMs: 30_000,
      backoffFactor: 2,
      jitter: 'equal',
      waitSignalingTimeoutMs: 20_000,
      isNetworkFailure: (event) => {
        // свой классификатор, например, для нестандартных кодов
        return event.cause === 'MY_CUSTOM_NETWORK_CAUSE';
      },
      canRetryOnError: (error) => {
        if (isBusyError(error)) {
          return false;
        }

        return true;
      },
    },
  },
);
```

## Подписка на события и индикация

```typescript
sipConnector.on('call-reconnect:status-changed', ({ isReconnecting }) => {
  toggleSpinner(isReconnecting);
});

sipConnector.on('call-reconnect:attempt-scheduled', ({ attempt, delayMs }) => {
  showToast(`Повтор #${attempt} через ${delayMs} мс`);
});

sipConnector.on('call-reconnect:limit-reached', ({ attempts }) => {
  showFatalBanner(`Не удалось восстановить звонок после ${attempts} попыток`);
});
```

См. полный список событий: [docs/api/call-reconnect-events.md](../api/call-reconnect-events.md).

## UI-интеграция через SessionManager

`SessionManager.getSnapshot().callReconnect` содержит агрегированный snapshot XState-машины (`value` + `context`). Любая смена состояния или контекста триггерит `snapshotEquals`, поэтому MST-модель `StatusesRoot/callReconnect` получает уведомление и может пересчитать UI-флаги.

В demo-приложении используется флаг `isReconnecting` (определён в `demo/StatusesRoot/callReconnect/Model.ts`), который истинен в `evaluating`/`backoff`/`waitingSignaling`/`attempting`/`limitReached`. Этого достаточно, чтобы показать баннер «Восстанавливаем звонок...».

## Что происходит при локальном `hangUp`

- `SipConnector.hangUp` автоматически вызывает `callReconnectManager.disarm('local-hangup')`.
- Машина уходит в `idle`, in-flight отменяется, эмитится `cancelled({ reason: 'local-hangup' })`.

## Отладка

- Включите `enableDebug()` — увидите логи `CallReconnectManager`, `CallReconnectRuntime`, `CallReconnectMachine`.
- Проверяйте состояния через `sipConnector.sessionManager.getSnapshot().callReconnect`.
- Для ручной проверки можно эмитировать `call:failed` через SIP-тестовую утилиту и наблюдать цикл событий.

## Сценарии для ручного тестирования

Все сценарии проверяются на demo-приложении (`yarn start`, открыть `http://localhost:8080`). В форме указываются валидные SIP-креды и номер конференции. Флаг «autoRedialEnabled» сохраняется в `localStorage` и доступен как чекбокс рядом с остальными переключателями.

Подготовка окружения:

- Открыть DevTools → Console, включить «Preserve log».
- В Console выполнить `localStorage.debug = 'sip-connector:*'` (или нажать кнопку «Включить debug» в UI, если она доступна) и перезагрузить страницу.
- Подготовить способ обрыва сети: «Offline» в DevTools → Network или отключение Wi-Fi/интерфейса на хосте.

Итоговый критерий любого сценария — DOM-блок `#callReconnectIndicator` корректно показывается/скрывается, а консоль содержит ожидаемую последовательность событий `call-reconnect:*`.

### Сценарий 1. Базовое автопереподключение после короткого обрыва

**Цель:** убедиться, что при сетевом сбое звонок восстанавливается без участия пользователя.

1. Установить чекбокс «autoRedialEnabled» в `true`.
2. Ввести валидные параметры, нажать «Войти», затем «Позвонить».
3. Дождаться состояния `activeCall` (виден remote stream).
4. В DevTools → Network включить «Offline» на 3–5 секунд и выключить обратно.

Ожидаемый результат:

- В консоли видно события в порядке: `call-reconnect:failure-detected` → `attempt-scheduled` → `attempt-started` → `attempt-succeeded`.
- `#callReconnectIndicator` появляется на время backoff/attempting и скрывается после успеха.
- Состояние `sipConnector.sessionManager.getSnapshot().callReconnect.value` переходит `armed → evaluating → backoff → attempting → armed`.
- Звонок вернулся, медиа восстановилось.

### Сценарий 2. Достижение лимита попыток и ручной `forceReconnect`

**Цель:** проверить ветку `limit-reached` и восстановление через `forceCallReconnect`.

1. Задать `callReconnectOptions: { maxAttempts: 2, baseBackoffMs: 500, maxBackoffMs: 1000 }` в инициализации `SipConnector` (или временно в demo).
2. Повторить шаги 1–3 из сценария 1.
3. Включить «Offline» и держать до момента, пока не отработает `limit-reached` (в консоли — `call-reconnect:limit-reached`).
4. Выключить «Offline» (сеть восстановлена).
5. В консоли вызвать `sipConnector.forceCallReconnect()`.

Ожидаемый результат:

- После шага 3 — состояние `limitReached`, индикатор остаётся видимым.
- После шага 5 — состояние возвращается к `attempting` → `armed`, звонок восстанавливается, события `attempt-started` → `attempt-succeeded`.

### Сценарий 3. Локальный `hangUp` во время переподключения

**Цель:** убедиться, что пользовательский `hangUp` немедленно останавливает цикл и эмитит `cancelled({ reason: 'local-hangup' })`.

1. Повторить шаги 1–3 из сценария 1.
2. Включить «Offline» и дождаться появления индикатора (`backoff`/`attempting`).
3. Не выключая «Offline», нажать «Положить трубку».

Ожидаемый результат:

- В консоли: `call-reconnect:cancelled` с `reason: 'local-hangup'`.
- Состояние машины — `idle`, `#callReconnectIndicator` скрыт.
- Никакие дальнейшие `attempt-started` не появляются после выключения «Offline».

### Сценарий 4. Снятие чекбокса во время переподключения (`disarm`)

**Цель:** проверить, что снятие флага прекращает попытки, но не рвёт активный звонок, если он уже восстановлен.

1. Повторить шаги 1–3 из сценария 1.
2. Включить «Offline», дождаться индикатора.
3. Снять чекбокс «autoRedialEnabled».

Ожидаемый результат:

- В консоли: `call-reconnect:cancelled` с `reason: 'disarm'` (либо `'manual'` при использовании `disarmCallAutoRedial('manual')`).
- Состояние — `idle`, индикатор скрыт.
- При последующем восстановлении сети новых попыток нет — звонок остаётся в текущем (потенциально оборванном) состоянии до явного клика «Позвонить».

### Сценарий 5. Долгий обрыв сигнализации (`waitingSignaling` → успех)

**Цель:** проверить координацию с регистрацией UA.

1. Убедиться, что `callReconnectOptions.waitSignalingTimeoutMs` ≥ 20 с (дефолт).
2. Повторить шаги 1–3 из сценария 1.
3. Включить «Offline» на 8–15 секунд (пока UA переходит в `disconnected`).
4. Выключить «Offline».

Ожидаемый результат:

- Последовательность событий: `failure-detected` → `waiting-signaling` → (после `connected/registered`) → `attempt-scheduled` → `attempt-started` → `attempt-succeeded`.
- В `sessionManager.getSnapshot().callReconnect.value` есть промежуточное состояние `waitingSignaling`.
- Индикатор держится всё время восстановления.

### Сценарий 6. Таймаут сигнализации (`waitingSignaling` → `errorTerminal`)

**Цель:** проверить терминальное состояние при затяжном оффлайне.

1. Установить `waitSignalingTimeoutMs: 3000` для ускорения.
2. Повторить шаги 1–3 из сценария 1.
3. Включить «Offline» и держать более 3 секунд.

Ожидаемый результат:

- Состояние машины достигает `errorTerminal`.
- Эмитится `attempt-failed` либо `cancelled`, индикатор скрывается после `disarm`/завершения.
- Возврат из `errorTerminal` возможен только через явный `forceCallReconnect()` или новый `call(...)`.

### Сценарий 7. Роль spectator (no-op)

**Цель:** убедиться, что для роли наблюдателя редиал отключается.

1. Подключиться к конференции с параметрами, при которых сервер присваивает роль spectator.
2. Установить «autoRedialEnabled» в `true`.
3. Нажать «Позвонить», дождаться состояния `activeCall`.

Ожидаемый результат:

- Сразу после `arm` эмитится `call-reconnect:cancelled` с `reason: 'spectator-role'`.
- Индикатор не появляется; обрыв сети не запускает попытки (восстановлением spectator-сессии занимается `CallManager`).

### Сценарий 8. Быстрая последовательность сбоев

**Цель:** убедиться, что одновременные `failed`-события не создают параллельные попытки.

1. Включить `autoRedialEnabled`, войти в звонок.
2. Несколько раз подряд (с интервалом < `baseBackoffMs`) переключить «Offline/Online».

Ожидаемый результат:

- В консоли между `attempt-started` и следующим `attempt-started` всегда идёт терминальный event (`attempt-succeeded`, `attempt-failed`, `cancelled`). Нет пересекающихся пар.
- Нет «зависших» таймеров: после окончательного восстановления индикатор скрыт, `callReconnect.value === 'armed'`.

### Быстрый чек-лист перед релизом

- [ ] Сценарий 1: базовое восстановление проходит.
- [ ] Сценарий 2: `limit-reached` + `forceReconnect` возвращает звонок.
- [ ] Сценарий 3: локальный `hangUp` гасит цикл.
- [ ] Сценарий 4: снятие чекбокса = `disarm`.
- [ ] Сценарий 5: `waitingSignaling` → успех.
- [ ] Сценарий 6: `waitingSignaling` → `errorTerminal` по таймауту.
- [ ] Сценарий 7: spectator не запускает редиал.
- [ ] Сценарий 8: нет параллельных попыток при шторме событий.
