import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Terminal, 
  Download, 
  Layers, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'instant' | 'pwabuilder' | 'cli' | 'capacitor'>('instant');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://your-app-url.run.app';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#18181B] border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 bg-[#121214] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Using on Android &amp; Converting to .APK</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
                  Yes, fully supported!
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Batch Photo Framer Pro runs natively on Android via PWA or can be compiled into a standalone .apk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Selector Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-6 pt-3 gap-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('instant')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'instant'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            1. Instant Install (No APK needed)
          </button>
          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pwabuilder'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            2. PWABuilder (.APK in 1 click)
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'cli'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            3. Google Bubblewrap CLI
          </button>
          <button
            onClick={() => setActiveTab('capacitor')}
            className={`pb-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'capacitor'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            4. Capacitor / Android Studio
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          
          {activeTab === 'instant' && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 text-blue-200">
                <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>The Fastest &amp; Recommended Android Solution: Install as PWA</span>
                </div>
                <p>
                  You do not actually need to deal with sideloading permissions or manual APK signing. This app is configured with a Web App Manifest and Service Worker so Android recognizes it as a native Android app!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">1</div>
                  <h4 className="font-semibold text-white mb-1">Open in Chrome</h4>
                  <p className="text-zinc-400 text-[11px]">
                    Open this app URL in Google Chrome or Samsung Internet on your Android phone.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">2</div>
                  <h4 className="font-semibold text-white mb-1">Tap Install</h4>
                  <p className="text-zinc-400 text-[11px]">
                    Tap the <strong>"Install to Android"</strong> button in the header, or tap the Chrome 3-dots menu &rarr; <strong>"Install app"</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs mb-2">3</div>
                  <h4 className="font-semibold text-white mb-1">Runs Fullscreen</h4>
                  <p className="text-zinc-400 text-[11px]">
                    An app icon is placed on your home screen. It opens standalone with no browser address bar and works offline!
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                <div className="truncate pr-4">
                  <span className="text-[11px] text-zinc-400 block">App Web URL to open on your phone:</span>
                  <span className="text-xs font-mono text-blue-400 truncate block">{currentUrl}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(currentUrl, 'url')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedText === 'url' ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pwabuilder' && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <p>
                If you need an actual standalone <code className="text-blue-400 bg-zinc-900 px-1 py-0.5 rounded">.apk</code> file to distribute, share via Telegram/Drive, or submit to the Google Play Store, Microsoft’s free open-source <strong>PWABuilder</strong> packages this PWA into an Android APK in under 2 minutes:
              </p>

              <ol className="list-decimal pl-4 space-y-2 text-zinc-300">
                <li>
                  Go to <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="text-blue-400 underline font-semibold">pwabuilder.com</a>.
                </li>
                <li>
                  Paste your app URL:
                  <div className="mt-1 flex items-center gap-2 bg-zinc-900 p-2 rounded border border-zinc-800 font-mono text-blue-300">
                    <span className="truncate flex-1">{currentUrl}</span>
                    <button
                      onClick={() => copyToClipboard(currentUrl, 'pwa-url')}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px] hover:bg-zinc-700"
                    >
                      {copiedText === 'pwa-url' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </li>
                <li>
                  Click <strong>Start</strong>. It will detect this app’s complete manifest, icons (192px &amp; 512px maskable), and service worker.
                </li>
                <li>
                  Click <strong>"Package for Android"</strong> &rarr; Select <strong>"Generate APK"</strong>.
                </li>
                <li>
                  Download the generated zip file. Inside you will find your signed <code className="text-blue-400 font-mono">app-release-signed.apk</code>!
                </li>
              </ol>

              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Ready to generate your APK?</span>
                  <span className="text-zinc-400 text-[11px]">Opens PWABuilder in a new tab</span>
                </div>
                <a
                  href={`https://www.pwabuilder.com/?url=${encodeURIComponent(currentUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition text-xs"
                >
                  <span>Open PWABuilder</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <p>
                Google provides an official command-line tool called <strong>Bubblewrap</strong> to build Trusted Web Activity (TWA) Android APKs directly from your terminal:
              </p>

              <div className="relative bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 font-mono text-[11px] text-zinc-300 space-y-2">
                <button
                  onClick={() => copyToClipboard(
                    `npm i -g @bubblewrap/cli\nbubblewrap init --manifest=${currentUrl}/manifest.webmanifest\nbubblewrap build`,
                    'cli-commands'
                  )}
                  className="absolute top-3 right-3 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedText === 'cli-commands' ? 'Copied!' : 'Copy Commands'}
                </button>
                <div className="text-zinc-500"># 1. Install Google Bubblewrap CLI</div>
                <div className="text-emerald-400">npm install -g @bubblewrap/cli</div>
                <div className="text-zinc-500 mt-2"># 2. Initialize project from this app's manifest</div>
                <div className="text-emerald-400">bubblewrap init --manifest={currentUrl}/manifest.webmanifest</div>
                <div className="text-zinc-500 mt-2"># 3. Compile signed APK</div>
                <div className="text-emerald-400">bubblewrap build</div>
              </div>

              <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Bubblewrap produces production-grade APKs and Android App Bundles (.aab) ready for Google Play or direct sideloading.</span>
              </div>
            </div>
          )}

          {activeTab === 'capacitor' && (
            <div className="space-y-4 text-xs leading-relaxed text-zinc-300">
              <p>
                If you want to customize native Android code in <strong>Android Studio</strong> (e.g. native camera plugins, notifications, or deep filesystem storage):
              </p>

              <div className="relative bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 font-mono text-[11px] text-zinc-300 space-y-2">
                <button
                  onClick={() => copyToClipboard(
                    `npm install @capacitor/core @capacitor/cli @capacitor/android\nnpx cap init "Photo Frame Pro" "com.photoframer.app" --web-dir dist\nnpm run build\nnpx cap add android\nnpx cap open android`,
                    'cap-commands'
                  )}
                  className="absolute top-3 right-3 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedText === 'cap-commands' ? 'Copied!' : 'Copy Commands'}
                </button>
                <div className="text-zinc-500"># 1. Install Capacitor</div>
                <div className="text-cyan-400">npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                <div className="text-zinc-500 mt-2"># 2. Initialize project</div>
                <div className="text-cyan-400">npx cap init "Photo Frame Pro" "com.photoframer.app" --web-dir dist</div>
                <div className="text-zinc-500 mt-2"># 3. Build &amp; add Android platform</div>
                <div className="text-cyan-400">npm run build && npx cap add android</div>
                <div className="text-zinc-500 mt-2"># 4. Open in Android Studio to build APK</div>
                <div className="text-cyan-400">npx cap open android</div>
              </div>

              <p className="text-[11px] text-zinc-400">
                Inside Android Studio, click <strong>Build &rarr; Build Bundle(s) / APK(s) &rarr; Build APK(s)</strong> to generate your `.apk`.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#121214] flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            All 6 frame styles, web-sharp filter &amp; batch exports run 100% offline.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
