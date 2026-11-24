export interface DiarioSitemapContext {
  hubLastmod?: string;
  materialDates: ReadonlySet<string>;
}

export type DiarioSitemapMetadata =
  | { include: true; lastmod?: string }
  | { include: false };

export function diarioHubLastmod(latestEditionDate: string, observedOn?: string): string {
  if (observedOn === undefined) return latestEditionDate;
  return observedOn > latestEditionDate ? observedOn : latestEditionDate;
}

export function diarioSitemapMetadata(
  pathname: string,
  context: DiarioSitemapContext,
): DiarioSitemapMetadata {
  const dated = /^\/diario-do-investidor\/(\d{4}-\d{2}-\d{2})\/$/u.exec(pathname);
  if (dated) {
    const date = dated[1];
    return context.materialDates.has(date)
      ? { include: true, lastmod: date }
      : { include: false };
  }
  if (pathname === '/diario-do-investidor/') {
    return context.hubLastmod === undefined
      ? { include: true }
      : { include: true, lastmod: context.hubLastmod };
  }
  return { include: true };
}
