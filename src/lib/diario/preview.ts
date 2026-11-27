import { educationalTopicContext } from './briefing';
import { buildBcbSnapshot, publicPolicy, sourceReference } from './curate';
import type { CollectedInputs, CurationResult, Edition, NewsItem, Vault } from './types';

function previewHeadline(title: string, subject: string): string {
  const cleaned = title.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const fallback = `Prévia de fato sobre ${subject}`;
  if (!/\p{L}/u.test(cleaned) || /\p{N}|<|>|&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/iu.test(cleaned)) {
    return fallback;
  }
  let headline = cleaned;
  if (headline.length > 240) {
    const sliced = headline.slice(0, 239);
    const boundary = sliced.lastIndexOf(' ');
    headline = sliced.slice(0, boundary > 0 ? boundary : 239).trimEnd();
  }
  if (/(?:^|[\s,;:/–—-])(?:a|o|as|os|de|da|do|das|dos|e|em|no|na|nos|nas|para|por|com|sem|sobre|que|ao|à|aos|às)$/iu.test(headline)) {
    return fallback;
  }
  return headline || fallback;
}

function newsBriefing(items: NewsItem[]): NonNullable<Edition['briefing']> {
  const subjects = [...new Set(items.map((item) => educationalTopicContext(item.topic).subject))].join(', ');
  return {
    whatHappened:
      `A curadoria selecionou fatos relacionados a ${subjects}. Esta prévia reúne títulos e fontes aprovadas para mostrar a estrutura possível da edição. Ela não constitui redação final, não acrescenta interpretação jornalística e não antecipa desdobramentos. O conteúdo permanece educacional e não apresenta recomendação de investimento.`,
    whyItMatters:
      `A leitura educacional oferece contexto para acompanhar ${subjects} com mais critério. Relacionar os fatos selecionados com objetivos, prazo, liquidez e tolerância a oscilações ajuda a organizar o planejamento, sem transformar informação pública em promessa de resultado ou em indicação de compra e venda de ativos.`,
    whatToWatch: [
      'Acompanhe a fonte oficial do fato selecionado e verifique se novas informações confirmam ou alteram o contexto apresentado nesta prévia.',
      'Compare os desdobramentos com as fontes aprovadas e com seu planejamento, sem presumir efeitos individuais ou tomar a prévia como recomendação.',
    ],
  };
}

export function buildSimulationDraft(
  inputs: CollectedInputs,
  result: CurationResult,
  vault: Vault,
  previous: Edition[],
): Edition {
  const selectedByCluster = new Map(result.selection.clusters.map((cluster) => [
    cluster.id,
    result.selection.selectedSources.filter((source) => source.clusterId === cluster.id),
  ]));
  const items = result.selection.clusters.map((cluster, index): NewsItem => {
    const sources = selectedByCluster.get(cluster.id)!;
    const context = educationalTopicContext(cluster.topic);
    return {
      id: `previa-${cluster.topic}-${String.fromCharCode(97 + index)}`,
      topic: cluster.topic,
      headline: previewHeadline(sources[0].title, context.subject),
      summary:
        `A prévia organiza o fato selecionado sobre ${context.subject} com base apenas nos metadados aprovados. O texto não constitui redação final e depende de revisão editorial antes de qualquer publicação.`,
      whyItMatters: context.whyItMatters,
      sourceIds: cluster.sourceIds,
    };
  });
  const event = result.decision.eventId === undefined
    ? undefined
    : vault.calendar.find((candidate) => candidate.id === result.decision.eventId);
  const lesson = result.decision.lessonId === undefined
    ? undefined
    : vault.lessons.find((candidate) => candidate.id === result.decision.lessonId);
  const briefing = result.decision.status === 'morno'
    ? undefined
    : result.briefing ?? newsBriefing(items);

  return {
    schemaVersion: 2,
    id: `diario-${inputs.date}`,
    date: inputs.date,
    generatedAt: inputs.retrievedAt,
    title: 'Prévia estrutural do Diário do Investidor',
    summary:
      'Simulação da estrutura editorial com fatos e fontes aprovadas. Esta prévia não constitui redação final, não foi publicada e não representa recomendação de investimento.',
    snapshot: buildBcbSnapshot(inputs, previous),
    decision: result.decision,
    items,
    ...(lesson === undefined ? {} : { lesson }),
    ...(briefing === undefined ? {} : { briefing }),
    ...(event === undefined ? {} : { event }),
    sources: result.selection.selectedSources.map(sourceReference),
    relatedCalculatorSlug: 'renda-fixa',
    policy: publicPolicy(vault),
    provenance: {
      generator: 'qoder-diario',
      promptVersion: 'diario-simulate',
      disclaimerKey: 'educacional-nao-e-recomendacao',
    },
  };
}
