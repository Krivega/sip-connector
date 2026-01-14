function toParsedJson(value: unknown): unknown {
  try {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  } catch {
    return String(value);
  }
}

function renderKey(name: string): HTMLElement {
  const span = document.createElement('span');

  span.textContent = name;
  span.style.color = '#89b4fa';
  span.style.fontWeight = '600';

  return span;
}

function renderPrimitive(value: number | string | boolean | null): HTMLElement {
  const span = document.createElement('span');

  const type = typeof value;

  if (value === null) {
    span.textContent = 'null';
    span.style.color = '#f2cdcd';

    return span;
  }

  if (type === 'string') {
    span.textContent = `"${value as string}"`;
    span.style.color = '#a6e3a1';

    return span;
  }

  if (type === 'number') {
    span.textContent = String(value);
    span.style.color = '#f9e2af';

    return span;
  }

  if (type === 'boolean') {
    span.textContent = String(value);
    span.style.color = '#f2cdcd';

    return span;
  }

  span.textContent = String(value);

  return span;
}

function renderJsonNode(value: unknown, path: string, depth: number): HTMLElement {
  const indent = { paddingLeft: '12px' };

  if (Array.isArray(value)) {
    const count = value.length;
    const details = document.createElement('details');

    details.style.margin = '2px 0';

    const summary = document.createElement('summary');

    summary.style.cursor = 'pointer';

    const bracketOpen = document.createElement('span');

    bracketOpen.textContent = '[';
    bracketOpen.style.color = '#94a3b8';

    const ellipsis = document.createElement('span');

    ellipsis.textContent = '…';
    ellipsis.style.color = '#94a3b8';

    const bracketClose = document.createElement('span');

    bracketClose.textContent = ']';
    bracketClose.style.color = '#94a3b8';

    const countSpan = document.createElement('span');

    countSpan.textContent = `(${count})`;
    countSpan.style.color = '#64748b';
    countSpan.style.marginLeft = '4px';

    summary.append(bracketOpen);
    summary.append(ellipsis);
    summary.append(bracketClose);
    summary.append(countSpan);

    const contentDiv = document.createElement('div');

    Object.assign(contentDiv.style, indent);

    value.forEach((item, index) => {
      const itemDiv = document.createElement('div');

      itemDiv.append(renderJsonNode(item, `${path}.${index}`, depth + 1));

      if (index < count - 1) {
        const comma = document.createElement('span');

        comma.textContent = ',';
        comma.style.color = '#475569';
        itemDiv.append(comma);
      }

      contentDiv.append(itemDiv);
    });

    details.append(summary);
    details.append(contentDiv);

    return details;
  }

  if (typeof value !== 'object' || value === null) {
    return renderPrimitive(value as number | string | boolean | null);
  }

  const entries = Object.entries(value);
  const count = entries.length;
  const details = document.createElement('details');

  details.style.margin = '2px 0';

  const summary = document.createElement('summary');

  summary.style.cursor = 'pointer';

  const braceOpen = document.createElement('span');

  braceOpen.textContent = '{';
  braceOpen.style.color = '#94a3b8';

  const ellipsis = document.createElement('span');

  ellipsis.textContent = '…';
  ellipsis.style.color = '#94a3b8';

  const braceClose = document.createElement('span');

  braceClose.textContent = '}';
  braceClose.style.color = '#94a3b8';

  const countSpan = document.createElement('span');

  countSpan.textContent = `(${count})`;
  countSpan.style.color = '#64748b';
  countSpan.style.marginLeft = '4px';

  summary.append(braceOpen);
  summary.append(ellipsis);
  summary.append(braceClose);
  summary.append(countSpan);

  const contentDiv = document.createElement('div');

  Object.assign(contentDiv.style, indent);

  entries.forEach(([key, value_], index) => {
    const entryDiv = document.createElement('div');

    entryDiv.append(renderKey(key));

    const colon = document.createElement('span');

    colon.textContent = ': ';
    colon.style.color = '#475569';
    entryDiv.append(colon);

    entryDiv.append(renderJsonNode(value_, `${path}.${key}`, depth + 1));

    if (index < count - 1) {
      const comma = document.createElement('span');

      comma.textContent = ',';
      comma.style.color = '#475569';
      entryDiv.append(comma);
    }

    contentDiv.append(entryDiv);
  });

  details.append(summary);
  details.append(contentDiv);

  return details;
}

function isEmptyJson(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object' && value !== null) {
    try {
      return Object.keys(value).length === 0;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Рендерит JSON значение в DOM элемент с подсветкой синтаксиса
 */
export function renderJson(value: unknown): HTMLElement {
  const parsed = toParsedJson(value);

  if (isEmptyJson(parsed)) {
    return document.createElement('div');
  }

  const container = document.createElement('div');

  Object.assign(container.style, {
    margin: '0',
    minHeight: '30px',
    padding: '8px 10px',
    background: '#0f172a',
    color: '#e2e8f0',
    borderRadius: '6px',
    overflowX: 'auto',
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: '8.4px',
    lineHeight: '1.5',
    border: '1px solid #1e293b',
  });

  container.append(renderJsonNode(parsed, 'root', 0));

  return container;
}

// Экспортируем внутреннюю функцию для использования в LogsManager
export { renderJsonNode };
