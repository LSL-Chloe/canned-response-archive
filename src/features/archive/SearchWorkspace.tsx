import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { findHashQuery, findSuggestions, insertSuggestion, type ArchiveResponse } from './model';

interface Props {
  responses: ArchiveResponse[];
  loading: boolean;
  onNotice: (notice: string) => void;
  onError: (message: string) => void;
}
interface LastInsert { before: string; after: string; caret: number }

export default function SearchWorkspace({ responses, loading, onNotice, onError }: Props) {
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastInsert = useRef<LastInsert | null>(null);
  const token = findHashQuery(draft, caret);
  const suggestions = useMemo(
    () => token ? findSuggestions(responses, token.query) : [],
    [responses, token?.query, token?.start, token?.end],
  );
  const open = focused && !dismissed && token !== null;
  const activeIndex = suggestions.length ? Math.min(highlight, suggestions.length - 1) : -1;

  function setSelection(nextCaret: number) {
    requestAnimationFrame(() => {
      const element = input.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(nextCaret, nextCaret);
    });
  }
  function useResponse(item: ArchiveResponse) {
    const found = findHashQuery(draft, input.current?.selectionStart ?? caret);
    if (!found) return;
    const inserted = insertSuggestion(draft, found, item.body);
    lastInsert.current = { before: draft, after: inserted.value, caret: found.start };
    setDraft(inserted.value);
    setCaret(inserted.caret);
    setDismissed(true);
    setSelection(inserted.caret);
    onNotice('Response inserted into your draft. Ctrl+Z or Cmd+Z restores the previous text.');
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      const previous = lastInsert.current;
      if (previous && draft === previous.after) {
        event.preventDefault();
        lastInsert.current = null;
        setDraft(previous.before);
        setCaret(previous.caret);
        setDismissed(false);
        setSelection(previous.caret);
        onNotice('Insertion undone.');
      }
      return; // Otherwise preserve the browser's normal undo behavior.
    }
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      useResponse(suggestions[activeIndex] ?? suggestions[0]!);
    }
  }
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      onNotice('Draft copied to clipboard.');
    } catch { onError('Clipboard access was blocked by your browser. Select and copy the text manually.'); }
  }

  return (
    <section className="archive-search-view" aria-label="Shortcut search">
      <div className="archive-search-intro">
        <p className="archive-kicker">CANNED RESPONSE ARCHIVE</p>
        <h1>Find the right words, faster.</h1>
        <p>Write your message and type <kbd>#</kbd> to search available canned responses.</p>
      </div>
      <div className="archive-composer">
        <div className="archive-composer-top">
          <span className="archive-composer-label">MESSAGE DRAFT</span>
          <span className="archive-faint">{loading ? 'Updating responses…' : `${responses.length} available`}</span>
        </div>
        <textarea
          ref={input}
          aria-label="Message draft with hashtag shortcuts"
          aria-autocomplete="list"
          aria-controls="archive-suggestions"
          aria-activedescendant={open && activeIndex >= 0 ? `archive-option-${activeIndex}` : undefined}
          value={draft}
          placeholder="Start typing your message, or type # to explore shortcuts…"
          spellCheck
          rows={7}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={event => { setCaret(event.currentTarget.selectionStart); setDismissed(false); }}
          onSelect={event => setCaret(event.currentTarget.selectionStart)}
          onChange={event => {
            const value = event.currentTarget.value;
            setDraft(value);
            setCaret(event.currentTarget.selectionStart);
            setDismissed(false);
            setHighlight(0);
            if (lastInsert.current?.after !== value) lastInsert.current = null;
          }}
          onKeyDown={onKeyDown}
        />
        {open && (
          <div className="archive-suggestion-popover">
            <div className="archive-suggestion-heading">
              <span>{token?.query ? `Matches for #${token.query}` : 'Available shortcuts'}</span>
              <span className="archive-faint">↑ ↓ to navigate · Enter to insert · Esc to close</span>
            </div>
            <div role="listbox" id="archive-suggestions" aria-label="Canned response suggestions" className="archive-suggestion-list">
              {suggestions.length ? suggestions.map((item, index) => (
                <div
                  key={item.id}
                  id={`archive-option-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`archive-suggestion ${activeIndex === index ? 'selected' : ''}`}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => useResponse(item)}
                >
                  <div className="archive-suggestion-row">
                    <strong>#{item.shortcut}</strong>
                    <span className="archive-small-tag">{item.visibility === 'private' ? 'Private' : 'Shared'}</span>
                  </div>
                  <div className="archive-snippet">{item.body}</div>
                </div>
              )) : (
                <div className="archive-empty-options">No responses match that shortcut.</div>
              )}
            </div>
          </div>
        )}
        <div className="archive-composer-bottom">
          <span><kbd>#</kbd> Search <span aria-hidden="true">·</span> <kbd>Enter</kbd> Insert <span aria-hidden="true">·</span> <kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo</span>
          <button className="archive-button archive-button-primary" type="button" disabled={!draft} onClick={() => void copyDraft()}>
            Copy draft
          </button>
        </div>
      </div>
      <p className="archive-search-note">Shared responses are available to everyone. Sign in to include your private responses.</p>
    </section>
  );
}
