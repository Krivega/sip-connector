# Совместимость браузеров

## WebRTC поддержка

SDK использует стандартные WebRTC API и совместим с:

| Браузер     | Версия | Уровень поддержки | Особенности                    |
| ----------- | ------ | ----------------- | ------------------------------ |
| **Chrome**  | 67+    | Полная поддержка  | Все возможности WebRTC         |
| **Firefox** | 60+    | Полная поддержка  | Все возможности WebRTC         |
| **Safari**  | 11+    | Базовая поддержка | Ограниченная поддержка кодеков |
| **Edge**    | 79+    | Полная поддержка  | Chromium-based                 |

## Проверка возможностей

```typescript
// Проверка поддержки WebRTC
if (!navigator.mediaDevices?.getUserMedia) {
  throw new Error('WebRTC не поддерживается');
}

// Проверка поддержки презентаций
if (!navigator.mediaDevices?.getDisplayMedia) {
  console.warn('Screen sharing не поддерживается');
}

// Проверка поддержки ICE restart
if (!RTCPeerConnection.prototype.restartIce) {
  console.warn('ICE restart не поддерживается в этом браузере');
}
```
