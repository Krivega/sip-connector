import { test } from './fixtures';

import type { DemoPage } from './page-objects/DemoPage';

const EXPECTED_CALL_SETTINGS = {
  fieldIds: ['serverAddress', 'displayName', 'conferenceNumber', 'autoRedialEnabled'] as const,
  autoRedialChecked: true,
  buttons: [
    { name: 'Подключиться к серверу', visibility: 'visible' },
    { name: 'Позвонить', visibility: 'visible' },
    { name: 'Отключиться от сервера', visibility: 'hidden' },
    { name: 'Завершить звонок', visibility: 'hidden' },
  ] as const,
} as const;

test.describe('Demo app (sip-connector)', () => {
  test('страница открывается с ожидаемым title', async ({ demoPage }: { demoPage: DemoPage }) => {
    await demoPage.expectTitle();
  });

  test('форма настроек звонка: основные поля и кнопки', async ({
    demoPage,
  }: {
    demoPage: DemoPage;
  }) => {
    await demoPage.expectCallSettings(EXPECTED_CALL_SETTINGS);
  });

  test('секция статусов и логи: сворачиваемые блоки', async ({
    demoPage,
  }: {
    demoPage: DemoPage;
  }) => {
    await test.step('проверить наличие секций', async () => {
      await demoPage.expectStatusAndLogsSections();
    });

    await test.step('раскрыть логи и проверить clear logs', async () => {
      await demoPage.openLogsAndExpectClearButton();
    });
  });

  test('панель настроек main stream: форма и кнопка применения', async ({
    demoPage,
  }: {
    demoPage: DemoPage;
  }) => {
    await demoPage.openMainStreamSettingsAndExpectDefaults();
  });
});
