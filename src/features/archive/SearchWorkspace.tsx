import LiquidButton from '../../ui/LiquidButton';
import { useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { findHashQuery, findPlainShortcutQuery, findShortcutGroups, insertSuggestion, type ArchiveResponse } from './model';
import LiquidUnderlay from '../../ui/LiquidUnderlay';

interface Props {
  responses: ArchiveResponse[];
  loading: boolean;
  onNotice: (notice: string) => void;
  onError: (message: string) => void;
}
interface LastInsert {
  before: string;
  after: string;
  caret: number;
  highlight: number;
  selectedShortcut: string | null;
}

export default function SearchWorkspace({ responses, loading, onNotice, onError }: Props) {
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selectedShortcut, setSelectedShortcut] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const lastInsert = useRef<LastInsert | null>(null);

  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = 'auto';
    const fullHeight = field.scrollHeight;
    field.style.height = `${Math.min(Math.max(fullHeight, 56), 216)}px`;
    field.style.overflowY = fullHeight > 216 ? 'auto' : 'hidden';
  }, [draft]);

  const token = findHashQuery(draft, caret) ?? findPlainShortcutQuery(draft, caret, responses);
  const groups = useMemo(
    () => token ? findShortcutGroups(responses, token.query) : [],
    [responses, token?.query, token?.start, token?.end],
  );
  const current = selectedShortcut
    ? groups.find(group => group.name.toLowerCase() === selectedShortcut.toLowerCase())
    : undefined;
  const options = current ? current.responses : groups;
  const open = focused && !dismissed && token !== null;
  const activeIndex = options.length ? Math.min(highlight, options.length - 1) : -1;

  // Keep keyboard selection in view inside the fixed-height menu.
  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return;
    menu.current?.querySelector<HTMLElement>(`#archive-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, current?.name]);

  function setSelection(nextCaret: number) {
    requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(nextCaret, nextCaret);
    });
  }
  function openShortcut(name: string) {
    setSelectedShortcut(name);
    setHighlight(0);
  }
  function goBack() {
    const previous = groups.findIndex(group => group.name.toLowerCase() === selectedShortcut?.toLowerCase());
    setSelectedShortcut(null);
    setHighlight(Math.max(0, previous));
  }
  function useResponse(item: ArchiveResponse) {
    const position = input.current?.selectionStart ?? caret;
    const found = findHashQuery(draft, position) ?? findPlainShortcutQuery(draft, position, responses);
    if (!found) return;
    const inserted = insertSuggestion(draft, found, item.body);
    lastInsert.current = {
      before: draft, after: inserted.value, caret: found.end,
      highlight: activeIndex, selectedShortcut,
    };
    setDraft(inserted.value);
    setCaret(inserted.caret);
    setDismissed(true);
    setSelection(inserted.caret);
    onNotice('Response inserted. Ctrl+Z or Cmd+Z restores the shortcut search.');
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // One Escape clears the entire composer, even if a shortcut menu or a
    // response variant is open. Reset the custom insertion undo snapshot so
    // Ctrl/Cmd+Z cannot unexpectedly restore a previously inserted reply.
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setDraft('');
      setCaret(0);
      setDismissed(true);
      setHighlight(0);
      setSelectedShortcut(null);
      lastInsert.current = null;
      setSelection(0);
      return;
    }
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      const previous = lastInsert.current;
      if (previous && draft === previous.after) {
        event.preventDefault();
        lastInsert.current = null;
        setDraft(previous.before);
        setCaret(previous.caret);
        setDismissed(false);
        setSelectedShortcut(previous.selectedShortcut);
        setHighlight(previous.highlight);
        setSelection(previous.caret);
        onNotice('Insertion undone. Shortcut search restored.');
      }
      return;
    }
    if (!open) return;
    if (current && event.key === 'ArrowLeft') {
      event.preventDefault();
      goBack();
      return;
    }
    if (!options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'ArrowRight') {
      if (!current && options[activeIndex]) {
        event.preventDefault();
        openShortcut(groups[activeIndex]!.name);
      } else if (current && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        useResponse(current.responses[activeIndex] ?? current.responses[0]!);
      }
    }
  }
  function onCopyDraft(event: ClipboardEvent<HTMLTextAreaElement>) {
    // Only substitute the full draft when nothing is selected. Preserve the
    // browser's normal Ctrl/Cmd+C behavior for highlighted text.
    if (!draft || event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) return;
    if (!event.clipboardData) return;
    event.clipboardData.setData('text/plain', draft);
    event.preventDefault();
    onNotice('Draft copied to clipboard.');
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      onNotice('Draft copied to clipboard.');
    } catch {
      onError('Clipboard access was blocked. Select and copy your text manually.');
    }
  }

  return (
    <section className="archive-search-view" aria-label="Shortcut search">
      <div className="archive-search-intro">
        <h1>Search responses</h1>
        <p>Start with a shortcut name, with or without <kbd>#</kbd>. Use <kbd>#</kbd> anywhere in a message.</p>
      </div>
      <div className="archive-composer">
        <LiquidUnderlay radius={18}/>
        <textarea
          ref={input}
          aria-label="Message draft with optional hashtag shortcuts"
          aria-keyshortcuts="Escape"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="archive-suggestions"
          aria-activedescendant={open && activeIndex >= 0 ? `archive-option-${activeIndex}` : undefined}
          value={draft}
          placeholder={loading ? 'Loading responses…' : 'Write a message, or find a shortcut with or without #…'}
          spellCheck
          rows={2}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={event => { setCaret(event.currentTarget.selectionStart); setDismissed(false); setSelectedShortcut(null); }}
          onSelect={event => setCaret(event.currentTarget.selectionStart)}
          onChange={event => {
            const value = event.currentTarget.value;
            setDraft(value);
            setCaret(event.currentTarget.selectionStart);
            setDismissed(false);
            setSelectedShortcut(null);
            setHighlight(0);
            if (lastInsert.current?.after !== value) lastInsert.current = null;
          }}
          onKeyDown={onKeyDown}
          onCopy={onCopyDraft}
        />
        {open && (
          <div className="archive-suggestion-popover">
            <div className="archive-suggestion-heading">
              {current ? (
                <button type="button" className="archive-shortcut-back"
                  onMouseDown={event => event.preventDefault()} onClick={goBack}
                  aria-label="Back to shortcuts">‹ <strong>#{current.name}</strong></button>
              ) : (
                <span>{token?.query ? `Shortcuts matching ${token.query}` : 'All shortcuts'}</span>
              )}
              <span className="archive-faint">
                {current ? `${current.responses.length} saved responses · Enter to insert · ← back` :
                  `${groups.length} shortcuts · ↑ ↓ select · Enter / → open`}
              </span>
            </div>
            <div role="listbox" id="archive-suggestions" ref={menu}
              aria-label={current ? `Responses for #${current.name}` : 'Saved shortcuts'}
              className="archive-suggestion-list archive-shortcut-scroll">
              {current ? current.responses.map((item, index) => (
                <div key={item.id} id={`archive-option-${index}`} role="option"
                  aria-selected={activeIndex === index}
                  className={`archive-suggestion ${activeIndex === index ? 'selected' : ''}`}
                  onMouseDown={event => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => useResponse(item)}>
                  <div className="archive-suggestion-row">
                    <span className="archive-response-option-label">{item.body}</span>
                    <span className="archive-small-tag">{item.visibility === 'private' ? 'Private' : 'Shared'}</span>
                  </div>
                </div>
              )) : groups.length ? groups.map((group, index) => (
                <div key={group.name.toLowerCase()} id={`archive-option-${index}`} role="option"
                  aria-selected={activeIndex === index}
                  className={`archive-suggestion archive-shortcut-option ${activeIndex === index ? 'selected' : ''}`}
                  onMouseDown={event => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => openShortcut(group.name)}>
                  <div className="archive-suggestion-row">
                    <strong>#{group.name}</strong>
                    <span className="archive-shortcut-count">{group.responses.length} <span aria-hidden="true">›</span></span>
                  </div>
                </div>
              )) : (
                <div className="archive-empty-options">No matching shortcuts.</div>
              )}
            </div>
          </div>
        )}
        <div className="archive-composer-bottom">
          <span className="archive-composer-hint"><kbd>#</kbd> Optional for shortcut search
            <span className="archive-hint-desktop"> · <kbd>Enter</kbd> open · <kbd>Ctrl</kbd> + <kbd>Z</kbd> undo · <kbd>Ctrl</kbd> + <kbd>C</kbd> copy · <kbd>Esc</kbd> clear</span>
          </span>
          <LiquidButton className="archive-button archive-button-primary" type="button"
            disabled={!draft} onClick={() => void copyDraft()}>Copy draft</LiquidButton>
        </div>
      </div>
    </section>
  );
}
