import type { ReactNode } from 'react';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

const COPY: Record<ConfidenceLevel, { label: string; hint: string }> = {
  high: { label: 'Checked', hint: 'High confidence' },
  medium: { label: 'Call to confirm', hint: 'Medium confidence' },
  low: { label: 'Unsure', hint: 'Low confidence. Never the main door.' },
};

/** Normalizes the seed list's free-text confidence to one of the three marks. */
export function toConfidence(value: string | null | undefined): ConfidenceLevel {
  return value === 'high' || value === 'medium' ? value : 'low';
}

/**
 * Filled square = checked · half-filled = call to confirm · dashed outline = unsure.
 * Shape carries the meaning, so it survives black-and-white printing and color blindness.
 */
export function ConfidenceMark({
  level,
  checkedOn,
  showLabel = true,
  className = '',
}: {
  level: ConfidenceLevel;
  /** e.g. "October 13". Shown after the label. */
  checkedOn?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  const { label, hint } = COPY[level];
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${className}`} title={hint}>
      <span className={`mark mark-${level}`} aria-hidden="true" />
      {showLabel ? (
        <span>
          {label}
          {checkedOn ? ` · ${checkedOn}` : ''}
        </span>
      ) : (
        <span className="sr-only">{hint}</span>
      )}
    </span>
  );
}

/** Use for any field the listing doesn't state. Never fill the gap with a guess. */
export function NotStated({ children = 'Not stated by source' }: { children?: ReactNode }) {
  return <span className="not-stated">{children}</span>;
}

/** Formats "2026-10-13" as "October 13" without timezone drift. */
export function formatCheckedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`;
}
