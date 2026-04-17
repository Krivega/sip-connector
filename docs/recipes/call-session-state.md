# Единая синхронизация состояния звонка через CallSessionState

`CallSessionState` — это отдельный агрегированный read-model модуль (уровень `src/CallSessionState`), который:

- хранит текущую роль (`role`);
- вычисляет производные role-флаги для UI (`derived`);
- синхронизирует `license` из `api:use-license`.

В `SipConnector` этот модуль создается отдельно и передается в `CallManager` через DI.  
Для клиентов публичная точка доступа — `sipConnector.callSessionState`.

## Когда применять

Используйте `CallSessionState`, если клиент сейчас:

- вручную отслеживает изменения роли;
- получает лишние ререндеры из-за рассинхронизации событий.

## Базовый пример

```typescript
// Текущий агрегированный снимок
const snapshot = sipConnector.callSessionState.getSnapshot();

console.log(snapshot.role.type); // participant | spectator | spectator_synthetic
console.log(snapshot.derived.isSpectatorAny);
console.log(snapshot.license); // AUDIO | VIDEO | AUDIOPLUSPRESENTATION | undefined
```

## Подписка на весь snapshot

```typescript
const unsubscribe = sipConnector.callSessionState.subscribe((snapshot) => {
  callSessionStore.syncFromCallSessionSnapshot(snapshot);
});

// ... позже
unsubscribe();
```

## Интеграция с MST (пример из demo)

```typescript
// statusesRoot/Model.ts
syncFromCallSessionSnapshot(snapshot: TCallSessionSnapshot) {
  applySnapshot(self.callSession, createCallSessionStatusSnapshot(snapshot));
}
```

Такой путь позволяет обновлять отдельную role-модель напрямую из `CallSessionState`, не затрагивая ветку `call` из `SessionSnapshot`.

## Что синхронизируется

`CallSessionState` формирует snapshot из двух источников:

- `RoleManager` (`role`, `derived`);
- `ApiManager` событие `use-license` (`license`).

События с семантически неизменным snapshot (тот же role branch и `audioId`, та же `license`) дедуплицируются и не эмитятся повторно.

## Диагностика и feedback loop

Для контроля качества подписок используйте:

```typescript
const diagnostics = sipConnector.callSessionState.getDiagnostics();

console.log(diagnostics.emitsTotal);
console.log(diagnostics.dedupedTotal);
console.log(diagnostics.subscribersCount);
```

Рекомендации:

1. Если `emitsTotal` растет быстрее ожидаемого UI-апдейта — проверьте дублирующиеся подписки.
2. Если `dedupedTotal` стабильно низкий — проверьте, не происходят ли лишние доменные изменения.
3. Периодически собирайте обратную связь от потребителей (`UI`, интеграции): стало ли проще поддерживать статусную синхронизацию.

## Миграция с ручной синхронизации

1. Оставьте текущие API чтения жизненного цикла звонка (`SessionManager`/`CallStateMachine`) без удаления.
2. Добавьте `sipConnector.callSessionState.subscribe(...)` в клиент и запитайте новый store-слой.
3. Переведите UI на чтение `snapshot.role`/`snapshot.derived` из одного обработчика подписки.
4. Удалите legacy-подписки на старые источники только после стабилизации метрик и тестов.
