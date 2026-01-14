# Диаграмма мониторинга и восстановления основного входящего видеопотока

Следующая диаграмма показывает взаимодействие компонентов при мониторинге здоровья основного видеопотока и его автоматическом восстановлении:

```mermaid
sequenceDiagram
    participant StatsManager
    participant MainStreamHealthMonitor
    participant SipConnector
    participant MainStreamRecovery
    participant CallManager

    loop Сбор статистики
        StatsManager->>StatsManager: Сбор WebRTC статистики
        StatsManager->>StatsManager: Проверка isInvalidInboundFrames<br/>(пакеты приходят, но фреймы не обрабатываются)
        StatsManager->>MainStreamHealthMonitor: Событие 'collected'
    end

    MainStreamHealthMonitor->>MainStreamHealthMonitor: Проверка isInvalidInboundFrames
    MainStreamHealthMonitor->>CallManager: Получение основного видеопотока
    CallManager-->>MainStreamHealthMonitor: mainVideoTrack
    MainStreamHealthMonitor->>MainStreamHealthMonitor: Проверка isMutedMainVideoTrack

    alt Проблема обнаружена
        MainStreamHealthMonitor->>SipConnector: Событие 'no-inbound-frames'
        SipConnector->>MainStreamRecovery: recover()
        MainStreamRecovery->>MainStreamRecovery: Throttling (3000ms)
        MainStreamRecovery->>CallManager: renegotiate()
        CallManager->>CallManager: Выполнение renegotiate
        CallManager-->>MainStreamRecovery: Результат renegotiate
    end
```
