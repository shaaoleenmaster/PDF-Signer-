import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { InkColorMode } from '../types';

export function dataUrlToBytes(s: string): Uint8Array {
  const c = String(s || '').indexOf(',');
  if (c < 0) throw new Error('Processed image data is invalid');
  const meta = s.slice(0, c);
  const body = s.slice(c + 1);
  if (/;base64/i.test(meta)) {
    const bin = atob(body);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  return new TextEncoder().encode(decodeURIComponent(body));
}

export function processInkImage(
  fileOrBlob: Blob,
  kind: 'sig' | 'seal' = 'sig',
  colorMode: InkColorMode = 'original'
): Promise<string> {
  if (kind === 'seal') {
    return processOfficeSealImage(fileOrBlob, colorMode);
  }

  return new Promise((resolve, reject) => {
    if (!fileOrBlob || !String(fileOrBlob.type || '').startsWith('image/')) {
      return reject(new Error('Please select an image file (PNG/JPG/WEBP).'));
    }
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('Failed to read image file.'));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image preview.'));
      img.onload = () => {
        try {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
          const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

          const src = document.createElement('canvas');
          src.width = w;
          src.height = h;
          const sc = src.getContext('2d', { willReadFrequently: true });
          if (!sc) throw new Error('Canvas 2D context unavailable');
          sc.imageSmoothingEnabled = true;
          sc.imageSmoothingQuality = 'high';
          sc.drawImage(img, 0, 0, w, h);

          const im = sc.getImageData(0, 0, w, h);
          const px = im.data;

          let sr = 0, sg = 0, sb = 0, n = 0;
          const step = Math.max(1, Math.floor(Math.min(w, h) / 100));
          for (let x = 0; x < w; x += step) {
            for (const y of [0, h - 1]) {
              const i = (y * w + x) * 4;
              if (px[i + 3] > 8) {
                sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++;
              }
            }
          }
          for (let y = 0; y < h; y += step) {
            for (const x of [0, w - 1]) {
              const i = (y * w + x) * 4;
              if (px[i + 3] > 8) {
                sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++;
              }
            }
          }

          const br = n ? sr / n : 255;
          const bg = n ? sg / n : 255;
          const bb = n ? sb / n : 255;
          const bLum = 0.2126 * br + 0.7152 * bg + 0.0722 * bb;

          const blur = document.createElement('canvas');
          blur.width = w;
          blur.height = h;
          const bc = blur.getContext('2d', { willReadFrequently: true });
          if (!bc) throw new Error('Blur canvas context unavailable');
          bc.filter = 'blur(15px)';
          bc.drawImage(src, 0, 0);
          bc.filter = 'none';
          const bp = bc.getImageData(0, 0, w, h).data;

          const score = new Float32Array(w * h);
          const bin = new Uint8Array(w * h);
          let hit = 0;

          for (let p = 0, i = 0; p < w * h; p++, i += 4) {
            const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
            if (a < 8) continue;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const local = 0.2126 * bp[i] + 0.7152 * bp[i + 1] + 0.0722 * bp[i + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const sat = mx ? (mx - mn) / mx : 0;
            const bgDist = Math.hypot(r - br, g - bg, b - bb) / (255 * Math.sqrt(3));
            const localDark = Math.max(0, (local - lum) / 255);
            const globalDark = Math.max(0, (bLum - lum) / 255);
            const chroma = (sat > 0.10 && lum < 245) ? Math.min(1, (sat - 0.10) / 0.45) * Math.min(1, (245 - lum) / 150) : 0;
            const strongBlack = (lum < 105 && bgDist > 0.18) ? Math.min(1, (105 - lum) / 70 + 0.25) : 0;
            const edgeInk = Math.min(1, localDark * 3.4) * Math.min(1, 0.55 + bgDist * 1.8);
            const colourInk = chroma * Math.min(1, 0.45 + localDark * 3.0);
            const ink = Math.max(strongBlack, edgeInk, colourInk, globalDark * 0.55);

            score[p] = ink;
            if (ink > 0.24) {
              bin[p] = 1;
              hit++;
            }
          }

          if (!hit) throw new Error('Could not clearly isolate signature ink from paper.');

          const labels = new Int32Array(w * h);
          const qx = new Int32Array(w * h);
          const qy = new Int32Array(w * h);
          const keep = new Uint8Array(w * h);
          let label = 0;
          const minArea = Math.max(18, Math.round(w * h * 0.000003));

          for (let sy = 0; sy < h; sy++) {
            for (let sx = 0; sx < w; sx++) {
              const si = sy * w + sx;
              if (!bin[si] || labels[si]) continue;
              label++;
              let head = 0, tail = 0;
              let area = 0;
              qx[tail] = sx;
              qy[tail++] = sy;
              labels[si] = label;

              while (head < tail) {
                const cx = qx[head];
                const cy = qy[head++];
                area++;
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const xx = cx + dx;
                    const yy = cy + dy;
                    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                    const ni = yy * w + xx;
                    if (bin[ni] && !labels[ni]) {
                      labels[ni] = label;
                      qx[tail] = xx;
                      qy[tail++] = yy;
                    }
                  }
                }
              }
              if (area >= Math.max(25, minArea)) {
                for (let j = 0; j < tail; j++) {
                  keep[qy[j] * w + qx[j]] = 1;
                }
              }
            }
          }

          let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
          for (let p = 0; p < w * h; p++) {
            if (keep[p]) {
              kept++;
              const x = p % w;
              const y = Math.floor(p / w);
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }

          if (!kept) throw new Error('Could not clearly isolate signature ink from paper.');

          const pad = Math.max(8, Math.round(Math.min(w, h) * 0.012));
          minX = Math.max(0, minX - pad);
          minY = Math.max(0, minY - pad);
          maxX = Math.min(w - 1, maxX + pad);
          maxY = Math.min(h - 1, maxY + pad);

          const iw = maxX - minX + 1;
          const ih = maxY - minY + 1;
          const side = 600;
          const out = document.createElement('canvas');
          out.width = side;
          out.height = side;
          const oc = out.getContext('2d', { willReadFrequently: true });
          if (!oc) throw new Error('Output canvas context error');
          oc.clearRect(0, 0, side, side);

          const td = oc.createImageData(iw, ih);
          for (let yy = 0; yy < ih; yy++) {
            for (let xx = 0; xx < iw; xx++) {
              const p = (minY + yy) * w + (minX + xx);
              const i = p * 4;
              const o = (yy * iw + xx) * 4;
              if (!keep[p]) continue;
              const a = Math.round(Math.max(0, Math.min(255, ((score[p] - 0.12) / 0.55) * 255)));
              if (a > 0) {
                td.data[o] = px[i];
                td.data[o + 1] = px[i + 1];
                td.data[o + 2] = px[i + 2];
                td.data[o + 3] = a;
              }
            }
          }

          const temp = document.createElement('canvas');
          temp.width = iw;
          temp.height = ih;
          const tc = temp.getContext('2d');
          if (!tc) throw new Error('Temp canvas error');
          tc.putImageData(td, 0, 0);

          const fit = Math.min((side - 40) / iw, (side - 40) / ih, 1.2);
          const dw = Math.max(1, Math.round(iw * fit));
          const dh = Math.max(1, Math.round(ih * fit));
          oc.drawImage(temp, 0, 0, iw, ih, Math.round((side - dw) / 2), Math.round((side - dh) / 2), dw, dh);

          if (colorMode === 'blue' || colorMode === 'black') {
            const d = oc.getImageData(0, 0, side, side);
            const q = d.data;
            for (let i = 0; i < q.length; i += 4) {
              if (q[i + 3]) {
                if (colorMode === 'black') {
                  q[i] = 0; q[i + 1] = 0; q[i + 2] = 0;
                } else {
                  q[i] = 20; q[i + 1] = 75; q[i + 2] = 190;
                }
              }
            }
            oc.putImageData(d, 0, 0);
          }

          resolve(out.toDataURL('image/png'));
        } catch (e: any) {
          reject(e);
        }
      };
      img.src = String(rd.result || '');
    };
    rd.readAsDataURL(fileOrBlob);
  });
}

export function processOfficeSealImage(
  fileOrBlob: Blob,
  colorMode: InkColorMode = 'original'
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fileOrBlob || !String(fileOrBlob.type || '').startsWith('image/')) {
      return reject(new Error('Please select an image file.'));
    }
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('Seal image could not be read.'));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Seal image could not be previewed.'));
      img.onload = () => {
        try {
          const maxSide = 2000;
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
          const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

          const src = document.createElement('canvas');
          src.width = w;
          src.height = h;
          const sc = src.getContext('2d', { willReadFrequently: true });
          if (!sc) throw new Error('Canvas context error');
          sc.imageSmoothingEnabled = true;
          sc.imageSmoothingQuality = 'high';
          sc.drawImage(img, 0, 0, w, h);

          const im = sc.getImageData(0, 0, w, h);
          const px = im.data;

          const neutral: number[] = [];
          const total = w * h;
          const sampleStep = Math.max(1, Math.floor(total / 12000));
          for (let p = 0; p < total; p += sampleStep) {
            const i = p * 4;
            const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
            if (a < 8) continue;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const sat = mx ? (mx - mn) / mx : 0;
            if (sat < 0.09) {
              neutral.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
          }

          if (!neutral.length) throw new Error('Could not estimate stamp background.');
          neutral.sort((a, b) => a - b);
          const bgLum = neutral[Math.floor(neutral.length * 0.55)];

          let br = 0, bg = 0, bb = 0, bn = 0;
          for (let p = 0; p < total; p += sampleStep) {
            const i = p * 4;
            const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
            if (a < 8) continue;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const sat = mx ? (mx - mn) / mx : 0;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (sat < 0.09 && Math.abs(lum - bgLum) < 22) {
              br += r; bg += g; bb += b; bn++;
            }
          }

          br = bn ? br / bn : bgLum;
          bg = bn ? bg / bn : bgLum;
          bb = bn ? bb / bn : bgLum;

          const blur = document.createElement('canvas');
          blur.width = w;
          blur.height = h;
          const bc = blur.getContext('2d', { willReadFrequently: true });
          if (!bc) throw new Error('Blur context error');
          bc.filter = 'blur(9px)';
          bc.drawImage(src, 0, 0);
          bc.filter = 'none';
          const bp = bc.getImageData(0, 0, w, h).data;

          const score = new Float32Array(total);
          const bin = new Uint8Array(total);
          let hits = 0;

          for (let p = 0; p < total; p++) {
            const i = p * 4;
            const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
            if (a < 8) continue;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const sat = mx ? (mx - mn) / mx : 0;
            const bgDist = Math.hypot(r - br, g - bg, b - bb) / (255 * Math.sqrt(3));
            const local = 0.2126 * bp[i] + 0.7152 * bp[i + 1] + 0.0722 * bp[i + 2];
            const localContrast = Math.max(0, (local - lum) / 255);
            const darkDelta = Math.max(0, (bgLum - lum) / 255);

            const chromaInk = (sat > 0.12 && bgDist > 0.035) ? Math.min(1, (sat - 0.12) / 0.28 + 0.25) * Math.min(1, 0.35 + bgDist * 4) : 0;
            const darkInk = (darkDelta > 0.07 && localContrast > 0.025 && bgDist > 0.025) ? Math.min(1, (darkDelta - 0.07) / 0.35 + 0.25) * Math.min(1, 0.35 + localContrast * 8) : 0;
            const ink = Math.max(chromaInk, darkInk);

            score[p] = ink;
            if (ink > 0.22) {
              bin[p] = 1;
              hits++;
            }
          }

          if (hits < 8) throw new Error('Could not clearly isolate seal / stamp ink.');

          const labels = new Int32Array(total);
          const qx = new Int32Array(total);
          const qy = new Int32Array(total);
          const keep = new Uint8Array(total);
          let label = 0;
          const minArea = Math.max(3, Math.round(total * 0.0000008));

          for (let sy = 0; sy < h; sy++) {
            for (let sx = 0; sx < w; sx++) {
              const si = sy * w + sx;
              if (!bin[si] || labels[si]) continue;
              label++;
              let head = 0, tail = 0;
              let area = 0;
              qx[tail] = sx;
              qy[tail++] = sy;
              labels[si] = label;

              while (head < tail) {
                const cx = qx[head];
                const cy = qy[head++];
                area++;
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const xx = cx + dx;
                    const yy = cy + dy;
                    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                    const ni = yy * w + xx;
                    if (bin[ni] && !labels[ni]) {
                      labels[ni] = label;
                      qx[tail] = xx;
                      qy[tail++] = yy;
                    }
                  }
                }
              }
              if (area >= minArea) {
                for (let j = 0; j < tail; j++) {
                  keep[qy[j] * w + qx[j]] = 1;
                }
              }
            }
          }

          let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
          for (let p = 0; p < total; p++) {
            if (keep[p]) {
              kept++;
              const x = p % w;
              const y = Math.floor(p / w);
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }

          if (!kept || maxX < minX || maxY < minY) throw new Error('Seal ink could not be extracted.');

          const pad = Math.max(6, Math.round(Math.min(w, h) * 0.018));
          minX = Math.max(0, minX - pad);
          minY = Math.max(0, minY - pad);
          maxX = Math.min(w - 1, maxX + pad);
          maxY = Math.min(h - 1, maxY + pad);

          const iw = maxX - minX + 1;
          const ih = maxY - minY + 1;
          const side = 800;
          const out = document.createElement('canvas');
          out.width = side;
          out.height = side;
          const oc = out.getContext('2d', { willReadFrequently: true });
          if (!oc) throw new Error('Output context error');
          oc.clearRect(0, 0, side, side);

          const td = oc.createImageData(iw, ih);
          for (let yy = 0; yy < ih; yy++) {
            for (let xx = 0; xx < iw; xx++) {
              const p = (minY + yy) * w + (minX + xx);
              const i = p * 4;
              const o = (yy * iw + xx) * 4;
              if (!keep[p]) continue;
              const a = Math.round(Math.max(0, Math.min(255, ((score[p] - 0.10) / 0.62) * 255)));
              if (a > 0) {
                td.data[o] = px[i];
                td.data[o + 1] = px[i + 1];
                td.data[o + 2] = px[i + 2];
                td.data[o + 3] = a;
              }
            }
          }

          const temp = document.createElement('canvas');
          temp.width = iw;
          temp.height = ih;
          const tc = temp.getContext('2d');
          if (!tc) throw new Error('Temp canvas error');
          tc.putImageData(td, 0, 0);

          const fit = Math.min((side - 40) / iw, (side - 40) / ih, 1.25);
          const dw = Math.max(1, Math.round(iw * fit));
          const dh = Math.max(1, Math.round(ih * fit));
          oc.drawImage(temp, 0, 0, iw, ih, Math.round((side - dw) / 2), Math.round((side - dh) / 2), dw, dh);

          if (colorMode === 'black' || colorMode === 'blue' || colorMode === 'red') {
            const d = oc.getImageData(0, 0, side, side);
            const q = d.data;
            for (let i = 0; i < q.length; i += 4) {
              if (q[i + 3]) {
                if (colorMode === 'black') {
                  q[i] = 0; q[i + 1] = 0; q[i + 2] = 0;
                } else if (colorMode === 'blue') {
                  q[i] = 20; q[i + 1] = 75; q[i + 2] = 190;
                } else if (colorMode === 'red') {
                  q[i] = 200; q[i + 1] = 25; q[i + 2] = 25;
                }
              }
            }
            oc.putImageData(d, 0, 0);
          }

          resolve(out.toDataURL('image/png'));
        } catch (e: any) {
          reject(e);
        }
      };
      img.src = String(rd.result || '');
    };
    rd.readAsDataURL(fileOrBlob);
  });
}

/**
 * Creates a beautiful sample 2-page legal document for quick testing
 */
export async function createSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Header border
  page1.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.1, 0.45, 0.8),
    borderWidth: 1.5,
  });

  page1.drawText('GOVERNMENT & CORPORATE VERIFICATION SERVICES', {
    x: 55,
    y: height - 65,
    size: 14,
    font: boldFont,
    color: rgb(0.08, 0.35, 0.65),
  });

  page1.drawText('CERTIFICATE OF AUTHORIZATION & COMPLIANCE (TEST DOCUMENT)', {
    x: 55,
    y: height - 85,
    size: 10,
    font,
    color: rgb(0.3, 0.35, 0.4),
  });

  // Body content
  const texts = [
    'Document Reference: DOC-VERIF-2026-9948',
    'Date of Execution: 23 September 2026',
    'Jurisdiction: Central Regulatory Authority & Public Notary Office',
    '',
    'TO WHOM IT MAY CONCERN:',
    '',
    'This is an official verification document provided for validation, electronic signing, and stamp seal',
    'attestation. All authorized parties are requested to review the clauses herein and place their verified',
    'signatures and official departmental seal in the designated execution zone below.',
    '',
    'Clause 1 (Authentication): The signatory confirms that the attached information has been verified and matches',
    'all statutory requirements under Section 42 of the Digital Records Act.',
    '',
    'Clause 2 (Official Seal): The seal affixed represents the official imprimatur of the designated authority,',
    'duly executed with full legal standing.',
    '',
    'Execution Area Instructions:',
    '- 1st Signatory (Authorized Representative / Officer)',
    '- 2nd Signatory (Countersigning Notary / Reviewer - optional)',
    '- Official Seal (Affix Seal 1 and/or Seal 2)',
    '',
    'Please place the Signature and Seal below and click "Sign Lock" and "Seal Lock" to finalize.',
  ];

  let y = height - 135;
  for (const line of texts) {
    if (line.startsWith('Clause') || line.startsWith('Execution') || line.startsWith('TO WHOM')) {
      page1.drawText(line, { x: 45, y, size: 10.5, font: boldFont, color: rgb(0.15, 0.2, 0.25) });
    } else {
      page1.drawText(line, { x: 45, y, size: 9.5, font, color: rgb(0.25, 0.28, 0.32) });
    }
    y -= 17;
  }

  // Placeholder signature boxes for guidance
  page1.drawRectangle({
    x: 50,
    y: 110,
    width: 220,
    height: 90,
    borderColor: rgb(0.75, 0.8, 0.85),
    borderWidth: 1,
    borderDashArray: [4, 4],
  });
  page1.drawText('Designated Signature Zone (Sign 1 / Sign 2)', {
    x: 60,
    y: 118,
    size: 8,
    font,
    color: rgb(0.55, 0.6, 0.65),
  });

  page1.drawRectangle({
    x: 320,
    y: 110,
    width: 220,
    height: 90,
    borderColor: rgb(0.75, 0.8, 0.85),
    borderWidth: 1,
    borderDashArray: [4, 4],
  });
  page1.drawText('Designated Seal Zone (Seal 1 / Seal 2)', {
    x: 345,
    y: 118,
    size: 8,
    font,
    color: rgb(0.55, 0.6, 0.65),
  });

  page1.drawText('Page 1 of 2 - Official Record (Test Template)', {
    x: width / 2 - 80,
    y: 35,
    size: 8.5,
    font,
    color: rgb(0.6, 0.65, 0.7),
  });

  // Page 2
  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawText('ANNEXURE A - TERMS & CONDITIONS (PAGE 2)', {
    x: 50,
    y: height - 80,
    size: 13,
    font: boldFont,
    color: rgb(0.1, 0.35, 0.6),
  });

  page2.drawText('1. This page provides additional schedule details and secondary countersignatures if required.', {
    x: 50,
    y: height - 120,
    size: 10,
    font,
    color: rgb(0.25, 0.28, 0.32),
  });
  page2.drawText('2. Rotation test: You can rotate this document 90 degrees using the "↻ PDF 90°" button.', {
    x: 50,
    y: height - 145,
    size: 10,
    font,
    color: rgb(0.25, 0.28, 0.32),
  });
  page2.drawText('3. Lock invariant test: Any locked signatures or seals remain upright at 0° regardless of PDF rotation.', {
    x: 50,
    y: height - 170,
    size: 10,
    font,
    color: rgb(0.25, 0.28, 0.32),
  });

  page2.drawRectangle({
    x: 50,
    y: 150,
    width: 490,
    height: 120,
    borderColor: rgb(0.75, 0.8, 0.85),
    borderWidth: 1,
    borderDashArray: [4, 4],
  });
  page2.drawText('Secondary Countersignature & Notarial Seal Zone', {
    x: 180,
    y: 160,
    size: 9,
    font,
    color: rgb(0.55, 0.6, 0.65),
  });

  page2.drawText('Page 2 of 2 - End of Document', {
    x: width / 2 - 60,
    y: 35,
    size: 8.5,
    font,
    color: rgb(0.6, 0.65, 0.7),
  });

  return await doc.save();
}
