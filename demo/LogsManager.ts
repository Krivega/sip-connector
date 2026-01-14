import { dom } from './dom';
import { renderJsonNode } from './jsonRenderer';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type { TEventName } from '@/SipConnector/events';

type TLog = {
  name: string;
  event: unknown;
  time: string;
  timestamp: number;
};

/**
 * Менеджер для управления и отображения логов событий sipConnector
 */
class LogsManager {
  private logs: TLog[] = [];

  private renderedLogsCount = 0;

  private filterText = '';

  private handlersUAEvents: Record<TEventName, (event: unknown) => void> = {} as Record<
    TEventName,
    (event: unknown) => void
  >;

  public constructor() {
    this.updateUI();
  }

  private static getNameBadgeStyle(name: string): Record<string, string> {
    const base = {
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      flex: '0 0 320px',
      width: '320px',
      padding: '2px 6px',
      minHeight: '30px',
      borderRadius: '4px',
      border: '1px solid transparent',
    };

    if (!name || typeof name !== 'string') {
      return { ...base, background: '#0b1220', color: '#e2e8f0', borderColor: '#1f2937' };
    }

    const lower = name.toLowerCase();

    if (lower.startsWith('auto-connect:')) {
      return { ...base, background: '#1e40af', color: '#e5edff', borderColor: '#1d4ed8' };
    }

    if (lower.startsWith('connection:')) {
      return { ...base, background: '#0f766e', color: '#e6fffb', borderColor: '#115e59' };
    }

    if (lower.startsWith('call:')) {
      return { ...base, background: '#9d174d', color: '#fff1f2', borderColor: '#831843' };
    }

    if (lower.startsWith('api:')) {
      return { ...base, background: '#7c3aed', color: '#f3e8ff', borderColor: '#6d28d9' };
    }

    if (lower.startsWith('incoming-call:')) {
      return { ...base, background: '#166534', color: '#dcfce7', borderColor: '#14532d' };
    }

    if (lower.startsWith('presentation:')) {
      return { ...base, background: '#b45309', color: '#fffbeb', borderColor: '#92400e' };
    }

    if (lower.startsWith('stats:')) {
      return { ...base, background: '#1f2937', color: '#e5e7eb', borderColor: '#334155' };
    }

    if (lower.startsWith('video-balancer:')) {
      return { ...base, background: '#7c2d12', color: '#fff7ed', borderColor: '#9a3412' };
    }

    return { ...base, background: '#0b1220', color: '#e2e8f0', borderColor: '#1f2937' };
  }

  private static formatTime(input: number): string {
    try {
      const d = new Date(input);
      const pad2 = (n: number) => {
        return `${n}`.padStart(2, '0');
      };
      const pad3 = (n: number) => {
        return `${n}`.padStart(3, '0');
      };
      const h = pad2(d.getHours());
      const m = pad2(d.getMinutes());
      const s = pad2(d.getSeconds());
      const ms = pad3(d.getMilliseconds());

      return `${h}:${m}:${s}.${ms}`;
    } catch {
      return '';
    }
  }

  public subscribe(): void {
    dom.clearLogsButtonElement.addEventListener('click', () => {
      this.clearLogs();
    });

    dom.filterLogsInputElement.addEventListener('input', () => {
      this.filterText = dom.filterLogsInputElement.value.trim().toLowerCase();
      this.applyFilter();
    });

    const { sipConnector } = sipConnectorFacade;

    sipConnector.events.eachTriggers((_trigger, eventName) => {
      const handler = (event: unknown) => {
        if (eventName.startsWith('stats:')) {
          return;
        }

        let eventParsed: unknown = {};

        try {
          eventParsed = this.safeSerialize(event);
        } catch {
          // eslint-disable-next-line no-console
          console.warn('fail parse event', event);
          eventParsed = 'parsing error';
        }

        this.updateLogs(eventName, eventParsed);
      };

      this.handlersUAEvents[eventName] = handler;
      sipConnectorFacade.on(eventName, handler);
    });
  }

  public destroy(): void {
    this.removeEvents();
  }

  public clearLogs(): void {
    this.logs = [];
    this.renderedLogsCount = 0;
    this.filterText = '';
    dom.filterLogsInputElement.value = '';
    this.updateUI();
  }

  private updateLogs(name: string, event: unknown): void {
    const now = Date.now();

    this.logs = [...this.logs, { name, event, timestamp: now, time: LogsManager.formatTime(now) }];

    const lastLog = this.logs.at(-1);

    if (lastLog && this.shouldShowLog(lastLog)) {
      // Если фильтр активен, перерисовываем весь список
      if (this.filterText) {
        this.renderLogsList();
      } else if (this.renderedLogsCount < this.logs.length) {
        // Если фильтра нет, просто добавляем новый элемент
        this.appendNewLog(lastLog, this.logs.length - 1);
      }
    }
  }

  // Safe serialization with circular handling and error-tolerant property access
  private safeSerialize(value: unknown): unknown {
    try {
      const sanitized = this.deepSanitize(value, new Set(), 0);

      return structuredClone(sanitized);
    } catch {
      try {
        return String(value);
      } catch {
        return 'parsing error';
      }
    }
  }

  private deepSanitize(value: unknown, seen: Set<unknown>, depth: number): unknown {
    const MAX_DEPTH = 6;

    if (depth > MAX_DEPTH) {
      return '[MaxDepth]';
    }

    const type = typeof value;

    if (value === null || type === 'undefined') {
      return undefined;
    }

    if (type === 'bigint') {
      try {
        const asNumber = Number(value);

        return Number.isSafeInteger(asNumber) ? asNumber : `${String(value as number)}n`;
      } catch {
        // В catch блоке value может быть undefined, используем безопасное преобразование
        if (value === undefined) {
          return 'undefined';
        }

        try {
          return `${String(value as number)}n`;
        } catch {
          return '[BigInt parsing error]';
        }
      }
    }

    if (type === 'string' || type === 'number' || type === 'boolean') {
      return value;
    }

    if (type === 'function') {
      return '[Function]';
    }

    if (type === 'symbol') {
      return String(value as symbol);
    }

    // Dates, RegExp, Error
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }

    // typeof null === 'object' в JavaScript, поэтому нужна проверка на null
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (type === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);

      if (Array.isArray(value)) {
        const result: unknown[] = [];

        for (const entry of value) {
          try {
            // Access may throw if getter throws
            result.push(this.deepSanitize(entry, seen, depth + 1));
          } catch {
            result.push('parsing error');
          }
        }

        return result;
      }

      const result: Record<string, unknown> = {};

      try {
        const keys = Object.keys(value as Record<string, unknown>);

        for (const key of keys) {
          try {
            const prop = (value as Record<string, unknown>)[key];

            result[key] = this.deepSanitize(prop, seen, depth + 1);
          } catch {
            result[key] = 'parsing error';
          }
        }
      } catch {
        return 'parsing error';
      }

      return result;
    }

    // Fallback
    try {
      return structuredClone(value);
    } catch {
      return 'parsing error';
    }
  }

  private removeEvents(): void {
    for (const eventName of Object.keys(this.handlersUAEvents) as TEventName[]) {
      if (Object.hasOwn(this.handlersUAEvents, eventName)) {
        const handler = this.handlersUAEvents[eventName];

        sipConnectorFacade.off(eventName, handler);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.handlersUAEvents[eventName];
      }
    }
  }

  // Метод не использует this напрямую, но должен быть методом экземпляра для консистентности

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private renderLog({ name, event, time, timestamp }: TLog): HTMLElement {
    const logContainer = document.createElement('div');

    logContainer.style.padding = '8px 0';
    logContainer.style.borderBottom = '1px solid #1e293b';

    const flexContainer = document.createElement('div');

    flexContainer.style.display = 'flex';
    flexContainer.style.alignItems = 'flex-start';
    flexContainer.style.gap = '8px';

    const badge = document.createElement('div');

    const badgeStyle = LogsManager.getNameBadgeStyle(name);

    Object.assign(badge.style, badgeStyle);

    const nameDiv = document.createElement('div');

    nameDiv.textContent = name;

    const timeDiv = document.createElement('div');

    timeDiv.textContent = time || LogsManager.formatTime(timestamp);
    timeDiv.style.color = '#94a3b8';
    timeDiv.style.fontWeight = 'normal';
    timeDiv.style.fontSize = '7.7px';

    badge.append(nameDiv, timeDiv);

    const jsonContainer = document.createElement('div');

    jsonContainer.style.flex = '1';
    jsonContainer.style.minWidth = '0';

    const jsonElement = renderJsonNode(event, 'root', 0);

    jsonContainer.append(jsonElement);

    flexContainer.append(badge, jsonContainer);

    logContainer.append(flexContainer);

    return logContainer;
  }

  private shouldShowLog(log: TLog): boolean {
    if (!this.filterText) {
      return true;
    }

    return log.name.toLowerCase().includes(this.filterText);
  }

  private appendNewLog(log: TLog, index: number): void {
    const logElement = this.renderLog(log);

    logElement.dataset.logIndex = String(index);

    dom.logsListElement.append(logElement);
    this.renderedLogsCount += 1;
  }

  private applyFilter(): void {
    this.renderLogsList();
  }

  private renderLogsList(): void {
    if (this.logs.length === 0) {
      dom.logsListElement.innerHTML = 'No logs';

      return;
    }

    // Очищаем список
    dom.logsListElement.innerHTML = '';
    this.renderedLogsCount = 0;

    const filteredLogs = this.filterText
      ? this.logs.filter((log) => {
          return this.shouldShowLog(log);
        })
      : this.logs;

    filteredLogs.forEach((log) => {
      const originalIndex = this.logs.indexOf(log);

      this.appendNewLog(log, originalIndex);
    });
  }

  private updateUI(): void {
    dom.show(dom.logsContainerElement);

    this.renderLogsList();
  }
}

export default LogsManager;
