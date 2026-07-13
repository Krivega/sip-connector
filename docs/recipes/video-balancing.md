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

1. `peerconnection:confirmed` → планирование запуска через `balancingStartDelay` (по умолчанию 10 с)
2. По таймеру → `balance()` + `subscribe()`
3. События `main-cam-control` → перебалансировка
4. Смена видеотрека → автоматическая перебалансировка
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
```
