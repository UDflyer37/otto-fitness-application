"use client";

import { useEffect, useMemo, useState } from "react";
import { formatWeight } from "@/lib/format";
import { barTotal, plateBreakdown } from "@/lib/plates";
import { MinusIcon, PlusIcon, ResetIcon } from "./Icons";
import { PlateStack } from "./PlateStack";
import { useAnimatedNumber } from "./motion";

/**
 * Bottom drawer with the target weight and a live plate stepper, so the
 * calculator is one tap away from any set without leaving the workout.
 */
export function PlateDrawer({
  open,
  title,
  target,
  barWeight,
  plates,
  onClose,
}: {
  open: boolean;
  title: string;
  target: number | null;
  barWeight: number;
  plates: number[];
  onClose: () => void;
}) {
  const available = useMemo(() => [...plates].sort((a, b) => b - a), [plates]);
  const breakdown = useMemo(
    () => (target !== null ? plateBreakdown(target, barWeight, available) : null),
    [target, barWeight, available],
  );

  const [counts, setCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<number, number> = {};
    for (const load of breakdown?.loads ?? []) next[load.plate] = load.count;
    setCounts(next);
  }, [open, breakdown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const total = barTotal(counts, barWeight, available);
  const animated = useAnimatedNumber(total);
  const loads = available
    .filter((plate) => (counts[plate] ?? 0) > 0)
    .map((plate) => ({ plate, count: counts[plate] }));

  if (!open) return null;

  const adjust = (plate: number, delta: number) => {
    setCounts((current) => ({
      ...current,
      [plate]: Math.max(0, Math.min(10, (current[plate] ?? 0) + delta)),
    }));
  };

  const reset = () => {
    const next: Record<number, number> = {};
    for (const load of breakdown?.loads ?? []) next[load.plate] = load.count;
    setCounts(next);
  };

  return (
    <div className="drawer-wrap">
      <button type="button" className="drawer-scrim" aria-label="Close plate calculator" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={`Plates for ${title}`}>
        <span className="drawer-grab" aria-hidden="true" />

        <div className="drawer-head">
          <div>
            <span className="kicker">Plates · {title}</span>
            <p className="drawer-value">
              {formatWeight(animated ?? total)}
              <small>lb</small>
            </p>
          </div>
          <div className="drawer-head-right">
            {target !== null ? (
              <span className="drawer-target">
                target <b>{formatWeight(target)}</b>
              </span>
            ) : null}
            <button type="button" className="roundbtn" onClick={reset} aria-label="Reset to the planned load">
              <ResetIcon size={15} />
            </button>
          </div>
        </div>

        <div className="drawer-art">
          <PlateStack loads={loads} />
        </div>

        <div className="drawer-chips">
          {loads.length ? (
            loads.map((load) => (
              <span key={load.plate} className="chip">
                {load.count} × {formatWeight(load.plate)}
              </span>
            ))
          ) : (
            <span className="chip chip--ghost">empty bar</span>
          )}
          <span className="chip chip--muted">per side</span>
        </div>

        <div className="drawer-steps">
          {available.map((plate) => (
            <div key={plate} className="dstep">
              <span className="dstep-label">{formatWeight(plate)}</span>
              <div className="dstep-controls">
                <button
                  type="button"
                  className="dstep-btn"
                  aria-label={`Remove a ${plate} pound plate`}
                  onClick={() => adjust(plate, -1)}
                  disabled={!counts[plate]}
                >
                  <MinusIcon size={14} />
                </button>
                <span className="dstep-count">{counts[plate] ?? 0}</span>
                <button
                  type="button"
                  className="dstep-btn"
                  aria-label={`Add a ${plate} pound plate`}
                  onClick={() => adjust(plate, 1)}
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className={`drawer-note ${breakdown && breakdown.short > 0 ? "is-warn" : ""}`}>
          {target === null
            ? "No percentage for this movement. Count plates as you load them."
            : breakdown && breakdown.short > 0
              ? `${formatWeight(target)} lb is ${formatWeight(breakdown.short)} lb short of this rack. Closest load: ${formatWeight(breakdown.achieved)} lb.`
              : `${formatWeight(target)} lb sits on the bar at ${formatWeight(breakdown?.achieved ?? target)} lb with your rack.`}
        </p>
      </div>
    </div>
  );
}
