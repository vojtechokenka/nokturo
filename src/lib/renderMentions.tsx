import type { ReactNode } from 'react';

/**
 * Renderuje text s @mentions – jednotný styl v celé appce.
 * 1) Někdo mě tagoval → fialové bg #D400FF/20, text-inherit
 * 2) Já tagoval někoho → font-semibold, text-inherit, bez pozadí
 * 3) Někdo tagoval jiného → font-medium, text-inherit, bez pozadí
 * Regex: @ + jméno (1+ slov), končí na mezere/punctuaci – podporuje @Alena Okénková, @Jan atd.
 */
export function renderContentWithMentions(
  content: string,
  isOwn?: boolean,
  currentUserDisplayName?: string
): ReactNode {
  const parts = content.split(/(@[\w\u00C0-\u024F]+(?:\s+[\w\u00C0-\u024F]+)*)/g);
  const currentNameNorm = currentUserDisplayName?.trim().toLowerCase();
  const mentionOfMeClass =
    'font-medium text-inherit px-1 py-0.5 rounded bg-mention/20 dark:bg-mention/20';
  const mentionByMeClass = 'font-semibold text-inherit px-0.5 py-0.5';
  const mentionOtherClass = 'font-medium text-inherit px-0.5 py-0.5';
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return part;
    const mentionName = part.slice(1).replace(/[,.\-!?;:]+\s*$/, '').trim();
    const mentionNorm = mentionName.toLowerCase();
    const isMentionOfMe = currentNameNorm && mentionNorm === currentNameNorm;
    const mentionClass = isMentionOfMe
      ? mentionOfMeClass
      : isOwn
        ? mentionByMeClass
        : mentionOtherClass;
    return (
      <span key={i} className={mentionClass}>
        {part}
      </span>
    );
  });
}
