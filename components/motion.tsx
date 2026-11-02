"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

/**
 * Mouse drag-to-scroll for horizontal rails. Touch already pans natively, so
 * this only takes over for a fine pointer, and it swallows the click that ends
 * a drag so a card doesn't open by accident.
 */
export function useDragScroll<T extends HTMLElement>(externalRef?: RefObject<T | null>) {
  const internalRef = useRef<T | null>(null);
  const ref = externalRef ?? internalRef;
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const end = (node: T) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    node.classList.remove("is-dragging");
    window.setTimeout(() => {
      drag.current.moved = false;
    }, 40);
  };

  const dragProps = {
    onPointerDown(event: ReactPointerEvent<T>) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const node = event.currentTarget;
      drag.current = {
        active: true,
        startX: event.clientX,
        scrollLeft: node.scrollLeft,
        moved: false,
      };
      node.classList.add("is-dragging");
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      const state = drag.current;
      if (!state.active) return;
      const delta = event.clientX - state.startX;
      if (Math.abs(delta) > 5) state.moved = true;
      event.currentTarget.scrollLeft = state.scrollLeft - delta;
    },
    onPointerUp(event: ReactPointerEvent<T>) {
      end(event.currentTarget);
    },
    onPointerCancel(event: ReactPointerEvent<T>) {
      end(event.currentTarget);
    },
    onPointerLeave(event: ReactPointerEvent<T>) {
      end(event.currentTarget);
    },
    onClickCapture(event: ReactMouseEvent<T> | ReactPointerEvent<T>) {
      if (!drag.current.moved) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  return { ref, dragProps };
}

/**
 * Desktop-only custom cursor: an ember dot with a lerped ring that expands and
 * can show a label over anything marked with `data-cursor`.
 * Touch devices and reduced-motion users keep the native pointer.
 */
export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    if (!fine.matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ring = ringRef.current;
    const dot = dotRef.current;
    const label = labelRef.current;
    if (!ring || !dot || !label) return;

    document.body.classList.add("cursor-on");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let frame = 0;
    let visible = false;

    const paint = () => {
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      frame = window.requestAnimationFrame(paint);
    };

    const show = (on: boolean) => {
      if (on === visible) return;
      visible = on;
      ring.style.opacity = on ? "1" : "0";
      dot.style.opacity = on ? "1" : "0";
    };

    const onMove = (event: PointerEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!visible) {
        ringX = mouseX;
        ringY = mouseY;
        show(true);
      }

      const target = event.target instanceof Element ? event.target.closest("[data-cursor]") : null;
      if (target) {
        ring.classList.add("is-active");
        label.textContent = target.getAttribute("data-cursor-label") ?? "";
      } else {
        ring.classList.remove("is-active");
        label.textContent = "";
      }
    };

    const onLeave = () => show(false);
    const onDown = () => ring.classList.add("is-pressed");
    const onUp = () => ring.classList.remove("is-pressed");

    frame = window.requestAnimationFrame(paint);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      document.body.classList.remove("cursor-on");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-ring" style={{ opacity: 0 }} aria-hidden="true">
        <span ref={labelRef} className="cursor-label" />
      </div>
      <div ref={dotRef} className="cursor-dot" style={{ opacity: 0 }} aria-hidden="true" />
    </>
  );
}

export function Grain() {
  return <div className="grain" aria-hidden="true" />;
}

/**
 * Tweens a number so weight readouts morph instead of jumping.
 */
export function useAnimatedNumber(target: number | null, duration = 520) {
  const [display, setDisplay] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);

  if (target === null) return null;
  return Math.round(display);
}
