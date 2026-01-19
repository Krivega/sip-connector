import { dom } from './dom';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type { TStatsManagerEventMap } from '@/StatsManager';

type TStats = TStatsManagerEventMap['collected'];

type TStatsSections = {
  audio?: unknown;
  mainStream?: unknown;
  contentedStream?: unknown;
};

type TStatsTab = 'audio' | 'mainStream' | 'contentedStream';

const MAX_STATS_DEPTH = 6;

/**
 * Менеджер для управления и отображения статистики звонка
 */
class CallStatsManager {
  private unsubscribe: (() => void) | undefined;

  private activeTab: TStatsTab = 'mainStream';

  public constructor() {
    this.clear();
    this.setupTabs();
  }

  public subscribe(): void {
    this.unsubscribe = sipConnectorFacade.onStats((stats) => {
      this.updateStats(stats);
    });
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  public clear(): void {
    this.renderSections({
      audio: undefined,
      mainStream: undefined,
      contentedStream: undefined,
    });
  }

  private setupTabs(): void {
    dom.callStatsTabMainStreamButtonElement.addEventListener('click', () => {
      this.setActiveTab('mainStream');
    });
    dom.callStatsTabAudioButtonElement.addEventListener('click', () => {
      this.setActiveTab('audio');
    });
    dom.callStatsTabContentedStreamButtonElement.addEventListener('click', () => {
      this.setActiveTab('contentedStream');
    });

    this.setActiveTab(this.activeTab);
  }

  private setActiveTab(tab: TStatsTab): void {
    this.activeTab = tab;

    const isMain = tab === 'mainStream';
    const isAudio = tab === 'audio';
    const isContented = tab === 'contentedStream';

    dom.callStatsTabMainStreamButtonElement.classList.toggle('is-active', isMain);
    dom.callStatsTabAudioButtonElement.classList.toggle('is-active', isAudio);
    dom.callStatsTabContentedStreamButtonElement.classList.toggle('is-active', isContented);

    dom.callStatsMainStreamPanelElement.classList.toggle('is-active', isMain);
    dom.callStatsAudioPanelElement.classList.toggle('is-active', isAudio);
    dom.callStatsContentedStreamPanelElement.classList.toggle('is-active', isContented);
  }

  private updateStats(stats: TStats): void {
    const sections: TStatsSections = {
      audio: {
        inbound: stats.inbound.audio,
        outbound: stats.outbound.audio,
      },
      mainStream: {
        inbound: stats.inbound.video,
        outbound: stats.outbound.video,
      },
      contentedStream: {
        inbound: stats.inbound.secondVideo,
        outbound: stats.outbound.secondVideo,
      },
    };

    this.toggleContentedStreamTabVisibility(
      this.hasStatsData(stats.inbound.secondVideo) || this.hasStatsData(stats.outbound.secondVideo),
    );

    this.renderSections(sections);
  }

  private renderSections({ audio, mainStream, contentedStream }: TStatsSections): void {
    this.renderSection(dom.callStatsAudioElement, audio);
    this.renderSection(dom.callStatsMainStreamElement, mainStream);
    this.renderSection(dom.callStatsContentedStreamElement, contentedStream);
  }

  private renderSection(htmlElement: HTMLElement, data: unknown): void {
    const table = document.createElement('div');

    table.classList.add('session-statuses');

    const rows = this.flattenStats(data);

    if (rows.length === 0) {
      this.appendRow(table, '-', '-');
    } else {
      rows.forEach(({ key, value }) => {
        this.appendRow(table, key, value);
      });
    }

    htmlElement.replaceChildren(table);
  }

  private toggleContentedStreamTabVisibility(isVisible: boolean): void {
    dom.callStatsTabContentedStreamButtonElement.classList.toggle('hidden', !isVisible);
    dom.callStatsContentedStreamPanelElement.classList.toggle('hidden', !isVisible);

    if (!isVisible && this.activeTab === 'contentedStream') {
      this.setActiveTab('mainStream');
    }
  }

  private hasStatsData(data: unknown): boolean {
    if (data === undefined || data === null) {
      return false;
    }

    if (typeof data === 'number' || typeof data === 'string' || typeof data === 'boolean') {
      return true;
    }

    if (Array.isArray(data)) {
      return data.some((item) => {
        return this.hasStatsData(item);
      });
    }

    if (typeof data !== 'object') {
      return false;
    }

    try {
      return Object.values(data as Record<string, unknown>).some((value) => {
        return this.hasStatsData(value);
      });
    } catch {
      return false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private appendRow(htmlElement: HTMLElement, key: string, value: string): void {
    const keyElement = document.createElement('span');

    keyElement.textContent = key;
    htmlElement.append(keyElement);

    const valueElement = document.createElement('span');

    valueElement.textContent = value;
    htmlElement.append(valueElement);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private flattenStats(data: unknown): { key: string; value: string }[] {
    const rows: { key: string; value: string }[] = [];
    const safeData = data ?? {};

    const appendPrimitive = (key: string, value: unknown) => {
      if (value === undefined) {
        rows.push({ key, value: '-' });

        return;
      }

      if (value === null) {
        rows.push({ key, value: 'null' });

        return;
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        rows.push({ key, value: String(value) });

        return;
      }

      if (typeof value === 'object') {
        try {
          const serialized = JSON.stringify(value) || '';

          rows.push({ key, value: serialized || '-' });
        } catch {
          rows.push({ key, value: '-' });
        }

        return;
      }

      if (typeof value === 'bigint') {
        rows.push({ key, value: `${value}n` });

        return;
      }

      if (typeof value === 'function') {
        rows.push({ key, value: '[Function]' });

        return;
      }

      if (typeof value === 'symbol') {
        rows.push({ key, value: value.description ?? 'symbol' });

        return;
      }

      rows.push({ key, value: '-' });
    };

    const walk = (value: unknown, path: string, depth: number) => {
      if (depth > MAX_STATS_DEPTH) {
        appendPrimitive(path, '[MaxDepth]');

        return;
      }

      if (value === null || value === undefined) {
        appendPrimitive(path, value);

        return;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          appendPrimitive(path, '[]');

          return;
        }

        value.forEach((item, index) => {
          const nextPath = path ? `${path}[${index}]` : `[${index}]`;

          walk(item, nextPath, depth + 1);
        });

        return;
      }

      if (typeof value !== 'object') {
        appendPrimitive(path, value);

        return;
      }

      let entries: [string, unknown][] = [];

      try {
        entries = Object.entries(value as Record<string, unknown>);
      } catch {
        appendPrimitive(path, value);

        return;
      }

      if (entries.length === 0) {
        appendPrimitive(path, value);

        return;
      }

      entries.forEach(([key, nestedValue]) => {
        const nextPath = path ? `${path}.${key}` : key;

        walk(nestedValue, nextPath, depth + 1);
      });
    };

    walk(safeData, '', 0);

    return rows.filter((row) => {
      return row.key.length > 0;
    });
  }
}

export default CallStatsManager;
