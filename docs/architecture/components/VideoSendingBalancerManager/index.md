# VideoSendingBalancerManager (Балансировка видео)

**Назначение**: Автоматическая оптимизация видеопотоков.

## Ключевые возможности

- Автоматическая оптимизация видеопотоков с задержкой запуска (10 секунд)
- Адаптивное опрашивание изменений треков
- Управление параметрами кодирования
- Сохранение ограничения `maxAvailableResolution` для основного исходящего потока
- Планирование и остановка балансировки
- Интеграция с режимом зрителя (`recv-session-*`, `recv-quality-changed`)

## Интеграция с `maxAvailableResolution`

`SipConnector` создаёт менеджер с callback `getMaxAvailableResolution` (4-й аргумент конструктора).
При старте, остановке и перебалансировке менеджер передаёт контекст в `VideoSendingBalancer`:

```typescript
{
  getMaxResolution: this.getMaxResolution;
}
```

Так лимит разрешения подключения учитывается при:

- первом `balance()` после задержки;
- обработке команд `main-cam-control`;
- смене видеотрека;
- `reset()` при остановке балансировки.

Для `MAX_MAIN_CAM_RESOLUTION` применяется более строгое из двух ограничений: команда MCU и
`maxAvailableResolution`.

## Жизненный цикл

1. `peerconnection:confirmed` → планирование запуска через `balancingStartDelay`
2. По таймеру → `balance(context)` + `subscribe(context)`
3. События `main-cam-control` → перебалансировка через `VideoSendingBalancer`
4. Смена трека → автоматическая перебалансировка
5. `ended` / `failed` / `recv-session-started` / `recv-quality-changed` → `stopBalancing()`
6. `recv-session-ended` → повторное планирование запуска

## Основные методы

| Метод              | Назначение                                               |
| ------------------ | -------------------------------------------------------- |
| `startBalancing()` | Принудительный запуск балансировки и подписки на события |
| `stopBalancing()`  | Остановка, отписка и сброс параметров отправителя        |
| `balance()`        | Разовая ручная балансировка                              |

## Связанные компоненты

- [`VideoSendingBalancer`](../../../../src/VideoSendingBalancer/README.md) — фасад балансировки
- [`CallManager`](../CallManager/index.md) — события звонка и `connection`
- [`ApiManager`](../ApiManager/index.md) — события `main-cam-control`

## Связанные рецепты

- [Управление видеобалансировщиком](../../../recipes/video-balancing.md)
- [Управление медиа-потоками](../../../recipes/media-management.md)
