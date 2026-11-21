import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api } from './api';
import LiquidButton from '../../ui/LiquidButton';
import { avatarImageSrc, alternateAvatarImageSrc } from './avatarImages';
import { assessAnimePortraitImage, type AnimePortraitQuality } from './avatarQuality';
import { featuredAvatars, searchCuratedAvatars, curatedAvatarsForTitle, curatedAvatars, alternateCuratedAvatars } from './curatedAvatarCatalog';

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
  franchise?: string;
  pack?: string;
  provider?: 'safebooru';
  booruTag?: string;
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

function PortraitImage({ url, label, inspectAnime = false, onReject }: {
  url: string;
  label: string;
  inspectAnime?: boolean;
  onReject?: (url: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [quality, setQuality] = useState<AnimePortraitQuality | 'pending'>(
    inspectAnime ? 'pending' : 'good',
  );

  useEffect(() => {
    setAttempt(0);
    setQuality(inspectAnime ? 'pending' : 'good');
  }, [url, inspectAnime]);

  if (attempt > 1) return (
    <span className="archive-avatar-image-fallback" aria-label={label + ' portrait unavailable'}>◯</span>
  );

  function review(image: HTMLImageElement) {
    if (!inspectAnime) return;
    const result = assessAnimePortraitImage(image);
    setQuality(result);
    if (result === 'reject') onReject?.(url);
  }

  return (
    <img
      src={attempt === 0 ? avatarImageSrc(url) : alternateAvatarImageSrc(url)}
      alt=""
      loading="lazy"
      decoding="async"
      className={inspectAnime ? quality === 'pending' || quality === 'reject'
        ? 'archive-anime-portrait-pending'
        : quality === 'enhance' ? 'archive-anime-portrait-enhance' : undefined : undefined}
      onLoad={event => review(event.currentTarget)}
      onError={() => setAttempt(value => value + 1)}
    />
  );
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
  const [remoteKey, setRemoteKey] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  // Block only the individual image URLs that fail the pixel-based quality test.
  // This is not a provider blacklist: other portraits from the same API remain.
  const [rejectedImages, setRejectedImages] = useState<Set<string>>(() => new Set());
  function rejectImage(url: string) {
    setRejectedImages(current => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

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

  // The two default rows are a fixed local manifest: no API or spinner on
  // opening Settings. Search immediately checks curated pack names, while
  // the live database may add supporting characters as an enhancement.
  useEffect(() => {
    if (selectedTitle || term.length < 2) return;
    const controller = new AbortController();
    const key = source + ':' + term.toLowerCase();
    setLoading(true);
    setSearchError('');
    const hint=source==='anime' ? searchCuratedAvatars('anime',term)[0]?.franchise : '';
    const query=new URLSearchParams({ source, q:term });
    if(hint)query.set('series',hint);
    void api<{items:Entry[];titles?:Entry[]}>(
      '/api/avatars/search?' + query,
      {signal:controller.signal},
    ).then(data => {
      if (controller.signal.aborted) return;
      setItems(data.items || []);
      setTitles(data.titles || []);
      setRemoteKey(key);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setItems([]);setTitles([]);setRemoteKey(key);
      setSearchError(error instanceof Error ? error.message : 'Additional portraits unavailable.');
    }).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [source,term,selectedTitle]);

  async function openTitle(title: Entry, nextPage=1) {
    // Prefer the actual square icon pack for any known franchise. Going into
    // "One Piece" must NOT replace its curated icons with pale Kitsu line art.
    if (nextPage===1 && curatedAvatarsForTitle(source,title.title).length) {
      setSelectedTitle(title);
      setItems([]);
      setHasMore(false);
      setPage(1);
      setSearchError('');
      return;
    }
    if (loading) return;
    setLoading(true);
    setSearchError('');
    try {
      const result = await api<{items:Entry[];hasMore:boolean}>(
        '/api/avatars/characters?source=' + source + '&id=' + encodeURIComponent(title.id) +
        '&page=' + nextPage + '&series=' + encodeURIComponent(title.title),
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
    const curated = curatedAvatars.find(avatar => avatar.id === item.id);
    if (!curated && !item.wiki && !item.malId && !item.booruTag) return;
    setMoreFrom(item);
    setMoreItems([]);
    setMoreError('');
    if (curated) {
      setMoreItems(alternateCuratedAvatars(curated).filter(avatar => avatar.id !== item.id));
      setMoreBusy(false);
      return;
    }
    setMoreBusy(true);
    try {
      if (item.booruTag) {
        const result=await api<{items:Entry[]}>(
          '/api/avatars/booru-looks?tag=' + encodeURIComponent(item.booruTag));
        setMoreItems((result.items||[]).filter(x=>x.avatarUrl && x.avatarUrl!==item.avatarUrl));
      } else {
        const params = new URLSearchParams({
          wiki:item.wiki || '',page:item.wikiPage || item.title,
          malId:String(item.malId || 0),
        });
        const result = await api<{items:Entry[]}>('/api/avatars/variations?' + params);
        setMoreItems((result.items || []).filter(x=>x.avatarUrl));
      }
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
    setMoreFrom(null);setMoreItems([]);setSearchError('');setShowAdditional(false);
  }
  function changeSource(next:Source) {
    if (next===source) return;
    setSource(next);setQuery('');setTerm('');
    setItems([]);setTitles([]);setRemoteKey('');
    resetNavigation();
  }
  const queryText=query.trim();
  const localMatches=queryText.length>=2
    ? searchCuratedAvatars(source,queryText)
    : featuredAvatars[source];
  const apiMatches=remoteKey===source+':'+queryText.toLowerCase() && queryText.length>=2
    ? items.filter(item=>item.kind==='avatar' && Boolean(item.avatarUrl))
    : [];
  // Favor real streaming-style PFPs; reveal raw database art when necessary.
  // Kitsu's anime character images are often white-background catalog art.
  // Never append those to a populated streaming-style anime icon collection.
  // For less common anime with no curated pack, keep the API fallback available.
  // Keep colorful, safely tagged single-character artwork even when curated
  // PFPs exist. Only old database portraits stay behind "Show additional".
  const extraFromApi=apiMatches
    .filter(item=>source!=='anime'||localMatches.length===0||item.provider==='safebooru')
    .filter(item=>!localMatches.some(local=>local.imageUrl===item.imageUrl));
  const safeAdditions=extraFromApi.filter(item=>item.provider==='safebooru');
  const optionalAdditions=extraFromApi.filter(item=>item.provider!=='safebooru');
  function hasMoreLooks(item:Entry):boolean {
    const local=curatedAvatars.find(icon=>icon.id===item.id);
    return !!(item.wiki || item.malId || item.booruTag ||
      (local&&alternateCuratedAvatars(local).length>1));
  }
  const curatedSeries=selectedTitle ? curatedAvatarsForTitle(source,selectedTitle.title) : [];
  const candidatePortraits=selectedTitle
    ? curatedSeries.length ? curatedSeries : items.filter(item=>item.kind==='avatar' && Boolean(item.avatarUrl))
    : [...localMatches,...safeAdditions,
      ...(localMatches.length===0||showAdditional?optionalAdditions:[])];
  const portraits=candidatePortraits.filter(item => !item.avatarUrl || !rejectedImages.has(item.avatarUrl));
  const hiddenAdditional=!selectedTitle && localMatches.length>0 && !showAdditional
    ? optionalAdditions.length : 0;
  const showFeatured=queryText.length<2 && !selectedTitle;
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
        onChange={event=>{setQuery(event.target.value);setShowAdditional(false);resetNavigation();}}/>
      {selectedTitle && (
        <button type="button" className="archive-avatar-back" onClick={resetNavigation}>
          <span aria-hidden="true">‹</span> {selectedTitle.title} — back to results
        </button>
      )}
      <div className="archive-avatar-gallery-header">
        <strong>{selectedTitle ? selectedTitle.title : showFeatured?'Featured characters':'Character portraits'}</strong>
        <span className="archive-faint">{portraits.length + ' available'}</span>
      </div>
      <div className="archive-avatar-gallery" aria-label="Available character profile pictures">
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
                {item.imageUrl ? <PortraitImage url={item.imageUrl} label={item.title}
                  inspectAnime={source==='anime' && !item.pack} onReject={rejectImage}/> :
                  <span className="archive-avatar-image-fallback" aria-hidden="true">◯</span>}
              </span>
              <span className="archive-avatar-tile-name">{item.title}</span>
            </button>
            {hasMoreLooks(item) &&
              <button type="button" className="archive-avatar-more-link" disabled={busy}
                onClick={()=>void showMore(item)}>More looks</button>}
          </div>
        ))}
      </div>
      {!showFeatured && loading && <p className="archive-hint" role="status">Looking for more portraits…</p>}
      {hiddenAdditional>0 &&
        <button type="button" className="archive-avatar-expand-results"
          onClick={()=>setShowAdditional(true)}>Show {hiddenAdditional} additional database portraits</button>}
      {searchError && !portraits.length && <p className="archive-avatar-error" role="alert">{searchError}</p>}
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
            {[moreFrom,...moreItems].filter(item=>item.avatarUrl && !rejectedImages.has(item.avatarUrl)).map((item,index)=>(
              <button type="button" key={item.id+':'+index} disabled={busy}
                title={'Choose '+moreFrom.title+' look '+(index+1)}
                className="archive-avatar-tile"
                onClick={()=>item.avatarUrl&&void selectAvatar(item.avatarUrl)}>
                <span className="archive-avatar-tile-image">
                  <PortraitImage url={item.avatarUrl!} label={moreFrom.title}
                    inspectAnime={source==='anime' && !item.pack} onReject={rejectImage}/>
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
     </section>
  );
}
