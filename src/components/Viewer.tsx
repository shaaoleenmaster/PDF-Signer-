import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Lock, Move, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { OverlayItem, OverlayType, ViewTransform, Geometry } from '../types';

interface ViewerProps {
  pdfDoc: any;
  pageNumber: number;
  rotation: number;
  overlays: OverlayItem[];
  activeOverlay: { type: OverlayType; index: number } | null;
  placementTarget: { type: OverlayType; index: number } | null;
  isMoveEnabled: boolean;
  onSelectOverlay: (type: OverlayType, index: number) => void;
  onUpdatePosition: (type: OverlayType, index: number, x: number, y: number) => void;
  onPlaceTarget: (x: number, y: number) => void;
  lang: 'hi' | 'en';
  onZoomChange?: (scale: number) => void;
}

const MAX_ZOOM = 10;
const MIN_ZOOM = 1;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const Viewer: React.FC<ViewerProps> = ({
  pdfDoc,
  pageNumber,
  rotation,
  overlays,
  activeOverlay,
  placementTarget,
  isMoveEnabled,
  onSelectOverlay,
  onUpdatePosition,
  onPlaceTarget,
  lang,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  // Gesture state refs
  const gestureRef = useRef<{
    mode: 'pan' | 'pinch' | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    baseDist?: number;
    baseScale?: number;
    anchorX?: number;
    anchorY?: number;
  }>({ mode: null, startX: 0, startY: 0, originX: 0, originY: 0 });

  // Overlay drag state
  const dragRef = useRef<{
    type: OverlayType;
    index: number;
    pointerId: number;
  } | null>(null);

  const viewRef = useRef(view);
  viewRef.current = view;

  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  // Constrain camera translation to keep page inside viewer
  const constrainCamera = useCallback((geom: Geometry, v: ViewTransform): ViewTransform => {
    const scale = clamp(v.scale, MIN_ZOOM, MAX_ZOOM);
    const W = geom.w * scale;
    const H = geom.h * scale;

    if (scale <= 1.0001) {
      return {
        scale: 1,
        x: 6 + (geom.vw - geom.w) / 2,
        y: 6 + (geom.vh - geom.h) / 2,
      };
    }

    const minX = 6 + Math.min(0, geom.vw - W);
    const maxX = 6 + Math.max(0, geom.vw - W);
    const minY = 6 + Math.min(0, geom.vh - H);
    const maxY = 6 + Math.max(0, geom.vh - H);

    return {
      scale,
      x: clamp(v.x, minX, maxX),
      y: clamp(v.y, minY, maxY),
    };
  }, []);

  // Measure page dimensions
  const measurePage = useCallback((page: any): Geometry => {
    const container = containerRef.current;
    const vw = Math.max(100, (container?.clientWidth || 800) - 16);
    const vh = Math.max(100, (container?.clientHeight || 600) - 16);

    const vp = page.getViewport({ scale: 1, rotation });
    const fit = Math.min(vw / vp.width, vh / vp.height);

    return {
      base: { width: vp.width, height: vp.height },
      vw,
      vh,
      fit,
      w: vp.width * fit,
      h: vp.height * fit,
    };
  }, [rotation]);

  // Render PDF page onto high-resolution canvas tiles
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !surfaceRef.current || !containerRef.current) return;
    setIsRendering(true);

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const geom = measurePage(page);
      setGeometry(geom);

      const nextView = constrainCamera(geom, viewRef.current);
      setView(nextView);
      onZoomChange?.(nextView.scale);

      const surface = surfaceRef.current;
      surface.style.width = `${geom.w}px`;
      surface.style.height = `${geom.h}px`;

      // Clear previous canvas tiles
      const oldCanvases = surface.querySelectorAll('canvas.pdf-tile');
      oldCanvases.forEach((c) => c.remove());

      const dpr = window.devicePixelRatio || 1;
      const density = clamp(dpr, 1.25, 2.5);
      const z = nextView.scale;
      const tileSize = 400;
      const cols = Math.max(1, Math.ceil(geom.w / tileSize));
      const rows = Math.max(1, Math.ceil(geom.h / tileSize));

      const vp = page.getViewport({ scale: geom.fit * z, rotation });

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * tileSize;
          const y = r * tileSize;
          const w = Math.min(tileSize, geom.w - x);
          const h = Math.min(tileSize, geom.h - y);

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-tile absolute pointer-events-none';
          canvas.style.left = `${x}px`;
          canvas.style.top = `${y}px`;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          canvas.width = Math.max(1, Math.ceil(w * density * z));
          canvas.height = Math.max(1, Math.ceil(h * density * z));

          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const tr = [
              density,
              0,
              0,
              density,
              -x * z * density,
              -y * z * density,
            ];

            await page.render({
              canvasContext: ctx,
              viewport: vp,
              transform: tr,
              intent: 'display',
            }).promise;
          }

          surface.appendChild(canvas);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('PDF Render error:', err);
      }
    } finally {
      setIsRendering(false);
    }
  }, [pdfDoc, pageNumber, rotation, measurePage, constrainCamera, onZoomChange]);

  // Trigger render on document/page/rotation change
  useEffect(() => {
    renderPage();
  }, [pdfDoc, pageNumber, rotation]);

  // Window resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (pdfDoc) {
        renderPage();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pdfDoc, renderPage]);

  // Mouse wheel zoom to cursor
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isMoveEnabled || !geometryRef.current || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const nextScale = clamp(viewRef.current.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM);

    const relX = (cursorX - viewRef.current.x) / viewRef.current.scale;
    const relY = (cursorY - viewRef.current.y) / viewRef.current.scale;

    const newX = cursorX - relX * nextScale;
    const newY = cursorY - relY * nextScale;

    const nextView = constrainCamera(geometryRef.current, {
      scale: nextScale,
      x: newX,
      y: newY,
    });

    setView(nextView);
    onZoomChange?.(nextView.scale);
  };

  // Click on page for placement target
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placementTarget || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0.01, 0.99);
    const y = clamp((e.clientY - rect.top) / rect.height, 0.01, 0.99);
    onPlaceTarget(x, y);
  };

  // Pointer Down on viewer (panning or overlay dragging)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const overlayElem = target.closest('[data-overlay-id]') as HTMLElement;

    if (overlayElem) {
      const type = overlayElem.dataset.overlayType as OverlayType;
      const index = Number(overlayElem.dataset.overlayIndex);
      const isLocked = overlayElem.dataset.overlayLocked === 'true';

      onSelectOverlay(type, index);

      if (!isLocked) {
        dragRef.current = { type, index, pointerId: e.pointerId };
        overlayElem.setPointerCapture?.(e.pointerId);
      }
      e.stopPropagation();
      return;
    }

    if (!isMoveEnabled) return;

    gestureRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Overlay drag
    if (dragRef.current && surfaceRef.current) {
      const rect = surfaceRef.current.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0.01, 0.99);
      const y = clamp((e.clientY - rect.top) / rect.height, 0.01, 0.99);
      onUpdatePosition(dragRef.current.type, dragRef.current.index, x, y);
      return;
    }

    // 2. Pan
    if (gestureRef.current.mode === 'pan' && isMoveEnabled && geometryRef.current) {
      const dx = e.clientX - gestureRef.current.startX;
      const dy = e.clientY - gestureRef.current.startY;

      const nextView = constrainCamera(geometryRef.current, {
        scale: viewRef.current.scale,
        x: gestureRef.current.originX + dx,
        y: gestureRef.current.originY + dy,
      });

      setView(nextView);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
    }
    if (gestureRef.current.mode === 'pan') {
      gestureRef.current.mode = null;
    }
  };

  // Touch gesture support (pinch zoom & touch pan)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-overlay-id]') || !isMoveEnabled) return;

    if (e.touches.length === 1) {
      const t = e.touches[0];
      gestureRef.current = {
        mode: 'pan',
        startX: t.clientX,
        startY: t.clientY,
        originX: viewRef.current.x,
        originY: viewRef.current.y,
      };
    } else if (e.touches.length >= 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.max(1, Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY));
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      gestureRef.current = {
        mode: 'pinch',
        startX: midX,
        startY: midY,
        originX: viewRef.current.x,
        originY: viewRef.current.y,
        baseDist: dist,
        baseScale: viewRef.current.scale,
        anchorX: (midX - viewRef.current.x) / viewRef.current.scale,
        anchorY: (midY - viewRef.current.y) / viewRef.current.scale,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMoveEnabled || !geometryRef.current) return;

    if (e.touches.length >= 2 && gestureRef.current.mode === 'pinch') {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.max(1, Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY));
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      const scale = clamp(
        (gestureRef.current.baseScale || 1) * (dist / (gestureRef.current.baseDist || 1)),
        MIN_ZOOM,
        MAX_ZOOM
      );

      const anchorX = gestureRef.current.anchorX || 0;
      const anchorY = gestureRef.current.anchorY || 0;

      const nextView = constrainCamera(geometryRef.current, {
        scale,
        x: midX - anchorX * scale,
        y: midY - anchorY * scale,
      });

      setView(nextView);
      onZoomChange?.(nextView.scale);
    } else if (e.touches.length === 1 && gestureRef.current.mode === 'pan') {
      const t = e.touches[0];
      const dx = t.clientX - gestureRef.current.startX;
      const dy = t.clientY - gestureRef.current.startY;

      const nextView = constrainCamera(geometryRef.current, {
        scale: viewRef.current.scale,
        x: gestureRef.current.originX + dx,
        y: gestureRef.current.originY + dy,
      });

      setView(nextView);
    }
  };

  const resetZoom = () => {
    if (!geometryRef.current) return;
    const nextView = constrainCamera(geometryRef.current, { scale: 1, x: 0, y: 0 });
    setView(nextView);
    onZoomChange?.(1);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className={`relative w-full h-full bg-slate-200/90 rounded-xl overflow-hidden border border-slate-300 shadow-inner select-none ${
        placementTarget
          ? 'cursor-crosshair'
          : isMoveEnabled
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-default'
      }`}
    >
      {/* Placement Prompt overlay */}
      {placementTarget && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg animate-bounce pointer-events-none flex items-center gap-1.5">
          <span>📍</span>
          <span>
            {lang === 'hi'
              ? `पेज पर क्लिक करके ${placementTarget.type === 'sig' ? 'हस्ताक्षर' : 'मुहर'} रखें`
              : `Click on page to place ${placementTarget.type === 'sig' ? 'Signature' : 'Seal'}`}
          </span>
        </div>
      )}

      {/* Floating Zoom and Pan Quick controls */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-xl shadow-md border border-slate-200">
        <button
          type="button"
          onClick={() => {
            if (!geometryRef.current) return;
            const nextScale = clamp(view.scale / 1.25, MIN_ZOOM, MAX_ZOOM);
            const nextView = constrainCamera(geometryRef.current, { ...view, scale: nextScale });
            setView(nextView);
            onZoomChange?.(nextView.scale);
          }}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-bold px-1.5 text-slate-700 min-w-[38px] text-center">
          {Math.round(view.scale * 100)}%
        </span>

        <button
          type="button"
          onClick={() => {
            if (!geometryRef.current) return;
            const nextScale = clamp(view.scale * 1.25, MIN_ZOOM, MAX_ZOOM);
            const nextView = constrainCamera(geometryRef.current, { ...view, scale: nextScale });
            setView(nextView);
            onZoomChange?.(nextView.scale);
          }}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetZoom}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors border-l border-slate-200 ml-0.5"
          title="Reset Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Camera and Document Surface */}
      <div
        ref={cameraRef}
        className="absolute left-0 top-0 will-change-transform origin-top-left"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
        }}
      >
        <div
          ref={surfaceRef}
          onClick={handlePageClick}
          className="relative bg-white shadow-xl overflow-hidden"
          style={{ width: geometry?.w || 400, height: geometry?.h || 560 }}
        >
          {/* Overlays rendered on top of PDF tiles */}
          {geometry &&
            overlays.map((item) => {
              if (!item.placed) return null;

              const isLocked = item.locked;
              const posX = (isLocked && item.lockX !== undefined ? item.lockX : item.x) * geometry.w;
              const posY = (isLocked && item.lockY !== undefined ? item.lockY : item.y) * geometry.h;
              const sizeFrac = isLocked && item.lockSize !== undefined ? item.lockSize : item.w;

              const itemW = geometry.w * clamp(sizeFrac, 0.03, 0.55);
              const aspect = (item.asset.height || 1) / (item.asset.width || 1);
              const itemH = itemW * aspect;

              const isActive = activeOverlay?.type === item.type && activeOverlay?.index === item.index;

              return (
                <div
                  key={item.id}
                  data-overlay-id={item.id}
                  data-overlay-type={item.type}
                  data-overlay-index={item.index}
                  data-overlay-locked={String(item.locked)}
                  className={`absolute group touch-none select-none ${
                    isLocked
                      ? 'cursor-not-allowed'
                      : 'cursor-move ring-2 ring-sky-500 ring-offset-1 rounded-sm'
                  } ${isActive && !isLocked ? 'ring-2 ring-emerald-500 shadow-md' : ''}`}
                  style={{
                    left: `${posX}px`,
                    top: `${posY}px`,
                    width: `${itemW}px`,
                    height: `${itemH}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isActive ? 25 : 15,
                  }}
                >
                  <img
                    src={item.asset.url}
                    alt={item.type}
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none drop-shadow-xs"
                  />

                  {/* Lock Indicator badge */}
                  {isLocked && (
                    <div className="absolute -top-3 -right-3 bg-emerald-600 text-white rounded-full p-0.5 shadow-sm ring-1 ring-white pointer-events-none">
                      <Lock className="w-3 h-3" />
                    </div>
                  )}

                  {/* Active & Unlocked Drag handle badge */}
                  {!isLocked && (
                    <div className="absolute -bottom-2 -left-2 bg-sky-600 text-white text-[9px] font-bold px-1 py-0.2 rounded shadow-xs pointer-events-none flex items-center gap-0.5">
                      <Move className="w-2.5 h-2.5" />
                      <span>{item.type === 'sig' ? `Sign ${item.index + 1}` : `Seal ${item.index + 1}`}</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
