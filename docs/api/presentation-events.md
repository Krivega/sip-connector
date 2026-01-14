# События `PresentationManager`

`PresentationManager` генерирует события в процессе управления презентациями (screen sharing). Все события доступны через префикс `presentation:*` в `SipConnector`.

## События

| Имя события            | Описание                                        | Тип данных    |
| ---------------------- | ----------------------------------------------- | ------------- |
| `presentation:start`   | Генерируется при начале запуска презентации     | `MediaStream` |
| `presentation:started` | Генерируется при успешном запуске презентации   | `MediaStream` |
| `presentation:end`     | Генерируется при начале остановки презентации   | `MediaStream` |
| `presentation:ended`   | Генерируется при успешной остановке презентации | `MediaStream` |
| `presentation:failed`  | Генерируется при ошибке презентации             | `Error`       |
