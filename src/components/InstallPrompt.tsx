import { useState, useEffect } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';

// BeforeInstallPromptEvent is not in standard TS types
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'cinematic_install_dismissed';

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function wasDismissed(): boolean {
  const val = localStorage.getItem(DISMISSED_KEY);
  if (!val) return false;
  // Riappare dopo 14 giorni
  const dismissed = new Date(val);
  const diff = Date.now() - dismissed.getTime();
  return diff < 14 * 24 * 60 * 60 * 1000;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (isInStandaloneMode()) return;
    // User already dismissed recently
    if (wasDismissed()) return;

    // iOS: mostra istruzioni manuali
    if (isIOS()) {
      // Delay 3s per non interrompere il login
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => clearTimeout(t);
    }

    // Android/Desktop: intercetta il prompt nativo
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay 2s
      setTimeout(() => setShowAndroid(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    setShowAndroid(false);
    setShowIOS(false);
  }

  async function handleInstallAndroid() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroid(false);
    } else {
      dismiss();
    }
    setInstalling(false);
    setDeferredPrompt(null);
  }

  // ─── Android banner ────────────────────────────────────────────────
  if (showAndroid) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[70] animate-slide-up">
        <div className="bg-film-surface border border-film-accent/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-film-border">
            <img src="/icons/icon-192.png" alt="Cinematic" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-film-text text-sm font-semibold">Installa Cinematic Shuffle</p>
            <p className="text-film-muted text-xs mt-0.5">Aggiungila alla schermata home per un'esperienza app</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={dismiss} className="p-1.5 text-film-subtle hover:text-film-muted transition-colors">
              <X size={16} />
            </button>
            <button
              onClick={handleInstallAndroid}
              disabled={installing}
              className="flex items-center gap-1.5 bg-film-accent text-film-black text-xs font-bold px-3 py-2 rounded-xl hover:bg-film-accent-dim transition-all active:scale-95 disabled:opacity-60"
            >
              <Download size={13} />
              {installing ? 'Installa...' : 'Installa'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── iOS istruzioni ────────────────────────────────────────────────
  if (showIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[70] animate-slide-up">
        <div className="bg-film-surface border border-film-border rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-film-border shrink-0">
                <img src="/icons/icon-180.png" alt="Cinematic" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-film-text text-sm font-semibold">Installa l'app su iPhone</p>
                <p className="text-film-muted text-xs">Accesso rapido dalla schermata home</p>
              </div>
            </div>
            <button onClick={dismiss} className="p-1 text-film-subtle hover:text-film-muted transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-film-card rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-film-accent/10 border border-film-accent/20 flex items-center justify-center shrink-0">
                <span className="text-film-accent font-bold text-xs">1</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <p className="text-film-text text-xs">Tocca</p>
                <div className="flex items-center gap-1 bg-film-surface border border-film-border rounded-lg px-2 py-1">
                  <Share size={11} className="text-blue-400" />
                  <span className="text-blue-400 text-xs">Condividi</span>
                </div>
                <p className="text-film-text text-xs">in Safari</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-film-card rounded-xl px-3 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-film-accent/10 border border-film-accent/20 flex items-center justify-center shrink-0">
                <span className="text-film-accent font-bold text-xs">2</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <p className="text-film-text text-xs">Seleziona</p>
                <div className="flex items-center gap-1 bg-film-surface border border-film-border rounded-lg px-2 py-1">
                  <Plus size={11} className="text-film-text" />
                  <span className="text-film-text text-xs">Aggiungi a Home</span>
                </div>
              </div>
            </div>
          </div>

          {/* iOS note -->*/}
          <p className="text-film-subtle text-xs mt-3 text-center">
            Funziona solo con Safari su iPhone e iPad
          </p>
        </div>
      </div>
    );
  }

  return null;
}
