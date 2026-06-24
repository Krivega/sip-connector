# Синхронизация роли звонка через SessionManager

Роль звонка читается из единого снапшота `sipConnector.sessionManager`.

Внутри `TSessionSnapshot` поле `callSessionState` содержит:

- текущую роль (`role`);
- производные role-флаги для UI (`derived`);
- `license` из события `api:use-license`.

Не подписывайтесь на роль отдельно от статуса звонка. Для клиентской логики используйте один снапшот `sessionManager`: так роль и `call`-статус согласованы в рамках одной реакции.

## Когда применять

Используйте этот подход, если клиент:

- вручную отслеживает изменения роли;
- одновременно зависит от роли и жизненного цикла звонка;
- получает ложные реакции из-за независимых подписок на разные источники.

## Базовый пример

```typescript
const snapshot = sipConnector.sessionManager.getSnapshot();
const { role, derived, license } = snapshot.callSessionState;

renderCallRole({
  role: role.type, // participant | spectator | spectator_synthetic
  isSpectator: derived.isSpectatorAny,
  license, // AUDIO | VIDEO | AUDIOPLUSPRESENTATION | undefined
});
```

## Подписка на role snapshot

```typescript
const unsubscribe = sipConnector.sessionManager.subscribe(
  (snapshot) => snapshot.callSessionState,
  (callSessionState) => {
    callSessionStore.syncFromCallSessionSnapshot(callSessionState);
  },
);

// ... позже
unsubscribe();
```

## Интеграция с MST (пример из demo)

```typescript
// statusesRoot/Model.ts
syncFromSessionSnapshot(snapshot: TSessionSnapshot) {
  applySnapshot(self.callSession, createCallSessionStatusSnapshot(snapshot.callSessionState));
}
```

Такой путь обновляет role-модель из общего `SessionSnapshot` и оставляет доступ к соседним веткам (`call`, `connection`, `callReconnect`) в той же реакции.

## Что синхронизируется

Ветка `callSessionState` формируется из двух источников:

- `RoleManager` (`role`, `derived`);
- `ApiManager` событие `use-license` (`license`).

Семантически неизменные обновления роли дедуплицируются внутри read-model, а клиент получает уже агрегированный снапшот через `sessionManager`.

## Миграция с ручной синхронизации

1. Найдите места, где роль и статус звонка читаются из независимых подписок.
2. Замените их одной подпиской на `sipConnector.sessionManager`.
3. Переведите UI на чтение `snapshot.callSessionState.role` и `snapshot.callSessionState.derived`.
4. Для условий, завязанных на активный звонок, используйте `sessionSelectors.selectIsInCall(snapshot)`.
