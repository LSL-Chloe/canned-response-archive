import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api } from './api';
import LiquidButton from '../../ui/LiquidButton';

type Source = 'anime' | 'tv' | 'movie';
type Entry = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string | null;
  avatarUrl?: string;
  kind: 'title' | 'avatar';
};
type Props = {
  avatarUrl: string | null;
  onAvatarChange: (value: string | null) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const sources: { id: Source; label: string }[] = [
  { id: 'anime', label: 'Anime' }, { id: 'tv', label: 'TV series' }, { id: 'movie', label: 'Movies' },
];

async function compressAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP picture.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose a picture smaller than 8 MB.');
  const blob = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = blob;
    await img.decode();
    if (img.width < 20 || img.height < 20) throw new Error('Choose a larger picture.');
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot prepare this picture in your browser.');
    const side = Math.min(img.width, img.height);
    // Center crop to a square so every avatar fits the circle without stretching.
    context.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    for (const quality of [.86, .7, .55]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length < 195000) return result;
    }
    throw new Error('Could not compress the picture sufficiently.');
  } finally {
    URL.revokeObjectURL(blob);
  }
}

export default function AvatarPicker({ avatarUrl, onAvatarChange, onNotice, onError }: Props) {
  const [source, setSource] = useState<Source>('anime');
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<Entry[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<Entry | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = query.trim();
    const timer = window.setTimeout(() => setTerm(next.length >= 2 ? next : ''), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!term || selectedTitle) {
      if (!selectedTitle) setItems([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setSearchError('');
    void api<{ items: Entry[] }>(`/api/avatars/search?source=${source}&q=${encodeURIComponent(term)}`, {
      signal: controller.signal,
    }).then(data => setItems(data.items))
      .catch(error => {
        if (controller.signal.aborted) return;
        setItems([]);
        setSearchError(error instanceof Error ? error.message : 'Could not search the catalog.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [source, term, selectedTitle]);

  async function openTitle(title: Entry, nextPage = 1) {
    if (loading) return;
    setLoading(true);
    setSearchError('');
    try {
      const result = await api<{ items: Entry[]; hasMore: boolean }>(
        `/api/avatars/characters?source=${source}&id=${encodeURIComponent(title.id)}&page=${nextPage}`,
      );
      setItems(previous => nextPage === 1 ? result.items : [...previous, ...result.items]);
      setPage(nextPage);
      setHasMore(result.hasMore);
      setSelectedTitle(title);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Unable to load characters.');
    } finally { setLoading(false); }
  }
  async function selectAvatar(value: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ avatarUrl: string }>('/api/account/avatar', {
        method: 'PATCH', body: JSON.stringify({ avatarUrl: value }),
      });
      onAvatarChange(result.avatarUrl);
      onNotice('Profile picture updated.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save your profile picture.');
    } finally { setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || busy) return;
    setBusy(true);
    try {
      const imageData = await compressAvatar(file);
      const result = await api<{ avatarUrl: string }>('/api/account/avatar/upload', {
        method: 'POST', body: JSON.stringify({ imageData }),
      });
      onAvatarChange(result.avatarUrl);
      onNotice('Your own profile picture was uploaded.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Upload failed.');
    } finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/account/avatar', { method: 'PATCH', body: JSON.stringify({ avatarUrl: null }) });
      onAvatarChange(null);
      onNotice('Profile picture reset to initials.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not reset the profile picture.');
    } finally { setBusy(false); }
  }
  function changeSource(next: Source) {
    setSource(next);
    setItems([]);
    setSelectedTitle(null);
    setHasMore(false);
    setPage(1);
    setSearchError('');
  }
  function back() {
    setSelectedTitle(null);
    setItems([]);
    setPage(1);
    setHasMore(false);
    setSearchError('');
  }
  return (
    <section className="archive-card archive-avatar-picker" aria-label="Choose profile picture">
      <div className="archive-avatar-heading">
        <div>
          <h2>Profile picture</h2>
          <p className="archive-hint">Upload your own picture or browse characters from anime, TV and movies.</p>
        </div>
        {avatarUrl && <button type="button" className="archive-avatar-reset" onClick={() => void remove()} disabled={busy}>Remove</button>}
      </div>
      <div className="archive-avatar-current">
        <span className="archive-avatar-preview">
          {avatarUrl ? <img src={avatarUrl} alt="Current profile picture" referrerPolicy="no-referrer"/> :
            <span aria-label="No profile picture" className="archive-avatar-placeholder">+</span>}
        </span>
        <span className="archive-faint">{avatarUrl ? 'Current picture' : 'No picture selected'}</span>
      </div>
      <div className="archive-avatar-source-tabs" role="group" aria-label="Avatar catalog">
        {sources.map(option => (
          <button key={option.id} type="button" className={source === option.id ? 'active' : ''}
            aria-pressed={source === option.id} onClick={() => changeSource(option.id)} disabled={busy}>
            {option.label}
          </button>
        ))}
      </div>
      <label htmlFor="archive-avatar-search" className="archive-avatar-search-label">Search by series or character</label>
      <input id="archive-avatar-search" type="search" value={query} maxLength={80}
        placeholder={source === 'anime' ? 'e.g. Naruto or Levi' : source === 'tv' ? 'e.g. Breaking Bad' : 'e.g. The Dark Knight'}
        onChange={event => { setQuery(event.target.value); back(); }}
        className="archive-avatar-search"/>
      {selectedTitle && (
        <button type="button" className="archive-avatar-back" onClick={back}>
          <span aria-hidden="true">‹</span> {selectedTitle.title} — back to search
        </button>
      )}
      <div className="archive-avatar-gallery" aria-label="Available profile pictures">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp"
          className="archive-avatar-file" aria-label="Choose picture from your computer" onChange={event => void upload(event)}/>
        <button type="button" className="archive-avatar-tile archive-avatar-upload" disabled={busy}
          onClick={() => fileInput.current?.click()} title="Upload a custom profile picture">
          <span className="archive-avatar-upload-circle"><span aria-hidden="true">+</span></span>
          <span className="archive-avatar-tile-name">Custom PFP</span>
        </button>
        {items.map((item, index) => (
          <button type="button" key={item.kind + ':' + item.id + ':' + index} disabled={busy || loading}
            className="archive-avatar-tile" title={item.title}
            onClick={() => item.kind === 'title' ? void openTitle(item) : item.avatarUrl && void selectAvatar(item.avatarUrl)}>
            <span className="archive-avatar-tile-image">
              {item.imageUrl ? <img src={item.imageUrl} loading="lazy" alt="" referrerPolicy="no-referrer"/> :
                <span aria-hidden="true">?</span>}
            </span>
            <span className="archive-avatar-tile-name">{item.title}</span>
            <span className="archive-avatar-tile-subtitle">{item.subtitle || (item.kind === 'title' ? 'View cast' : 'Choose')}</span>
          </button>
        ))}
      </div>
      {loading && <p className="archive-hint" role="status">Finding portraits…</p>}
      {searchError && <p className="archive-avatar-error" role="alert">{searchError}</p>}
      {selectedTitle && hasMore && !loading && (
        <LiquidButton type="button" tone="neutral" disabled={busy} className="archive-button"
          onClick={() => void openTitle(selectedTitle, page + 1)}>Load more characters</LiquidButton>
      )}
      {!loading && !searchError && !items.length && (
        <p className="archive-hint">{selectedTitle ? 'No character portraits available for this title.' :
          query.trim().length < 2 ? 'Search a show, movie or character, or use the first circle to upload from your PC.' :
            'No matching portraits found.'}</p>
      )}
      <p className="archive-avatar-attribution">Images from AniList, TVmaze and TMDB. Movie portraits use actor photos when character images are unavailable.</p>
    </section>
  );
}
