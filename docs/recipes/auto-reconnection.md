# Автоматическое переподключение

## AutoConnectorManager

`AutoConnectorManager` обеспечивает **автоматическое переподключение** при обрывах связи и проблемах с сетью:

```typescript
// Создание SipConnector с настройками автоподключения
const sipConnector = new SipConnector(
  { JsSIP },
  {
    autoConnectorOptions: {
      timeoutBetweenAttempts: 3000, // Задержка между попытками
      checkTelephonyRequestInterval: 15000, // Интервал проверки телефонии
    },
  },
);

// Запуск автоподключения
sipConnector.startAutoConnect({
  // Возвращает параметры подключения
  getParameters: async () => {
    return {
      displayName: 'displayName',
      sipServerUrl: 'example.com', // Путь /webrtc/wss/ добавляется автоматически
      sipServerIp: 'sip.example.com',
      remoteAddress: '192.168.1.1',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      user: 'user',
      password: 'password',
      register: true,
    };
  },
  // Проверяет готовность к подключению
  hasReadyForConnection: () => {
    return true;
  },
});

// Остановка автоподключения
sipConnector.stopAutoConnect();

// Принудительный рестарт текущего автоконнект-флоу (низкоуровневый API)
sipConnector.autoConnectorManager.restart();
```

## Принцип работы

- **Автоматические попытки**: Повторяет попытки подключения при ошибках
- **Проверка телефонии**: Периодически проверяет доступность сервера
- **Мониторинг состояния**: Отслеживает состояние регистрации и звонков
- **Адаптивные задержки**: Использует настраиваемые интервалы между попытками
- **Очистка кэша**: Возможность настраивать очистку кэша через хук
- **Реакция на сеть**: Опциональный подписчик сетевых событий (`online`/`offline`/`change`) с настраиваемой политикой `probe` (по умолчанию) / `reconnect` / `ignore` — проверяет достижимость сервера SIP OPTIONS-пингом и запускает реконнект только при недоступности; `offline` прерывает соединение через grace-окно
- **Причины реконнекта**: Все внешние рестарты проходят через единый `requestReconnect` (например: `start`, `manual-restart`, `telephony-disconnected`, `registration-failed-out-of-call`, `network-online`, `network-change`)

## Приоритеты причин рестарта (coalescing)

В коротком окне coalescing повторные запросы на рестарт схлопываются:

- если новая причина имеет **меньший или равный** приоритет — она подавляется;
- если новая причина имеет **больший** приоритет — она допускается и перезапускает флоу.

| Причина (`TReconnectReason`)      | Приоритет |
| --------------------------------- | --------- |
| `start`                           | `0`       |
| `telephony-disconnected`          | `1`       |
| `telephony-check-failed`          | `1`       |
| `registration-failed-out-of-call` | `3`       |
| `manual-restart`                  | `4`       |
| `network-online`                  | `4`       |
| `network-change`                  | `4`       |

## События автоподключения

| Событие                                  | Описание                                         | Данные                                                                            |
| ---------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `auto-connect:before-attempt`            | Начало очередной попытки подключения             | `{}`                                                                              |
| `auto-connect:success`                   | Успешное подключение или подтверждение связи     | `undefined`                                                                       |
| `auto-connect:failed-all-attempts`       | Ошибка в цепочке ретрая (фатальный сценарий)     | `Error`                                                                           |
| `auto-connect:cancelled-attempts`        | Попытки отменены (например, неактуальный flow)   | `unknown` / `Error`                                                               |
| `auto-connect:stop-attempts-by-error`    | Остановка без ретрая (`canRetryOnError=false`)   | `unknown`                                                                         |
| `auto-connect:limit-reached-attempts`    | Достигнут лимит попыток, включён check-telephony | `Error('Limit reached')`                                                          |
| `auto-connect:changed-attempt-status`    | Изменение статуса попытки                        | `{ isInProgress: boolean }`                                                       |
| `auto-connect:telephony-check-failure`   | Ошибка проверки телефонии + решение policy       | `{ failCount, escalationLevel, shouldRequestReconnect, nextRetryDelayMs, error }` |
| `auto-connect:telephony-check-escalated` | Эскалация деградации проверки телефонии          | `{ failCount, escalationLevel, error }`                                           |

## Подписка на события автоподключения

```typescript
// Подписка на события автоподключения
sipConnector.on('auto-connect:changed-attempt-status', ({ isInProgress }) => {
  console.log('Попытка подключения в процессе:', isInProgress);
});

sipConnector.on('auto-connect:before-attempt', () => {
  console.log('Начало попытки подключения');
});

sipConnector.on('auto-connect:success', () => {
  console.log('Подключение успешно');
});

sipConnector.on('auto-connect:failed-all-attempts', (error) => {
  console.log('Цепочка переподключения завершилась с ошибкой:', error);
});

sipConnector.on('auto-connect:cancelled-attempts', (error) => {
  console.log('Попытка подключения отменена:', error);
});
```

## Реакция на сетевые события браузера

По умолчанию `AutoConnectorManager` использует встроенный browser-адаптер `createBrowserNetworkEventsSubscriber()` (события `window.online`/`window.offline` + `navigator.connection.change`, если доступен). При необходимости клиент может передать свой `networkEventsSubscriber` (например, для React Native NetInfo или кастомного окружения).

### Контракт

```typescript
type TNetworkEventsHandlers = {
  onChange: () => void;
  onOnline: () => void;
  onOffline: () => void;
};

type INetworkEventsSubscriber = {
  subscribe: (handlers: TNetworkEventsHandlers) => void;
  unsubscribe: () => void;
};
```

- `onOnline` — обрабатывается согласно `onNetworkOnlinePolicy` (default: `'probe'`). При срабатывании приводит к причине реконнекта `network-online`.
- `onChange` — обрабатывается согласно `onNetworkChangePolicy` (default: `'probe'`). При срабатывании приводит к причине реконнекта `network-change`.
- `onOffline` — планируется отложенный стоп соединения через `offlineGraceMs` (по умолчанию `2000` мс). Если в течение окна придёт `onOnline`/`onChange`, стоп отменяется — это защита от «моргнувшей» сети.

Подписка на сетевые события активна, пока автоконнектор работает: `start()` подписывается, `stop()` отписывается.

### Политики обработки `onChange` / `onOnline`

Событие сетевого стека не гарантирует, что **наш** SIP-сервер действительно достижим (пример: пользователь переключил Wi-Fi — физически сеть есть, но конкретный сервер может быть недоступен или наоборот, сокет ещё жив). Чтобы не рвать рабочее соединение на каждом шорохе, предусмотрены политики:

| Значение      | Поведение                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `'probe'` ⭐  | **По умолчанию.** Адаптивный probe по состоянию state machine (см. таблицу ниже).                                    |
| `'reconnect'` | Безусловный `requestReconnect` (старое поведение). Подойдёт, когда клиент уверен, что событие действительно значимо. |
| `'ignore'`    | Событие игнорируется. Полагаемся на периодический `PingServerRequester` и JsSIP transport reconnect.                 |

#### Поведение `'probe'` по состояниям

| Состояние машины      | Что делает probe                               | При успехе                                                        | При неуспехе                                    |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| `connectedMonitoring` | `connectionManager.ping()` (SIP OPTIONS)       | Сокет жив — ничего не делаем                                      | Сокет мёртв — `requestReconnect`                |
| `waitingBeforeRetry`  | `connectionManager.checkTelephony(...)`        | Сервер доступен — **ускоряем** retry через `requestReconnect`     | Сервер недоступен — ждём штатного retry-таймера |
| прочие                | probe пропускается (попытка уже идёт или idle) | `requestReconnect` запускается безусловно (как при `'reconnect'`) | —                                               |

Логика `waitingBeforeRetry` экономит ограниченные попытки подключения: если сервер заведомо недоступен, нет смысла тратить на него ещё одну попытку — лучше дождаться таймера и попробовать позже.

```typescript
autoConnectorOptions: {
  onNetworkChangePolicy: 'probe',  // default
  onNetworkOnlinePolicy: 'probe',  // default
  // offlineGraceMs: 2000,
}
```

### Пример (браузер)

```typescript
const browserNetworkSubscriber: INetworkEventsSubscriber = (() => {
  let disposers: Array<() => void> = [];

  return {
    subscribe: (handlers) => {
      const online = () => {
        handlers.onOnline();
      };
      const offline = () => {
        handlers.onOffline();
      };
      const change = () => {
        handlers.onChange();
      };

      window.addEventListener('online', online);
      window.addEventListener('offline', offline);

      const connection = (navigator as Navigator & { connection?: EventTarget }).connection;

      connection?.addEventListener('change', change);

      disposers = [
        () => {
          window.removeEventListener('online', online);
        },
        () => {
          window.removeEventListener('offline', offline);
        },
        () => {
          connection?.removeEventListener('change', change);
        },
      ];
    },
    unsubscribe: () => {
      disposers.forEach((dispose) => {
        dispose();
      });
      disposers = [];
    },
  };
})();

const sipConnector = new SipConnector(
  { JsSIP },
  {
    autoConnectorOptions: {
      networkEventsSubscriber: browserNetworkSubscriber,
      offlineGraceMs: 2000,
    },
  },
);
```

### Тюнинг `offlineGraceMs`

- Короче (500–1000 мс) — быстрее реагируем на реальный обрыв, но растёт риск ложного disconnect при коротких дропах.
- Дольше (3000–5000 мс) — комфортнее для нестабильных мобильных сетей, но заметнее лаг при длительных обрывах.

## Базовые operational профили telephonyFailPolicy

### Production (устойчивость, меньше шума)

```typescript
autoConnectorOptions: {
  telephonyFailPolicy: {
    baseRetryDelayMs: 2000,
    maxRetryDelayMs: 60000,
    warningThreshold: 3,
    criticalThreshold: 6,
  },
}
```

- Рекомендуемая последовательность backoff: `2s -> 4s -> 8s -> 16s -> 32s -> 60s (cap)`.
- `warning` с 3-го fail, `critical` с 6-го fail.

### Stage (быстрая диагностика регрессий)

```typescript
autoConnectorOptions: {
  telephonyFailPolicy: {
    baseRetryDelayMs: 1000,
    maxRetryDelayMs: 15000,
    warningThreshold: 2,
    criticalThreshold: 4,
  },
}
```

- Рекомендуемая последовательность backoff: `1s -> 2s -> 4s -> 8s -> 15s (cap)`.
- Более ранняя эскалация помогает быстрее заметить проблемы перед релизом.

## Когда тюнинговать policy

- Если в production часто появляется `auto-connect:telephony-check-escalated` с `critical`, увеличивайте `criticalThreshold` и/или `maxRetryDelayMs`.
- Если восстановление после кратких сетевых просадок слишком медленное, уменьшайте `baseRetryDelayMs`.
- Если слишком много ложных предупреждений (`warning`) на нестабильной сети, увеличивайте `warningThreshold`.
