/**
 * Compresses and resizes user-selected image files so they safely fit within
 * Firestore document size bounds (<= 380,000 base64 characters).
 */
export async function compressImageFile(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; maxChars?: number }
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP).');
  }

  const maxWidth = options?.maxWidth ?? 1280;
  const maxHeight = options?.maxHeight ?? 960;
  const maxChars = options?.maxChars ?? 360000;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image file.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    let targetW = Math.max(1, Math.round(img.width * scale));
    let targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is unavailable in this browser.');
    }

    const attempts: Array<{ scaleFactor: number; quality: number }> = [
      { scaleFactor: 1, quality: 0.85 },
      { scaleFactor: 1, quality: 0.72 },
      { scaleFactor: 0.8, quality: 0.68 },
      { scaleFactor: 0.65, quality: 0.6 },
      { scaleFactor: 0.5, quality: 0.52 },
    ];

    for (const attempt of attempts) {
      canvas.width = Math.max(1, Math.round(targetW * attempt.scaleFactor));
      canvas.height = Math.max(1, Math.round(targetH * attempt.scaleFactor));
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const webpUrl = canvas.toDataURL('image/webp', attempt.quality);
      if (webpUrl.length <= maxChars && webpUrl.startsWith('data:image/webp')) {
        return webpUrl;
      }

      const jpegUrl = canvas.toDataURL('image/jpeg', attempt.quality);
      if (jpegUrl.length <= maxChars) {
        return jpegUrl;
      }
    }

    throw new Error('Image file is too large even after compression. Please choose a smaller image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
