import { Blocker } from '@/types';
import { SectionLabel } from '@/components/ui';
import { TRI_LABEL } from './labels';

/** "What's blocking the door" (architecture 4.4). Shown before the matches. */
export function Blockers({ blockers }: { blockers: Blocker[] }) {
  if (blockers.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionLabel>What’s blocking the door</SectionLabel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {blockers.map(b => (
          <article key={b.id} className={`p-4 text-[14px] ${b.has === 'no' ? 'panel' : 'panel-soft'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="m-0 font-sans text-[16px] font-bold">{b.label}</h3>
              <span className={`tag ${b.has === 'no' ? 'tag-dark' : ''}`}>Has it: {TRI_LABEL[b.has]}</span>
            </div>
            <div className="mt-2">
              <span className="font-semibold">Blocks: </span>
              {b.blocks.map(x => x.name).join('; ')}
            </div>
            <div className="mt-1">
              <span className="font-semibold">Unblocks it: </span>
              {b.unblockers.length ? b.unblockers.map(u => `${u.name} (${u.note})`).join('; ') : <span className="not-stated">Nothing in the directory</span>}
            </div>
            {b.unknowns.length > 0 && (
              <ul className="m-0 mt-2 list-outside list-disc space-y-0.5 pl-5">
                {b.unknowns.map(u => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
