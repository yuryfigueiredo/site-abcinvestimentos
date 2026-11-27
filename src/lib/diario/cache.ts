import { join, resolve } from 'node:path';
import { parseCalendarDate } from './time';
import type { CacheScope } from './types';

export function diarioCachePath(root: string, date: string, scope: CacheScope): string {
  parseCalendarDate(date, 'cache date');
  if (scope !== 'edition' && scope !== 'simulation') throw new Error('Unknown Diário cache scope');
  const directory = join(resolve(root), '.cache', 'diario');
  return scope === 'simulation' ? join(directory, 'simulations', date) : join(directory, date);
}
