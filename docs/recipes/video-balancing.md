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
   пока браузер прогревает отправку, параметры отправителя не ужесточаются (кроме ручного
   `balance()`); перехват замены трека включается сразу
2. По таймеру → `startBalancing()`: первая балансировка с последней запомненной командой сервера,
   затем `balancing-started` — и при ошибке первой балансировки: её повторит сверка по тику
3. События `main-cam-control` → при активной балансировке перебалансировка; пока запуск
   запланирован — команда только запоминается до старта по таймеру; иначе команда не принимается
4. Смена видеотрека при активной балансировке → параметры нового трека применяются до замены, если
   они строже текущих, и сразу после неё; команда сервера или старт балансировки во время уже идущей
   замены применяются к новому треку сразу. Записи параметров замена ждёт, пока они завершаются:
   после 1 с без завершения хотя бы одной записи отправителя до смены трека меняет трек без
   подготовки; параметры нового трека применяются после зависшей записи
5. Пока балансировка активна, она сама замечает смену отправителя, замену трека мимо неё и изменение
   размера трека и повторяет балансировку, завершившуюся ошибкой
6. `ended` / `failed` / `recv-session-started` / `recv-quality-changed` → `stopBalancing()`: команда
   стирается, параметры отправителя возвращаются к параметрам по треку
7. `recv-session-ended` → повторное планирование запуска

Правила, по которым балансировщик решает, что применить в каждом состоянии, и его известные пределы
описаны в [`VideoSendingBalancer`](../../src/VideoSendingBalancer/README.md).

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

`startBalancing()` без соединения отклоняется ошибкой `connection is not exist` и ничего не меняет:
запланированный запуск остаётся, `balancing-started` не приходит.

`balance()` при активной балансировке применяет текущую команду сервера и отклоняет промис при
ошибке запроса кодека или применения параметров. В остальное время, в том числе во время прогрева
(запуск запланирован или старт по таймеру не удался без соединения), параметры применяются один раз
по разрешению трека и `maxAvailableResolution`, без команды сервера, и могут стать строже текущих.
Запомненную в прогреве команду ручной вызов не применяет и запланированный запуск не отменяет:
команду применит старт — по таймеру, а если старт по таймеру уже не удался, то следующее
планирование (`peerconnection:confirmed`, `recv-session-ended`) или `startBalancing()`. Без
соединения промис отклоняется ошибкой `connection is not exist`.
