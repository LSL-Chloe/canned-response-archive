import { useState } from 'react';
import { alternateAvatarImageSrc, avatarImageSrc } from './avatarImages';

interface Props {
  name: string;
  url: string | null;
}

/** Decorative directory avatar: match the account menu's image rules, and
 * fall back to an initial if a user has not selected a picture. */
export default function AgentAvatar({ name, url }: Props) {
  const [fallback, setFallback] = useState<string | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const firstSrc = url ? avatarImageSrc(url) : null;
  const fallbackSrc = url ? alternateAvatarImageSrc(url) : null;
  const imageSrc = fallback === url ? fallbackSrc : firstSrc;
  const showImage = !!url && !!imageSrc && broken !== url;

  return (
    <span className="archive-directory-avatar" aria-hidden="true">
      {showImage ? (
        <img src={imageSrc} loading="lazy" decoding="async" alt=""
          onError={() => {
            if (fallback !== url && fallbackSrc && fallbackSrc !== firstSrc) setFallback(url);
            else setBroken(url);
          }}/>
      ) : <span className="archive-directory-avatar-initial">{name.trim().charAt(0).toUpperCase() || '?'}</span>}
    </span>
  );
}
