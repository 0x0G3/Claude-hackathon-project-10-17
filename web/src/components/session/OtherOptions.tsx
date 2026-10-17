import { MatchItem } from '@/types';
import { Button, ConfidenceMark, formatCheckedDate } from '@/components/ui';
import { STATUS_LABEL } from './labels';

/**
 * Listings checked but not in the plan. "Not a fit" items keep their reason so a case worker can
 * override a rule that's wrong (architecture 4.9).
 */
export function OtherOptions({ items, onInclude }: { items: MatchItem[]; onInclude: (id: string) => void }) {
  if (items.length === 0) return null;
  const notFit = items.filter(i => i.status === 'not_a_fit');
  const rest = items.filter(i => i.status !== 'not_a_fit');

  return (
    <details className="panel-soft p-4 text-[14px]">
      <summary className="cursor-pointer font-semibold">
        Also checked: {rest.length} other option{rest.length === 1 ? '' : 's'}, {notFit.length} not a fit
      </summary>
      <ul className="m-0 mt-3 list-none space-y-3 p-0">
        {[...rest, ...notFit].map(item => (
          <li key={item.resource_id} className="border-b border-navy pb-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">{item.name}</span>
              <span className="tag">{STATUS_LABEL[item.status]}</span>
            </div>
            <ConfidenceMark level={item.confidence} checkedOn={formatCheckedDate(item.verified_date)} className="mt-1" />
            {item.checks
              .filter(c => c.outcome !== 'meets')
              .map((c, i) => (
                <div key={i}>
                  <span className="font-semibold">{c.outcome === 'does_not_meet' ? 'Does not meet' : 'Unknown'} · {c.rule}:</span> {c.detail}
                </div>
              ))}
            <Button variant="link" onClick={() => onInclude(item.resource_id)}>
              {item.status === 'not_a_fit' ? 'Override: add to the plan anyway' : 'Add to the plan'}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
