### План рефакторинга

#### 1. Разделение ответственности

**Создать новые классы:**

```typescript
// Контроллер/фасад
class VideoSendingBalancer {
  private readonly eventHandler: VideoSendingEventHandler;
  private readonly senderBalancer: SenderBalancer;
  private readonly taskQueue: TaskQueue<TResult>;

  constructor(sipConnector: SipConnector, options: BalancerOptions) {
    this.eventHandler = new VideoSendingEventHandler(sipConnector);
    this.senderBalancer = new SenderBalancer(options);
    this.taskQueue = new TaskQueue();
  }

  subscribe(): void {
    this.eventHandler.subscribe(this.handleMainCamControl.bind(this));
  }

  private async handleMainCamControl(headers: MainCamHeaders): Promise<void> {
    const result = await this.senderBalancer.balance(headers);
    this.taskQueue.add(() => this.applyResult(result));
  }
}

// Бизнес-логика балансировки
class SenderBalancer {
  private readonly strategies: Map<EEventsMainCAM, BalancingStrategy>;

  constructor(options: BalancerOptions) {
    this.strategies = this.createStrategies(options);
  }

  async balance(headers: MainCamHeaders): Promise<TResult> {
    const strategy = this.strategies.get(headers.mainCam) ?? this.strategies.get(undefined);
    return strategy.execute(headers);
  }
}

// Обработчик событий
class VideoSendingEventHandler {
  constructor(private readonly sipConnector: SipConnector) {}

  subscribe(handler: (headers: MainCamHeaders) => void): void {
    this.sipConnector.on('api:main-cam-control', handler);
  }

  unsubscribe(): void {
    this.sipConnector.off('api:main-cam-control');
  }
}

// Очередь задач
class TaskQueue<T> {
  private readonly stackPromises = createStackPromises<T>();

  add(task: () => Promise<T>): Promise<T> {
    this.stackPromises.add(task);
    return this.execute();
  }

  private async execute(): Promise<T> {
    return this.stackPromises().catch((error: unknown) => {
      logger.error('TaskQueue: error', error);
      throw error; // Пробрасываем ошибку наружу
    });
  }
}
```

#### 2. Вынесение констант и конфигурации

```typescript
// Константы
const SCALE_RESOLUTION = {
  DOWNGRADED: 200,
  DEFAULT: 1,
} as const;

const BITRATE_LIMITS = {
  MIN: getMinimumBitrate,
  MAX: getMaximumBitrate,
} as const;

// Конфигурация
interface BalancerOptions {
  ignoreForCodec?: string;
  onSetParameters?: TOnSetParameters;
  scaleResolution?: typeof SCALE_RESOLUTION;
  bitrateLimits?: typeof BITRATE_LIMITS;
}
```

#### 3. Улучшение обработки ошибок

```typescript
// Типобезопасный resultNoChanged
private createNoChangedResult(): TResult {
  return {
    isChanged: false,
    parameters: {
      encodings: [{}],
      transactionId: '0',
      codecs: [],
      headerExtensions: [],
      rtcp: {},
    },
  };
}

// Правильная обработка ошибок
private async executeTask<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    logger.error('VideoSendingBalancer: error', error);
    return this.createNoChangedResult() as T;
  }
}
```

#### 4. Стратегия вместо switch

```typescript
// Интерфейс стратегии
interface BalancingStrategy {
  execute(context: BalancingContext): Promise<TResult>;
}

// Контекст для стратегий
interface BalancingContext {
  sender: RTCRtpSender;
  videoTrack: MediaStreamVideoTrack;
  codec?: string;
  resolutionMainCam?: string;
}

// Реализации стратегий
class PauseMainCamStrategy implements BalancingStrategy {
  async execute({ sender, codec }: BalancingContext): Promise<TResult> {
    const scaleResolutionDownBy = SCALE_RESOLUTION.DOWNGRADED;
    const maxBitrate = BITRATE_LIMITS.MIN(codec);

    return setEncodingsToSender(sender, { scaleResolutionDownBy, maxBitrate });
  }
}

class ResumeMainCamStrategy implements BalancingStrategy {
  async execute({ sender, videoTrack, codec }: BalancingContext): Promise<TResult> {
    const settings = videoTrack.getSettings();
    const widthCurrent = settings.width;

    const maxBitrate =
      widthCurrent === undefined
        ? BITRATE_LIMITS.MAX(codec)
        : calcMaxBitrateByWidthAndCodec(widthCurrent, codec);

    return setEncodingsToSender(sender, {
      scaleResolutionDownBy: SCALE_RESOLUTION.DEFAULT,
      maxBitrate,
    });
  }
}

class MaxResolutionStrategy implements BalancingStrategy {
  async execute({
    sender,
    videoTrack,
    codec,
    resolutionMainCam,
  }: BalancingContext): Promise<TResult> {
    if (!resolutionMainCam) {
      return new ResumeMainCamStrategy().execute({ sender, videoTrack, codec });
    }

    const [widthTarget, heightTarget] = resolutionMainCam.split('x');
    const targetSize = {
      width: Number(widthTarget),
      height: Number(heightTarget),
    };

    const scaleResolutionDownBy = calcScaleResolutionDownBy({ videoTrack, targetSize });
    const maxBitrate = calcMaxBitrateByWidthAndCodec(targetSize.width, codec);

    return setEncodingsToSender(sender, { scaleResolutionDownBy, maxBitrate });
  }
}
```

#### 5. Улучшение тестируемости через DI

```typescript
// Интерфейсы для зависимостей
interface ISenderFinder {
  findVideoSender(senders: RTCRtpSender[]): RTCRtpSender | undefined;
}

interface ICodecProvider {
  getCodecFromSender(sender: RTCRtpSender): Promise<string>;
}

interface IParametersSetter {
  setEncodingsToSender(
    sender: RTCRtpSender,
    parameters: EncodingParameters,
    onSetParameters?: TOnSetParameters,
  ): Promise<TResult>;
}

// Внедрение зависимостей
class SenderBalancer {
  constructor(
    private readonly senderFinder: ISenderFinder,
    private readonly codecProvider: ICodecProvider,
    private readonly parametersSetter: IParametersSetter,
    options: BalancerOptions,
  ) {
    this.strategies = this.createStrategies(options);
  }
}
```

#### 6. Документация и комментарии

````typescript
/**
 * Балансировщик видеопотоков для управления качеством передачи
 *
 * @param sipConnector - Экземпляр SipConnector для подписки на события
 * @param options - Опции конфигурации
 *
 * @example
 * ```typescript
 * const balancer = new VideoSendingBalancer(sipConnector, {
 *   ignoreForCodec: 'H264',
 *   onSetParameters: (result) => console.log('Parameters set:', result)
 * });
 *
 * balancer.subscribe();
 * ```
 */
class VideoSendingBalancer {
  /**
   * Подписывается на события управления главной камерой
   */
  public subscribe(): void {
    // ...
  }

  /**
   * Отписывается от событий и сбрасывает состояние
   */
  public unsubscribe(): void {
    // ...
  }
}
````

### Метрики прогресса

1. **Сокращение покрытия `VideoSendingBalancer` в unit-тестах до ≤ 20%**
   - Остальное покрытие переносится в новые, мелкие модули

2. **100% юнит-тесты бизнес-логики `SenderBalancer`**
   - Тестирование стратегий без зависимости от `SipConnector`

3. **Показатель `cyclomatic complexity` каждого метода ≤ 5**
   - Упрощение логики через разделение на стратегии

4. **Удаление всех «магических» чисел из кода-продукта**
   - Вынесение в константы и конфигурацию

5. **Улучшение покрытия тестами до 90%+**
   - За счёт упрощения компонентов и внедрения зависимостей

### Приоритеты выполнения

1. **Высокий приоритет:**
   - Разделение ответственности (контроллер, сервис, очередь)
   - Вынесение констант
   - Исправление обработки ошибок

2. **Средний приоритет:**
   - Замена switch на стратегии
   - Внедрение зависимостей через DI
   - Улучшение документации

3. **Низкий приоритет:**
   - Потенциальное кеширование результатов
   - Дополнительные оптимизации производительности

### Ожидаемые результаты

- **Упрощение поддержки:** каждый класс имеет одну ответственность
- **Улучшение тестируемости:** возможность тестировать бизнес-логику изолированно
- **Повышение читаемости:** устранение магических чисел и дублирования
- **Гибкость:** легко добавлять новые стратегии балансировки
- **Надёжность:** правильная обработка ошибок и типобезопасность
