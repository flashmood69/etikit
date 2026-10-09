import type { LabelElement } from '../types';

export type CsvDataset = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
};

function detectDelimiter(text: string) {
  const counts = new Map<string, number>([[',', 0], [';', 0], ['\t', 0]]);
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"' && inQuotes && text[index + 1] === '"') {
      index++;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (character === '\r' || character === '\n')) {
      break;
    } else if (!inQuotes && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }

  return [...counts].reduce((best, candidate) =>
    candidate[1] > best[1] ? candidate : best
  )[0];
}

export function parseCsv(text: string, fileName: string): CsvDataset {
  text = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else if (character === '\r' && text[index + 1] === '\n') {
        field += '\n';
        index++;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === delimiter) {
      record.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (character === '\r' && text[index + 1] === '\n') index++;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('CSV contains an unclosed quoted field.');
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmptyRecords = records.filter((row) => row.some((value) => value.trim() !== ''));
  if (nonEmptyRecords.length < 2) {
    throw new Error('CSV needs a header row and at least one data row.');
  }

  const headers = nonEmptyRecords[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim()
  );
  if (headers.some((header) => !header)) {
    throw new Error('CSV column names cannot be empty.');
  }
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new Error('CSV column names must be unique.');
  }

  const rows = nonEmptyRecords.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex]]));
  });

  return { fileName, headers, rows };
}

export function resolveCsvFields(elements: LabelElement[], row?: Record<string, string>): LabelElement[] {
  if (!row) return elements;

  return elements.map((element) => {
    if (!('content' in element) || typeof element.content !== 'string') return element;
    return {
      ...element,
      content: element.content.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (token, field: string) =>
        Object.prototype.hasOwnProperty.call(row, field.trim()) ? row[field.trim()] : token
      )
    } as LabelElement;
  });
}

export function hasCsvBindings(elements: LabelElement[], headers: string[]) {
  const availableHeaders = new Set(headers);
  return elements.some((element) => {
    if (!('content' in element) || typeof element.content !== 'string') return false;
    return Array.from(element.content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g))
      .some(([, field]) => availableHeaders.has(field.trim()));
  });
}
