"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useApp } from "@/lib/state";
import { formatWeight } from "@/lib/format";
import { barTotal, plateBreakdown, roundToPlate, STANDARD_PLATES } from "@/lib/plates";
import type { Lift } from "@/lib/types";
import { MinusIcon, PlusIcon } from "./Icons";
import { Field, NumericInput, Segmented, Slider, Toggle } from "./ui";
import { PlateStack } from "./PlateStack";
import { useAnimatedNumber } from "./motion";

type Mode = "find" | "bar";

const PERCENT_MIN = 40;
const PERCENT_MAX = 105;
const GLYPH: Record<number, { width: number; height: number }> = {
  45: { width: 19, height: 44 },
  35: { width: 17, height: 40 },
  25: { width: 15, height: 35 },
  10: { width: 12, height: 29 },
  5: { width: 10, height: 25 },
  2.5: { width: 8, height: 21 },
};

const MAX_CHIPS: { lift: Lift; label: string }[] = [
  { lift: "squat", label: "Squat" },
  { lift: "bench", label: "Bench" },
  { lift: "deadlift", label: "Deadlift" },
  { lift: "press", label: "Press" },
];

export function PlatesView() {
  const { settings, updateSettings, setMax } = useApp();
  const [mode, setMode] = useState<Mode>("find");
  const [trainingMax, setTrainingMax] = useState<number | null>(null);
  const [percent, setPercent] = useState(80);
  const [counts, setCounts] = useState<Record<number, number>>({});

  const base = trainingMax
    ? settings.workingMax
      ? Math.round(trainingMax * 0.9)
      : trainingMax
    : null;
  // With the 90% switch on the working max is the load, so there is no
  // percentage left to apply and the slider is hidden.
  const target = base
    ? roundToPlate(settings.workingMax ? base : (base * percent) / 100)
    : null;

  const breakdown = useMemo(
    () => (target !== null ? plateBreakdown(target, settings.barWeight, settings.plates) : null),
    [target, settings.barWeight, settings.plates],
  );

  const platesOnBar = useMemo(
    () => STANDARD_PLATES.filter((plate) => settings.plates.includes(plate)),
    [settings.plates],
  );

  const total = useMemo(
    () => barTotal(counts, settings.barWeight, platesOnBar),
    [counts, settings.barWeight, platesOnBar],
  );

  const currentLoads = useMemo(
    () =>
      platesOnBar
        .filter((plate) => (counts[plate] ?? 0) > 0)
        .map((plate) => ({ plate, count: counts[plate] })),
    [counts, platesOnBar],
  );

  const animatedAchieved = useAnimatedNumber(breakdown?.achieved ?? null);
  const animatedTotal = useAnimatedNumber(total);

  const togglePlate = (plate: number) => {
    const has = settings.plates.includes(plate);
    const next = has
      ? settings.plates.filter((item) => item !== plate)
      : [...settings.plates, plate].sort((a, b) => b - a);
    updateSettings({ plates: next });
    if (has) setCounts((current) => ({ ...current, [plate]: 0 }));
  };

  const adjust = (plate: number, delta: number) => {
    setCounts((current) => {
      const next = Math.max(0, Math.min(10, (current[plate] ?? 0) + delta));
      return { ...current, [plate]: next };
    });
  };

  const ticks = Array.from({ length: 14 }, (_, index) => PERCENT_MIN + index * 5);

  // The rack is identical in both modes. It sits after the training max when
  // finding a load, because the bar weight changes far less often.
  const equipment = (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Equipment</h2>
        <span className="section-aside">{platesOnBar.length} weights available</span>
      </div>

      <label className="equip-bar">
        <span className="field-label">Bar weight</span>
        <div className="input-row">
          <NumericInput
            value={settings.barWeight}
            onChange={(value) => updateSettings({ barWeight: value ?? 0 })}
            ariaLabel="Bar weight in pounds"
            allowDecimal={false}
          />
          <span className="unit">lb</span>
        </div>
      </label>

      <div className="rack">
        {STANDARD_PLATES.map((plate) => {
          const on = settings.plates.includes(plate);
          const size = GLYPH[plate];
          return (
            <button
              key={plate}
              type="button"
              className={`rackbtn ${on ? "is-on" : ""}`}
              aria-pressed={on}
              aria-label={`${formatWeight(plate)} pound plates ${on ? "in" : "out of"} your rack`}
              onClick={() => togglePlate(plate)}
              data-cursor="link"
            >
              <span
                className="rackbtn-glyph"
                style={{ "--w": `${size.width}px`, height: `${size.height}px` } as CSSProperties}
              />
              <span className="rackbtn-num">{formatWeight(plate)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <>
      <section className="section" style={{ paddingTop: 10 }}>
        <span className="kicker">
          <span className="kicker-index">03</span> Plate math
        </span>
        <h1 className="type-title">Load the bar.</h1>
      </section>

      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: "find", label: "Find plates" },
          { value: "bar", label: "On the bar" },
        ]}
      />

      {mode === "find" ? (
        <>
          <section className="section">
            <Field label="Training max">
              <div className="maxfield-value">
                <NumericInput
                  className="maxfield-input"
                  value={trainingMax}
                  onChange={setTrainingMax}
                  ariaLabel="Training max in pounds"
                />
                <span className="maxfield-unit">lb</span>
              </div>
            </Field>

            <div className="actions">
              {MAX_CHIPS.map(({ lift, label }) => {
                const value = settings.maxes[lift];
                if (!value) return null;
                return (
                  <button
                    key={lift}
                    type="button"
                    className="textaction"
                    onClick={() => setTrainingMax(value)}
                  >
                    Use {label} {formatWeight(value)}
                  </button>
                );
              })}
            </div>

            {settings.workingMax ? null : (
              <div>
                <div className="slider-head">
                  <span className="field-label">Percent of max</span>
                  <span className="slider-value">{percent}%</span>
                </div>
                <Slider
                  value={percent}
                  min={PERCENT_MIN}
                  max={PERCENT_MAX}
                  step={5}
                  onChange={setPercent}
                  ariaLabel="Percent of max"
                />
                <div className="slider-ticks" aria-hidden="true">
                  {ticks.map((tick) => (
                    <span key={tick} className={tick % 20 === 0 ? "is-major" : ""} />
                  ))}
                </div>
              </div>
            )}

            <Toggle
              checked={settings.workingMax}
              onChange={(checked) => updateSettings({ workingMax: checked })}
              label="Use 90% working max"
              hint={base ? `Calculating from ${formatWeight(base)} lb` : "Enter a max to calculate."}
            />
          </section>

          {equipment}

          <section className="readout">
            <div className="readout-top">
              <div>
                <span className="kicker">On the bar</span>
                <p className="readout-value">
                  {breakdown ? formatWeight(animatedAchieved ?? breakdown.achieved) : "0"}
                  <small>lb</small>
                </p>
              </div>
              <div className="readout-aside">
                <span className="kicker">Per side</span>
                <span className="mono" style={{ fontSize: 14 }}>
                  {breakdown ? `${formatWeight(breakdown.loadedPerSide)} lb` : "0 lb"}
                </span>
              </div>
            </div>

            <div style={{ height: 162 }}>
              {breakdown ? (
                <PlateStack loads={breakdown.loads} />
              ) : (
                <div className="stack-empty">enter a max to load the bar</div>
              )}
            </div>

            <div className="platechips">
              <span className="platechips-label">Each side</span>
              {breakdown && breakdown.loads.length ? (
                breakdown.loads.map((load) => (
                  <span key={load.plate} className="platechip">
                    {formatWeight(load.plate)} <b>×{load.count}</b>
                  </span>
                ))
              ) : (
                <span className="platechip platechip--soft">
                  {breakdown ? "empty bar" : "no load yet"}
                </span>
              )}
            </div>

            <p className={`readout-caption ${breakdown && breakdown.short > 0 ? "readout-warn" : ""}`}>
              {breakdown && target !== null ? (
                breakdown.short > 0 ? (
                  <>
                    Target was {formatWeight(target)} lb. Closest your rack can load is{" "}
                    {formatWeight(breakdown.achieved)} lb. Short by {formatWeight(breakdown.short)} lb.
                  </>
                ) : settings.workingMax ? (
                  <>
                    Working from 90% of {formatWeight(trainingMax ?? 0)} lb: {formatWeight(base ?? 0)} lb,
                    rounded to {formatWeight(target)} lb, and your rack hits it exactly.
                  </>
                ) : (
                  <>
                    {percent}% of {formatWeight(base ?? 0)} lb rounds to {formatWeight(target)} lb, and
                    your rack hits it exactly.
                  </>
                )
              ) : (
                <>Set a training max and the bar fills in for you.</>
              )}
            </p>

            {trainingMax ? (
              <div className="actions">
                {MAX_CHIPS.map(({ lift, label }) => (
                  <button
                    key={lift}
                    type="button"
                    className="textaction"
                    onClick={() => setMax(lift, trainingMax)}
                  >
                    Save {formatWeight(trainingMax)} as {label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <>
          {equipment}

          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Plates per side</h2>
              <button
                type="button"
                className="linkbtn"
                onClick={() => setCounts({})}
                disabled={!Object.values(counts).some(Boolean)}
              >
                Clear
              </button>
            </div>

            {platesOnBar.length ? (
              <div className="stepper-list">
                {platesOnBar.map((plate) => (
                  <div key={plate} className="stepper">
                    <span className="stepper-label">
                      {formatWeight(plate)} <span className="unit">lb</span>
                    </span>
                    <div className="stepper-controls">
                      <button
                        type="button"
                        className="stepbtn"
                        aria-label={`Remove one ${plate} pound plate`}
                        onClick={() => adjust(plate, -1)}
                        disabled={!counts[plate]}
                      >
                        <MinusIcon size={16} />
                      </button>
                      <span className="stepcount">{counts[plate] ?? 0}</span>
                      <button
                        type="button"
                        className="stepbtn"
                        aria-label={`Add one ${plate} pound plate`}
                        onClick={() => adjust(plate, 1)}
                      >
                        <PlusIcon size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <p className="empty-title">Your rack is empty</p>
                <p className="empty-text">Add at least one plate above to start counting.</p>
              </div>
            )}
          </section>

          <section className="readout">
            <div className="readout-top">
              <div>
                <span className="kicker">Total on the bar</span>
                <p className="readout-value">
                  {formatWeight(animatedTotal ?? total)}
                  <small>lb</small>
                </p>
              </div>
              <div className="readout-aside">
                <span className="kicker">Per side</span>
                <span className="mono" style={{ fontSize: 14 }}>
                  {formatWeight((total - settings.barWeight) / 2)} lb
                </span>
              </div>
            </div>

            <div style={{ height: 162 }}>
              {currentLoads.length ? (
                <PlateStack loads={currentLoads} />
              ) : (
                <div className="stack-empty">empty bar · {formatWeight(settings.barWeight)} lb</div>
              )}
            </div>

            <p className="readout-caption">
              Bar {formatWeight(settings.barWeight)} lb · {platesOnBar.length} weights available in your rack.
            </p>
          </section>
        </>
      )}
    </>
  );
}
