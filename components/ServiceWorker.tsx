"use client";

import { useEffect } from "react";

/**
 * Registers the offline worker. It only runs in a production build: the worker
 * caches `/_next/static` cache first, and dev serves those files unhashed, so
 * leaving it on in development would fight hot reload.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Offline support is an extra; the app runs fine without it.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    const onLoad = () => register();
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
