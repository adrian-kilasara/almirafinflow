import { useEffect, useRef, useState } from "react";

/**
 * ResizeObserver-based container size hook.
 * Returns the live width/height of the ref'd element.
 */
export function useContainerSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...size };
}

export type ColMode = 1 | 2 | 3 | 4;

/** Maps a width to a sensible column count for card grids. */
export function colsForWidth(w: number): ColMode {
  if (w < 640) return 1;
  if (w < 900) return 2;
  if (w < 1280) return 3;
  return 4;
}
