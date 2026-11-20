import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api } from './api';
import LiquidButton from '../../ui/LiquidButton';
import { avatarImageSrc } from './avatarImages';

type Source = 'anime' | 'tv' | 'movie';
type Entry = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string | null;
  avatarUrl?: string;
  kind: 'title' | 'avatar';
  wiki?: string;
  wikiPage?: string;
  malId?: number;
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

function PortraitImage({ url, label }: { url: string; label: string }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [url]);
  if (attempt > 1) return <span className="archive-avatar-image-fallback" aria-label={label + ' portrait unavailable'}>◯</span>;
  return <img src={attempt === 0 ? avatarImageSrc(url) : url} loading="lazy" alt=""
    onError={() => setAttempt(value => value + 1)}/>;
}

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
  const [titles, setTitles] = useState<Entry[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<Entry | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [moreFrom, setMoreFrom] = useState<Entry | null>(null);
  const [moreItems, setMoreItems] = useState<Entry[]>([]);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Opening a category loads featured characters. Searching replaces them
  // with actual character portraits without requiring any title selection.
  useEffect(() => {
    if (selectedTitle) return;
    const controller = new AbortController();
    const path = term.length >= 2
      ? '/api/avatars/search?source=' + source + '&q=' + encodeURIComponent(term)
      : '/api/avatars/popular?source=' + source;
    setLoading(true);
    setSearchError('');
    void api<{items:Entry[];titles?:Entry[]}>(path,{signal:controller.signal})
      .then(data => {
        if (controller.signal.aborted) return;
        setItems(data.items || []);
        setTitles(data.titles || []);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setItems([]);
        setTitles([]);
        setSearchError(error instanceof Error ? error.message : 'Character catalog could not load.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [source,term,selectedTitle]);

  async function openTitle(title: Entry, nextPage=1) {
    if (loading) return;
    setLoading(true);
    setSearchError('');
    try {
      const result = await api<{items:Entry[];hasMore:boolean}>(
        '/api/avatars/characters?source=' + source + '&id=' + encodeURIComponent(title.id) + '&page=' + nextPage,
      );
      setItems(previous => nextPage===1 ? result.items : [...previous,...result.items]);
      setPage(nextPage);
      setHasMore(result.hasMore);
      setSelectedTitle(title);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Characters could not load.');
    } finally { setLoading(false); }
  }
  async function selectAvatar(value:string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{avatarUrl:string}>('/api/account/avatar',{
        method:'PATCH',body:JSON.stringify({avatarUrl:value}),
      });
      onAvatarChange(result.avatarUrl);
      setMoreFrom(null);
      onNotice('Profile picture updated.');
    } catch(error) {
      onError(error instanceof Error ? error.message : 'Could not save profile picture.');
    } finally { setBusy(false); }
  }
  async function showMore(item:Entry) {
    if (!item.wiki && !item.malId) return;
    setMoreFrom(item);
    setMoreItems([]);
    setMoreError('');
    setMoreBusy(true);
    try {
      const params = new URLSearchParams({
        wiki:item.wiki || '',page:item.wikiPage || item.title,
        malId:String(item.malId || 0),
      });
      const result = await api<{items:Entry[]}>('/api/avatars/variations?' + params);
      setMoreItems((result.items || []).filter(x=>x.avatarUrl));
    } catch(error) {
      setMoreError(error instanceof Error ? error.message : 'Alternate looks are unavailable.');
    } finally { setMoreBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if (!file || busy) return;
    setBusy(true);
    try {
      const imageData=await compressAvatar(file);
      const result=await api<{avatarUrl:string}>('/api/account/avatar/upload',{
        method:'POST',body:JSON.stringify({imageData}),
      });
      onAvatarChange(result.avatarUrl);
      onNotice('Custom profile picture uploaded.');
    } catch(error) {
      onError(error instanceof Error ? error.message : 'Upload failed.');
    } finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/account/avatar',{method:'PATCH',body:JSON.stringify({avatarUrl:null})});
      onAvatarChange(null);
      onNotice('Profile picture reset to initials.');
    } catch(error) {
      onError(error instanceof Error ? error.message : 'Could not reset profile picture.');
    } finally { setBusy(false); }
  }
  function resetNavigation() {
    setSelectedTitle(null);setPage(1);setHasMore(false);
    setMoreFrom(null);setMoreItems([]);setSearchError('');
  }
  function changeSource(next:Source) {
    if (next===source) return;
    setSource(next);setQuery('');setTerm('');
    setItems([]);setTitles([]);
    resetNavigation();
  }
  const portraits=items.filter(item=>item.kind==='avatar' && Boolean(item.avatarUrl));
  const showFeatured=term.length<2 && !selectedTitle;
  return (
    <section className="archive-card archive-avatar-picker" aria-label="Choose profile picture">
      <div className="archive-avatar-heading">
        <div>
          <h2>Profile picture</h2>
          <p className="archive-hint">Choose a character portrait or upload your own.</p>
        </div>
        {avatarUrl && <button type="button" className="archive-avatar-reset"
          onClick={()=>void remove()} disabled={busy}>Remove</button>}
      </div>
      <div className="archive-avatar-current">
        <span className="archive-avatar-preview">
          {avatarUrl ? <PortraitImage url={avatarUrl} label="Current profile"/> :
            <span aria-label="No profile picture" className="archive-avatar-placeholder">◯</span>}
        </span>
        <span className="archive-faint">{avatarUrl ? 'Current picture' : 'No picture selected'}</span>
      </div>
      <div className="archive-avatar-source-tabs" role="group" aria-label="Avatar catalog">
        {sources.map(option=>(
          <button key={option.id} type="button" className={source===option.id?'active':''}
            aria-pressed={source===option.id} disabled={busy}
            onClick={()=>changeSource(option.id)}>{option.label}</button>
        ))}
      </div>
      <label htmlFor="archive-avatar-search" className="archive-avatar-search-label">
        Search characters, movies or series
      </label>
      <input id="archive-avatar-search" type="search" value={query} maxLength={80}
        className="archive-avatar-search"
        placeholder={source==='anime'?'Search Naruto, Black Clover, Asta…':
          source==='tv'?'Search Breaking Bad, Walter White…':'Search Avengers, Harry Potter, Loki…'}
        onChange={event=>{setQuery(event.target.value);resetNavigation();}}/>
      {selectedTitle && (
        <button type="button" className="archive-avatar-back" onClick={resetNavigation}>
          <span aria-hidden="true">‹</span> {selectedTitle.title} — back to results
        </button>
      )}
      <div className="archive-avatar-gallery-header">
        <strong>{selectedTitle ? selectedTitle.title : showFeatured?'Popular characters':'Character portraits'}</strong>
        <span className="archive-faint">{loading ? 'Searching…' : portraits.length + ' available'}</span>
      </div>
      <div className="archive-avatar-gallery" aria-label="Available character profile pictures" aria-busy={loading}>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp"
          className="archive-avatar-file" aria-label="Choose picture from your computer"
          onChange={event=>void upload(event)}/>
        <button type="button" className="archive-avatar-tile archive-avatar-upload" disabled={busy}
          onClick={()=>fileInput.current?.click()} title="Upload a custom profile picture">
          <span className="archive-avatar-upload-circle"><span aria-hidden="true">+</span></span>
          <span className="archive-avatar-tile-name">Custom PFP</span>
        </button>
        {portraits.map((item,index)=>(
          <div key={item.id + ':' + index} className="archive-avatar-choice">
            <button type="button" disabled={busy}
              className="archive-avatar-tile" title={'Use '+item.title}
              onClick={()=>item.avatarUrl&&void selectAvatar(item.avatarUrl)}>
              <span className="archive-avatar-tile-image">
                {item.imageUrl ? <PortraitImage url={item.imageUrl} label={item.title}/> :
                  <span className="archive-avatar-image-fallback" aria-hidden="true">◯</span>}
              </span>
              <span className="archive-avatar-tile-name">{item.title}</span>
            </button>
            {(item.wiki || item.malId) &&
              <button type="button" className="archive-avatar-more-link" disabled={busy}
                onClick={()=>void showMore(item)}>More looks</button>}
          </div>
        ))}
      </div>
      {loading && <p className="archive-hint" role="status">Finding character portraits…</p>}
      {searchError && <p className="archive-avatar-error" role="alert">{searchError}</p>}
      {!loading && !searchError && !portraits.length &&
        <p className="archive-hint">
          No character portraits available here yet. Try a different name or choose a custom picture.
        </p>}
      {selectedTitle && hasMore && !loading &&
        <LiquidButton type="button" tone="neutral" className="archive-button"
          disabled={busy} onClick={()=>void openTitle(selectedTitle,page+1)}>Load more characters</LiquidButton>}
      {!selectedTitle && titles.length>0 &&
        <div className="archive-avatar-title-results" aria-label="Browse a specific title">
          <span className="archive-faint">Want more from a specific series or movie? Browse its characters.</span>
          <div className="archive-avatar-title-list">
            {titles.slice(0,9).map(item=>(
              <button type="button" key={item.id} className="archive-avatar-title-choice"
                disabled={busy||loading} onClick={()=>void openTitle(item)}>
                <span className="archive-avatar-title-name">{item.title}</span>
                <span className="archive-avatar-title-kind">{item.subtitle}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>}
      {moreFrom &&
        <div className="archive-avatar-variations" aria-label={'Alternate looks for '+moreFrom.title}>
          <div className="archive-avatar-variations-header">
            <strong>{moreFrom.title} · more looks</strong>
            <button type="button" onClick={()=>setMoreFrom(null)} aria-label="Close alternate looks">×</button>
          </div>
          <div className="archive-avatar-variation-grid">
            {[moreFrom,...moreItems].filter(item=>item.avatarUrl).map((item,index)=>(
              <button type="button" key={item.id+':'+index} disabled={busy}
                title={'Choose '+moreFrom.title+' look '+(index+1)}
                className="archive-avatar-tile"
                onClick={()=>item.avatarUrl&&void selectAvatar(item.avatarUrl)}>
                <span className="archive-avatar-tile-image">
                  <PortraitImage url={item.avatarUrl!} label={moreFrom.title}/>
                </span>
                <span className="archive-avatar-tile-subtitle">Look {index+1}</span>
              </button>
            ))}
          </div>
          {moreBusy && <p className="archive-hint" role="status">Finding additional looks…</p>}
          {moreError && <p className="archive-avatar-error" role="alert">{moreError}</p>}
          {!moreBusy && !moreError && !moreItems.length &&
            <p className="archive-hint">No additional portraits are available for this character.</p>}
        </div>}
      <p className="archive-avatar-attribution">
        Character artwork from AniList, Kitsu, Jikan and fan-wiki contributors.
        Portrait availability varies by title; actor headshots are excluded.
      </p>
    </section>
  );
}
