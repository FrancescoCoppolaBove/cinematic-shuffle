import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function useUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setShowUpdate(true);
    },
    onOfflineReady() {
      console.log('[PWA] App pronta per uso offline');
    },
  });

  function applyUpdate() {
    updateServiceWorker(true);
    setShowUpdate(false);
  }

  function dismissUpdate() {
    setShowUpdate(false);
  }

  return { showUpdate, applyUpdate, dismissUpdate };
}
