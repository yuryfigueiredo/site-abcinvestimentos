import { EVENT_TOPICS } from './curate';
import { parseEditorialBriefing } from './schema';
import type {
  CalendarEvent,
  Edition,
  EditorialBriefing,
  Lesson,
  ReasonCode,
  Topic,
  Vault,
} from './types';

type TopicContext = {
  subject: string;
  whyItMatters: string;
  whatToWatch: string;
};

const TOPIC_CONTEXT: Record<Topic, TopicContext> = {
  juros: {
    subject: 'juros e política monetária',
    whyItMatters:
      'A política monetária influencia as taxas de juros e o preço de mercado de títulos de renda fixa. Entender essa relação ajuda o investidor a acompanhar o ambiente econômico e a revisar seu planejamento com prudência, considerando objetivos, prazo, liquidez e tolerância a oscilações, sem transformar o evento em indicação de compra ou venda.',
    whatToWatch:
      'Observe a evolução dos juros e da comunicação oficial, relacionando as novas informações ao prazo e à liquidez dos seus objetivos sem presumir decisões futuras.',
  },
  inflacao: {
    subject: 'inflação e preços',
    whyItMatters:
      'A inflação afeta o poder de compra e a forma como rendimentos nominais devem ser interpretados. Acompanhar o índice ajuda a distinguir variação de preços de ganho real e a revisar o planejamento com mais critério, sem assumir que um resultado isolado determine o comportamento futuro dos investimentos.',
    whatToWatch:
      'Acompanhe a divulgação oficial da inflação e compare a trajetória dos preços com seus objetivos, sem tratar um único resultado como previsão para os próximos períodos.',
  },
  cambio: {
    subject: 'câmbio e moeda estrangeira',
    whyItMatters:
      'O câmbio pode influenciar preços e compromissos em moeda estrangeira. Entender a exposição existente ajuda a organizar o planejamento com mais critério, considerando objetivos, prazo e tolerância a oscilações, sem presumir que o movimento observado se repetirá ou indicar uma operação específica.',
    whatToWatch:
      'Acompanhe as novas observações cambiais e revise seus compromissos em moeda estrangeira, mantendo a leitura educacional separada de qualquer decisão de investimento.',
  },
  'renda-fixa': {
    subject: 'renda fixa e condições de financiamento',
    whyItMatters:
      'As condições de financiamento e o contexto econômico influenciam o ambiente de renda fixa. A leitura educacional ajuda a relacionar o evento com objetivos, prazo e liquidez, sem afirmar efeitos automáticos sobre um título ou apresentar o acompanhamento como recomendação de aplicação.',
    whatToWatch:
      'Observe os desdobramentos oficiais relacionados à renda fixa e compare as condições publicadas com seus objetivos, sem inferir resultados individuais não divulgados.',
  },
  'bolsa-fiis': {
    subject: 'bolsa e fundos imobiliários',
    whyItMatters:
      'O contexto de bolsa e fundos imobiliários pode influenciar expectativas e a percepção de risco. Acompanhar informações oficiais ajuda a manter o estudo ancorado em fatos, considerando horizonte, diversificação e tolerância a oscilações, sem converter a leitura do dia em recomendação de compra ou venda.',
    whatToWatch:
      'Acompanhe os comunicados oficiais e as informações verificadas sobre bolsa e fundos imobiliários, separando contexto de mercado de decisões individuais de investimento.',
  },
  regulacao: {
    subject: 'regulação e proteção do investidor',
    whyItMatters:
      'Mudanças regulatórias podem alterar regras e procedimentos relevantes para o investidor. Compreender o comunicado oficial ajuda a acompanhar direitos, obrigações e proteções aplicáveis, sem presumir efeitos não publicados ou transformar contexto regulatório em recomendação sobre um ativo específico.',
    whatToWatch:
      'Acompanhe os comunicados do regulador e confira as regras aplicáveis antes de revisar procedimentos, mantendo o estudo baseado em informação oficial e verificável.',
  },
};

const REASON_LABELS: Record<ReasonCode, string> = {
  'calendar-event': 'evento do calendário aprovado',
  'dollar-trigger': 'movimento cambial acima do limiar editorial',
  'official-news': 'notícia oficial selecionada',
  'corroborated-media-news': 'notícia corroborada por veículos independentes',
  'monday-lesson': 'lição aprovada para a cadência semanal',
  'no-substantive-delta': 'ausência de alteração substantiva',
  'history-unavailable': 'histórico indisponível para a curadoria',
};

function approvedEvent(edition: Edition, vault: Vault): { event: CalendarEvent; topic: Topic } {
  const eventId = edition.decision.eventId;
  const event = vault.calendar.find((candidate) => candidate.id === eventId);
  if (!event) throw new Error(`Deterministic briefing requires approved calendar event "${eventId}"`);
  const kind = vault.thresholds.events.find((candidate) => event.id.startsWith(`${candidate}-`));
  const topic = kind === undefined ? undefined : EVENT_TOPICS[kind];
  if (!topic) throw new Error(`Approved calendar event "${event.id}" has no editorial topic`);
  return { event, topic };
}

function approvedLesson(edition: Edition, vault: Vault): Lesson {
  const lesson = vault.lessons.find((candidate) => candidate.id === edition.decision.lessonId);
  if (!lesson) throw new Error(`Deterministic briefing requires approved lesson "${edition.decision.lessonId}"`);
  return lesson;
}

function boundedExcerpt(value: string, maximum: number): string {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (normalized.length <= maximum) return normalized;
  const sliced = normalized.slice(0, maximum - 1);
  const boundary = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, boundary > 0 ? boundary : maximum - 1).trimEnd()}…`;
}

function eventBriefing(edition: Edition, vault: Vault): EditorialBriefing {
  const { event, topic } = approvedEvent(edition, vault);
  const context = TOPIC_CONTEXT[topic];
  const titleIsProseSafe = !/\p{N}/u.test(event.title) &&
    !/<|>|&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/iu.test(event.title);
  const eventReference = titleIsProseSafe ? `"${event.title}"` : `um evento sobre ${context.subject}`;
  return {
    whatHappened:
      `O calendário aprovado registra ${eventReference} nesta data. A curadoria usa o evento como fato central da edição e mantém a leitura restrita ao título, à data e à fonte oficial cadastrados no cofre. O resultado não é presumido: o acompanhamento parte do comunicado oficial e da evidência que vier a ser publicada. O tema ${context.subject} organiza a explicação, sem acrescentar números, previsões ou recomendações de investimento.`,
    whyItMatters: context.whyItMatters,
    whatToWatch: [
      'Acompanhe a fonte oficial do evento e compare o conteúdo divulgado com o registro aprovado, sem presumir um resultado antes da publicação.',
      context.whatToWatch,
    ],
  };
}

function lessonBriefing(edition: Edition, vault: Vault): EditorialBriefing {
  const lesson = approvedLesson(edition, vault);
  return {
    whatHappened:
      `A curadoria selecionou a lição aprovada "${lesson.title}" para a cadência semanal. O conteúdo é educacional e foi escolhido pelo cofre para um dia sem notícias, evento ou gatilho cambial. ${boundedExcerpt(lesson.body, 900)} A leitura não altera a decisão determinística nem apresenta os conceitos como indicação de compra ou venda.`,
    whyItMatters:
      'Uma lição aprovada oferece contexto para organizar decisões financeiras com mais critério. O conteúdo educacional aproxima conceitos do planejamento cotidiano, mas não substitui a análise individual de objetivos, prazo, liquidez e tolerância a risco. Releia o material relacionado e use o estudo como apoio, sem tratá-lo como promessa de resultado ou recomendação de investimento.',
    whatToWatch: [
      'Releia a lição desta edição e relacione seus conceitos com o seu planejamento, considerando objetivos, prazo, liquidez e tolerância a risco.',
      'Use o guia relacionado para aprofundar o estudo e compare informações antes de tomar decisões, sem tratar o conteúdo educacional como recomendação.',
    ],
  };
}

function dollarBriefing(edition: Edition): EditorialBriefing {
  const change = edition.snapshot.dollarChangePct;
  const movement = change !== null && change > 0
    ? 'alta'
    : change !== null && change < 0
      ? 'baixa'
      : 'movimento relevante';
  return {
    whatHappened:
      `O fechamento do dólar registrou ${movement}. A variação superou o limiar editorial adotado pela curadoria e tornou o câmbio o fato central da edição. A comparação usa a observação anterior registrada no snapshot, sem acrescentar valores à prosa. O painel factual preserva a medição e a data, enquanto esta leitura explica o contexto sem prever novos movimentos ou recomendar investimentos.`,
    whyItMatters:
      'Movimentos cambiais podem influenciar preços e compromissos em moeda estrangeira, além de afetar expectativas para a inflação e os juros. Para o investidor, entender essa relação ajuda a revisar o planejamento com mais critério, considerando objetivos, prazo e exposição ao risco. A variação registrada é educacional e não indica que o mesmo movimento continuará.',
    whatToWatch: [
      'Acompanhe as novas observações do câmbio e compare a direção do movimento com o registro apresentado no painel factual.',
      'Revise compromissos em moeda estrangeira e o impacto educacional no planejamento, sem assumir que a variação atual se repetirá.',
    ],
  };
}

function conservativeBriefing(edition: Edition): EditorialBriefing {
  const reasons = edition.decision.reasonCodes.map((code) => REASON_LABELS[code]);
  const reasonText = reasons.length > 0 ? reasons.join(', ') : 'os motivos registrados pela curadoria';
  return {
    whatHappened:
      `A curadoria determinística marcou a edição como material com o título "${edition.title}". Os motivos registrados são ${reasonText}. O briefing se limita a esses elementos aprovados e ao snapshot factual, sem criar notícias, números, previsões ou recomendações de investimento. O acompanhamento deve permanecer ancorado nas fontes e nos dados desta edição.`,
    whyItMatters:
      'A leitura determinística organiza o contexto aprovado sem acrescentar interpretações livres ao fato que justificou a edição. Relacionar o título, os motivos e o snapshot ajuda o investidor a acompanhar a informação com mais critério, considerando seus objetivos e sua tolerância a risco. O conteúdo permanece educacional e não representa promessa de resultado ou indicação de compra e venda de ativos.',
    whatToWatch: [
      'Acompanhe os próximos comunicados oficiais e verifique se novas informações alteram o contexto apresentado nesta edição.',
      'Observe os desdobramentos relacionados ao tema e compare as fontes aprovadas antes de revisar o planejamento.',
    ],
  };
}

export function buildDeterministicBriefing(edition: Edition, vault: Vault): EditorialBriefing {
  if (edition.decision.status !== 'material') {
    throw new Error('Deterministic briefing is forbidden for quiet editions');
  }
  if (edition.decision.newsClusterIds.length > 0 || edition.items.length > 0) {
    throw new Error('Deterministic briefing is forbidden for news editions');
  }

  const briefing = edition.decision.eventId !== undefined
    ? eventBriefing(edition, vault)
    : edition.decision.lessonId !== undefined
      ? lessonBriefing(edition, vault)
      : edition.decision.reasonCodes.includes('dollar-trigger')
        ? dollarBriefing(edition)
        : conservativeBriefing(edition);
  return parseEditorialBriefing(briefing);
}
