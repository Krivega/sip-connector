# Автоматическое переподключение

## AutoConnectorManager

`AutoConnectorManager` обеспечивает **автоматическое переподключение** при обрывах связи и проблемах с сетью:

```typescript
// Создание SipConnector с настройками автоподключения
const sipConnector = new SipConnector(
  { JsSIP },
  {
    autoConnectorOptions: {
      onBeforeRetry, // Очистка кэша перед переподключением
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
- **Причины реконнекта**: Все внешние рестарты проходят через единый `requestReconnect` (например: `start`, `network-change`, `sleep-resume`)

## Приоритеты причин рестарта (coalescing)

В коротком окне coalescing повторные запросы на рестарт схлопываются:

- если новая причина имеет **меньший или равный** приоритет — она подавляется;
- если новая причина имеет **больший** приоритет — она допускается и перезапускает флоу.

| Причина (`TReconnectReason`)      | Приоритет |
| --------------------------------- | --------- |
| `start`                           | `0`       |
| `telephony-disconnected`          | `1`       |
| `sleep-resume`                    | `2`       |
| `registration-failed-out-of-call` | `3`       |
| `network-change`                  | `4`       |

## События автоподключения

| Событие                               | Описание                                         | Данные                      |
| ------------------------------------- | ------------------------------------------------ | --------------------------- |
| `auto-connect:before-attempt`         | Начало очередной попытки подключения             | `{}`                        |
| `auto-connect:success`                | Успешное подключение или подтверждение связи     | `undefined`                 |
| `auto-connect:failed-all-attempts`    | Ошибка в цепочке ретрая (фатальный сценарий)     | `Error`                     |
| `auto-connect:cancelled-attempts`     | Попытки отменены (например, неактуальный flow)   | `unknown` / `Error`         |
| `auto-connect:stop-attempts-by-error` | Остановка без ретрая (`canRetryOnError=false`)   | `unknown`                   |
| `auto-connect:limit-reached-attempts` | Достигнут лимит попыток, включён check-telephony | `Error('Limit reached')`    |
| `auto-connect:changed-attempt-status` | Изменение статуса попытки                        | `{ isInProgress: boolean }` |

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
