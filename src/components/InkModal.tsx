import React, { useState, useRef, useEffect } from 'react';
import { Upload, Edit3, X, Check, RefreshCw, Stamp } from 'lucide-react';
import { processInkImage, dataUrlToBytes } from '../utils/inkProcessor';
import type { InkAsset, InkColorMode, OverlayType } from '../types';

interface InkModalProps {
  isOpen: boolean;
  type: OverlayType;
  currentAsset: InkAsset | null;
  onClose: () => void;
  onApply: (asset: InkAsset) => void;
  lang: 'hi' | 'en';
}

export const InkModal: React.FC<InkModalProps> = ({
  isOpen,
  type,
  currentAsset,
  onClose,
  onApply,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'draw' | 'generate'>('upload');
  const [colorMode, setColorMode] = useState<InkColorMode>('original');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [stampText, setStampText] = useState<string>('AUTHORIZED SIGNATORY • NOTARY PUBLIC');

  // Drawing canvas refs
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (currentAsset?.url) {
        setPreviewUrl(currentAsset.url);
      } else {
        setPreviewUrl('');
      }
      setRawFile(null);
      setHasDrawn(false);
      setActiveTab('upload');
      setColorMode('original');
    }
  }, [isOpen, currentAsset]);

  // Handle re-processing when colorMode changes
  useEffect(() => {
    if (!isOpen) return;

    if (rawFile && activeTab === 'upload') {
      setIsProcessing(true);
      setErrorMsg('');
      processInkImage(rawFile, type, colorMode)
        .then((url) => {
          setPreviewUrl(url);
          setIsProcessing(false);
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Processing failed');
          setIsProcessing(false);
        });
    }
  }, [colorMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const processed = await processInkImage(file, type, colorMode);
      setPreviewUrl(processed);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to extract ink from uploaded image.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colorMode === 'black' ? '#000000' : colorMode === 'red' ? '#b91c1c' : '#1d4ed8';

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = drawCanvasRef.current;
    if (canvas) {
      setPreviewUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      setPreviewUrl('');
    }
  };

  // Generate an official Circular / Oval Stamp Seal
  const generateOfficialStamp = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 600, 600);
    const center = 300;
    const radius = 240;
    const stampColor = colorMode === 'black' ? '#111827' : colorMode === 'red' ? '#dc2626' : '#1e40af';

    ctx.strokeStyle = stampColor;
    ctx.fillStyle = stampColor;

    // Outer double rings
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, radius - 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius - 70, 0, Math.PI * 2);
    ctx.stroke();

    // Curved circular text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cleanText = (stampText || 'OFFICIAL VERIFICATION SEAL').toUpperCase();
    const chars = cleanText.split('');
    const angleStep = (Math.PI * 1.6) / Math.max(chars.length, 1);
    let startAngle = -Math.PI * 1.3;

    for (let i = 0; i < chars.length; i++) {
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + i * angleStep);
      ctx.fillText(chars[i], 0, -(radius - 42));
      ctx.restore();
    }

    // Inner details
    ctx.font = '900 28px sans-serif';
    ctx.fillText('VERIFIED', center, center - 20);

    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★ OFFICIAL SEAL ★', center, center + 18);

    ctx.font = 'italic 14px sans-serif';
    ctx.fillText('GOVT. / CORP. REG.', center, center + 42);

    const url = canvas.toDataURL('image/png');
    setPreviewUrl(url);
  };

  const handleApply = async () => {
    if (!previewUrl) {
      setErrorMsg(lang === 'hi' ? 'कृपया पहले इमेज अपलोड करें या बनाएं' : 'Please upload or draw an image first.');
      return;
    }

    try {
      setIsProcessing(true);
      const bytes = dataUrlToBytes(previewUrl);

      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || 600, height: img.naturalHeight || 600 });
        img.onerror = () => reject(new Error('Preview load error'));
        img.src = previewUrl;
      });

      const asset: InkAsset = {
        bytes,
        mime: 'image/png',
        url: previewUrl,
        width: dims.width,
        height: dims.height,
        source: rawFile?.name || (type === 'sig' ? 'signature.png' : 'seal.png'),
      };

      onApply(asset);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not apply image asset.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const isSig = type === 'sig';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-cyan-600 to-sky-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isSig ? <Edit3 className="w-5 h-5" /> : <Stamp className="w-5 h-5" />}
            <h2 className="font-bold text-base sm:text-lg">
              {isSig ? (lang === 'hi' ? 'हस्ताक्षर (Signature)' : 'Signature Management') : (lang === 'hi' ? 'मुहर / सील (Official Seal)' : 'Official Seal Management')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            {lang === 'hi' ? 'अपलोड (Upload)' : 'Upload Image'}
          </button>

          {isSig ? (
            <button
              onClick={() => {
                setActiveTab('draw');
                setTimeout(() => clearDrawCanvas(), 50);
              }}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'draw'
                  ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              {lang === 'hi' ? 'ड्रॉ करें (Draw)' : 'Draw on Screen'}
            </button>
          ) : (
            <button
              onClick={() => {
                setActiveTab('generate');
                generateOfficialStamp();
              }}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'generate'
                  ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Stamp className="w-4 h-4" />
              {lang === 'hi' ? 'सील बनाएं (Make Seal)' : 'Instant Stamp'}
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-2.5 text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <span>⚠️ {errorMsg}</span>
              <button onClick={() => setErrorMsg('')} className="text-red-500 font-bold ml-2">✕</button>
            </div>
          )}

          {/* Tab 1: Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 rounded-xl p-4 cursor-pointer transition-colors text-center group">
                <Upload className="w-8 h-8 text-sky-600 group-hover:scale-110 transition-transform mb-1.5" />
                <span className="font-semibold text-sm text-slate-800">
                  {lang === 'hi' ? 'यहाँ फोटो चुनें या खींचकर लाएं' : 'Click to upload image or drag & drop'}
                </span>
                <span className="text-xs text-slate-500 mt-0.5">
                  {isSig
                    ? (lang === 'hi' ? 'कागज पर दस्तखत की फोटो (स्वचालित पृष्ठभूमि हटाने वाला)' : 'Photo of pen signature on white paper (auto transparent)')
                    : (lang === 'hi' ? 'कार्यालय मुहर / रबर स्टैम्प की फोटो' : 'Photo or scan of rubber stamp / office seal')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Tab 2: Live Canvas Draw (for signature) */}
          {activeTab === 'draw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{lang === 'hi' ? 'माउस या उंगली से दस्तखत करें:' : 'Sign using mouse or finger:'}</span>
                <button
                  type="button"
                  onClick={clearDrawCanvas}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" />
                  {lang === 'hi' ? 'साफ करें (Clear)' : 'Clear Canvas'}
                </button>
              </div>
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner touch-none">
                <canvas
                  ref={drawCanvasRef}
                  width={500}
                  height={220}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair bg-slate-50/30"
                />
              </div>
            </div>
          )}

          {/* Tab 3: Stamp Generator (for seal) */}
          {activeTab === 'generate' && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">
                {lang === 'hi' ? 'मुहर पर नाम / विभाग लिखें:' : 'Department or Organization Name:'}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stampText}
                  onChange={(e) => setStampText(e.target.value)}
                  placeholder="e.g. AUTHORIZED SIGNATORY • NOTARY"
                  className="flex-1 text-xs sm:text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={generateOfficialStamp}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  {lang === 'hi' ? 'रीफ्रेश' : 'Update'}
                </button>
              </div>
            </div>
          )}

          {/* Color Mode selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              {lang === 'hi' ? 'इंक रंग (Ink Color):' : 'Ink Color Option:'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setColorMode('original')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                  colorMode === 'original'
                    ? 'border-sky-600 bg-sky-50 text-sky-800 shadow-xs ring-1 ring-sky-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lang === 'hi' ? 'मूल (Original)' : 'Original'}
              </button>

              <button
                type="button"
                onClick={() => setColorMode('blue')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  colorMode === 'blue'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-xs ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                {lang === 'hi' ? 'नीला (Blue)' : 'Blue'}
              </button>

              <button
                type="button"
                onClick={() => setColorMode('black')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  colorMode === 'black'
                    ? 'border-slate-800 bg-slate-100 text-slate-900 shadow-xs ring-1 ring-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-black"></span>
                {lang === 'hi' ? 'काला (Black)' : 'Black'}
              </button>

              <button
                type="button"
                onClick={() => setColorMode('red')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  colorMode === 'red'
                    ? 'border-red-600 bg-red-50 text-red-800 shadow-xs ring-1 ring-red-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                {lang === 'hi' ? 'लाल (Red)' : 'Red'}
              </button>
            </div>
          </div>

          {/* Transparency / Checkerboard Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>{lang === 'hi' ? 'पारदर्शी पूर्वावलोकन (Isolated Ink Preview):' : 'Transparent Ink Preview:'}</span>
              {previewUrl && <span className="text-emerald-600 font-semibold">✓ Background Removed</span>}
            </div>
            <div
              className="w-full h-44 sm:h-52 rounded-xl border border-slate-300 flex items-center justify-center overflow-hidden relative shadow-inner"
              style={{
                backgroundImage:
                  'repeating-conic-gradient(#f1f5f9 0 25%, #ffffff 0 50%)',
                backgroundSize: '16px 16px',
              }}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
                  <span className="text-xs font-medium">
                    {lang === 'hi' ? 'इंक साफ की जा रही है...' : 'Extracting clean ink...'}
                  </span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Processed ink preview"
                  className="max-w-[90%] max-h-[90%] object-contain drop-shadow-sm select-none"
                />
              ) : (
                <div className="text-center text-slate-400 text-xs px-4">
                  {lang === 'hi' ? 'यहाँ साफ पारदर्शी परिणाम दिखेगा' : 'Clean transparent ink will appear here'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors"
          >
            {lang === 'hi' ? '✕ बंद करें' : 'Close'}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!previewUrl || isProcessing}
            className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {lang === 'hi' ? '✓ लागू करें' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
};
