# Управление участниками конференции

## Отслеживание перемещений

```typescript
// Подписка на перемещение в зрители (новый формат с audioId)
const unsubscribeMoveToSpectators = sipConnector.on(
  'api:participant:move-request-to-spectators',
  (data) => {
    if (data.isSynthetic) {
      console.log('Участник перемещен в зрители (синтетическое событие)');
    } else {
      console.log('Участник перемещен в зрители с audioId:', data.audioId);
    }
    updateParticipantRole('spectator');
  },
);

// Подписка на перемещение в зрители (старый формат для обратной совместимости)
const unsubscribeMoveToSpectatorsSynthetic = sipConnector.on(
  'api:participant:move-request-to-spectators-synthetic',
  () => {
    console.log('Участник перемещен в зрители (старый формат)');
    updateParticipantRole('spectator');
  },
);

// Подписка на перемещение в участники
const unsubscribeMoveToParticipants = sipConnector.on(
  'api:participant:move-request-to-participants',
  () => {
    console.log('Участник перемещен в участники');
    updateParticipantRole('participant');
  },
);

// Отписка при необходимости
unsubscribeMoveToSpectators();
unsubscribeMoveToSpectatorsSynthetic();
unsubscribeMoveToParticipants();
```

## Административные функции

```typescript
// Принудительная остановка презентации
facade.onMustStopPresentation(() => {
  console.log('Администратор требует остановить презентацию');
  facade.stopShareSipConnector();
});

// Мониторинг лицензий
facade.onUseLicense((license) => {
  console.log('Используется лицензия:', license);
  updateLicenseStatus(license);
});
```
