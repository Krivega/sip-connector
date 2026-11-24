# Управление презентациями

Режим (MCU или direct P2P) определяется автоматически по состоянию звонка; передавать его в методы не нужно.

## Запуск презентации

```typescript
// Получение потока экрана
const displayStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true,
});

// Запуск презентации с настройками качества
await facade.startPresentation({
  videoTrack: displayStream.getVideoTracks()[0] as MediaStreamVideoTrack,
  contentHint: 'detail', // Оптимизация для детального контента
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
  videoTrack: newDisplayStream.getVideoTracks()[0] as MediaStreamVideoTrack,
  contentHint: 'text', // Оптимизация для текстового контента
  degradationPreference: 'maintain-resolution',
});

// Остановка презентации
await facade.stopPresentation();
```

## Настройки качества презентации

| Параметр                | Описание                         | Рекомендуемые значения                  |
| ----------------------- | -------------------------------- | --------------------------------------- |
| `contentHint`           | Тип контента для оптимизации     | `'detail'`, `'text'`, `'motion'`        |
| `degradationPreference` | Приоритет при ухудшении качества | `'maintain-resolution'` для презентаций |
| `sendEncodings`         | Параметры слоёв кодирования      | Массив RTCRtpEncodingParameters         |

`PresentationManager` при `startPresentation()` и `updatePresentation()` автоматически добавляет
или ужесточает `scaleResolutionDownBy` в `sendEncodings`, чтобы отправляемый кадр демонстрации
укладывался в два лимита; действует более строгий:

- `maxAvailableResolution` из конфигурации подключения: `SipConnector` передаёт его в
  `PresentationManager` как `maxResolution`;
- предел H.264-энкодера: площадь кадра не больше 36 864 макроблоков 16×16 (например, 4096×2304).
  Больший кадр уменьшается минимально, ровно до этого предела. Лимит действует и без
  `maxAvailableResolution`.

Пока демонстрация активна, размер кадра проверяется раз в секунду. Если трек изменил размер без
замены (например, выросло захватываемое окно), `scaleResolutionDownBy` пересчитывается по тем же
лимитам, а при возврате в пределы возвращается к `1`. `maxBitrate` при пересчёте не меняется.
Проверка останавливается при `updatePresentation()`, `stopPresentation()` и завершении звонка.

## Адаптивные настройки в зависимости от типа контента

```typescript
// Адаптивные настройки в зависимости от типа контента
const presentationSettings = {
  // For detailed graphics/images
  highQuality: {
    contentHint: 'detail' as const,
    degradationPreference: 'maintain-resolution' as const,
  },

  // For text documents
  textOptimized: {
    contentHint: 'text' as const,
    degradationPreference: 'maintain-resolution' as const,
  },

  // For video content
  videoOptimized: {
    contentHint: 'motion' as const,
    degradationPreference: 'maintain-framerate' as const,
  },
};

// Использование настроек
await facade.startPresentation({
  videoTrack: displayStream.getVideoTracks()[0] as MediaStreamVideoTrack,
  ...presentationSettings.textOptimized,
});
```

## Управление состоянием презентации

Доступ к состоянию презентации через `presentationManager`:

```typescript
const { presentationManager } = sipConnector;

// Проверка текущего состояния
console.log('В процессе запуска/остановки:', presentationManager.isPendingPresentation);
console.log('Текущий video track презентации:', presentationManager.videoTrackPresentationCurrent);
```
