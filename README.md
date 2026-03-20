# sip-connector

[![npm](https://img.shields.io/npm/v/sip-connector?style=flat-square)](https://www.npmjs.com/package/sip-connector)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/sip-connector?style=flat-square)
[![Demo](https://img.shields.io/badge/demo-online-brightgreen?style=flat-square)](https://Krivega.github.io/sip-connector/)
[![Documentation](https://img.shields.io/badge/docs-available-blue?style=flat-square)](./docs/README.md)

---

## 📖 Описание

**sip-connector** — это TypeScript SDK для интеграции WebRTC-приложений с платформой Vinteo через SIP-протокол. Предоставляет высокоуровневый API для создания полнофункциональных видеоконференций.

### 🎯 Основные возможности

SDK предоставляет комплексное решение для:

| Категория                    | Возможности                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| **SIP-подключения**          | Регистрация на сервере (SIP REGISTER), управление сессиями                              |
| **WebRTC-коммуникации**      | Исходящие/входящие звонки (SIP INVITE/200 OK), медиа-потоки, управление transceiver'ами |
| **Презентации**              | Отправка второго потока (screen sharing, демонстрация экрана)                           |
| **Системные сообщения**      | DTMF, SIP INFO, синхронизация медиа-состояния                                           |
| **Событийная архитектура**   | Подписка на события платформы в реальном времени                                        |
| **Мониторинг**               | WebRTC-статистика (RTCRtpStats, ICE candidate stats)                                    |
| **Управление конференциями** | Перемещение участников между ролями (участник/зритель)                                  |
| **Лицензирование**           | Мониторинг использования лицензий и состояния презентаций                               |
| **Автоподключение**          | Автоматическое переподключение при обрывах связи                                        |

- **Адаптивный polling**: Улучшенная система опроса для мониторинга изменений видеотреков
- **Поддержка maxBitrate в PresentationManager**: Автоматическое управление битрейтом для презентаций
- **Предпочтительные кодеки в SipConnector**: Настройка приоритетов кодеков на уровне коннектора
- **Обработка смены треков**: Автоматическая адаптация балансировки при изменении видеотреков
- **Улучшенная статистика**: Расширенные возможности сбора и анализа WebRTC статистики
  |

---

## Демо

- [Demo](https://Krivega.github.io/sip-connector/)
- Это интерактивный пример, который помогает наглядно продемонстрировать основные возможности библиотеки `sip-connector`: установление SIP-сессий и звонков, работу с WebRTC-медиа-потоками, поддержку “презентаций” (второго потока), а также базовую событийную логику и мониторинг WebRTC-статистики.

## 🚀 Установка

```bash
npm install sip-connector
```

---

## Документация

- **API Reference**: [Справочная документация по API](./docs/api/README.md)
- **Рецепты**: [Практические примеры и рецепты использования](./docs/recipes/README.md)
- **Архитектура**: [Детальное описание внутренней структуры](./docs/arch/README.md)
- **Тестирование**: [Руководство по тестированию](./docs/testing.md)
- **Совместимость браузеров**: [Поддержка браузеров и WebRTC](./docs/browser-compatibility.md)

---

## 👨‍💻 Автор

### Krivega Dmitriy

- 🌐 Website: [krivega.com](https://krivega.com)
- 📱 Github: [@Krivega](https://github.com/Krivega)
- 📧 Email: <mr.krivega@gmail.com>

## 📄 Лицензия

Copyright © 2021‑2026 [Krivega Dmitriy](https://github.com/Krivega).

This project is licensed under the [MIT License](https://github.com/Krivega/sip-connector/blob/master/LICENSE) - see the LICENSE file for details.
