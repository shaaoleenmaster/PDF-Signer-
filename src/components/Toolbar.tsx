import React from 'react';
import {
  FileText,
  Edit3,
  Trash2,
  Stamp,
  RotateCw,
  Pause,
  Play,
  MapPin,
  Minus,
  Plus,
  Lock,
  Save,
  Download,
  Sparkles,
} from 'lucide-react';
import type { OverlayType } from '../types';

interface ToolbarProps {
  numPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSelectPdf: () => void;
  onLoadSample: () => void;
  onOpenSignModal: () => void;
  onDeleteSign: () => void;
  onOpenSealModal: () => void;
  onDeleteSeal: () => void;
  onRotatePdf: () => void;
  isMoveEnabled: boolean;
  onToggleMove: () => void;
  onPlaceOverlay: (type: OverlayType) => void;
  onResizeOverlay: (type: OverlayType, delta: number) => void;
  sigSizePct: number;
  sealSizePct: number;
  onLockOverlay: (type: OverlayType) => void;
  onSave: () => void;
  onDownloadSignedPdf: () => void;
  isPdfLoaded: boolean;
  hasSignedOutput: boolean;
  lang: 'hi' | 'en';
}

export const Toolbar: React.FC<ToolbarProps> = ({
  numPages,
  currentPage,
  onPageChange,
  onSelectPdf,
  onLoadSample,
  onOpenSignModal,
  onDeleteSign,
  onOpenSealModal,
  onDeleteSeal,
  onRotatePdf,
  isMoveEnabled,
  onToggleMove,
  onPlaceOverlay,
  onResizeOverlay,
  sigSizePct,
  sealSizePct,
  onLockOverlay,
  onSave,
  onDownloadSignedPdf,
  isPdfLoaded,
  hasSignedOutput,
  lang,
}) => {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 p-2 bg-white rounded-xl border border-slate-200 shadow-xs select-none">
      {/* 1. PDF File upload */}
      <div className="flex gap-1 col-span-1">
        <button
          type="button"
          onClick={onSelectPdf}
          className="flex-1 h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg shadow-xs transition-all active:scale-98"
          title="Open PDF Document"
        >
          <FileText className="w-3.5 h-3.5 text-sky-600" />
          <span>{lang === 'hi' ? '📄 PDF' : '📄 PDF'}</span>
        </button>
        {!isPdfLoaded && (
          <button
            type="button"
            onClick={onLoadSample}
            className="h-10 px-2 flex items-center justify-center text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-xs transition-all"
            title="Load Sample Document"
          >
            <Sparkles className="w-3 h-3 text-indigo-600" />
          </button>
        )}
      </div>

      {/* 2. Signature Setup */}
      <button
        type="button"
        onClick={onOpenSignModal}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs transition-all active:scale-98"
      >
        <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
        <span>{lang === 'hi' ? '✍️ Sign' : '✍️ Sign'}</span>
      </button>

      {/* 3. Delete Signature */}
      <button
        type="button"
        onClick={onDeleteSign}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
        title="Delete selected Sign"
      >
        <Trash2 className="w-3.5 h-3.5 text-amber-600" />
        <span>{lang === 'hi' ? '🗑️ Sign' : '🗑️ Sign'}</span>
      </button>

      {/* 4. Seal Setup */}
      <button
        type="button"
        onClick={onOpenSealModal}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg shadow-xs transition-all active:scale-98"
      >
        <Stamp className="w-3.5 h-3.5 text-sky-600" />
        <span>{lang === 'hi' ? '🏛️ Seal' : '🏛️ Seal'}</span>
      </button>

      {/* 5. Delete Seal */}
      <button
        type="button"
        onClick={onDeleteSeal}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
        title="Delete selected Seal"
      >
        <Trash2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>{lang === 'hi' ? '🗑️ Seal' : '🗑️ Seal'}</span>
      </button>

      {/* 6. Page Select */}
      <div className="h-10 px-2 flex items-center justify-center bg-white border border-slate-300 rounded-lg shadow-xs">
        <select
          value={currentPage}
          onChange={(e) => onPageChange(Number(e.target.value))}
          disabled={!isPdfLoaded || numPages <= 0}
          className="w-full h-full bg-transparent text-xs font-extrabold text-slate-700 outline-none cursor-pointer text-center"
        >
          {numPages > 0 ? (
            Array.from({ length: numPages }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                📑 {lang === 'hi' ? 'पेज' : 'Page'} {i + 1} / {numPages}
              </option>
            ))
          ) : (
            <option value="1">📑 Page 1</option>
          )}
        </select>
      </div>

      {/* 7. Rotate PDF 90° */}
      <button
        type="button"
        onClick={onRotatePdf}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
      >
        <RotateCw className="w-3.5 h-3.5 text-slate-600" />
        <span>↻ PDF 90°</span>
      </button>

      {/* 8. Move PDF Toggle */}
      <button
        type="button"
        onClick={onToggleMove}
        className={`h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold rounded-lg shadow-xs transition-all active:scale-98 ${
          isMoveEnabled
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            : 'bg-sky-100 text-sky-800 border border-sky-300 ring-1 ring-sky-300'
        }`}
      >
        {isMoveEnabled ? (
          <>
            <Pause className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'hi' ? '⏸ Stop PDF' : '⏸ Stop PDF'}</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 text-sky-700" />
            <span>{lang === 'hi' ? '▶ Move PDF' : '▶ Move PDF'}</span>
          </>
        )}
      </button>

      {/* 9. Place Sign */}
      <button
        type="button"
        onClick={() => onPlaceOverlay('sig')}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-200" />
        <span>{lang === 'hi' ? '📍 Sign रखें' : '📍 Place Sign'}</span>
      </button>

      {/* 10, 11, 12. Sign Size Controls: [-] [%] [+] */}
      <div className="flex items-center col-span-1 h-10 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onResizeOverlay('sig', -0.02)}
          disabled={!isPdfLoaded}
          className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-40"
          title="Decrease Sign Size"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="flex-1 text-center font-bold text-xs text-slate-700">
          {sigSizePct}%
        </span>
        <button
          type="button"
          onClick={() => onResizeOverlay('sig', 0.02)}
          disabled={!isPdfLoaded}
          className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-40"
          title="Increase Sign Size"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* 13. Place Seal */}
      <button
        type="button"
        onClick={() => onPlaceOverlay('seal')}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-200" />
        <span>{lang === 'hi' ? '📍 Seal रखें' : '📍 Place Seal'}</span>
      </button>

      {/* 14, 15, 16. Seal Size Controls: [-] [%] [+] */}
      <div className="flex items-center col-span-1 h-10 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onResizeOverlay('seal', -0.02)}
          disabled={!isPdfLoaded}
          className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-40"
          title="Decrease Seal Size"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="flex-1 text-center font-bold text-xs text-slate-700">
          {sealSizePct}%
        </span>
        <button
          type="button"
          onClick={() => onResizeOverlay('seal', 0.02)}
          disabled={!isPdfLoaded}
          className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-40"
          title="Increase Seal Size"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* 17. Lock Sign */}
      <button
        type="button"
        onClick={() => onLockOverlay('sig')}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
        title="Lock Sign Position and Size"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>{lang === 'hi' ? '🔒 Sign Lock' : '🔒 Sign Lock'}</span>
      </button>

      {/* 18. Lock Seal */}
      <button
        type="button"
        onClick={() => onLockOverlay('seal')}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
        title="Lock Seal Position and Size"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>{lang === 'hi' ? '🔒 Seal Lock' : '🔒 Seal Lock'}</span>
      </button>

      {/* 19. Save Document */}
      <button
        type="button"
        onClick={onSave}
        disabled={!isPdfLoaded}
        className="h-10 px-2 flex items-center justify-center gap-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all active:scale-98"
      >
        <Save className="w-3.5 h-3.5" />
        <span>{lang === 'hi' ? '💾 Save' : '💾 Save'}</span>
      </button>

      {/* 20. Export / Download Signed PDF */}
      <button
        type="button"
        onClick={onDownloadSignedPdf}
        disabled={!isPdfLoaded}
        className={`h-10 px-2.5 flex items-center justify-center gap-1 text-xs font-black rounded-lg shadow-sm transition-all active:scale-98 ${
          hasSignedOutput
            ? 'bg-sky-600 hover:bg-sky-700 text-white ring-2 ring-sky-400 animate-pulse'
            : 'bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{lang === 'hi' ? '📤 Signed PDF' : '📤 Signed PDF'}</span>
      </button>
    </div>
  );
};
