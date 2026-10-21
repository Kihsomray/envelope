import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

/** Tracks an element's content width so SVGs can draw text at true pixel size. */
export function useElementWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(1, Math.round(el.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/** True while the referenced element is out of view (scrolled past). */
export function useScrolledPast<T extends Element>() {
  const ref = useRef<T>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: '-64px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, past] as const;
}

export function useDebouncedEffect(effect: () => void, deps: readonly unknown[], delayMs: number) {
  useEffect(() => {
    const t = setTimeout(effect, delayMs);
    return () => clearTimeout(t);
  }, deps);
}
