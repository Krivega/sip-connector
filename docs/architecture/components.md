# Компоненты SIP Connector

Детальное описание всех менеджеров и их внутренних компонентов.

Документация разбита по отдельным файлам для каждого компонента:

## Основные менеджеры

- [SessionManager](./components/SessionManager/index.md) - Агрегатор состояний сеанса, единый интерфейс для работы с состояниями всех машин
- [ConnectionManager](./components/ConnectionManager/index.md) - Управление SIP-соединениями и регистрацией на сервере
- [ConnectionQueueManager](./components/ConnectionQueueManager/index.md) - Очередь операций подключения
- [AutoConnectorManager](./components/AutoConnectorManager/index.md) - Автоматическое переподключение
- [CallManager](./components/CallManager/index.md) - Управление WebRTC-звонками
- [ApiManager](./components/ApiManager/index.md) - Обработка SIP INFO сообщений и взаимодействие с сервером
- [PresentationManager](./components/PresentationManager/index.md) - Управление демонстрацией экрана
- [IncomingCallManager](./components/IncomingCallManager/index.md) - Обработка входящих SIP-звонков

## Вспомогательные компоненты

- [StatsManager](./components/StatsManager/index.md) - Сбор и мониторинг WebRTC статистики
- [MainStreamHealthMonitor](./components/MainStreamHealthMonitor/index.md) - Мониторинг здоровья видеопотока
- [MainStreamRecovery](./components/MainStreamRecovery/index.md) - Восстановление видеопотока
- [VideoSendingBalancerManager](./components/VideoSendingBalancerManager/index.md) - Балансировка видео
