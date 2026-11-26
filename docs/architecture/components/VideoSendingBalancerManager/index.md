# VideoSendingBalancerManager (Балансировка видео)

**Назначение**: Автоматическая оптимизация видеопотоков.

## Ключевые возможности

- Автоматическая оптимизация видеопотоков с задержкой запуска (10 секунд) на время прогрева отправки
  браузером: до его завершения скалирование не применяется
- Адаптивное опрашивание изменений треков
- Управление параметрами кодирования
- Учёт `maxAvailableResolution` подключения при балансировке основного исходящего потока
- Планирование и остановка балансировки
- Интеграция с режимом зрителя (`recv-session-*`, `recv-quality-changed`)

## Интеграция с `maxAvailableResolution`

`SipConnector` создаёт менеджер с опциями `IBalancerOptions`, дополняя пользовательский
`videoBalancerOptions` callback `getMaxResolution`:

```typescript
new VideoSendingBalancerManager(callManager, apiManager, {
  ...videoBalancerOptions,
  getMaxResolution: sipConnector.getMaxAvailableResolution.bind(sipConnector),
});
```

Пользователь не может переопределить `getMaxResolution` через `videoBalancerOptions`
(тип `Omit<IBalancerOptions, 'getMaxResolution'>`).

`VideoSendingBalancerManager` передаёт полный набор опций в конструктор `VideoSendingBalancer`.
`SenderBalancer` сохраняет `getMaxResolution` и вызывает его при каждой операции балансировки —
актуальное значение `connectionConfiguration.maxAvailableResolution` учитывается при:

- первом `balance()` после старта;
- обработке команд `main-cam-control` (кроме `PAUSE_MAIN_CAM` и `MAX_MAIN_CAM_RESOLUTION` с
  `resolutionMainCam`);
- смене видеотрека;
- сбросе параметров при остановке балансировки.

## Жизненный цикл

Менеджер переводит `VideoSendingBalancer` между состояниями `idle`, `warmup` и `started`:

1. `peerconnection:confirmed` / `recv-session-ended` → планирование запуска через
   `balancingStartDelay`, состояние `warmup`: параметры не ужесточаются (кроме ручного `balance()`),
   замены трека уже идут через балансировщик
2. По таймеру → `startBalancing()`, состояние `started`: первая балансировка с последней запомненной
   командой сервера, затем `balancing-started`
3. События `main-cam-control` передаются балансировщику: в `started` — перебалансировка, в `warmup`
   команда только запоминается, в `idle` не принимается
4. `ended` / `failed` / `recv-session-started` / `recv-quality-changed` → `stopBalancing()`,
   состояние `idle`: команда стирается, параметры отправителя сбрасываются

Состоянием, командой сервера и токеном запуска владеет `VideoSendingBalancer`; менеджер владеет
таймером, `isBalancingScheduled`, `isBalancingActive` и событиями. Правила применения параметров и
известные пределы — в описании
[`VideoSendingBalancer`](../../../../src/VideoSendingBalancer/README.md).

## Основные методы

| Метод              | Назначение                                                |
| ------------------ | --------------------------------------------------------- |
| `startBalancing()` | Принудительный запуск балансировки                        |
| `stopBalancing()`  | Остановка, сброс команды сервера и параметров отправителя |
| `balance()`        | Ручная балансировка; в прогреве — по треку, без команды   |

## Связанные компоненты

- [`VideoSendingBalancer`](../../../../src/VideoSendingBalancer/README.md) — фасад балансировки
- [`CallManager`](../CallManager/index.md) — события звонка и `connection`
- [`ApiManager`](../ApiManager/index.md) — события `main-cam-control`

## Связанные рецепты

- [Управление видеобалансировщиком](../../../recipes/video-balancing.md)
- [Управление медиа-потоками](../../../recipes/media-management.md)
