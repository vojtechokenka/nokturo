import { useEffect, useState } from 'react';

export type ImageLuminance = 'light' | 'dark';

function resolveLuminance(image: HTMLImageElement): ImageLuminance {
  const sampleWidth = Math.min(140, Math.max(40, Math.round(image.naturalWidth * 0.2)));
  const sampleHeight = Math.min(64, Math.max(24, Math.round(image.naturalHeight * 0.16)));
  const sourceX = Math.max(0, image.naturalWidth - sampleWidth);
  const sourceY = 0;

  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 'dark';

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sampleWidth,
    sampleHeight,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );

  const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let total = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.1) continue;
    total += (0.299 * data[i]) + (0.587 * data[i + 1]) + (0.114 * data[i + 2]);
    count += 1;
  }

  if (!count) return 'dark';
  const average = total / count;
  return average >= 128 ? 'light' : 'dark';
}

export function useImageLuminance(imageUrl?: string | null): ImageLuminance {
  const [luminance, setLuminance] = useState<ImageLuminance>('dark');

  useEffect(() => {
    if (!imageUrl) {
      setLuminance('dark');
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';

    const onLoad = () => {
      if (cancelled) return;
      try {
        setLuminance(resolveLuminance(image));
      } catch {
        setLuminance('dark');
      }
    };

    const onError = () => {
      if (cancelled) return;
      setLuminance('dark');
    };

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    image.src = imageUrl;

    return () => {
      cancelled = true;
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };
  }, [imageUrl]);

  return luminance;
}
