/** Decode a File into a canvas, downscaled so the longest side is ≤ maxSide. */
export async function fileToCanvas(file: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

/** Grayscale + contrast stretch: noticeably improves Tesseract on glossy packaging. */
export function preprocessForOcr(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    d[i] = y;
    hist[y]++;
  }
  // Stretch between the 2nd and 98th percentiles.
  const n = d.length / 4;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) if ((acc += hist[v]) > n * 0.02) { lo = v; break; }
  acc = 0;
  for (let v = 255; v >= 0; v--) if ((acc += hist[v]) > n * 0.02) { hi = v; break; }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function canvasToBase64Jpeg(c: HTMLCanvasElement, quality = 0.85): string {
  return c.toDataURL('image/jpeg', quality).split(',')[1];
}
