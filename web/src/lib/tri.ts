import { Tri } from '@/types';

/** Has at least one of two things: yes if either is yes, no only if both are no. */
export function either(a: Tri, b: Tri): Tri {
  if (a === 'yes' || b === 'yes') return 'yes';
  return a === 'no' && b === 'no' ? 'no' : 'unknown';
}
