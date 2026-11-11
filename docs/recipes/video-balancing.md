# Управление видеобалансировщиком

## Автоматическая балансировка

`VideoSendingBalancer` интегрирован в `SipConnector` через `VideoSendingBalancerManager` и запускается
автоматически:

```typescript
const sipConnector = new SipConnector(
  { JsSIP: { UA, WebSocketInterface } },
  {
    videoBalancerOptions: {
      ignoreForCodec: 'H264', // Игнорировать H264
      onSetParameters: (result) => {
        console.log('Параметры обновлены:', result);
      },
    },
  },
);

// Подписка на события балансировщика
sipConnector.on('video-balancer:balancing-started', (data) => {
  console.log(`Балансировка запущена через ${data.delay}мс`);
});

sipConnector.on('video-balancer:parameters-updated', (result) => {
  console.log('Обновлены параметры:', result);
});
```

`getMaxResolution` в опциях балансировщика задаёт `SipConnector` автоматически — переопределить его
через `videoBalancerOptions` нельзя.

## Жизненный цикл балансировщика

1. `peerconnection:confirmed` → планирование запуска через `balancingStartDelay` (по умолчанию 10 с):
   пока браузер прогревает отправку, скалирование не применяется
2. По таймеру → `startBalancing()`: перехват замены трека и слежение за треком включаются сразу,
   затем первая балансировка с последней запомненной командой сервера
3. События `main-cam-control` → при активной балансировке перебалансировка; пока запуск
   запланирован — команда только запоминается до старта по таймеру; иначе команда игнорируется
4. Смена видеотрека → масштаб нового трека заранее, если он строже (кодек не запрашивается; при
   заданном `ignoreForCodec` параметры заранее не меняются); если применить его не удалось, ошибка
   логируется, трек всё равно заменяется. Замена отклоняется только ошибкой самого `replaceTrack`;
   при этом масштаб оставшегося трека возвращается. После успешной замены выполняется обычная
   балансировка; параметры, которые вызывающий код выставляет сразу после `replaceTrack`, она затем
   перекрывает. Кодек балансировка запрашивает до очереди изменений отправителя: зависший запрос не
   задерживает очередь и замену трека
5. `ended` / `failed` / `recv-session-started` / `recv-quality-changed` → `stopBalancing()`
6. `recv-session-ended` → повторное планирование запуска

## Ограничение разрешения (`maxAvailableResolution`)

Если в конфигурации подключения задан `maxAvailableResolution`, `SipConnector` добавляет в опции
менеджера callback `getMaxResolution`. `VideoSendingBalancer` передаёт его в `SenderBalancer` при
создании; при каждой балансировке и сбросе callback вызывается заново — лимит всегда актуален.

Лимит влияет на `scaleResolutionDownBy` и `maxBitrate` при:

- первой балансировке после задержки;
- `RESUME_MAIN_CAM` и сбросе;
- смене видеотрека.

Не применяется при `PAUSE_MAIN_CAM` и при `MAX_MAIN_CAM_RESOLUTION` с явным `resolutionMainCam` —
там используется только команда MCU.

Подробнее о внутренней логике: [`VideoSendingBalancer`](../../src/VideoSendingBalancer/README.md).

## События балансировщика

| Событие                              | Описание                   | Данные                 |
| ------------------------------------ | -------------------------- | ---------------------- |
| `video-balancer:balancing-scheduled` | Балансировка запланирована | `{ delay: number }`    |
| `video-balancer:balancing-started`   | Балансировка запущена      | `{ delay: number }`    |
| `video-balancer:balancing-stopped`   | Балансировка остановлена   | -                      |
| `video-balancer:parameters-updated`  | Параметры обновлены        | `RTCRtpSendParameters` |

## Ручное управление балансировкой

```typescript
sipConnector.videoSendingBalancerManager.startBalancing(); // Принудительный запуск
sipConnector.videoSendingBalancerManager.stopBalancing(); // Остановка
sipConnector.videoSendingBalancerManager.balance(); // Ручная балансировка
```

`balance()` при активной балансировке применяет текущую команду сервера и отклоняет промис при
ошибке запроса кодека или применения параметров. Во время прогрева (запуск запланирован) он ничего
не меняет. Вне прогрева и активной балансировки параметры применяются один раз по разрешению трека,
без команды сервера и слежения за треком.
