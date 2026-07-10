# ConnectAndCallSessionManager (lifecycle connect + call)

`ConnectAndCallSessionManager` управляет полным lifecycle сценария connect + call, не дублируя
логику подключения, мониторинга signaling и redial.

## Ключевые возможности

- эксклюзивно запускает `AutoConnectorManager` для всей продолжительности сессии;
- запускает переданную `SipConnector` стратегию первого звонка;
- сохраняет signaling при recoverable network failure, пока `CallReconnectManager` выполняет redial;
- выполняет единый идемпотентный cleanup после финального или ручного завершения;
- предоставляет `hangUp()`, `disconnect()` и `waitUntilClosed()`.

## Состояния

| Состояние      | Назначение                                    |
| -------------- | --------------------------------------------- |
| `idle`         | Сессия ещё не запущена                        |
| `connecting`   | Запускается AutoConnector                     |
| `calling`      | Запускается первый звонок                     |
| `active`       | Звонок активен                                |
| `reconnecting` | CallReconnectManager восстанавливает звонок   |
| `finalizing`   | Выполняется cleanup после финального исхода   |
| `cancelling`   | Выполняется cleanup по ручной команде         |
| `closed`       | Ресурсы освобождены, AutoConnector остановлен |

## Инварианты

1. Новый lifecycle можно запустить только при `AutoConnectorManager.isActive === false`.
2. `SipConnector` хранит не более одной незакрытой connect + call session. Повторный запуск
   возвращает `session-active`.
3. Решение `redial` или `finish` принимает только `CallReconnectManager`.
4. При `redial` AutoConnector не останавливается.
5. Cleanup выполняется один раз: disarm/cancel redial, завершение активного звонка,
   `stopAutoConnect()`, удаление подписок.
6. `stopAutoConnect()` является канонической операцией отключения signaling, поскольку она также
   останавливает retry, ping и подписки на сетевые события.

## Владение сессией

`SipConnector` регистрирует session до запуска AutoConnector и освобождает ссылку только после
`CLOSED` либо ошибки старта. Поэтому `SipConnector.hangUp()` и `SipConnector.disconnect()`, а также
соответствующие методы фасада, делегируются активной session и выполняют тот же полный cleanup, что
и методы возвращённого session handle.

Session завершает звонок через внутренний teardown-примитив. Он не вызывает публичный `hangUp()`,
что исключает рекурсию при делегировании.

## Публичный API

Lifecycle создаётся внутри `SipConnector.connectAndCallToServer()`. Фасад делегирует ему сценарий,
передавая `callToServer()` как стратегию первого звонка. Успешный результат возвращает `session`
вместе с `configuration` и `peerConnection`:

```typescript
const result = await facade.connectAndCallToServer(parameters);

if (result.isSuccessful) {
  // Оба варианта выполняют одинаковый полный cleanup.
  await facade.hangUp();
  const closeReason = await result.session.waitUntilClosed();
}
```
