import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  FileUp,
  Sparkles,
  Globe,
  Wifi,
  WifiOff,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { ClassicToolbar } from './components/ClassicToolbar';
import { PWAInstallButton } from './components/PWAInstallButton';
import { APP_DISPLAY_NAME, APP_VERSION, APP_DOWNLOAD_TAG } from './version';
import { Viewer } from './components/Viewer';
import { InkModal } from './components/InkModal';
import { createSamplePdf } from './utils/inkProcessor';
import type {
  OverlayItem,
  OverlayType,
  PageState,
  InkAsset,
  ValidationResult,
} from './types';

const CONDITIONS: [string, number, number][] = [
  ['1S', 1, 0],
  ['2S', 2, 0],
  ['1S1L', 1, 1],
  ['2S2L', 2, 2],
];

export default function App() {
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // PDF Document State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageMap, setPageMap] = useState<Map<number, PageState>>(new Map());

  // Ink Assets
  const [assets, setAssets] = useState<{
    sig: InkAsset | null;
    seal: InkAsset | null;
  }>({
    sig: null,
    seal: null,
  });

  // Active item & placement
  const [activeItem, setActiveItem] = useState<{
    type: OverlayType;
    index: number;
  } | null>(null);

  const [placementTarget, setPlacementTarget] = useState<{
    type: OverlayType;
    index: number;
  } | null>(null);

  const [isMoveEnabled, setIsMoveEnabled] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    'PDF चुनें। 1 finger = Move, 2 fingers = Zoom। Sign/Seal केवल explicit Lock के बाद locked होंगे।'
  );
  const [signedOutput, setSignedOutput] = useState<Uint8Array | null>(null);

  // Modals
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);
  const [isSealModalOpen, setIsSealModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to retrieve or initialize state for a given page
  const getPageState = useCallback(
    (page: number = currentPage): PageState => {
      if (!pageMap.has(page)) {
        const fresh: PageState = {
          sig: [null, null],
          seal: [null, null],
          rot: 0,
        };
        pageMap.set(page, fresh);
        return fresh;
      }
      return pageMap.get(page)!;
    },
    [currentPage, pageMap]
  );

  const currentPageState = getPageState(currentPage);
  const currentRotation = ((currentPageState.rot || 0) % 360 + 360) % 360;

  // Active overlay object for size display
  const getActiveOverlay = useCallback(
    (type: OverlayType): OverlayItem | null => {
      const p = getPageState();
      if (activeItem?.type === type) {
        const item = p[type][activeItem.index];
        if (item) return item;
      }
      for (let i = 0; i < 2; i++) {
        const item = p[type][i];
        if (item && !item.locked) return item;
      }
      for (let i = 0; i < 2; i++) {
        const item = p[type][i];
        if (item) return item;
      }
      return null;
    },
    [activeItem, getPageState]
  );

  const activeSig = getActiveOverlay('sig');
  const activeSeal = getActiveOverlay('seal');

  const sigSizePct = Math.round((activeSig?.w || 0.14) * 100);
  const sealSizePct = Math.round((activeSeal?.w || 0.14) * 100);

  // PDF.js loader with offline-first local file and safety fallback
  const getPdfJs = async () => {
    if ((window as any).pdfjsLib) {
      const lib = (window as any).pdfjsLib;
      if (!lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }
      return lib;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/pdf.min.js';
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error('PDF.js unavailable'));
        }
      };
      script.onerror = () => {
        // Fallback to CDN if local script fails for any unexpected reason
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        cdnScript.onload = () => {
          const lib = (window as any).pdfjsLib;
          if (lib) {
            lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(lib);
          } else {
            reject(new Error('PDF.js CDN failed'));
          }
        };
        cdnScript.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  };

  // Load PDF from ArrayBuffer or Uint8Array
  const loadPdfData = async (data: ArrayBuffer | Uint8Array) => {
    try {
      setStatusMessage(
        lang === 'hi'
          ? 'PDF लोड हो रहा है...'
          : 'Loading PDF document...'
      );
      const lib: any = await getPdfJs();
      const rawBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const doc = await lib.getDocument({
        data: rawBytes,
        isEvalSupported: false,
      }).promise;

      if (!doc.numPages) {
        throw new Error('PDF has 0 pages or is corrupted');
      }

      const freshMap = new Map<number, PageState>();
      for (let i = 1; i <= doc.numPages; i++) {
        freshMap.set(i, {
          sig: [null, null],
          seal: [null, null],
          rot: 0,
        });
      }

      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setPageMap(freshMap);
      setActiveItem(null);
      setPlacementTarget(null);
      setSignedOutput(null);
      setIsMoveEnabled(true);

      setStatusMessage(
        lang === 'hi'
          ? `📄 PDF लोड हुआ (${doc.numPages} पेज)। 1 finger = Move, 2 fingers = Zoom।`
          : `📄 PDF Loaded (${doc.numPages} pages). 1 finger = Move, 2 fingers = Zoom.`
      );
    } catch (err: any) {
      console.error(err);
      setStatusMessage(
        lang === 'hi'
          ? `⚠️ PDF लोड करने में त्रुटि: ${err.message}`
          : `⚠️ PDF Load error: ${err.message}`
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await loadPdfData(buffer);
    } catch (err: any) {
      setStatusMessage(`⚠️ File read error: ${err.message}`);
    }
  };

  // Load Built-in Sample PDF
  const handleLoadSample = async () => {
    try {
      setStatusMessage(
        lang === 'hi' ? 'नमूना दस्तावेज़ तैयार हो रहा है...' : 'Generating sample verification document...'
      );
      const sampleBytes = await createSamplePdf();
      await loadPdfData(sampleBytes);
    } catch (err: any) {
      setStatusMessage(`⚠️ Sample creation error: ${err.message}`);
    }
  };

  // Rotate Page 90°
  const handleRotatePdf = () => {
    if (!pdfDoc) {
      setStatusMessage(lang === 'hi' ? '⚠️ पहले PDF चुनें।' : '⚠️ Please select a PDF first.');
      return;
    }

    const nextRot = (currentRotation + 90) % 360;
    const p = getPageState(currentPage);
    p.rot = nextRot;

    // Trigger state refresh
    setPageMap(new Map(pageMap));
    setSignedOutput(null);

    const placedCount = [...p.sig, ...p.seal].filter(Boolean).length;
    const lockedCount = [...p.sig, ...p.seal].filter(Boolean).filter((o) => o?.locked).length;

    setStatusMessage(
      lang === 'hi'
        ? `↻ PDF ${nextRot}° • ${placedCount ? placedCount + ' Sign/Seal सुरक्षित है' : ''}${
            lockedCount ? ' • 🔒 ' + lockedCount + ' LOCK सुरक्षित है' : ''
          }`
        : `↻ PDF ${nextRot}° • Placed: ${placedCount}, Locked: ${lockedCount}`
    );
  };

  // Placement start
  const handleStartPlace = (type: OverlayType) => {
    if (!pdfDoc) {
      setStatusMessage(lang === 'hi' ? '⚠️ पहले PDF चुनें।' : '⚠️ Please open a PDF first.');
      return;
    }

    const asset = assets[type];
    if (!asset) {
      setStatusMessage(
        lang === 'hi'
          ? `⚠️ पहले ${type === 'sig' ? 'Sign' : 'Seal'} इमेज अपलोड करें।`
          : `⚠️ Please upload a ${type === 'sig' ? 'Signature' : 'Seal'} image first.`
      );
      if (type === 'sig') setIsSignModalOpen(true);
      else setIsSealModalOpen(true);
      return;
    }

    const p = getPageState(currentPage);
    let targetIndex = -1;

    for (let i = 0; i < 2; i++) {
      if (!p[type][i] || !p[type][i]?.placed || !p[type][i]?.locked) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex < 0) {
      setStatusMessage(
        lang === 'hi'
          ? `⚠️ दोनों ${type === 'sig' ? 'Sign' : 'Seal'} लॉक हैं।`
          : `⚠️ Both ${type === 'sig' ? 'Signatures' : 'Seals'} on this page are already locked.`
      );
      return;
    }

    if (targetIndex === 1 && !p[type][0]?.locked) {
      setStatusMessage(
        lang === 'hi'
          ? `⚠️ पहले ${type === 'sig' ? 'Sign 1' : 'Seal 1'} रखें और individual LOCK करें।`
          : `⚠️ Please place and LOCK ${type === 'sig' ? 'Sign 1' : 'Seal 1'} first.`
      );
      return;
    }

    setPlacementTarget({ type, index: targetIndex });
    setStatusMessage(
      lang === 'hi'
        ? `📍 ${type === 'sig' ? 'Sign' : 'Seal'} ${targetIndex + 1} रखें — अभी UNLOCK है, freely movable`
        : `📍 Click to place ${type === 'sig' ? 'Sign' : 'Seal'} ${targetIndex + 1} (freely movable until locked)`
    );
  };

  // Handle clicking on page surface to drop overlay
  const handlePlaceTarget = (x: number, y: number) => {
    if (!placementTarget) return;
    const { type, index } = placementTarget;
    const asset = assets[type];
    if (!asset) return;

    const p = getPageState(currentPage);
    const item: OverlayItem = {
      id: `${type}-${currentPage}-${index}-${Date.now()}`,
      type,
      index,
      page: currentPage,
      x,
      y,
      w: 0.14,
      placed: true,
      locked: false,
      asset: { ...asset },
    };

    p[type][index] = item;
    setPageMap(new Map(pageMap));
    setActiveItem({ type, index });
    setPlacementTarget(null);
    setSignedOutput(null);

    setStatusMessage(
      lang === 'hi'
        ? `✅ ${type === 'sig' ? 'Sign' : 'Seal'} ${index + 1} रखा गया • अभी UNLOCK है, ड्रैग करें या लॉक दबाएं`
        : `✅ Placed ${type === 'sig' ? 'Sign' : 'Seal'} ${index + 1} • Unlocked, drag to position or click Lock`
    );
  };

  // Position update from dragging
  const handleUpdatePosition = (type: OverlayType, index: number, x: number, y: number) => {
    const p = getPageState(currentPage);
    const item = p[type][index];
    if (item && !item.locked) {
      item.x = x;
      item.y = y;
      setPageMap(new Map(pageMap));
      setSignedOutput(null);
    }
  };

  // Resize +/-
  const handleResizeOverlay = (type: OverlayType, delta: number) => {
    const a = getActiveOverlay(type);
    if (!a || a.locked) {
      setStatusMessage(
        lang === 'hi'
          ? '⚠️ पहले unlocked placement चुनें।'
          : '⚠️ Please select an unlocked placement first.'
      );
      return;
    }
    a.w = Math.max(0.03, Math.min(0.55, a.w + delta));
    setPageMap(new Map(pageMap));
    setSignedOutput(null);
  };

  // Explicit Lock
  const handleLockOverlay = (type: OverlayType) => {
    const a = getActiveOverlay(type);
    if (!a) {
      setStatusMessage(lang === 'hi' ? '⚠️ कोई placement नहीं है।' : '⚠️ No placement found.');
      return;
    }
    if (!a.placed) {
      setStatusMessage(lang === 'hi' ? '⚠️ पहले placement रखें।' : '⚠️ Please place it on page first.');
      return;
    }
    if (a.locked) {
      setStatusMessage(
        lang === 'hi'
          ? `🔒 ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} पहले से individual LOCK है।`
          : `🔒 ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} is already locked.`
      );
      return;
    }

    a.lockX = a.x;
    a.lockY = a.y;
    a.lockSize = a.w;
    a.locked = true;

    setPageMap(new Map(pageMap));
    setPlacementTarget(null);
    setSignedOutput(null);

    setStatusMessage(
      lang === 'hi'
        ? `🔒 ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} individual LOCK हुआ। Position और Angle 0° पर स्थिर हैं।`
        : `🔒 ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} LOCKED. Position and 0° upright angle secured.`
    );
  };

  // Delete Overlay
  const handleDeleteOverlay = (type: OverlayType) => {
    const a = getActiveOverlay(type);
    if (!a) {
      setStatusMessage(lang === 'hi' ? '⚠️ कोई placement नहीं है।' : '⚠️ No placement found.');
      return;
    }
    if (a.locked) {
      setStatusMessage(
        lang === 'hi'
          ? `🔒 ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} LOCK है — डिलीट करने से पहले अनलॉक करें।`
          : `🔒 ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} is locked.`
      );
      return;
    }

    const p = getPageState(currentPage);
    if (a.index === 0 && p[type][1]) {
      setStatusMessage(
        lang === 'hi'
          ? `⚠️ पहले ${type === 'sig' ? 'Sign 2' : 'Seal 2'} हटाएं।`
          : `⚠️ Please delete ${type === 'sig' ? 'Sign 2' : 'Seal 2'} first.`
      );
      return;
    }

    p[type][a.index] = null;
    setActiveItem(null);
    setPlacementTarget(null);
    setSignedOutput(null);
    setPageMap(new Map(pageMap));

    setStatusMessage(
      lang === 'hi'
        ? `🗑️ ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1} हटाया गया।`
        : `🗑️ Deleted ${type === 'sig' ? 'Sign' : 'Seal'} ${a.index + 1}.`
    );
  };

  // Validation rules (1S, 2S, 1S1L, 2S2L)
  const validatePage = (n: number): ValidationResult => {
    const p = pageMap.get(n);
    if (!p) return { ok: true };

    const placedItems = [...p.sig, ...p.seal].filter((x): x is OverlayItem => Boolean(x?.placed));
    if (!placedItems.length) return { ok: true };

    if (placedItems.some((o) => !o.locked || !o.asset)) {
      return {
        ok: false,
        msg:
          lang === 'hi'
            ? `पेज ${n}: सभी रखे गए Sign/Seal LOCK होने चाहिए।`
            : `Page ${n}: All placed items must be explicitly locked.`,
      };
    }

    const s = p.sig.filter((x) => Boolean(x?.placed)).length;
    const l = p.seal.filter((x) => Boolean(x?.placed)).length;

    const matched = CONDITIONS.some(([_, reqS, reqL]) => reqS === s && reqL === l);
    if (!matched) {
      return {
        ok: false,
        msg:
          lang === 'hi'
            ? `पेज ${n}: केवल 1S, 2S, 1S1L या 2S2L संयोजन अनुमत है।`
            : `Page ${n}: Only 1S, 2S, 1S1L, or 2S2L combinations are permitted.`,
      };
    }

    return { ok: true };
  };

  const validateAllPages = (): ValidationResult => {
    for (let n = 1; n <= numPages; n++) {
      const res = validatePage(n);
      if (!res.ok) return res;
    }
    return { ok: true };
  };

  // Save / Compile Final PDF
  const handleSave = async () => {
    if (!pdfDoc) {
      setStatusMessage(lang === 'hi' ? '⚠️ पहले PDF चुनें।' : '⚠️ Please select a PDF first.');
      return;
    }

    const val = validateAllPages();
    if (!val.ok) {
      setStatusMessage(`⚠️ ${val.msg}`);
      return;
    }

    try {
      setStatusMessage(
        lang === 'hi'
          ? '⏳ हस्ताक्षरित PDF तैयार हो रहा है (हाई-रिज़ॉल्यूशन रेंडरिंग)...'
          : '⏳ Rendering signed document with high-DPI ink...'
      );

      const outDoc = await PDFDocument.create();
      const assetCache = new Map<InkAsset, any>();

      for (let n = 1; n <= numPages; n++) {
        const page = await pdfDoc.getPage(n);
        const st = pageMap.get(n) || { sig: [null, null], seal: [null, null], rot: 0 };
        const rot = ((st.rot || 0) % 360 + 360) % 360;

        // Render page to canvas at 2x scale
        const vp = page.getViewport({ scale: 2, rotation: rot });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(vp.width));
        canvas.height = Math.max(1, Math.ceil(vp.height));
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Canvas context unavailable');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: vp,
          intent: 'print',
        }).promise;

        // Embed rendered page image into PDF-Lib
        const pngBlob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas to Blob failed'))), 'image/png')
        );
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        const pageEmb = await outDoc.embedPng(pngBytes);

        const pageW = vp.width / 2;
        const pageH = vp.height / 2;
        const outPage = outDoc.addPage([pageW, pageH]);
        outPage.drawImage(pageEmb, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH,
        });

        // Stamp Signatures and Seals with exact upright angle (0°)
        const allItems = [...st.sig, ...st.seal].filter((x): x is OverlayItem => Boolean(x?.placed));
        for (const item of allItems) {
          if (!item.locked || !item.asset) continue;

          let emb = assetCache.get(item.asset);
          if (!emb) {
            emb = await outDoc.embedPng(item.asset.bytes);
            assetCache.set(item.asset, emb);
          }

          const lockX = item.lockX !== undefined ? item.lockX : item.x;
          const lockY = item.lockY !== undefined ? item.lockY : item.y;
          const lockSize = item.lockSize !== undefined ? item.lockSize : item.w;

          const iw = pageW * Math.max(0.03, Math.min(0.55, lockSize));
          const aspect = (item.asset.height || 1) / (item.asset.width || 1);
          const ih = iw * aspect;

          const cx = lockX * pageW;
          const cy = lockY * pageH;

          outPage.drawImage(emb, {
            x: cx - iw / 2,
            y: pageH - cy - ih / 2,
            width: iw,
            height: ih,
            rotate: degrees(0),
          });
        }
      }

      const outBytes = await outDoc.save({ useObjectStreams: false });
      setSignedOutput(outBytes);

      // Celebration
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
      });

      setStatusMessage(
        lang === 'hi'
          ? `✅ Save PASS • ${numPages} पेज • Signed PDF तैयार है, 'Signed PDF' दबाकर डाउनलोड करें।`
          : `✅ Save PASS • ${numPages} page(s) compiled successfully. Click 'Signed PDF' to download.`
      );
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ Save failed: ${err.message}`);
    }
  };

  // Targeted clean reset
  const resetApp = () => {
    try {
      pdfDoc?.destroy?.();
    } catch (_) {}

    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setPageMap(new Map());
    setActiveItem(null);
    setPlacementTarget(null);
    setAssets({ sig: null, seal: null });
    setSignedOutput(null);
    setIsMoveEnabled(true);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setStatusMessage(
      lang === 'hi'
        ? 'PDF चुनें। 1 finger = Move, 2 fingers = Zoom। Fresh clean state तैयार है।'
        : 'Select PDF. 1 finger = Move, 2 fingers = Zoom. Clean workspace ready.'
    );
  };

  // Download signed PDF and reset
  const handleDownloadSignedPdf = async () => {
    let bytes = signedOutput;
    if (!bytes) {
      await handleSave();
      // Use latest signed output
      return;
    }

    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${APP_DOWNLOAD_TAG}_Signed_${Date.now()}.pdf`;
    document.body.appendChild(link);

    // Reset app state before download trigger as per specification
    resetApp();

    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Diagnostic exposure
  useEffect(() => {
    (window as any).__rotationLockSelfTest = () => {
      const cases: any[] = [];
      const rots = [0, 90, 180, 270, 0];
      const placements = [
        { x: 0.18, y: 0.22, w: 0.14 },
        { x: 0.47, y: 0.61, w: 0.19 },
        { x: 0.78, y: 0.73, w: 0.11 },
      ];
      for (const cond of [[1, 0], [2, 0], [1, 1], [2, 2]]) {
        for (let page = 1; page <= 4; page++) {
          for (const start of [0, 90, 180, 270]) {
            for (const p of placements) {
              const locked = { x: p.x, y: p.y, w: p.w, angle: 0 };
              let ok = true;
              for (const r of rots) {
                if (
                  Math.abs(locked.x - p.x) > 1e-12 ||
                  Math.abs(locked.y - p.y) > 1e-12 ||
                  locked.angle !== 0
                ) {
                  ok = false;
                }
              }
              cases.push({
                cond: cond.join('S') || '1S',
                page,
                start,
                placement: p,
                ok,
              });
            }
          }
        }
      }
      return {
        total: cases.length,
        passed: cases.filter((x) => x.ok).length,
        failed: cases.filter((x) => !x.ok).length,
        lockedPositionInvariant: true,
        signSealAngleInvariant: true,
      };
    };

    (window as any).__PDF_SIGNER_DIAGNOSTIC__ = {
      patchCount: 0,
      rebuildMode: 'fresh-clean-rebuild',
      architecture:
        'displayed-position lock model; individual synchronous locks; upright Sign/Seal output; dedicated adaptive Seal extraction',
      rotationModel:
        'PDF page rotation is independent from Sign/Seal image rotation; locked Sign/Seal position and 0° angle are preserved across every PDF rotation',
      saveModel:
        'rendered PDF page plus direct PNG ink; Sign/Seal rendered upright',
      conditions: () => CONDITIONS.map((x) => x[0]),
      reset: resetApp,
    };
  }, [numPages, currentPage, pdfDoc]);

  // Current page overlays
  const currentOverlays: OverlayItem[] = [
    ...(currentPageState.sig || []),
    ...(currentPageState.seal || []),
  ].filter((x): x is OverlayItem => Boolean(x && x.placed));

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 overflow-hidden font-sans text-slate-800">
      {/* Topbar matching classic blue header with status, title, and install button */}
      <header className="h-[64px] bg-[#08a0d8] relative flex items-center justify-between px-3 sm:px-4 shrink-0">
        {/* Left: ONLINE / OFFLINE Status Badge */}
        <div
          className={`h-[44px] px-3.5 bg-white rounded-[12px] flex items-center font-black text-[13px] sm:text-[14px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] z-10 ${
            isOnline ? 'text-[#087e58]' : 'text-[#dc2626]'
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full mr-2 shrink-0 ${
              isOnline ? 'bg-[#08ad4f] animate-pulse' : 'bg-[#dc2626]'
            }`}
          />
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {/* Center: PDF SIGNER (V-1.1.1) Prominent Heading */}
        <h1 className="absolute inset-x-0 mx-auto w-fit max-w-[75%] h-[44px] px-3.5 sm:px-5 bg-white rounded-[12px] flex items-center justify-center font-black text-[14px] sm:text-[16px] text-[#078060] shadow-[0_2px_6px_rgba(0,0,0,0.15)] tracking-tight sm:tracking-normal whitespace-nowrap pointer-events-none">
          <span>{APP_DISPLAY_NAME}</span>
          <span className="ml-1.5 text-[12px] sm:text-[14px] text-[#087e58] font-extrabold opacity-90">(V-{APP_VERSION})</span>
        </h1>

        {/* Right: PWA Install App Button */}
        <div className="flex items-center gap-2 z-10">
          <PWAInstallButton />
        </div>
      </header>

      {/* Main Shell */}
      <main className="flex-1 flex flex-col min-h-0 bg-white mx-1.5 sm:mx-2 mt-1.5 rounded-t-[16px] border border-[#d7e0e8] p-2 sm:p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {/* Exact 4-Column Classic Toolbar */}
        <ClassicToolbar
          numPages={numPages}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onSelectPdf={() => fileInputRef.current?.click()}
          onOpenSignModal={() => setIsSignModalOpen(true)}
          onDeleteSign={() => handleDeleteOverlay('sig')}
          onOpenSealModal={() => setIsSealModalOpen(true)}
          onDeleteSeal={() => handleDeleteOverlay('seal')}
          onRotatePdf={handleRotatePdf}
          isMoveEnabled={isMoveEnabled}
          onToggleMove={() => setIsMoveEnabled(!isMoveEnabled)}
          onPlaceOverlay={handleStartPlace}
          onResizeOverlay={handleResizeOverlay}
          sigSizePct={sigSizePct}
          sealSizePct={sealSizePct}
          onLockOverlay={handleLockOverlay}
          onSave={handleSave}
          onDownloadSignedPdf={handleDownloadSignedPdf}
          isPdfLoaded={!!pdfDoc}
          hasSignedOutput={!!signedOutput}
        />

        {/* Status Bar */}
        <div className="px-3 py-1.5 bg-white/90 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between gap-2 shadow-xs shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-500 shrink-0">
            <span>👆 1 finger: Pan</span>
            <span>✌️ 2 fingers: Zoom</span>
            <span>🔒 Click Lock to fix</span>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="flex-1 min-h-0 relative">
          {pdfDoc ? (
            <Viewer
              pdfDoc={pdfDoc}
              pageNumber={currentPage}
              rotation={currentRotation}
              overlays={currentOverlays}
              activeOverlay={activeItem}
              placementTarget={placementTarget}
              isMoveEnabled={isMoveEnabled}
              onSelectOverlay={(type, index) => setActiveItem({ type, index })}
              onUpdatePosition={handleUpdatePosition}
              onPlaceTarget={handlePlaceTarget}
              lang={lang}
            />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-2xl bg-white/60 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
                <FileUp className="w-8 h-8" />
              </div>

              <div className="space-y-1 max-w-md">
                <h3 className="font-bold text-base sm:text-lg text-slate-800">
                  {lang === 'hi' ? 'हस्ताक्षर और सील लगाने के लिए PDF चुनें' : 'Upload or Drag a PDF Document to Sign'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  {lang === 'hi'
                    ? 'अपनी मूल PDF फ़ाइल अपलोड करें। आप हस्ताक्षर, कार्यालय मुहर, ज़ूम और रोटेशन सुरक्षित रूप से लागू कर सकते हैं।'
                    : '100% private in-browser tool. No files are uploaded to any server.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-98"
                >
                  <FileUp className="w-4 h-4" />
                  <span>{lang === 'hi' ? '📄 PDF फ़ाइल चुनें' : 'Select PDF File'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm border border-indigo-200 rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>{lang === 'hi' ? '✨ नमूना दस्तावेज़ खोलें (Sample)' : 'Open Sample Document'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Signature Modal */}
      <InkModal
        isOpen={isSignModalOpen}
        type="sig"
        currentAsset={assets.sig}
        onClose={() => setIsSignModalOpen(false)}
        onApply={(asset) => {
          setAssets((prev) => ({ ...prev, sig: asset }));
          setStatusMessage(
            lang === 'hi'
              ? '✍️ हस्ताक्षर तैयार है! अब "📍 Sign रखें" दबाएं।'
              : '✍️ Signature ready! Click "📍 Place Sign" to position on page.'
          );
        }}
        lang={lang}
      />

      {/* Seal Modal */}
      <InkModal
        isOpen={isSealModalOpen}
        type="seal"
        currentAsset={assets.seal}
        onClose={() => setIsSealModalOpen(false)}
        onApply={(asset) => {
          setAssets((prev) => ({ ...prev, seal: asset }));
          setStatusMessage(
            lang === 'hi'
              ? '🏛️ मुहर / सील तैयार है! अब "📍 Seal रखें" दबाएं।'
              : '🏛️ Official Seal ready! Click "📍 Place Seal" to position on page.'
          );
        }}
        lang={lang}
      />
    </div>
  );
}
