import LiquidButton from '../../ui/LiquidButton';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { findHashQuery, findSuggestions, insertSuggestion, type ArchiveResponse } from './model';
import LiquidUnderlay from '../../ui/LiquidUnderlay';

interface Props {
  responses: ArchiveResponse[];
  loading: boolean;
  onNotice: (notice: string) => void;
  onError: (message: string) => void;
}
interface LastInsert { before: string; after: string; caret: number; highlight: number }

export default function SearchWorkspace({ responses, loading, onNotice, onError }: Props) {
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastInsert = useRef<LastInsert | null>(null);
  // Expand only as the message grows; don't start users in a seven-row editor.
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = 'auto';
    const fullHeight = field.scrollHeight;
    field.style.height = `${Math.min(Math.max(fullHeight, 56), 216)}px`;
    field.style.overflowY = fullHeight > 216 ? 'auto' : 'hidden';
  }, [draft]);
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
    lastInsert.current = { before: draft, after: inserted.value, caret: found.end, highlight: activeIndex };
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
        setHighlight(previous.highlight);
        setSelection(previous.caret);
        onNotice('Insertion undone. Your previous # search and its suggestions are restored.');
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
        <h1>Search responses</h1>
        <p>Type <kbd>#</kbd> in your draft to insert a saved reply.</p>
      </div>
      <div className="archive-composer">
        <LiquidUnderlay radius={18}/>
        <textarea
          ref={input}
          aria-label="Message draft with hashtag shortcuts"
          aria-autocomplete="list"
          aria-controls="archive-suggestions"
          aria-activedescendant={open && activeIndex >= 0 ? `archive-option-${activeIndex}` : undefined}
          value={draft}
          placeholder={loading ? 'Loading responses…' : 'Write a message, or type # to find a response…'}
          spellCheck
          rows={2}
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
          <span className="archive-composer-hint"><kbd>#</kbd> Shortcuts<span className="archive-hint-desktop"> · <kbd>Enter</kbd> insert · <kbd>Ctrl</kbd> + <kbd>Z</kbd> undo</span></span>
          <LiquidButton className="archive-button archive-button-primary" type="button" disabled={!draft} onClick={() => void copyDraft()}>
            Copy draft
          </LiquidButton>
        </div>
      </div>
    </section>
  );
}
