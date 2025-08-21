# Таблица зависимости битрейта от разрешения и кодека

Данная таблица показывает максимальные битрейты для различных разрешений и кодеков на основе алгоритма `calcMaxBitrateByWidthAndCodec`.

## Алгоритм расчета

Битрейт рассчитывается в два этапа:

1. **По разрешению**: Функция `calcMaxBitrateByWidth` определяет базовый битрейт по максимальной ширине кадра
2. **По кодеку**: Функция `scaleBitrateByCodec` применяет коэффициент масштабирования для AV1 кодека (0.6x)

## Типы потоков

### Основной поток (камера)

Использует адаптивный битрейт, который рассчитывается на основе разрешения и кодека согласно таблице ниже.

### Поток презентации

Использует **фиксированный битрейт** равный `ONE_MEGABIT_IN_BITS = 1e6` (1 Мбит/с = 1000 кбит/с), независимо от разрешения и кодека.

## Таблица битрейтов для основного потока (камера)

| Разрешение (ширина) | Базовый битрейт | H.264/H.265/VP8/VP9 | AV1          |
| ------------------- | --------------- | ------------------- | ------------ |
| ≤ 64px              | 0.06 Мбит/с     | 0.06 Мбит/с         | 0.036 Мбит/с |
| ≤ 128px             | 0.12 Мбит/с     | 0.12 Мбит/с         | 0.072 Мбит/с |
| ≤ 256px             | 0.25 Мбит/с     | 0.25 Мбит/с         | 0.15 Мбит/с  |
| ≤ 384px             | 0.32 Мбит/с     | 0.32 Мбит/с         | 0.192 Мбит/с |
| ≤ 426px             | 0.38 Мбит/с     | 0.38 Мбит/с         | 0.228 Мбит/с |
| ≤ 640px             | 0.5 Мбит/с      | 0.5 Мбит/с          | 0.3 Мбит/с   |
| ≤ 848px             | 0.7 Мбит/с      | 0.7 Мбит/с          | 0.42 Мбит/с  |
| ≤ 1280px            | 1.0 Мбит/с      | 1.0 Мбит/с          | 0.6 Мбит/с   |
| ≤ 1920px            | 2.0 Мбит/с      | 2.0 Мбит/с          | 1.2 Мбит/с   |
| > 1920px            | 4.0 Мбит/с      | 4.0 Мбит/с          | 2.4 Мбит/с   |

## Детали реализации

### Константы

- **MINIMUM_BITRATE**: 0.06 Мбит/с (60 кбит/с)
- **MAXIMUM_BITRATE**: 4.0 Мбит/с (4000 кбит/с)
- **FACTOR_CODEC_AV1**: 0.6 (коэффициент для AV1 кодека)
- **ONE_MEGABIT_IN_BITS**: 1e6 (1 Мбит/с = 1000 кбит/с) - фиксированный битрейт для потока презентации

### Функция `calcMaxBitrateByWidth`

```typescript
const calcMaxBitrateByWidth = (maxWidth: number): number => {
  if (maxWidth <= 64) return MINIMUM_BITRATE;
  if (maxWidth <= 128) return megabitsToBits(0.12);
  if (maxWidth <= 256) return megabitsToBits(0.25);
  if (maxWidth <= 384) return megabitsToBits(0.32);
  if (maxWidth <= 426) return megabitsToBits(0.38);
  if (maxWidth <= 640) return megabitsToBits(0.5);
  if (maxWidth <= 848) return megabitsToBits(0.7);
  if (maxWidth <= 1280) return megabitsToBits(1);
  if (maxWidth <= 1920) return megabitsToBits(2);
  return MAXIMUM_BITRATE;
};
```

### Функция `scaleBitrateByCodec`

```typescript
const scaleBitrateByCodec = (bitrate: number, codec?: string): number => {
  if (hasAv1Codec(codec)) {
    return bitrate * FACTOR_CODEC_AV1;
  }
  return bitrate;
};
```

### Определение AV1 кодека

```typescript
const hasAv1Codec = (codec?: string): boolean => {
  return hasIncludesString(codec, 'av1');
};
```

## Примеры использования

### Получение максимального битрейта для конкретного разрешения и кодека

```typescript
import calcMaxBitrateByWidthAndCodec from './calcMaxBitrateByWidthAndCodec';

// Для разрешения 1280x720 и H.264 кодека
const bitrateH264 = calcMaxBitrateByWidthAndCodec(1280, 'H264');
// Результат: 1.0 Мбит/с

// Для разрешения 1280x720 и AV1 кодека
const bitrateAV1 = calcMaxBitrateByWidthAndCodec(1280, 'av1');
// Результат: 0.6 Мбит/с
```

### Получение минимального и максимального битрейта для кодека

```typescript
import { getMinimumBitrate, getMaximumBitrate } from './calcMaxBitrateByWidthAndCodec';

// Минимальный битрейт для H.264
const minH264 = getMinimumBitrate('H264');
// Результат: 0.06 Мбит/с

// Максимальный битрейт для AV1
const maxAV1 = getMaximumBitrate('av1');
// Результат: 2.4 Мбит/с
```

### Использование фиксированного битрейта для презентации

```typescript
import { ONE_MEGABIT_IN_BITS } from '@/SipConnector/constants';

// Создание PresentationManager с фиксированным битрейтом
const presentationManager = new PresentationManager({
  callManager,
  maxBitrate: ONE_MEGABIT_IN_BITS, // 1 Мбит/с
});

// Битрейт для презентации всегда будет 1 Мбит/с
// независимо от разрешения экрана или используемого кодека
```

## Примечания

- Битрейт рассчитывается по максимальной ширине кадра (width)
- Для AV1 кодека применяется коэффициент 0.6, что позволяет достичь того же качества при меньшем битрейте
- Все остальные кодеки (H.264, H.265, VP8, VP9) используют базовый битрейт без масштабирования
- Разрешения группируются по диапазонам для упрощения выбора битрейта
- **Поток презентации** использует фиксированный битрейт 1 Мбит/с для обеспечения стабильного качества демонстрации экрана
