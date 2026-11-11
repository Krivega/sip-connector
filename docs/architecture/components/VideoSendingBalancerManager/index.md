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

1. `peerconnection:confirmed` → планирование запуска через `balancingStartDelay`
2. По таймеру → `startBalancing()`: перехват замены трека и слежение за треком включаются сразу,
   затем первая балансировка с последней запомненной командой сервера
3. События `main-cam-control` → при активной балансировке перебалансировка через
   `VideoSendingBalancer`; пока запуск запланирован — команда только запоминается до старта по
   таймеру; иначе команда игнорируется
4. Смена трека → масштаб нового трека заранее, если он строже (кодек не запрашивается; при заданном
   `ignoreForCodec` параметры заранее не меняются); если применить его не удалось, ошибка
   логируется, трек всё равно заменяется. Замена отклоняется только ошибкой самого `replaceTrack`;
   при этом масштаб оставшегося трека возвращается. После успешной замены выполняется обычная
   балансировка; параметры, которые вызывающий код выставляет сразу после `replaceTrack`, она затем
   перекрывает. Кодек балансировка запрашивает до очереди изменений отправителя: зависший запрос не
   задерживает очередь и замену трека
5. `ended` / `failed` / `recv-session-started` / `recv-quality-changed` → `stopBalancing()`
6. `recv-session-ended` → повторное планирование запуска

## Основные методы

| Метод              | Назначение                                                |
| ------------------ | --------------------------------------------------------- |
| `startBalancing()` | Принудительный запуск балансировки                        |
| `stopBalancing()`  | Остановка, сброс команды сервера и параметров отправителя |
| `balance()`        | Ручная балансировка; во время прогрева ничего не меняет   |

## Связанные компоненты

- [`VideoSendingBalancer`](../../../../src/VideoSendingBalancer/README.md) — фасад балансировки
- [`CallManager`](../CallManager/index.md) — события звонка и `connection`
- [`ApiManager`](../ApiManager/index.md) — события `main-cam-control`

## Связанные рецепты

- [Управление видеобалансировщиком](../../../recipes/video-balancing.md)
- [Управление медиа-потоками](../../../recipes/media-management.md)
