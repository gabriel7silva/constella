"use client";

import { useEffect } from "react";
import { isRecoverableClientCrash, reloadOnceForSkew } from "@/lib/deployment-skew";

/**
 * Reloads the tab when it detects it's running an outdated client bundle — e.g. right after the in-app
 * self-update restarted the server on a new build. Listens for uncaught errors + promise rejections and, if
 * they look like version skew ("Failed to find Server Action …", chunk-load failures), hard-reloads once to
 * fetch the matching bundle BEFORE the stale tab crashes to the root error page. Renders nothing.
 */
export function DeploymentSkewGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => { if (isRecoverableClientCrash(e.error ?? e.message)) reloadOnceForSkew(); };
    const onRejection = (e: PromiseRejectionEvent) => { if (isRecoverableClientCrash(e.reason)) reloadOnceForSkew(); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
