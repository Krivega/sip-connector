# Работа с входящими звонками

## Обработка входящих вызовов

```typescript
// Подписка на изменения удаленных потоков (до ответа на звонок)
const unsubscribeRemoteStreams = sipConnector.on('call:remote-tracks-changed', (event) => {
  console.log('Изменение удаленных потоков:', event);
  displayRemoteStreams(event.streams);
});

// Подписка на входящие события
sipConnector.on('incoming-call:ringing', () => {
  // Автоматический ответ с локальным потоком
  facade.answerToIncomingCall({
    mediaStream: localStream,
  });
});
```

## Подписка на входящие звонки

```typescript
// Подписка на входящие звонки
sipConnector.on('incoming-call:ringing', async (event) => {
  console.log('Входящий звонок:', event.remoteCallerData);

  // Принять звонок
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  await facade.answerToIncomingCall({ mediaStream });

  // Или отклонить
  // await facade.declineToIncomingCall();
});
```

## Управление состоянием входящих звонков

Доступ к состоянию через IncomingCallStateMachine:

```typescript
const incomingStateMachine = sipConnector.incomingCallManager.incomingCallStateMachine;

// Проверка текущего состояния
console.log('Состояние входящего:', incomingStateMachine.state);
console.log('Звонок поступает:', incomingStateMachine.isRinging);
console.log('Обработан:', incomingStateMachine.isFinished);
console.log('Данные вызывающего:', incomingStateMachine.remoteCallerData);
console.log('Причина завершения:', incomingStateMachine.lastReason);

// Сброс состояния
if (incomingStateMachine.isFinished) {
  incomingStateMachine.reset();
}
```
