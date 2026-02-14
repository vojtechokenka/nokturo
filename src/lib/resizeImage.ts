/**
 * Resizes and compresses an image to fit within max dimensions and file size.
 * Returns a Blob suitable for upload.
 * Uses createImageBitmap for async decode (avoids blocking main thread) and
 * yields between toBlob iterations to prevent app freeze/crash.
 */
export async function resizeAvatarImage(
  file: File,
  maxDimension: number,
  maxSizeBytes: number,
  targetQuality = 0.65
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    // Use createImageBitmap for async decode - offloads from main thread (Electron/Chromium)
    let bitmap: ImageBitmap | HTMLImageElement;
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = url;
        });
      }
    } else {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
    }

    URL.revokeObjectURL(url);

    let { width, height } = bitmap;
    const needsResize = width > maxDimension || height > maxDimension;

    if (needsResize) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Canvas not supported');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === 'function') bitmap.close();

    const mime = 'image/jpeg';
    let quality = targetQuality;

    const tryBlob = (): Promise<Blob> =>
      new Promise((resolveBlob, rejectBlob) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              rejectBlob(new Error('Failed to create blob'));
              return;
            }
            if (blob.size <= maxSizeBytes || quality <= 0.2) {
              resolveBlob(blob);
              return;
            }
            quality -= 0.15;
            if (quality > 0.2) {
              // Yield to event loop between iterations - prevents main thread freeze/crash
              setTimeout(() => {
                tryBlob().then(resolveBlob).catch(rejectBlob);
              }, 0);
            } else {
              resolveBlob(blob);
            }
          },
          mime,
          quality
        );
      });

    return tryBlob();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
