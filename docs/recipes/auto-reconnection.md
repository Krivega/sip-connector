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

## События автоподключения

| Событие                               | Описание                       | Данные                              |
| ------------------------------------- | ------------------------------ | ----------------------------------- |
| `auto-connect:connecting`             | Начало подключения             | -                                   |
| `auto-connect:connected`              | Успешное подключение           | `{ ua: UA, isRegistered: boolean }` |
| `auto-connect:disconnecting`          | Начало отключения              | -                                   |
| `auto-connect:disconnected`           | Отключение завершено           | -                                   |
| `auto-connect:failed`                 | Ошибка подключения             | `Error`                             |
| `auto-connect:before-attempt`         | Начало попытки подключения     | -                                   |
| `auto-connect:succeeded-attempt`      | Успешная попытка подключения   | -                                   |
| `auto-connect:failed-attempt`         | Неудачная попытка подключения  | `Error`                             |
| `auto-connect:cancelled-attempt`      | Отмененная попытка подключения | `Error`                             |
| `auto-connect:changed-attempt-status` | Изменение статуса попытки      | `{ isInProgress: boolean }`         |

## Подписка на события автоподключения

```typescript
// Подписка на события автоподключения
sipConnector.on('auto-connect:changed-attempt-status', ({ isInProgress }) => {
  console.log('Попытка подключения в процессе:', isInProgress);
});

sipConnector.on('auto-connect:before-attempt', () => {
  console.log('Начало попытки подключения');
});

sipConnector.on('auto-connect:succeeded-attempt', () => {
  console.log('Попытка подключения успешна');
});

sipConnector.on('auto-connect:failed-attempt', (error) => {
  console.log('Попытка подключения неудачна:', error);
});

sipConnector.on('auto-connect:cancelled-attempt', (error) => {
  console.log('Попытка подключения отменена:', error);
});
```
