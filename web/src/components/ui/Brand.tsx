import type { ReactNode } from 'react';

/** Yellow help strip. Sits at the top of every client screen, as on IHH's site. */
export function HelpStrip({ size = 'md' }: { size?: 'md' | 'xl' }) {
  const big = size === 'xl';
  return (
    <div
      role="note"
      aria-label="Get help now"
      className={`bg-accent text-on-accent px-gutter ${big ? 'py-2.5 text-[17px] leading-snug' : 'py-2 text-[13px] leading-snug'}`}
    >
      <div className="mx-auto max-w-content">
        In danger? Call{' '}
        <a href="tel:911" className="font-bold">
          9-1-1
        </a>
        {big ? <br /> : ' · '}
        Questions? Dial{' '}
        <a href="tel:211" className="font-bold">
          2-1-1
        </a>
      </div>
    </div>
  );
}

/** Navy top bar. Logo always top left; the right side holds the product label or staff tabs. */
export function TopBar({ label = 'Next Door', children }: { label?: string; children?: ReactNode }) {
  return (
    <header className="on-dark bg-dark">
      <div className="mx-auto flex min-h-16 max-w-content flex-wrap items-center gap-x-6 gap-y-2 px-gutter py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG, no optimization needed */}
        <img src="/brand/ihh-logo-full.svg" alt="Illumination Health + Home" width={142} height={24} className="h-6 w-auto" />
        <span className="eyebrow basis-full sm:basis-auto sm:border-l sm:border-white sm:pl-4">{label}</span>
        {children && <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto sm:w-auto">{children}</div>}
      </div>
    </header>
  );
}

/** Uppercase overline above a heading. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow m-0 ${className}`}>{children}</p>;
}

/** Section label with the 2px navy rule under it. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`eyebrow rule m-0 font-sans ${className}`}>{children}</h2>;
}
