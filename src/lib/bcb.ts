import { isCalendarDate } from './diario/time';
import type { BcbObservation } from './diario/types';

export type { BcbObservation } from './diario/types';

const BCB_HOST = 'api.bcb.gov.br';
const BCB_PORT = '443';
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 1_000_000;
const TIMEOUT_MS = 3500;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007F-\u009F]/u;
const INVALID_URL_CHARACTER = /[<>"\\]/u;

function isTrustedBcbUrl(value: string): URL | null {
  if (value.length > 2048 || CONTROL_OR_SPACE.test(value) || INVALID_URL_CHARACTER.test(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== BCB_HOST ||
      (url.port || BCB_PORT) !== BCB_PORT ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

async function readBoundedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('BCB response exceeds the maximum size');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('BCB response exceeds the maximum size');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
  }
  return chunks.join('');
}

async function fetchBcbJson(serieCode: number, count: number, fetchImpl: typeof fetch): Promise<unknown> {
  if (!Number.isInteger(serieCode) || serieCode < 1) throw new Error('BCB series code must be a positive integer');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('BCB observation count must be between 1 and 100');

  let url = new URL(
    `https://${BCB_HOST}/dados/serie/bcdata.sgs.${serieCode}/dados/ultimos/${count}?formato=json`,
  );
  const visited = new Set([url.href]);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    for (let hops = 0; ; hops += 1) {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        redirect: 'manual',
      });
      if (REDIRECT_STATUSES.has(response.status)) {
        if (hops >= MAX_REDIRECTS) return null;
        const location = response.headers.get('location');
        if (!location || location.length > 2048 || CONTROL_OR_SPACE.test(location) || INVALID_URL_CHARACTER.test(location)) {
          return null;
        }
        let target: URL;
        try {
          target = new URL(location, url);
        } catch {
          return null;
        }
        if (!isTrustedBcbUrl(target.href) || visited.has(target.href)) return null;
        visited.add(target.href);
        url = target;
        continue;
      }
      if (!response.ok) return null;
      return JSON.parse(await readBoundedText(response)) as unknown;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseBcbDate(value: string): string | null {
  if (typeof value !== 'string') return null;
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = brazilian
    ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : null;
  return iso !== null && isCalendarDate(iso) ? iso : null;
}

function parseObservation(value: unknown): BcbObservation | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  if (typeof fields.data !== 'string' || (typeof fields.valor !== 'string' && typeof fields.valor !== 'number')) {
    return null;
  }
  const date = parseBcbDate(fields.data);
  const rawValue = String(fields.valor).trim();
  if (!date || !rawValue) return null;
  const parsed = Number(rawValue.replace(',', '.'));
  return Number.isFinite(parsed) ? { value: parsed, date } : null;
}

export async function fetchBcbRecentValues(
  serieCode: number,
  count: number,
  fetchImpl: typeof fetch = fetch,
): Promise<BcbObservation[]> {
  const data = await fetchBcbJson(serieCode, count, fetchImpl);
  if (!Array.isArray(data)) return [];

  const byDate = new Map<string, BcbObservation>();
  for (const entry of data) {
    const observation = parseObservation(entry);
    if (observation && !byDate.has(observation.date)) byDate.set(observation.date, observation);
  }
  return [...byDate.values()].sort((left, right) => right.date.localeCompare(left.date)).slice(0, count);
}

export async function fetchBcbLastValue(
  serieCode: number,
  fetchImpl: typeof fetch = fetch,
): Promise<BcbObservation | null> {
  return (await fetchBcbRecentValues(serieCode, 1, fetchImpl))[0] ?? null;
}

export function latestRealizedDate(
  observations: Array<BcbObservation | null>,
  now: Date = new Date(),
): string | null {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
  const today = now.toISOString().slice(0, 10);
  const latest = observations
    .map((observation) => parseBcbDate(observation?.date ?? ''))
    .filter((date): date is string => date !== null && date <= today)
    .sort()
    .at(-1);
  if (!latest) return null;
  const [year, month, day] = latest.split('-');
  return `${day}/${month}/${year}`;
}
