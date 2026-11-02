"use client";

import { MOVE_ART } from "./moveArt";

/** Set once the movement demos have been downloaded for offline use. */
const SAVED_KEY = "otto-offline.v1";

export type OfflineProgress = {
  done: number;
  total: number;
  complete?: boolean;
};

/** Every frame the app can show: two poses at two sizes per movement. */
export function moveDemoUrls() {
  const urls: string[] = [];
  for (const art of MOVE_ART) {
    for (const frame of ["a", "b"]) {
      urls.push(`/moves/${art.slug}/${frame}-160.jpg`);
      urls.push(`/moves/${art.slug}/${frame}-640.jpg`);
    }
  }
  return urls;
}

export function offlineSavedAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

/**
 * Asks the service worker to download every movement frame. Resolves with the
 * number of files once the worker reports completion.
 */
export async function saveDemosOffline(onProgress: (progress: OfflineProgress) => void) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("This browser cannot save the app for offline use.");
  }

  if (!(await navigator.serviceWorker.getRegistration())) {
    throw new Error("Offline saving is available in the deployed app, not in local development.");
  }

  // `ready` waits for the worker to finish installing; the race keeps a broken
  // registration from leaving the button spinning forever.
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000)),
  ]);
  const worker = ready?.active ?? navigator.serviceWorker.controller;
  if (!worker) {
    throw new Error("The offline worker is still starting. Try again in a moment.");
  }

  const urls = moveDemoUrls();

  return new Promise<number>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("Saving took too long. Check your connection and try again."));
    }, 240_000);

    channel.port1.onmessage = (event: MessageEvent) => {
      const data = event.data as OfflineProgress | undefined;
      if (!data) return;
      onProgress(data);
      if (data.complete) {
        window.clearTimeout(timer);
        channel.port1.close();
        try {
          window.localStorage.setItem(SAVED_KEY, new Date().toISOString());
        } catch {
          // Storage can be blocked; the cache still holds the files.
        }
        resolve(data.total);
      }
    };

    worker.postMessage({ type: "precache-moves", urls }, [channel.port2]);
  });
}
