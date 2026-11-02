"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type NumericInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  allowDecimal?: boolean;
};

/** Text input that behaves nicely on iOS: numeric keypad, no spinner, no leading zeros. */
export function NumericInput({
  value,
  onChange,
  placeholder = "",
  ariaLabel,
  className = "input",
  allowDecimal = true,
}: NumericInputProps) {
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);

  return (
    <input
      className={className}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      enterKeyHint="done"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        const pattern = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
        let cleaned = event.target.value.replace(pattern, "");
        if (allowDecimal) cleaned = cleaned.replace(/(\..*)\./g, "$1");
        cleaned = cleaned.slice(0, 6);
        setText(cleaned);
        if (cleaned === "" || cleaned === ".") {
          onChange(null);
        } else {
          const parsed = Number(cleaned);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }
      }}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switchline ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
      data-cursor="link"
    >
      <span className="switchline-track">
        <span className="switchline-thumb" />
      </span>
      <span className="switchline-text">
        <span className="switchline-label">{label}</span>
        {hint ? <span className="switchline-hint">{hint}</span> : null}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      className="seg"
      role="tablist"
      style={{ "--cols": options.length, "--i": index } as CSSProperties}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`segbtn ${value === option.value ? "is-active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
      <span className="seg-indicator" aria-hidden="true" />
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      className="slider"
      style={{ "--fill": `${fill}%` } as CSSProperties}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
