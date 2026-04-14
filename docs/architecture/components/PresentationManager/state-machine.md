# PresentationStateMachine (Состояния демонстрации экрана)

Внутренний компонент `PresentationManager`, управляющий состояниями демонстрации экрана через XState с валидацией допустимых операций и предотвращением некорректных переходов.

## Интеграция с менеджером

- **Доменные события машины:** `SCREEN.STARTING`, `SCREEN.STARTED`, `SCREEN.ENDING`, `SCREEN.ENDED`, `SCREEN.FAILED`, `CALL.ENDED`, `CALL.FAILED`, `PRESENTATION.RESET`.
- **Источники событий:** `CallManager.events` — `presentation:start`, `presentation:started`, `presentation:end`, `presentation:ended`, `presentation:failed`, `ended`, `failed`; сброс при потере соединения обрабатывается на уровне менеджера (не отдельными переходами в этой машине).

## Диаграмма переходов (Mermaid)

Граф соответствует [`PresentationStateMachine.ts`](../../../../src/PresentationManager/PresentationStateMachine.ts).

```mermaid
stateDiagram-v2
    [*] --> idle
    state "presentation:idle" as idle
    state "presentation:starting" as starting
    state "presentation:active" as active
    state "presentation:stopping" as stopping
    state "presentation:failed" as failed

    idle --> starting: SCREEN.STARTING
    starting --> active: SCREEN.STARTED
    starting --> failed: SCREEN.FAILED
    starting --> idle: SCREEN.ENDED
    starting --> idle: CALL.ENDED
    starting --> failed: CALL.FAILED
    active --> stopping: SCREEN.ENDING
    active --> idle: SCREEN.ENDED
    active --> idle: CALL.ENDED
    active --> failed: SCREEN.FAILED
    active --> failed: CALL.FAILED
    stopping --> idle: SCREEN.ENDED
    stopping --> idle: CALL.ENDED
    stopping --> failed: SCREEN.FAILED
    stopping --> failed: CALL.FAILED
    failed --> starting: SCREEN.STARTING
    failed --> idle: SCREEN.ENDED
    failed --> idle: PRESENTATION.RESET
```

## Типобезопасная обработка ошибок

Машина использует типобезопасную обработку ошибок: `lastError: Error | undefined`.

## Публичный API

### Геттеры состояний

- `isIdle` — проверка состояния IDLE
- `isStarting` — проверка состояния STARTING
- `isActive` — проверка состояния ACTIVE
- `isStopping` — проверка состояния STOPPING
- `isFailed` — проверка состояния FAILED

### Комбинированные геттеры

- `isPending` — проверка состояний starting/stopping
- `isActiveOrPending` — проверка состояний active/starting/stopping

### Геттер ошибки

- `lastError` — последняя ошибка (если есть)

### Методы управления

- `reset()` — сброс состояния в IDLE

## Граф переходов

### Основной путь

- **IDLE → STARTING → ACTIVE → STOPPING → IDLE**

### Переходы в FAILED

Из состояний STARTING/ACTIVE/STOPPING:

- Через `SCREEN.FAILED`
- При ошибке звонка — `CALL.FAILED`

### Переход RESET

- **FAILED → IDLE** — через `PRESENTATION.RESET`

### Прерывание при сбросе звонка

При завершении звонка (`ended` → `CALL.ENDED`, ошибка `failed` → `CALL.FAILED`) из состояний STARTING/ACTIVE/STOPPING происходит переход в IDLE или FAILED по графу выше.

### Убранные переходы

Убран нелогичный переход **IDLE → FAILED** (презентация не может зафейлиться до старта).

### Переходы из FAILED

- **FAILED → STARTING** — повторная попытка через `SCREEN.STARTING`
- **FAILED → IDLE** — через `PRESENTATION.RESET` или `SCREEN.ENDED`

## Обработка ошибок

Автоматическое создание Error из не-Error значений: для объектов используется `JSON.stringify` для преобразования в строку перед созданием Error.

## Логирование

Все переходы состояний и недопустимые операции логируются через `console.warn` для отладки и мониторинга.
