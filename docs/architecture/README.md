# Архитектура SIP Connector

Добро пожаловать в документацию по архитектуре SIP Connector. Эта документация разделена на несколько разделов для удобства навигации.

## Структура документации

### 📋 [Обзор архитектуры](./overview.md)

- Архитектурные слои
- Основные компоненты (SipConnectorFacade, SipConnector)
- Диаграмма архитектуры
- Взаимодействие компонентов

### 🧩 [Компоненты](./components.md)

Детальное описание всех менеджеров и их внутренних компонентов. Каждый компонент находится в своей директории с документацией:

**Основные менеджеры:**

- [SessionManager](./components/SessionManager/index.md) - Агрегатор состояний сеанса, единый интерфейс для работы с состояниями всех машин
- [ConnectionManager](./components/ConnectionManager/index.md) - Управление SIP-соединениями и регистрацией на сервере
  - [State Machine](./components/ConnectionManager/state-machine.md) - ConnectionStateMachine
- [CallManager](./components/CallManager/index.md) - Управление WebRTC-звонками
  - [State Machine](./components/CallManager/state-machine.md) - CallStateMachine
- [PresentationManager](./components/PresentationManager/index.md) - Управление демонстрацией экрана
  - [State Machine](./components/PresentationManager/state-machine.md) - PresentationStateMachine
- [IncomingCallManager](./components/IncomingCallManager/index.md) - Обработка входящих SIP-звонков
  - [State Machine](./components/IncomingCallManager/state-machine.md) - IncomingCallStateMachine
- [ConnectionQueueManager](./components/ConnectionQueueManager/index.md) - Очередь операций подключения
- [AutoConnectorManager](./components/AutoConnectorManager/index.md) - Автоматическое переподключение
- [ApiManager](./components/ApiManager/index.md) - Обработка SIP INFO сообщений и взаимодействие с сервером

**Вспомогательные компоненты:**

- [StatsManager](./components/StatsManager/index.md) - Сбор и мониторинг WebRTC статистики
- [MainStreamHealthMonitor](./components/MainStreamHealthMonitor/index.md) - Мониторинг здоровья видеопотока
- [MainStreamRecovery](./components/MainStreamRecovery/index.md) - Восстановление видеопотока
- [VideoSendingBalancerManager](./components/VideoSendingBalancerManager/index.md) - Балансировка видео

**Особенности структуры:**

- Каждый компонент с машиной состояний имеет отдельный файл `state-machine.md` с детальным описанием
- Комбинированное состояние системы описано в [SessionManager/system-status.md](./components/SessionManager/system-status.md)

### 🔄 [Модель состояний (XState)](./state-machines.md)

Общее описание модели состояний сеанса:

- Диаграмма состояний сеанса (Mermaid)
- Слои архитектуры машин состояний
- Доменные статусы и события
- API для клиентов (`sipConnector.session`)
- Инварианты и гварды
- Ссылки на детальные описания машин состояний в компонентах
- [Комбинированное состояние системы](./components/SessionManager/system-status.md) (ESystemStatus)
- [Тестирование машин состояний](./state-machines-testing.md)

### 🏗️ [Архитектурные принципы](./principles.md)

- Разделение ответственности
- Паттерны проектирования
- SOLID принципы
- Ключевые особенности архитектуры
- Преимущества архитектуры

## Основные концепции

SIP Connector построен на принципах **чистой архитектуры** с использованием современных паттернов проектирования:

- **Модульность** - каждый компонент решает свою задачу
- **Расширяемость** - легко добавлять новые функции
- **Надежность** - предсказуемое поведение через машины состояний (XState)
- **Производительность** - оптимизация на всех уровнях
- **Простота использования** - высокоуровневый API скрывает сложность
- **Типобезопасность** - полная типизация TypeScript с типобезопасными селекторами

## Структура документации компонентов

Документация компонентов организована следующим образом:

```shell
components/
├── ComponentName/
│   ├── index.md          # Описание компонента
│   └── state-machine.md  # Описание машины состояний (если есть)
└── ...
```

## Быстрый старт

1. Начните с [Обзора архитектуры](./overview.md) для понимания общей структуры
2. Изучите [Модель состояний](./state-machines.md) для работы с состояниями через XState
3. Ознакомьтесь с конкретными компонентами в разделе [Компоненты](./components.md)
4. Используйте [Архитектурные принципы](./principles.md) как руководство при разработке

---

**Примечание**: Для получения актуальной информации о конкретных компонентах, обратитесь к соответствующим разделам документации.
