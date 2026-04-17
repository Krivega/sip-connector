# CallSessionState (read-model роли звонка)

`CallSessionState` — отдельный компонент уровня `SipConnector`, отвечающий за агрегированный снимок роли звонка и связанных derived-флагов.

## Назначение

- Единый источник role-состояния для клиентов.
- Дедупликация изменений snapshot перед уведомлением подписчиков.
- Синхронизация `license` из API-события `use-license`.

## Ключевые возможности

- Единый snapshot: `role + derived + license`.
- Дедупликация повторных семантически равных обновлений.
- Подписка на полный snapshot без selector-API.
- Диагностика потока событий (`emitsTotal`, `dedupedTotal`, `subscribersCount`).

## Источники данных

| Источник             | Данные                                                       |
| -------------------- | ------------------------------------------------------------ |
| `RoleManager`        | `role` (`participant` / `spectator` / `spectator_synthetic`) |
| `ApiManager (event)` | `license` (`AUDIO` / `VIDEO` / `AUDIOPLUSPRESENTATION`)      |

## Основные методы

| Метод                       | Назначение                                    |
| --------------------------- | --------------------------------------------- |
| `getSnapshot()`             | Текущий snapshot: `role + derived + license`. |
| `subscribe(listener)`       | Подписка на полный snapshot.                  |
| `getDiagnostics()`          | Метрики `emits/deduped/subscribers`.          |
| `subscribeToApiEvents(...)` | Подписка на `use-license`.                    |

## Жизненный цикл

1. `SipConnector` создает `CallSessionState`.
2. `SipConnector` инжектит экземпляр в `CallManager`.
3. `CallManager` использует `CallSessionState` для role-orchestration, но не является владельцем компонента.

## Клиентская интеграция

Рекомендуемый доступ — через `sipConnector.callSessionState`.

```typescript
const snapshot = sipConnector.callSessionState.getSnapshot();

const unsubscribe = sipConnector.callSessionState.subscribe((next) => {
  console.log(next.role.type, next.license);
});

unsubscribe();
```
