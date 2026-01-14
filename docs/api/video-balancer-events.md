# События `VideoSendingBalancerManager`

`VideoSendingBalancerManager` генерирует события в процессе автоматической балансировки видеопотоков. Все события доступны через префикс `video-balancer:*` в `SipConnector`.

## События

| Имя события                          | Описание                                     | Тип данных              |
| ------------------------------------ | -------------------------------------------- | ----------------------- |
| `video-balancer:balancing-scheduled` | Генерируется при планировании балансировки   | `{ delay: number }`     |
| `video-balancer:balancing-started`   | Генерируется при запуске балансировки        | `{ delay: number }`     |
| `video-balancer:balancing-stopped`   | Генерируется при остановке балансировки      | `Record<string, never>` |
| `video-balancer:parameters-updated`  | Генерируется при обновлении параметров видео | `RTCRtpSendParameters`  |
