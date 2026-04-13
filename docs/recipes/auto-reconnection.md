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
```

## Принцип работы

- **Автоматические попытки**: Повторяет попытки подключения при ошибках
- **Проверка телефонии**: Периодически проверяет доступность сервера
- **Мониторинг состояния**: Отслеживает состояние регистрации и звонков
- **Адаптивные задержки**: Использует настраиваемые интервалы между попытками
- **Очистка кэша**: Возможность настраивать очистку кэша через хук
- **Причины реконнекта**: Все внешние рестарты проходят через единый `requestReconnect` (например: `start`, `telephony-disconnected`, `registration-failed-out-of-call`)

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
