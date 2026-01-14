# WebRTC Статистика

## Обзор возможностей

SDK предоставляет детальную WebRTC-статистику, основанную на [W3C WebRTC Statistics API](https://www.w3.org/TR/webrtc-stats/), включающую:

| Тип статистики     | Описание              | Метрики                       |
| ------------------ | --------------------- | ----------------------------- |
| **RTP статистика** | Потоковые данные      | Пакеты, байты, jitter, loss   |
| **Кодеки**         | Параметры кодирования | Параметры, реализация         |
| **ICE кандидаты**  | Сетевые соединения    | Типы, приоритеты, состояния   |
| **Транспорт**      | Защищенные соединения | DTLS, соединения, сертификаты |

## Использование статистики

```typescript
import { StatsPeerConnection, EStatsTypes, hasAvailableStats } from 'sip-connector';

// Проверка доступности
if (hasAvailableStats()) {
  const statsCollector = new StatsPeerConnection();

  // Подписка на события статистики
  statsCollector.on('collected', ({ outbound, inbound }) => {
    console.log('Исходящая статистика:', outbound);
    console.log('Входящая статистика:', inbound);

    // Новая метрика availableIncomingBitrate
    if (inbound.additional?.candidatePair?.availableIncomingBitrate) {
      console.log(
        'Доступный входящий битрейт:',
        inbound.additional.candidatePair.availableIncomingBitrate,
      );
    }

    // Анализ качества соединения
    analyzeConnectionQuality(outbound, inbound);
  });

  // Запуск сбора статистики с адаптивным интервалом
  statsCollector.start(peerConnection);
}
```

## Адаптивный интервал сбора статистики

SDK автоматически адаптирует частоту сбора статистики в зависимости от времени выполнения:

| Время выполнения | Множитель интервала | Интервал (мс) |
| ---------------- | ------------------- | ------------- |
| < 16 мс          | 1x                  | 1000          |
| 16-32 мс         | 2x                  | 2000          |
| 32-48 мс         | 3x                  | 3000          |
| > 48 мс          | 4x                  | 4000          |

```typescript
// Мониторинг производительности сбора статистики
statsCollector.on('collected', (stats) => {
  const collectionTime = performance.now() - startTime;
  console.log(`Статистика собрана за ${collectionTime}мс`);
});
```

## Типы статистики

| Категория              | Типы                              | Описание                                   |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| **Аудио потоки**       | `TInboundAudio`, `TOutboundAudio` | RTP, кодек, jitter buffer, audio level     |
| **Видео потоки**       | `TInboundVideo`, `TOutboundVideo` | RTP, кодек, frames, bitrate, resolution    |
| **Сетевая информация** | `TAdditional`                     | ICE кандидаты, DTLS транспорт, сертификаты |
