import { useState, type ChangeEvent } from 'react';
import { exportResponses, importResponses } from './api';
import {
  MAX_IMPORT_FILE_BYTES, batchTransferRows, parseTransferFile, type TransferFile,
} from './transfer';
import type { Agent, Visibility } from './model';

interface Props {
  agent: Agent;
  onClose: () => void;
  reload: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

/** No client-side Supabase credentials. The existing Worker validates the user's role. */
export default function TransferWorkspace({ agent, onClose, reload, onNotice, onError }: Props) {
  const [scope, setScope] = useState<Visibility>('private');
  const [selectedName, setSelectedName] = useState('');
  const [preview, setPreview] = useState<TransferFile | null>(null);
  const [validationError, setValidationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const canShared = agent.role === 'admin';
  const rows = preview?.responses ?? [];
  const batches = preview ? batchTransferRows(rows, scope) : [];

  function chooseScope(next: Visibility) {
    if (busy || (next === 'shared' && !canShared)) return;
    setScope(next);
    setPreview(null);
    setSelectedName('');
    setValidationError('');
    setCompleted(0);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPreview(null);
    setCompleted(0);
    setValidationError('');
    setSelectedName(file?.name ?? '');
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setValidationError('The JSON file exceeds the 8 MB preview limit.');
      return;
    }
    setBusy(true);
    try {
      const content = await file.text();
      setPreview(parseTransferFile(content, scope));
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Unable to read this file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      const archive = await exportResponses(scope);
      if (archive.version !== 1 || archive.visibility !== scope || !Array.isArray(archive.responses)) {
        throw new Error('The export returned an unexpected format.');
      }
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `canned-responses-${scope}-${new Date().toISOString().slice(0, 10)}.json`;
        link.style.display = 'none';
        document.body.append(link);
        link.click();
        link.remove();
        onNotice(`Export downloaded: ${archive.responses.length} ${scope} responses.`);
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not export responses.');
    } finally { setBusy(false); }
  }

  async function handleImport() {
    if (!preview || !rows.length || busy || (scope === 'shared' && !canShared)) return;
    if (!window.confirm(
      `Import ${rows.length} NEW ${scope} responses from ${selectedName}?\n\n` +
      'Existing responses will not be overwritten. Duplicate shortcuts or text will be added as additional responses. ' +
      'This import is not atomic: if it fails partway, some entries may already be saved.',
    )) return;
    setBusy(true);
    setCompleted(0);
    let saved = 0;
    try {
      for (const batch of batches) {
        const result = await importResponses(scope, batch);
        if (result.imported !== batch.length || result.visibility !== scope) {
          throw new Error('The server did not confirm the expected import count.');
        }
        saved += batch.length;
        setCompleted(saved);
      }
      setPreview(null);
      setSelectedName('');
      onNotice(`Imported ${saved} new ${scope} responses. Existing responses were kept.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Import request failed.';
      onError(
        `Import interrupted after ${saved} confirmed responses. ` +
        'The failing batch may have been partially saved; check the library before attempting it again. ' + reason,
      );
      // The current batch might have succeeded in part. Do not offer a one-click retry.
      setPreview(null);
      setSelectedName('');
    } finally {
      setBusy(false);
      try { await reload(); }
      catch (error) { onError(error instanceof Error ? error.message : 'Could not refresh the library after importing.'); }
    }
  }

  return (
    <section className="archive-card archive-transfer" aria-label="Import and export responses">
      <div className="archive-form-heading">
        <div>
          <p className="archive-kicker">BACKUP & RESTORE</p>
          <h2>Import / Export responses</h2>
          <p>Export your responses as JSON or import an archive into the selected location.</p>
        </div>
        <button className="archive-button archive-button-quiet" type="button" disabled={busy} onClick={onClose}>Close</button>
      </div>
      <div className="archive-transfer-scope" role="group" aria-label="Import export destination">
        <button type="button" className={scope === 'private' ? 'active' : ''} aria-pressed={scope === 'private'}
          onClick={() => chooseScope('private')} disabled={busy}>My Private</button>
        {canShared && <button type="button" className={scope === 'shared' ? 'active' : ''} aria-pressed={scope === 'shared'}
          onClick={() => chooseScope('shared')} disabled={busy}>Shared (Admin)</button>}
      </div>
      <p className="archive-transfer-note">
        {scope === 'private'
          ? 'Private import/export is restricted to your own account. Even admins cannot export another agent’s private responses.'
          : 'Only the administrator can import or export the Shared library. Other agents can still add shared responses manually.'}
      </p>
      <div className="archive-transfer-grid">
        <div className="archive-transfer-column">
          <h3>Export {scope === 'shared' ? 'shared' : 'my private'} responses</h3>
          <p>Download all responses in this location, including their shortcuts, as a JSON backup.</p>
          <button type="button" className="archive-button archive-button-primary" disabled={busy}
            onClick={() => void handleExport()}>{busy ? 'Working…' : 'Download JSON'}</button>
        </div>
        <div className="archive-transfer-column">
          <h3>Import {scope === 'shared' ? 'shared' : 'private'} responses</h3>
          <p>Select a Canned Response Archive JSON export. The file is checked locally before upload.</p>
          <label htmlFor="archive-import-file" className="archive-transfer-file-label">Choose JSON file</label>
          <input id="archive-import-file" type="file" accept=".json,application/json" disabled={busy}
            onChange={event => void handleFile(event)} />
          {selectedName && <p className="archive-hint">Selected: {selectedName}</p>}
          {validationError && <p className="archive-transfer-error" role="alert">{validationError}</p>}
        </div>
      </div>
      {preview && (
        <div className="archive-transfer-preview">
          <div className="archive-transfer-preview-heading">
            <div><strong>Review before importing</strong><span className="archive-faint">
              {rows.length} responses · {batches.length} {batches.length === 1 ? 'batch' : 'batches'} · {scope}
            </span></div>
          </div>
          <div className="archive-transfer-preview-list" aria-label="First eight incoming responses">
            {rows.slice(0, 8).map((row, index) => (
              <div className="archive-transfer-preview-item" key={index}>
                <strong>#{row.shortcut}</strong>
                <span>{row.body.length > 180 ? `${row.body.slice(0, 180)}…` : row.body}</span>
              </div>
            ))}
          </div>
          {rows.length > 8 && <p className="archive-hint">Showing 8 of {rows.length} responses.</p>}
          <p className="archive-transfer-warning">
            Import only adds responses; it never replaces or merges existing text. Duplicate entries may be created.
            Imports run in batches of at most 50 and are <strong>not atomic</strong>. A failed batch may leave some responses saved.
            The backend currently permits up to 10 import requests per hour per account.
          </p>
          <div className="archive-transfer-preview-actions">
            <button type="button" className="archive-button archive-button-primary" disabled={busy}
              onClick={() => void handleImport()}>{busy ? `Importing… ${completed}/${rows.length}` : `Confirm import ${rows.length} responses`}</button>
            <button type="button" className="archive-button archive-button-quiet" disabled={busy}
              onClick={() => { setPreview(null); setSelectedName(''); setValidationError(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
