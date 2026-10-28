import { useEffect, useRef, useState } from "react";
import { db } from "./store";
import { learningDay } from "./scheduler";
import { activeSeconds } from "./budget";
export function useSessionClock(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const last = useRef(Date.now());
  const today = learningDay(new Date().toISOString());
  useEffect(() => {
    db.settings
      .get("session:" + today)
      .then((s) => setElapsed(typeof s?.value === "number" ? s.value : 0))
      .catch(() => {});
  }, [today]);
  useEffect(() => {
    last.current = Date.now();
    if (!active) return;
    let disposed = false;
    const reset = () => {
      last.current = Date.now();
    };
    document.addEventListener("visibilitychange", reset);
    const timer = setInterval(async () => {
      const now = Date.now();
      const seconds = activeSeconds(
        last.current,
        now,
        document.visibilityState === "visible",
      );
      last.current = now;
      if (!seconds) return;
      try {
        const total = await db.transaction("rw", db.settings, async () => {
          const key = "session:" + learningDay(new Date(now).toISOString());
          const old = await db.settings.get(key);
          const value =
            (typeof old?.value === "number" ? old.value : 0) + seconds;
          await db.settings.put({ key, value });
          return value;
        });
        if (!disposed) setElapsed(total);
      } catch {
        /* Save failures are handled by the review transaction; timing must not fabricate progress. */
      }
    }, 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [active]);
  return {
    elapsed,
    display: `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`,
  };
}
