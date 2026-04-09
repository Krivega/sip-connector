# ApiManager (Серверное API)

**Назначение**: Обработка SIP INFO сообщений и взаимодействие с сервером.

## Ключевые возможности

- Обработка команд от сервера
- Отправка состояния медиа
- Управление DTMF-сигналами
- Синхронизация каналов
- Обработка событий перемещения участников

## Основные методы

- `sendMediaState()` - отправка состояния медиа
- `sendDTMF()` - отправка DTMF-сигналов
- `waitChannels()` - ожидание каналов
- `askPermissionToEnableCam()` - запрос разрешений

## Внутренние компоненты

### PeerToPeerManager

Управление direct peer-to-peer звонками

- Автоматическое определение и отправка информации о direct P2P комнате
- Генерация имени комнаты в формате `p2p{user}to{number}` (для инициатора) или `p2p{number}to{user}` (для отвечающего)
- Отправка SIP INFO через `CallManager.sendEnterRoom()` с заголовками:
  - `CONTENT_ENTER_ROOM`: имя комнаты (например, `p2p100to200`)
  - `PARTICIPANT_NAME`: имя пользователя из UA configuration
  - `IS_DIRECT_PEER_TO_PEER`: `true` (булевый флаг)
- Срабатывает при событиях `accepted` (для инициатора) и `confirmed` (для отвечающего) от CallManager
- Использует данные из `CallManager` (number, isCallInitiator, isCallAnswerer) и `ConnectionManager` (user из UA configuration)
- Отправленное событие `enter-room` обрабатывается ApiManager и приводит к переходу CallStateMachine в состояние `DIRECT_P2P_ROOM`
