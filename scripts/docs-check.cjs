const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DOCS_DIR = path.resolve('docs');
const ROOT_DIR = process.cwd();

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const DEPRECATED_PATTERNS = [
  {
    name: 'Deprecated session API',
    regex: /\bsipConnector\.session\b/g,
    message: 'Use `sipConnector.sessionManager`.',
  },
  {
    name: 'Deprecated connection state machine path',
    regex: /\bconnectionManager\.connectionStateMachine\b/g,
    message: 'Use `sipConnector.connectionManager.stateMachine`.',
  },
  {
    name: 'Deprecated call state machine path',
    regex: /\bcallManager\.callStateMachine\b/g,
    message: 'Use `sipConnector.callManager.stateMachine`.',
  },
  {
    name: 'Deprecated incoming payload access',
    regex: /\bevent\.remoteCallerData\b/g,
    message: '`incoming-call:ringing` handler receives `TRemoteCallerData` directly.',
  },
  {
    name: 'Non-canonical package import',
    regex: /from\s+['"]@krivega\/sip-connector['"]/g,
    message: "Use `from 'sip-connector'`.",
  },
];

const TYPESCRIPT_FENCE_REGEX = /```typescript\n([\s\S]*?)```/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]*)\]\(([^)]+)\)/g;

const AVAILABLE_CHECKS = [
  'content',
  'links',
  'api-sync',
  'state-machine-structure',
  'state-machine-structure-strict',
  'component-index-structure',
  'api-docs-structure',
];

/** По умолчанию без lenient-only: strict включает все правила state-machine */
const DEFAULT_CHECKS = AVAILABLE_CHECKS;

/** Заголовок H1: `# <Имя>StateMachine (краткое описание)` */
const STATE_MACHINE_STRICT_H1_REGEX = /^# .+StateMachine \(.+\)$/;

// Заголовок H1 для docs/architecture/components/*/index.md: `# <Имя> (краткое описание)`
const COMPONENT_INDEX_H1_REGEX = /^# .+ \(.+\)$/;

const STATE_MACHINE_SECTION_ORDER = [
  '## Публичный API',
  '## Состояния',
  '## Контекст и инварианты',
  '## Диаграмма переходов (Mermaid)',
  '## Ключевые правила переходов',
  '## Интеграция и события',
  '## Логирование',
];

const API_README_SECTIONS = ['## Содержание'];

const API_EXPORTS_SECTIONS = [
  '## Основные классы',
  '## Методы управления соединением',
  '## Управление качеством приема (режим зрителя)',
  '## Утилиты и типы',
];

const API_EVENTS_SECTIONS = ['## События', '## Структуры данных', '## Пример использования'];

const DOCS_SCHEMA = {
  STATE_MACHINE: {
    strictH1Regex: STATE_MACHINE_STRICT_H1_REGEX,
    requiredSections: STATE_MACHINE_SECTION_ORDER,
    orderTemplate: STATE_MACHINE_SECTION_ORDER,
    firstMainSection: '## Публичный API',
    mermaidSection: '## Диаграмма переходов (Mermaid)',
  },
  COMPONENT_INDEX: {
    h1Regex: COMPONENT_INDEX_H1_REGEX,
    requiredSections: ['## Ключевые возможности'],
    requireIntro: true,
  },
  API: {
    README: {
      fileName: 'README.md',
      h1Exact: '# API Reference',
      requiredSections: API_README_SECTIONS,
      allowedSections: API_README_SECTIONS,
      orderTemplate: API_README_SECTIONS,
      requireIntro: false,
    },
    EXPORTS: {
      fileName: 'exports.md',
      h1Exact: '# API и экспорты',
      requiredSections: API_EXPORTS_SECTIONS,
      allowedSections: API_EXPORTS_SECTIONS,
      orderTemplate: API_EXPORTS_SECTIONS,
      requireIntro: false,
    },
    EVENTS: {
      fileNamePattern: /-events\.md$/,
      h1Regex: /^# События `[^`]+`$/,
      requiredSections: ['## События'],
      allowedSections: API_EVENTS_SECTIONS,
      orderTemplate: API_EVENTS_SECTIONS,
      requireIntro: true,
    },
  },
};

const API_EVENT_SYNC_CONFIG = [
  {
    docPath: 'docs/api/connection-events.md',
    sourcePath: 'src/ConnectionManager/events.ts',
    prefix: 'connection',
  },
  {
    docPath: 'docs/api/call-events.md',
    sourcePath: 'src/CallManager/events.ts',
    prefix: 'call',
  },
  {
    docPath: 'docs/api/incoming-call-events.md',
    sourcePath: 'src/IncomingCallManager/events.ts',
    prefix: 'incoming-call',
  },
  {
    docPath: 'docs/api/presentation-events.md',
    sourcePath: 'src/PresentationManager/events.ts',
    // События PresentationManager уже содержат `presentation:*`.
    prefix: '',
    docPrefixFilter: 'presentation:',
  },
  {
    docPath: 'docs/api/stats-events.md',
    sourcePath: 'src/StatsPeerConnection/events.ts',
    prefix: 'stats',
  },
  {
    docPath: 'docs/api/video-balancer-events.md',
    sourcePath: 'src/VideoSendingBalancerManager/events.ts',
    prefix: 'video-balancer',
  },
  {
    docPath: 'docs/api/main-stream-health-events.md',
    sourcePath: 'src/MainStreamHealthMonitor/events.ts',
    prefix: 'main-stream-health',
  },
  {
    docPath: 'docs/api/session-events.md',
    sourcePath: 'src/SessionManager/events.ts',
    prefix: 'session',
  },
  {
    docPath: 'docs/api/auto-connector-events.md',
    sourcePath: 'src/AutoConnectorManager/events.ts',
    prefix: 'auto-connect',
  },
  {
    docPath: 'docs/api/api-events.md',
    sourcePath: 'src/ApiManager/events.ts',
    prefix: 'api',
  },
  {
    docPath: 'docs/api/sip-connector-events.md',
    sourcePath: 'src/SipConnector/events.ts',
    sourceArrayConstName: 'SIP_CONNECTOR_EVENTS',
    noColonOnly: true,
  },
];

function getMarkdownFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function docIssue(filePath, line, type, title, message, snippet) {
  const base = { filePath, line, type, title, message };

  if (snippet !== undefined) {
    base.snippet = snippet;
  }

  return base;
}

/** Непустой текст между строками [startIndex, endIndex), не считая строки-заголовки `#`. */
function hasNonEmptyNonHeadingContent(lines, startIndex, endIndex) {
  return lines.slice(startIndex, endIndex).some((line) => {
    const trimmed = line.trim();

    return trimmed !== '' && !trimmed.startsWith('#');
  });
}

/** Первая строка H1 (`# ...`, не `##`). */
function findMainH1LineIndex(lines) {
  return lines.findIndex((line) => {
    const trimmed = line.trim();

    return trimmed.startsWith('# ') && !trimmed.startsWith('## ');
  });
}

/** Первая строка `## ...` после указанной позиции (индекс строки в массиве). */
function findFirstLevel2HeadingLineIndex(lines, afterLineIndex) {
  return lines.findIndex((line, index) => {
    return index > afterLineIndex && line.startsWith('## ');
  });
}

/** Есть ли непустой текст между H1 и первым `##` (или до конца файла). */
function hasIntroParagraph(lines, h1LineIndex, firstLevel2LineIndex) {
  const introEnd = firstLevel2LineIndex === -1 ? lines.length : firstLevel2LineIndex;

  return hasNonEmptyNonHeadingContent(lines, h1LineIndex + 1, introEnd);
}

function checkDeprecatedPatterns(filePath, content) {
  const issues = [];

  for (const pattern of DEPRECATED_PATTERNS) {
    const matches = content.matchAll(pattern.regex);

    for (const match of matches) {
      const matchIndex = match.index ?? 0;
      const line = getLineNumber(content, matchIndex);

      issues.push(docIssue(filePath, line, 'deprecated', pattern.name, pattern.message, match[0]));
    }
  }

  return issues;
}

function formatDiagnosticMessage(diagnostic) {
  if (typeof diagnostic.messageText === 'string') {
    return diagnostic.messageText;
  }

  let current = diagnostic.messageText;
  const parts = [current.messageText];

  while (current.next) {
    current = current.next[0];
    parts.push(current.messageText);
  }

  return parts.join(' ');
}

function checkTypescriptFences(filePath, content) {
  const issues = [];
  const matches = content.matchAll(TYPESCRIPT_FENCE_REGEX);
  let blockIndex = 0;

  for (const match of matches) {
    blockIndex += 1;

    const blockContent = match[1];
    const blockStartIndex = match.index ?? 0;
    const blockLine = getLineNumber(content, blockStartIndex);
    const virtualFileName = `${filePath}#block-${blockIndex}.ts`;

    const variants = [
      {
        code: blockContent,
      },
      {
        // Позволяет валидировать сниппеты-инструкции с выражениями.
        code: `(() => {\n${blockContent}\n})();`,
      },
      {
        // Позволяет валидировать сниппеты, где приведён только фрагмент типа.
        code: `type __DocSnippet = ${blockContent};`,
      },
      {
        // Позволяет валидировать object-fragments вида "key: { ... }".
        code: `({\n${blockContent}\n});`,
      },
    ];

    const diagnosticsByVariant = variants.map(({ code }) => {
      const result = ts.transpileModule(code, {
        fileName: virtualFileName,
        reportDiagnostics: true,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
      });

      return (result.diagnostics ?? []).filter((diagnostic) => {
        return diagnostic.category === ts.DiagnosticCategory.Error;
      });
    });

    const hasValidVariant = diagnosticsByVariant.some((diagnostics) => {
      return diagnostics.length === 0;
    });

    if (hasValidVariant) {
      continue;
    }

    const diagnostics = diagnosticsByVariant[0];

    for (const diagnostic of diagnostics) {
      const line = diagnostic.start
        ? blockLine + getLineNumber(blockContent, diagnostic.start) - 1
        : blockLine;

      issues.push(
        docIssue(
          filePath,
          line,
          'typescript',
          `TypeScript syntax error in block #${blockIndex}`,
          formatDiagnosticMessage(diagnostic),
        ),
      );
    }
  }

  return issues;
}

function resolveRequestedChecks() {
  const checksArg = process.argv.find((arg) => {
    return arg.startsWith('--checks=');
  });

  if (!checksArg) {
    return new Set(DEFAULT_CHECKS);
  }

  const checks = checksArg
    .replace('--checks=', '')
    .split(',')
    .map((part) => {
      return part.trim();
    })
    .filter(Boolean);

  const unknownChecks = checks.filter((check) => {
    return !AVAILABLE_CHECKS.includes(check);
  });

  if (unknownChecks.length > 0) {
    console.error(
      `Unknown check(s): ${unknownChecks.join(', ')}. Available: ${AVAILABLE_CHECKS.join(', ')}`,
    );
    process.exit(1);
  }

  return new Set(checks);
}

function isExternalLink(target) {
  return (
    /^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('mailto:') || target.startsWith('tel:')
  );
}

function splitTargetPathAndAnchor(rawTarget) {
  const cleanTarget = rawTarget.trim().replace(/^<|>$/g, '');
  const hashIndex = cleanTarget.indexOf('#');

  if (hashIndex === -1) {
    return { targetPath: cleanTarget, anchor: undefined };
  }

  return {
    targetPath: cleanTarget.slice(0, hashIndex),
    anchor: cleanTarget.slice(hashIndex + 1),
  };
}

function slugifyHeading(rawHeading) {
  return rawHeading
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractAnchorsFromMarkdown(content) {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const anchors = new Set();
  const duplicateCounter = new Map();

  for (const match of content.matchAll(headingRegex)) {
    const heading = match[1].trim();
    const baseSlug = slugifyHeading(heading);

    if (!baseSlug) {
      continue;
    }

    const duplicateIndex = duplicateCounter.get(baseSlug) ?? 0;
    const slug = duplicateIndex === 0 ? baseSlug : `${baseSlug}-${duplicateIndex}`;

    anchors.add(slug);
    duplicateCounter.set(baseSlug, duplicateIndex + 1);
  }

  return anchors;
}

function pushLinkIssue(issues, markdownFile, line, title, message, snippet) {
  issues.push(docIssue(markdownFile, line, 'links', title, message, snippet));
}

function checkLinks(markdownFile, content, markdownContentCache) {
  const issues = [];
  const fileDirectory = path.dirname(markdownFile);

  for (const match of content.matchAll(MARKDOWN_LINK_REGEX)) {
    const matchIndex = match.index ?? 0;
    const maybeImage = content[matchIndex - 1] === '!';

    if (maybeImage) {
      continue;
    }

    const rawTarget = match[2];
    const line = getLineNumber(content, matchIndex);

    if (!rawTarget || isExternalLink(rawTarget)) {
      continue;
    }

    const { targetPath, anchor } = splitTargetPathAndAnchor(rawTarget);

    if (targetPath === '' && anchor) {
      const currentAnchors = extractAnchorsFromMarkdown(content);
      const normalizedAnchor = decodeURIComponent(anchor).toLowerCase();

      if (!currentAnchors.has(normalizedAnchor)) {
        pushLinkIssue(
          issues,
          markdownFile,
          line,
          'Broken local anchor',
          `Anchor "#${anchor}" not found in current file.`,
          rawTarget,
        );
      }

      continue;
    }

    const resolvedTargetPath = path.resolve(fileDirectory, decodeURIComponent(targetPath));

    if (!fs.existsSync(resolvedTargetPath)) {
      pushLinkIssue(
        issues,
        markdownFile,
        line,
        'Broken relative link',
        `Target file does not exist: ${path.relative(ROOT_DIR, resolvedTargetPath)}.`,
        rawTarget,
      );
      continue;
    }

    if (!anchor) {
      continue;
    }

    const normalizedAnchor = decodeURIComponent(anchor).toLowerCase();
    const targetContent = markdownContentCache.get(resolvedTargetPath);

    if (targetContent === undefined) {
      continue;
    }

    const targetAnchors = extractAnchorsFromMarkdown(targetContent);

    if (!targetAnchors.has(normalizedAnchor)) {
      pushLinkIssue(
        issues,
        markdownFile,
        line,
        'Broken target anchor',
        `Anchor "#${anchor}" not found in ${path.relative(ROOT_DIR, resolvedTargetPath)}.`,
        rawTarget,
      );
    }
  }

  return issues;
}

function extractEnumStringValues(sourceContent) {
  const enumValues = new Map();
  const enumRegex = /enum\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;

  for (const enumMatch of sourceContent.matchAll(enumRegex)) {
    const enumName = enumMatch[1];
    const enumBody = enumMatch[2];
    const memberRegex = /([A-Za-z0-9_]+)\s*=\s*'([^']+)'/g;

    for (const memberMatch of enumBody.matchAll(memberRegex)) {
      enumValues.set(`${enumName}.${memberMatch[1]}`, memberMatch[2]);
    }
  }

  return enumValues;
}

function extractConstStringValues(sourceContent) {
  const constValues = new Map();
  const constRegex = /const\s+([A-Z0-9_]+)\s*=\s*'([^']+)'\s*(?:as\s+const)?\s*;/g;

  for (const constMatch of sourceContent.matchAll(constRegex)) {
    constValues.set(constMatch[1], constMatch[2]);
  }

  return constValues;
}

function extractArrayBody(sourceContent, constName) {
  const arrayRegex = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const`);
  const match = sourceContent.match(arrayRegex);

  if (!match) {
    return undefined;
  }

  return match[1];
}

function extractEventsFromSourceArray(sourceContent, constName = 'EVENT_NAMES') {
  const arrayBody = extractArrayBody(sourceContent, constName);

  if (arrayBody === undefined) {
    throw new Error(`Cannot find ${constName} in source file.`);
  }

  const enumValues = extractEnumStringValues(sourceContent);
  const constValues = extractConstStringValues(sourceContent);
  const values = new Set();

  for (const match of arrayBody.matchAll(/'([^']+)'/g)) {
    values.add(match[1]);
  }

  for (const match of arrayBody.matchAll(/`\$\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}`/g)) {
    const enumKey = `${match[1]}.${match[2]}`;
    const value = enumValues.get(enumKey);

    if (value) {
      values.add(value);
    }
  }

  for (const line of arrayBody.split('\n')) {
    const cleaned = line
      .replace(/\/\/.*$/g, '')
      .trim()
      .replace(/,$/, '');

    if (!cleaned || cleaned.startsWith('...')) {
      continue;
    }

    const constValue = constValues.get(cleaned);

    if (constValue) {
      values.add(constValue);
    }
  }

  return values;
}

function extractEventsFromEEventEnum(sourceContent) {
  const match = sourceContent.match(/enum\s+EEvent\s*\{([\s\S]*?)\}/);

  if (!match) {
    return new Set();
  }

  const values = new Set();

  for (const valueMatch of match[1].matchAll(/=\s*'([^']+)'/g)) {
    values.add(valueMatch[1]);
  }

  return values;
}

function extractEventsFromDocTable(content) {
  const values = new Set();

  for (const match of content.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) {
    const eventName = match[1].trim();

    if (!eventName) {
      continue;
    }

    values.add(eventName);
  }

  return values;
}

function checkApiEventsSync() {
  const issues = [];

  for (const config of API_EVENT_SYNC_CONFIG) {
    const absoluteDocPath = path.resolve(ROOT_DIR, config.docPath);
    const absoluteSourcePath = path.resolve(ROOT_DIR, config.sourcePath);
    const docContent = readUtf8(absoluteDocPath);
    const sourceContent = readUtf8(absoluteSourcePath);

    const sourceEvents = extractEventsFromSourceArray(
      sourceContent,
      config.sourceArrayConstName ?? 'EVENT_NAMES',
    );
    if (sourceEvents.size === 0) {
      const enumEvents = extractEventsFromEEventEnum(sourceContent);

      enumEvents.forEach((eventName) => {
        sourceEvents.add(eventName);
      });
    }

    const expectedDocEvents = new Set(
      [...sourceEvents].map((eventName) => {
        return config.prefix ? `${config.prefix}:${eventName}` : eventName;
      }),
    );
    const docEvents = extractEventsFromDocTable(docContent);
    const relevantDocEvents = new Set(
      [...docEvents].filter((eventName) => {
        if (config.noColonOnly) {
          return !eventName.includes(':');
        }

        if (config.docPrefixFilter) {
          return eventName.startsWith(config.docPrefixFilter);
        }

        if (!config.prefix) {
          return true;
        }

        return eventName.startsWith(`${config.prefix}:`);
      }),
    );

    const missingInDocs = [...expectedDocEvents].filter((eventName) => {
      return !relevantDocEvents.has(eventName);
    });
    const extraInDocs = [...relevantDocEvents].filter((eventName) => {
      return !expectedDocEvents.has(eventName);
    });

    if (missingInDocs.length > 0) {
      issues.push(
        docIssue(
          absoluteDocPath,
          1,
          'api-sync',
          'Missing API event(s) in docs',
          missingInDocs.join(', '),
        ),
      );
    }

    if (extraInDocs.length > 0) {
      issues.push(
        docIssue(
          absoluteDocPath,
          1,
          'api-sync',
          'Unknown API event(s) in docs',
          extraInDocs.join(', '),
        ),
      );
    }
  }

  return issues;
}

function getStateMachineDocsFiles() {
  return getMarkdownFiles(path.resolve(DOCS_DIR, 'architecture/components')).filter((filePath) => {
    return filePath.endsWith('/state-machine.md');
  });
}

function getSectionBodyAfterHeading(lines, sectionHeading) {
  const startIndex = lines.findIndex((line) => {
    return line.trim() === sectionHeading;
  });

  if (startIndex === -1) {
    return undefined;
  }

  let endIndex = lines.length;

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      endIndex = i;
      break;
    }
  }

  return {
    startLine: startIndex + 1,
    body: lines.slice(startIndex + 1, endIndex).join('\n'),
  };
}

function getLevel2Headings(lines) {
  return lines
    .map((line, index) => ({ heading: line.trim(), line: index + 1 }))
    .filter(({ heading }) => heading.startsWith('## '));
}

function validateSectionsAgainstSchema(filePath, checkType, level2Headings, schema, options = {}) {
  const {
    checkUnexpected = false,
    checkDuplicates = false,
    checkOrder = false,
    unexpectedSectionsMessage,
    orderMismatchMessage,
  } = options;
  const issues = [];
  const sectionPositions = new Map();
  const add = (line, title, message, snippet) => {
    issues.push(docIssue(filePath, line, checkType, title, message, snippet));
  };

  for (const requiredSection of schema.requiredSections ?? []) {
    const found = level2Headings.find(({ heading }) => {
      return heading === requiredSection;
    });

    if (!found) {
      add(1, 'Missing required section', `Section "${requiredSection}" is required.`);
      continue;
    }

    sectionPositions.set(requiredSection, found.line);
  }

  if (checkUnexpected && schema.allowedSections) {
    const unexpectedSections = level2Headings.filter(({ heading }) => {
      return !schema.allowedSections.includes(heading);
    });

    for (const section of unexpectedSections) {
      add(
        section.line,
        'Unexpected section',
        unexpectedSectionsMessage ??
          `File supports only template sections: ${schema.allowedSections.join(', ')}.`,
        section.heading,
      );
    }
  }

  if (checkDuplicates) {
    const seenSections = new Set();

    for (const section of level2Headings) {
      if (seenSections.has(section.heading)) {
        add(
          section.line,
          'Duplicate section',
          `Section "${section.heading}" must appear only once.`,
          section.heading,
        );
      }

      seenSections.add(section.heading);
    }
  }

  if (checkOrder && schema.orderTemplate) {
    const filteredOrderedSections = level2Headings
      .map(({ heading }) => heading)
      .filter((heading) => schema.orderTemplate.includes(heading));

    for (let index = 1; index < filteredOrderedSections.length; index += 1) {
      const prevTemplateIndex = schema.orderTemplate.indexOf(filteredOrderedSections[index - 1]);
      const nextTemplateIndex = schema.orderTemplate.indexOf(filteredOrderedSections[index]);

      if (nextTemplateIndex <= prevTemplateIndex) {
        const headingOutOfOrder = filteredOrderedSections[index];
        const badEntry = level2Headings.find((entry) => entry.heading === headingOutOfOrder);

        add(
          badEntry?.line ?? 1,
          'Sections order mismatch',
          orderMismatchMessage ??
            `Sections order must follow template: ${schema.orderTemplate.join(' -> ')}.`,
        );
        break;
      }
    }
  }

  return { issues, sectionPositions };
}

function getNonEmptyLinesWithNumbers(lines) {
  return lines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim() !== '');
}

function checkStateMachineStructure(filePath, content, options = {}) {
  const { strict = false } = options;
  const schema = DOCS_SCHEMA.STATE_MACHINE;
  const issues = [];
  const lines = content.split('\n');
  const nonEmptyLines = getNonEmptyLinesWithNumbers(lines);
  const firstNonEmptyLine = nonEmptyLines[0];

  if (!firstNonEmptyLine || !firstNonEmptyLine.line.startsWith('# ')) {
    issues.push(
      docIssue(
        filePath,
        1,
        'state-machine-structure',
        'Missing top-level title',
        'First non-empty line must be a level-1 heading: `# <название>`.',
      ),
    );

    return issues;
  }

  if (strict) {
    const h1 = firstNonEmptyLine.line.trim();

    if (!schema.strictH1Regex.test(h1)) {
      issues.push(
        docIssue(
          filePath,
          firstNonEmptyLine.lineNumber,
          'state-machine-structure-strict',
          'Strict H1 format',
          'Title must match `# <Name>StateMachine (описание)` — class name ends with `StateMachine`, then space and parenthetical subtitle.',
          h1,
        ),
      );
    }
  }

  const validationResult = validateSectionsAgainstSchema(
    filePath,
    'state-machine-structure',
    getLevel2Headings(lines),
    schema,
    {
      checkOrder: true,
      orderMismatchMessage:
        'Required sections must follow the template order from `Публичный API` to `Логирование`.',
    },
  );
  issues.push(...validationResult.issues);

  const firstSectionLine = validationResult.sectionPositions.get(schema.firstMainSection);

  if (firstSectionLine) {
    const hasDescription = hasNonEmptyNonHeadingContent(
      lines,
      firstNonEmptyLine.lineNumber,
      firstSectionLine - 1,
    );

    if (!hasDescription) {
      issues.push(
        docIssue(
          filePath,
          firstSectionLine,
          'state-machine-structure',
          'Missing description block',
          'A short description is required between the title and `## Публичный API`.',
        ),
      );
    }
  }

  if (strict) {
    const diagramSection = getSectionBodyAfterHeading(lines, schema.mermaidSection);

    if (diagramSection && !diagramSection.body.includes('```mermaid')) {
      issues.push(
        docIssue(
          filePath,
          diagramSection.startLine + 1,
          'state-machine-structure-strict',
          'Mermaid block placement',
          'Section `## Диаграмма переходов (Mermaid)` must contain a ```mermaid fenced block (before the next `##` section).',
        ),
      );
    }
  }

  return issues;
}

function getComponentIndexDocsFiles() {
  return getMarkdownFiles(path.resolve(DOCS_DIR, 'architecture/components')).filter((filePath) => {
    return path.basename(filePath) === 'index.md';
  });
}

function checkComponentIndexStructure(filePath, content) {
  const schema = DOCS_SCHEMA.COMPONENT_INDEX;
  const issues = [];
  const lines = content.split('\n');

  const h1Index = findMainH1LineIndex(lines);

  if (h1Index === -1) {
    issues.push(
      docIssue(
        filePath,
        1,
        'component-index-structure',
        'Missing top-level title',
        'File must contain `# <ComponentName> (краткое описание)` as the main H1.',
      ),
    );

    return issues;
  }

  const h1 = lines[h1Index].trim();

  if (!schema.h1Regex.test(h1)) {
    issues.push(
      docIssue(
        filePath,
        h1Index + 1,
        'component-index-structure',
        'H1 format',
        'Title must match `# <ComponentName> (описание)` — name, space, parenthetical subtitle.',
        h1,
      ),
    );
  }

  const firstHeadingIndex = findFirstLevel2HeadingLineIndex(lines, h1Index);

  if (schema.requireIntro && !hasIntroParagraph(lines, h1Index, firstHeadingIndex)) {
    issues.push(
      docIssue(
        filePath,
        h1Index + 2,
        'component-index-structure',
        'Missing intro',
        'Add a short intro (paragraph or `**Назначение**: ...`) before the first `##` section.',
      ),
    );
  }

  const validationResult = validateSectionsAgainstSchema(
    filePath,
    'component-index-structure',
    getLevel2Headings(lines),
    schema,
  );
  issues.push(...validationResult.issues);

  return issues;
}

function getApiDocsTopLevelMarkdownFiles() {
  const apiDir = path.resolve(DOCS_DIR, 'api');

  if (!fs.existsSync(apiDir)) {
    return [];
  }

  return fs
    .readdirSync(apiDir, { withFileTypes: true })
    .filter((entry) => {
      return entry.isFile() && entry.name.endsWith('.md');
    })
    .map((entry) => {
      return path.join(apiDir, entry.name);
    });
}

function resolveApiDocsSchemaByFileName(fileName) {
  const api = DOCS_SCHEMA.API;
  const candidates = [
    { schema: api.README, test: (name) => name === api.README.fileName },
    { schema: api.EXPORTS, test: (name) => name === api.EXPORTS.fileName },
    { schema: api.EVENTS, test: (name) => api.EVENTS.fileNamePattern.test(name) },
  ];

  const match = candidates.find(({ test }) => test(fileName));

  return match?.schema;
}

function checkApiDocsStructure(filePath, content) {
  const issues = [];
  const basename = path.basename(filePath);
  const schema = resolveApiDocsSchemaByFileName(basename);
  const lines = content.split('\n');
  const level2Headings = getLevel2Headings(lines);

  const h1Index = findMainH1LineIndex(lines);

  if (h1Index === -1) {
    issues.push(
      docIssue(
        filePath,
        1,
        'api-docs-structure',
        'Missing top-level title',
        'File must start with a single `# ...` H1 heading.',
      ),
    );

    return issues;
  }

  const h1 = lines[h1Index].trim();

  if (!schema) {
    issues.push(
      docIssue(
        filePath,
        1,
        'api-docs-structure',
        'Unsupported api doc file',
        'Expected README.md, exports.md, or a file named *-events.md. Update docs-check.cjs if a new layout is intentional.',
      ),
    );

    return issues;
  }

  if (schema.h1Exact && h1 !== schema.h1Exact) {
    issues.push(
      docIssue(
        filePath,
        h1Index + 1,
        'api-docs-structure',
        'H1 format',
        `H1 must be exactly \`${schema.h1Exact}\`.`,
        h1,
      ),
    );
  }

  if (schema.h1Regex && !schema.h1Regex.test(h1)) {
    issues.push(
      docIssue(
        filePath,
        h1Index + 1,
        'api-docs-structure',
        'H1 format',
        'Title must match `# События `ManagerName`` (backticks around the manager name).',
        h1,
      ),
    );
  }

  if (schema.requireIntro) {
    const firstHeadingIndex = findFirstLevel2HeadingLineIndex(lines, h1Index);

    if (!hasIntroParagraph(lines, h1Index, firstHeadingIndex)) {
      issues.push(
        docIssue(
          filePath,
          h1Index + 2,
          'api-docs-structure',
          'Missing intro',
          'Add a short intro paragraph before the first `##` section.',
        ),
      );
    }
  }

  const validationResult = validateSectionsAgainstSchema(
    filePath,
    'api-docs-structure',
    level2Headings,
    schema,
    {
      checkUnexpected: true,
      checkDuplicates: true,
      checkOrder: true,
    },
  );
  issues.push(...validationResult.issues);

  return issues;
}

function runChecksOnFiles(filePaths, getIssuesForFile, markdownContentCache) {
  const issues = [];

  for (const filePath of filePaths) {
    const content = markdownContentCache.get(filePath) ?? readUtf8(filePath);

    issues.push(...getIssuesForFile(filePath, content));
  }

  return issues;
}

function collectContentAndLinkIssues(markdownFiles, markdownContentCache, requestedChecks) {
  const issues = [];

  for (const markdownFile of markdownFiles) {
    const content = markdownContentCache.get(markdownFile) ?? '';

    if (requestedChecks.has('content')) {
      issues.push(...checkDeprecatedPatterns(markdownFile, content));
      issues.push(...checkTypescriptFences(markdownFile, content));
    }

    if (requestedChecks.has('links')) {
      issues.push(...checkLinks(markdownFile, content, markdownContentCache));
    }
  }

  return issues;
}

function printDocCheckIssues(issues) {
  console.error(`docs-check: found ${issues.length} issue(s):`);

  for (const issue of issues) {
    const relativePath = path.relative(process.cwd(), issue.filePath);
    const location = `${relativePath}:${issue.line}`;
    const details = 'snippet' in issue && issue.snippet ? ` [${issue.snippet}]` : '';

    console.error(`- ${location} — ${issue.title}: ${issue.message}${details}`);
  }
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Docs directory not found: ${DOCS_DIR}`);
    process.exit(1);
  }

  const requestedChecks = resolveRequestedChecks();
  const markdownFiles = getMarkdownFiles(DOCS_DIR);
  const markdownContentCache = new Map(
    markdownFiles.map((filePath) => {
      return [filePath, readUtf8(filePath)];
    }),
  );
  const allIssues = [];

  if (requestedChecks.has('content') || requestedChecks.has('links')) {
    allIssues.push(
      ...collectContentAndLinkIssues(markdownFiles, markdownContentCache, requestedChecks),
    );
  }

  if (requestedChecks.has('api-sync')) {
    allIssues.push(...checkApiEventsSync());
  }

  if (
    requestedChecks.has('state-machine-structure') ||
    requestedChecks.has('state-machine-structure-strict')
  ) {
    const useStrictStructure = requestedChecks.has('state-machine-structure-strict');

    allIssues.push(
      ...runChecksOnFiles(
        getStateMachineDocsFiles(),
        (filePath, content) => {
          return checkStateMachineStructure(filePath, content, { strict: useStrictStructure });
        },
        markdownContentCache,
      ),
    );
  }

  if (requestedChecks.has('component-index-structure')) {
    allIssues.push(
      ...runChecksOnFiles(
        getComponentIndexDocsFiles(),
        checkComponentIndexStructure,
        markdownContentCache,
      ),
    );
  }

  if (requestedChecks.has('api-docs-structure')) {
    allIssues.push(
      ...runChecksOnFiles(
        getApiDocsTopLevelMarkdownFiles(),
        checkApiDocsStructure,
        markdownContentCache,
      ),
    );
  }

  if (allIssues.length === 0) {
    console.log(
      `docs-check: OK (${markdownFiles.length} markdown files checked; checks: ${[
        ...requestedChecks,
      ].join(', ')})`,
    );
    return;
  }

  printDocCheckIssues(allIssues);
  process.exit(1);
}

main();
