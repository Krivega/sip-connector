# VideoSendingBalancerManager (Балансировка видео)

**Назначение**: Автоматическая оптимизация видеопотоков.

## Ключевые возможности

- Автоматическая оптимизация видеопотоков с задержкой запуска (10 секунд)
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

- первом `balance()` после задержки;
- обработке команд `main-cam-control` (кроме `PAUSE_MAIN_CAM` и `MAX_MAIN_CAM_RESOLUTION` с
  `resolutionMainCam`);
- смене видеотрека;
- `reset()` при остановке балансировки.

## Жизненный цикл

1. `peerconnection:confirmed` → планирование запуска через `balancingStartDelay`
2. По таймеру → `balance()` + `subscribe()`
3. События `main-cam-control` → перебалансировка через `VideoSendingBalancer`
4. Смена трека → автоматическая перебалансировка
5. `ended` / `failed` / `recv-session-started` / `recv-quality-changed` → `stopBalancing()`
6. `recv-session-ended` → повторное планирование запуска

## Основные методы

| Метод              | Назначение                                               |
| ------------------ | -------------------------------------------------------- |
| `startBalancing()` | Принудительный запуск балансировки и подписки на события |
| `stopBalancing()`  | Остановка, отписка и сброс параметров отправителя        |
| `balance()`        | Разовая ручная балансировка                              |

## Связанные компоненты

- [`VideoSendingBalancer`](../../../../src/VideoSendingBalancer/README.md) — фасад балансировки
- [`CallManager`](../CallManager/index.md) — события звонка и `connection`
- [`ApiManager`](../ApiManager/index.md) — события `main-cam-control`

## Связанные рецепты

- [Управление видеобалансировщиком](../../../recipes/video-balancing.md)
- [Управление медиа-потоками](../../../recipes/media-management.md)
