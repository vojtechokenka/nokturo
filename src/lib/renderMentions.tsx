import type { ReactNode } from 'react';

/**
 * Renderuje text s @mentions – jednotný styl v celé appce.
 * 1) Někdo mě tagoval → fialové bg #D400FF/20, text-inherit
 * 2) Já tagoval někoho → font-semibold, text-inherit, bez pozadí
 * 3) Někdo tagoval jiného → font-medium, text-inherit, bez pozadí
 */
export function renderContentWithMentions(
  content: string,
  isOwn?: boolean,
  currentUserDisplayName?: string
): ReactNode {
  const parts = content.split(/(@\S+(?:\s+\S+)?)/g);
  const currentNameNorm = currentUserDisplayName?.trim().toLowerCase();
  const mentionOfMeClass =
    'font-medium text-inherit px-1 py-0.5 rounded bg-mention/20 dark:bg-mention/20';
  const mentionByMeClass = 'font-semibold text-inherit px-0.5 py-0.5';
  const mentionOtherClass = 'font-medium text-inherit px-0.5 py-0.5';
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return part;
    const mentionName = part.slice(1).trim();
    const isMentionOfMe = currentNameNorm && mentionName.toLowerCase() === currentNameNorm;
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
