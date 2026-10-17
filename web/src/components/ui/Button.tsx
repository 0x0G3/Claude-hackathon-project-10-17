import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type CommonProps = {
  /** One primary per screen. Everything that isn't primary or secondary is a link. */
  variant?: Variant;
  /** sm 44px (dense staff rows) · md 58px phone and staff · lg 64px desktop · xl 68px Make it easier */
  size?: Size;
  /** Adds the → that says "this moves you on". */
  arrow?: boolean;
  /** Full width. */
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };
type LinkProps = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { href: string };

export function buttonClass({ variant = 'primary', size = 'md', block = false, className = '' }: Partial<CommonProps> = {}) {
  if (variant === 'link') return ['btn-link', className].filter(Boolean).join(' ');
  return [
    'btn',
    variant === 'primary' ? 'btn-primary' : 'btn-secondary',
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    size === 'xl' && 'btn-xl',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function Content({ children, arrow }: { children: ReactNode; arrow?: boolean }) {
  return (
    <>
      <span>{children}</span>
      {arrow && <span aria-hidden="true">→</span>}
    </>
  );
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, arrow, block, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, block, className });

  if (typeof rest.href === 'string') {
    const { href, ...anchor } = rest as Omit<LinkProps, keyof CommonProps>;
    const internal = href.startsWith('/');
    return internal ? (
      <Link href={href} className={cls} {...anchor}>
        <Content arrow={arrow}>{children}</Content>
      </Link>
    ) : (
      <a href={href} className={cls} {...anchor}>
        <Content arrow={arrow}>{children}</Content>
      </a>
    );
  }

  const { type = 'button', ...button } = rest as Omit<ButtonProps, keyof CommonProps>;
  return (
    <button type={type} className={cls} {...button}>
      <Content arrow={arrow}>{children}</Content>
    </button>
  );
}
