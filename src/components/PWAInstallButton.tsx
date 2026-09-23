import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running standalone, do not show install prompt
  if (isInstalled) {
    return null;
  }

  // Android / Chromium / Edge / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="h-[44px] px-3 bg-white/95 hover:bg-white text-[#087e58] font-black text-[12px] sm:text-[13px] rounded-[12px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] flex items-center gap-1.5 transition-transform active:scale-95 shrink-0 z-10"
        title="मोबाइल में ऐप इनस्टॉल करें (Install App)"
      >
        <Download className="w-4 h-4 text-[#08ad4f] stroke-[2.5]" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="h-[44px] px-2.5 bg-white/95 hover:bg-white text-[#087e58] font-black text-[12px] rounded-[12px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] flex items-center gap-1.5 transition-transform active:scale-95 shrink-0 z-10"
          title="iPhone में इनस्टॉल करें"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#08ad4f]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 select-text">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-black text-[#087e58] flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#08ad4f]" />
                  iPhone / iPad में Install करें
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3 space-y-2 text-xs text-slate-700 leading-relaxed">
                <p>
                  1. नीचे Safari ब्राउज़र में <strong>Share (शेयर)</strong> बटन पर टैप करें।
                </p>
                <p>
                  2. नीचे स्क्रॉल करके <strong>'Add to Home Screen' (होम स्क्रीन पर जोड़ें)</strong> चुनें।
                </p>
                <p className="text-[#087e58] font-bold">
                  3. इसके बाद यह ऐप बिना इंटरनेट भी आपके मोबाइल में हमेशा चलेगी!
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 rounded-xl bg-[#08a0d8] text-white font-bold text-xs shadow-md hover:bg-[#078cbd] transition-colors"
              >
                समझ गया (Close)
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
