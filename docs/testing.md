# Тестирование

## Запуск тестов

```bash
# Все тесты
npm test

# Тесты с покрытием
npm run test:coverage

# Тесты в watch режиме
npm run test:watch

# E2E (Playwright)
npm run test:e2e

# E2E на реальном dev.vinteo.com: без флага файл пропускается
E2E_REAL_SERVER=1 npm run test:e2e -- e2e/signaling-loss-real-server.spec.ts
```

## Тестовые фикстуры

SDK включает готовые моки для тестирования:

| Мок                     | Назначение           | Описание                   |
| ----------------------- | -------------------- | -------------------------- |
| `RTCPeerConnectionMock` | WebRTC API           | Имитация WebRTC соединений |
| `UA.mock.ts`            | SIP-функциональность | Имитация SIP User Agent    |
| `BaseSession.mock.ts`   | Сессии               | Имитация SIP сессий        |
