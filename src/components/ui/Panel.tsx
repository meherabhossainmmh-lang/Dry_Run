import type { ReactNode } from 'react';

interface PanelProps {
  /** Instrument name. Rendered verbatim as the panel's <h2>. */
  title: string;
  /** Right-hand header slot — status, counts, badges. */
  meta?: ReactNode;
  /** Reserved for the heaviest-weighted instrument on the rack. */
  accent?: boolean;
  /** Power-on stagger, ms. */
  delay?: number;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * One faceplate for every instrument on the rack: hairline bezel, lit top edge,
 * display-face title. Keeping the chrome here is what lets each panel's file be
 * only its own logic.
 */
export default function Panel({
  title,
  meta,
  accent = false,
  delay = 0,
  className = '',
  bodyClassName = '',
  children,
}: PanelProps) {
  return (
    <section
      className={`panel rise p-3 ${accent ? 'panel-flare' : ''} ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">{title}</h2>
        {meta}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
