import type { Worker } from 'tesseract.js';
import { fileToCanvas, preprocessForOcr } from './image';
import { parseLabel, type ParsedLabel } from './labelParser';
import { KEYS, lsGet } from './local';

let worker: Promise<Worker> | null = null;
let workerLang = '';

async function getWorker(lang: string, onProgress?: (p: number) => void) {
  if (!worker || workerLang !== lang) {
    if (worker) (await worker).terminate();
    workerLang = lang;
    worker = import('tesseract.js').then(({ createWorker }) =>
      createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') onProgress?.(m.progress);
        },
      }),
    );
  }
  return worker;
}

export const ocrLang = () => lsGet(KEYS.ocrLang, 'spa+eng');

/** On-device OCR (Tesseract, WASM). Language data (~2–10 MB) is downloaded once and cached by the browser. */
export async function ocrLabel(file: Blob, onProgress?: (p: number) => void): Promise<ParsedLabel & { text: string }> {
  const canvas = preprocessForOcr(await fileToCanvas(file, 2000));
  const w = await getWorker(ocrLang(), onProgress);
  const { data } = await w.recognize(canvas);
  return { ...parseLabel(data.text), text: data.text };
}
