# Управление презентациями

## Запуск презентации

```typescript
// Получение потока экрана
const displayStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
});

// Запуск презентации с настройками качества
await facade.startPresentation({
  mediaStream: displayStream,
  isP2P: false, // MCU режим
  contentHint: 'detail', // Оптимизация для детального контента
  maxBitrate: 4000000, // Максимальный битрейт 4 Мбит/с
  degradationPreference: 'maintain-resolution', // Приоритет разрешения
  sendEncodings: [
    { width: 1920, height: 1080, scalabilityMode: 'L3T3_KEY' },
    { width: 1280, height: 720 },
  ],
});
```

## Обновление и остановка

```typescript
// Обновление потока презентации с новыми настройками
await facade.updatePresentation({
  mediaStream: newDisplayStream,
  isP2P: false,
  maxBitrate: 6000000, // Увеличенный битрейт для HD контента
  contentHint: 'text', // Оптимизация для текстового контента
});

// Остановка презентации
await facade.stopPresentation();
```

## Настройки качества презентации

| Параметр                | Описание                         | Рекомендуемые значения                  |
| ----------------------- | -------------------------------- | --------------------------------------- |
| `maxBitrate`            | Максимальный битрейт (bps)       | 2-8 Мбит/с в зависимости от контента    |
| `contentHint`           | Тип контента для оптимизации     | `'detail'`, `'text'`, `'motion'`        |
| `degradationPreference` | Приоритет при ухудшении качества | `'maintain-resolution'` для презентаций |

## Адаптивные настройки в зависимости от типа контента

```typescript
// Адаптивные настройки в зависимости от типа контента
const presentationSettings = {
  // For detailed graphics/images
  highQuality: {
    maxBitrate: 8000000,
    contentHint: 'detail' as const,
    degradationPreference: 'maintain-resolution' as const,
  },

  // For text documents
  textOptimized: {
    maxBitrate: 4000000,
    contentHint: 'text' as const,
    degradationPreference: 'maintain-resolution' as const,
  },

  // For video content
  videoOptimized: {
    maxBitrate: 6000000,
    contentHint: 'motion' as const,
    degradationPreference: 'maintain-framerate' as const,
  },
};

// Использование настроек
await facade.startPresentation({
  mediaStream: displayStream,
  isP2P: false,
  ...presentationSettings.textOptimized,
});
```

## Управление состоянием презентации

Доступ к состоянию через PresentationStateMachine:

```typescript
const presentationStateMachine = sipConnector.callManager.presentationStateMachine;

// Проверка текущего состояния
console.log('Состояние презентации:', presentationStateMachine.state);
console.log('Активна:', presentationStateMachine.isActive);
console.log('В процессе:', presentationStateMachine.isPending); // starting/stopping
console.log('Активна или в процессе:', presentationStateMachine.isActiveOrPending);
console.log('Ошибка:', presentationStateMachine.lastError);

// Сброс состояния после ошибки
if (presentationStateMachine.isFailed) {
  presentationStateMachine.reset();
}
```
