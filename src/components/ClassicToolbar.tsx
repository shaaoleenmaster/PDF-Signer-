import React from 'react';
import type { OverlayType } from '../types';

interface ClassicToolbarProps {
  numPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSelectPdf: () => void;
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
}

export const ClassicToolbar: React.FC<ClassicToolbarProps> = ({
  numPages,
  currentPage,
  onPageChange,
  onSelectPdf,
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
}) => {
  return (
    <div className="grid grid-cols-4 gap-1.5 w-full select-none">
      {/* Row 1 */}
      {/* 1. PDF */}
      <button
        type="button"
        onClick={onSelectPdf}
        className="h-11 border border-[#cce1f0] bg-[#eaf5ff] hover:bg-[#dceeff] text-[#22577a] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>📄</span>
        <span>PDF</span>
      </button>

      {/* 2. Sign */}
      <button
        type="button"
        onClick={onOpenSignModal}
        className="h-11 border border-[#c9eedf] bg-[#eaf9f3] hover:bg-[#d8f5e9] text-[#1c6e52] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>✍️</span>
        <span>Sign</span>
      </button>

      {/* 3. Delete Sign */}
      <button
        type="button"
        onClick={onDeleteSign}
        disabled={!isPdfLoaded}
        className="h-11 border border-[#fde4cf] bg-[#fff3e7] hover:bg-[#fee8d3] disabled:opacity-50 text-[#a05a2c] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>🗑️</span>
        <span>Sign</span>
      </button>

      {/* 4. Seal */}
      <button
        type="button"
        onClick={onOpenSealModal}
        className="h-11 border border-[#cce1f0] bg-[#eaf5ff] hover:bg-[#dceeff] text-[#22577a] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>🏛️</span>
        <span>Seal</span>
      </button>

      {/* Row 2 */}
      {/* 5. Delete Seal */}
      <button
        type="button"
        onClick={onDeleteSeal}
        disabled={!isPdfLoaded}
        className="h-11 border border-[#c9eedf] bg-[#eaf9f3] hover:bg-[#d8f5e9] disabled:opacity-50 text-[#1c6e52] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>🗑️</span>
        <span>Seal</span>
      </button>

      {/* 6. Page Select */}
      <div className="h-11 border border-[#cce1f0] bg-white rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center px-1">
        <select
          value={currentPage}
          onChange={(e) => onPageChange(Number(e.target.value))}
          disabled={!isPdfLoaded || numPages <= 0}
          className="w-full h-full bg-transparent text-[#22577a] font-black text-[13px] outline-none text-center cursor-pointer"
        >
          {numPages > 0 ? (
            Array.from({ length: numPages }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                📑 Page {i + 1}
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
        className="h-11 border border-[#cce1f0] bg-[#eaf5ff] hover:bg-[#dceeff] disabled:opacity-50 text-[#22577a] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>↻</span>
        <span>PDF 90°</span>
      </button>

      {/* 8. Stop / Move PDF */}
      <button
        type="button"
        onClick={onToggleMove}
        className={`h-11 border font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform ${
          isMoveEnabled
            ? 'border-[#c9eedf] bg-[#eaf9f3] text-[#1c6e52]'
            : 'border-[#b8dcfb] bg-[#dbeeff] text-[#125b96]'
        }`}
      >
        <span>{isMoveEnabled ? '⏸' : '▶'}</span>
        <span>{isMoveEnabled ? 'Stop PDF' : 'Move PDF'}</span>
      </button>

      {/* Row 3 */}
      {/* 9. Sign रखें */}
      <button
        type="button"
        onClick={() => onPlaceOverlay('sig')}
        disabled={!isPdfLoaded}
        className="h-11 bg-[#05ad72] hover:bg-[#049d66] border border-[#039962] text-white font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.12)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span>📍</span>
        <span>Sign रखें</span>
      </button>

      {/* 10. Minus Sign */}
      <button
        type="button"
        onClick={() => onResizeOverlay('sig', -0.02)}
        disabled={!isPdfLoaded}
        className="h-11 border border-[#cce1f0] bg-[#eaf5ff] hover:bg-[#dceeff] disabled:opacity-50 text-[#22577a] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>➖</span>
        <span>Sign</span>
      </button>

      {/* 11. Sign Pct */}
      <div className="h-11 border border-[#cce1f0] bg-[#eaf5ff] text-[#22577a] font-black text-[14px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center">
        {sigSizePct}%
      </div>

      {/* 12. Plus Sign */}
      <button
        type="button"
        onClick={() => onResizeOverlay('sig', 0.02)}
        disabled={!isPdfLoaded}
        className="h-11 border border-[#fde4cf] bg-[#fff3e7] hover:bg-[#fee8d3] disabled:opacity-50 text-[#a05a2c] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>➕</span>
        <span>Sign</span>
      </button>

      {/* Row 4 */}
      {/* 13. Seal रखें */}
      <button
        type="button"
        onClick={() => onPlaceOverlay('seal')}
        disabled={!isPdfLoaded}
        className="h-11 bg-[#05ad72] hover:bg-[#049d66] border border-[#039962] text-white font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.12)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span>📍</span>
        <span>Seal रखें</span>
      </button>

      {/* 14. Minus Seal */}
      <button
        type="button"
        onClick={() => onResizeOverlay('seal', -0.02)}
        disabled={!isPdfLoaded}
        className="h-11 border border-[#c9eedf] bg-[#eaf9f3] hover:bg-[#d8f5e9] disabled:opacity-50 text-[#1c6e52] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>➖</span>
        <span>Seal</span>
      </button>

      {/* 15. Seal Pct */}
      <div className="h-11 border border-[#cce1f0] bg-[#eaf5ff] text-[#22577a] font-black text-[14px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center">
        {sealSizePct}%
      </div>

      {/* 16. Plus Seal */}
      <button
        type="button"
        onClick={() => onResizeOverlay('seal', 0.02)}
        disabled={!isPdfLoaded}
        className="h-11 border border-[#fde4cf] bg-[#fff3e7] hover:bg-[#fee8d3] disabled:opacity-50 text-[#a05a2c] font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
      >
        <span>➕</span>
        <span>Seal</span>
      </button>

      {/* Row 5 */}
      {/* 17. Lock Sign */}
      <button
        type="button"
        onClick={() => onLockOverlay('sig')}
        disabled={!isPdfLoaded}
        className="h-11 bg-[#05ad72] hover:bg-[#049d66] border border-[#039962] text-white font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.12)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span>🔒</span>
        <span>Sign Lock</span>
      </button>

      {/* 18. Lock Seal */}
      <button
        type="button"
        onClick={() => onLockOverlay('seal')}
        disabled={!isPdfLoaded}
        className="h-11 bg-[#05ad72] hover:bg-[#049d66] border border-[#039962] text-white font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.12)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span>🔒</span>
        <span>Seal Lock</span>
      </button>

      {/* 19. Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={!isPdfLoaded}
        className="h-11 bg-[#05ad72] hover:bg-[#049d66] border border-[#039962] text-white font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.12)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <span>💾</span>
        <span>Save</span>
      </button>

      {/* 20. Signed PDF */}
      <button
        type="button"
        onClick={onDownloadSignedPdf}
        disabled={!isPdfLoaded}
        className={`h-11 border text-white font-black text-[13px] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.14)] flex items-center justify-center gap-1 active:scale-[0.98] transition-transform ${
          hasSignedOutput
            ? 'bg-[#168bd9] hover:bg-[#127dc4] border-[#0f72b5] ring-2 ring-blue-300 animate-pulse'
            : 'bg-[#168bd9] hover:bg-[#127dc4] border-[#0f72b5] disabled:opacity-50'
        }`}
      >
        <span>📤</span>
        <span>Signed PDF</span>
      </button>
    </div>
  );
};
