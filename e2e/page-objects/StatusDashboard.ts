import { type Page, expect } from '@playwright/test';

export type TStatusDiagramCategory =
  | 'connection'
  | 'autoConnectorManager'
  | 'callReconnect'
  | 'call'
  | 'incoming'
  | 'presentation'
  | 'system';

export type TStatusNodeTitle =
  | 'Connection'
  | 'Auto Connector'
  | 'Call Reconnect'
  | 'Call'
  | 'Call Session'
  | 'Incoming'
  | 'Presentation'
  | 'System';

/** Ожидаемые поля узла: метка → значение */
type TNodeFields = Record<string, string>;

export type TExpectedNodeState = {
  state?: string;
  fields?: TNodeFields;
  /** поле содержит JSON; проверяется contains-text */
  jsonFields?: Record<string, string>;
};

export type TExpectedDashboardState = {
  diagrams?: Partial<Record<TStatusDiagramCategory, string>>;
  nodes?: Partial<Record<TStatusNodeTitle, TExpectedNodeState>>;
};

const STATE_SYNC_TIMEOUT_MS = 30_000;

export class StatusDashboard {
  private readonly page: Page;

  public constructor(page: Page) {
    this.page = page;
  }

  public async open() {
    await this.page.locator('details:has(#sessionStatusesDiagrams) > summary').click();
    await expect(this.page.locator('#sessionStatusesDiagrams')).toBeVisible();
    await expect(this.page.locator('#statusesNodeValues')).toBeVisible();
  }

  public async waitForDiagramStatus(
    category: TStatusDiagramCategory,
    value: string,
    { timeout = STATE_SYNC_TIMEOUT_MS }: { timeout?: number } = {},
  ) {
    const activeNode = this.page.locator(
      `#sessionStatusesDiagrams .status-diagram__node--active[data-status-category="${category}"]`,
    );

    await expect(activeNode).toHaveAttribute('data-status-value', value, {
      timeout,
    });
  }

  public async expectDiagramStatusNot(
    category: TStatusDiagramCategory,
    value: string,
    { timeout = STATE_SYNC_TIMEOUT_MS }: { timeout?: number } = {},
  ) {
    const activeNode = this.page.locator(
      `#sessionStatusesDiagrams .status-diagram__node--active[data-status-category="${category}"]`,
    );

    await expect(activeNode).not.toHaveAttribute('data-status-value', value, {
      timeout,
    });
  }

  /** Единая точка входа — декларативная проверка всего состояния дашборда */
  public async expectState(expected: TExpectedDashboardState) {
    if (expected.diagrams) {
      await this.expectDiagramStatuses(expected.diagrams);
    }

    if (expected.nodes) {
      await Promise.all(
        Object.entries(expected.nodes).map(async ([nodeTitle, nodeState]) => {
          return this.expectNodeState(nodeTitle as TStatusNodeTitle, nodeState);
        }),
      );
    }
  }

  public async getNodeFieldJson(nodeTitle: TStatusNodeTitle, fieldLabel: RegExp) {
    const preText = await this.rowByLabel(nodeTitle, fieldLabel)
      .locator('pre')
      .first()
      .textContent();

    if (preText === null) {
      throw new Error(`JSON pre not found: ${nodeTitle} / ${String(fieldLabel)}`);
    }

    return JSON.parse(preText) as unknown;
  }

  private async expectDiagramStatuses(diagrams: Partial<Record<TStatusDiagramCategory, string>>) {
    await Promise.all(
      Object.entries(diagrams).map(async ([category, value]) => {
        const activeNode = this.page.locator(
          `#sessionStatusesDiagrams .status-diagram__node--active[data-status-category="${category}"]`,
        );

        await expect(activeNode, `active node for ${category}`).toHaveCount(1);
        await expect(activeNode).toHaveAttribute('data-status-value', value);
      }),
    );
  }

  private sectionByTitle(title: TStatusNodeTitle) {
    return this.page.locator('#statusesNodeValues .conference-state__node').filter({
      has: this.page.getByRole('heading', { level: 4, name: title }),
    });
  }

  private rowByLabel(sectionTitle: TStatusNodeTitle, label: RegExp) {
    return this.sectionByTitle(sectionTitle)
      .locator('li')
      .filter({
        has: this.page.locator('b').filter({ hasText: label }),
      });
  }

  private async expectNodeState(title: TStatusNodeTitle, nodeExpected: TExpectedNodeState) {
    const assertions: Promise<void>[] = [];

    if (nodeExpected.state !== undefined) {
      const valueSpan = this.rowByLabel(title, /state:/i)
        .locator(':scope > span')
        .first();

      assertions.push(expect(valueSpan).toHaveText(nodeExpected.state));
    }

    if (nodeExpected.fields) {
      for (const [label, value] of Object.entries(nodeExpected.fields)) {
        const valueSpan = this.rowByLabel(title, new RegExp(label, 'i'))
          .locator(':scope > span')
          .first();

        assertions.push(expect(valueSpan).toHaveText(value));
      }
    }

    if (nodeExpected.jsonFields) {
      for (const [label, expectedText] of Object.entries(nodeExpected.jsonFields)) {
        const pre = this.rowByLabel(title, new RegExp(label, 'i')).locator('pre').first();

        assertions.push(expect(pre).toContainText(expectedText));
      }
    }

    await Promise.all(assertions);
  }
}
