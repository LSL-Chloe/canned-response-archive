import type { Visibility } from './model';

export interface TransferRow {
  shortcut: string;
  body: string;
}
export interface TransferFile {
  version: 1;
  visibility: Visibility;
  responses: TransferRow[];
}

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_BYTES = 8_000_000;
const MAX_REQUEST_BYTES = 220_000;
const MAX_BATCH_ROWS = 50;

/** Validate exported JSON locally before any import request reaches the Worker. */
export function parseTransferFile(raw: string, destination: Visibility): TransferFile {
  if (raw.length > MAX_IMPORT_FILE_BYTES) throw new Error('File is too large (8 MB maximum).');
  let decoded: unknown;
  try { decoded = JSON.parse(raw); }
  catch { throw new Error('This file is not valid JSON.'); }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('Expected a JSON archive object, not an array.');
  }
  const data = decoded as Record<string, unknown>;
  if (data.version !== 1) throw new Error('Only Canned Response Archive version 1 exports are supported.');
  if (data.visibility !== 'private' && data.visibility !== 'shared') {
    throw new Error('Archive file must identify Shared or Private visibility.');
  }
  if (data.visibility !== destination) {
    throw new Error(`This file was exported as ${data.visibility}. Choose ${data.visibility === 'shared' ? 'Shared' : 'Private'} before importing.`);
  }
  if (!Array.isArray(data.responses) || !data.responses.length) {
    throw new Error('This archive has no responses to import.');
  }
  if (data.responses.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import up to ${MAX_IMPORT_ROWS} responses per file; split larger exports into smaller files.`);
  }
  const responses: TransferRow[] = data.responses.map((unknownRow, index) => {
    if (!unknownRow || typeof unknownRow !== 'object' || Array.isArray(unknownRow)) {
      throw new Error(`Response ${index + 1} is not a valid object.`);
    }
    const row = unknownRow as Record<string, unknown>;
    if (typeof row.shortcut !== 'string') throw new Error(`Response ${index + 1} has no shortcut.`);
    const shortcut = row.shortcut.trim().replace(/^#/, '');
    if (!/^[A-Za-z0-9_][A-Za-z0-9_ -]{0,63}$/.test(shortcut)) {
      throw new Error(`Response ${index + 1} has an invalid shortcut (1–64 letters, numbers, spaces, - or _).`);
    }
    if (typeof row.body !== 'string' || !row.body.trim() || row.body.length > 10_000) {
      throw new Error(`Response ${index + 1} must contain 1–10,000 characters of text.`);
    }
    return { shortcut, body: row.body };
  });
  return { version: 1, visibility: destination, responses };
}

/** Keep each server request under the 50-response and 250k-character API limits. */
export function batchTransferRows(rows: TransferRow[], visibility: Visibility): TransferRow[][] {
  if (!rows.length) return [];
  const result: TransferRow[][] = [];
  let batch: TransferRow[] = [];
  const size = (items: TransferRow[]) =>
    new TextEncoder().encode(JSON.stringify({ visibility, responses: items })).length;
  for (const row of rows) {
    if (batch.length && (batch.length === MAX_BATCH_ROWS || size([...batch, row]) > MAX_REQUEST_BYTES)) {
      result.push(batch);
      batch = [];
    }
    if (size([row]) > MAX_REQUEST_BYTES) throw new Error('One response is too large for the import API.');
    batch.push(row);
  }
  if (batch.length) result.push(batch);
  return result;
}
