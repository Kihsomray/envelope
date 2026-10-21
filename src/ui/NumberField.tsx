import { useEffect, useState } from 'preact/hooks';
import { parseNumber } from './format';

interface Props {
  readonly id: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly unit: string;
  readonly label: string;
  readonly decimals?: number;
  readonly min?: number;
  readonly max?: number;
  readonly invalid?: boolean;
  readonly describedBy?: string;
}

/**
 * A numeric text field that is pleasant on phones: decimal keypad, no spinner,
 * live updates while typing, and tolerant of partial input like "12." or "".
 * The draft text is kept separately so the caret never jumps while typing.
 */
export function NumberField({ id, value, onChange, unit, label, decimals = 0, min = 0, max = Infinity, invalid, describedBy }: Props) {
  const format = (n: number) => (decimals > 0 ? String(Number(n.toFixed(decimals))) : String(Math.round(n)));
  const [draft, setDraft] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value));
  }, [value, focused]);

  const commit = (text: string) => {
    if (text.trim() === '') return onChange(0);
    const n = parseNumber(text);
    if (n !== null) onChange(Math.min(Math.max(n, min), max));
  };

  return (
    <span class="number-field">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        aria-label={label}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          (e.currentTarget as HTMLInputElement).select();
        }}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        onInput={(e) => {
          const text = (e.currentTarget as HTMLInputElement).value;
          setDraft(text);
          commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
      />
      <span class="unit" aria-hidden="true">
        {unit}
      </span>
    </span>
  );
}
