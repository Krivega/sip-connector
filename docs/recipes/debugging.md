# Отладка и диагностика

## Включение отладочного режима

```typescript
import { enableDebug, disableDebug } from 'sip-connector';

// Включение детального логирования
enableDebug();

// Отключение для продакшена
disableDebug();
```

## Мониторинг состояния

```typescript
// Проверка состояния подключения
console.log('Зарегистрирован:', facade.isRegistered);

// Проверка конфигурации
console.log('Настроен:', facade.isConfigured());

// Диагностика ICE-соединения
const checkIceConnection = async () => {
  try {
    const success = await sipConnector.callManager.restartIce({
      useUpdate: true,
      extraHeaders: ['X-Debug: ICE-Check'],
    });
    console.log('ICE соединение:', success ? 'OK' : 'Проблемы');
  } catch (error) {
    console.error('ICE недоступен:', error.message);
  }
};
```

## Управление состоянием звонка

```typescript
// Отслеживание жизненного цикла звонка через события
sipConnector.on('call:accepted', () => {
  console.log('Звонок принят');
});

sipConnector.on('call:ended', () => {
  console.log('Звонок завершен');
});

sipConnector.on('call:failed', (error) => {
  console.error('Ошибка звонка:', error);
});

// Доступ к состоянию через CallStateMachine (внутренний компонент)
const callStateMachine = sipConnector.callManager.callStateMachine;

// Проверка текущего состояния
console.log('Состояние звонка:', callStateMachine.state);
console.log('Звонок активен:', callStateMachine.isActive); // true для accepted/inCall
console.log('Ожидание:', callStateMachine.isPending); // true для connecting/ringing
console.log('Последняя ошибка:', callStateMachine.lastError);

// Сброс состояния после завершения
if (callStateMachine.isEnded || callStateMachine.isFailed) {
  callStateMachine.reset(); // Переход в IDLE
}
```
