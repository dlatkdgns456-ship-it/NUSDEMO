import { callAI } from './aiClient';
import { searchNewsSources } from './newsService';
import { searchAssemblySources } from './assemblyService';
import { searchAssemblySpeechSources } from './assemblySpeechService';
import { searchYouTubeSources } from './youtubeService';
import { safeParseJSON } from '../utils/jsonParser';

import {
  extractInfoPrompt,
  searchPastStatementsPrompt,
  compareStatementsPrompt,
  generateQuestionsPrompt,
  dnaAnalysisPrompt,
} from '../prompts/factcheckPrompts';

const KOREAN_STOP_WORDS = new Set([
  '대한',
  '관련',
  '이번',
  '오늘',
  '발언',
  '기사',
  '문제',
  '논란',
  '입장',
  '정책',
  '분야',
  '국내',
  '국외',
  '우리',
  '대해',
  '대해서',
  '통해',
  '위해',
  '있는',
  '없는',
  '했다',
  '한다',
  '것',
  '등',
]);

const NEWS_LIMIT_CONFIG = {
  standard: {
    displayLimit: 8,
    promptLimit: 5,
    perQueryDisplay: 5,
  },
  deep: {
    displayLimit: 15,
    promptLimit: 10,
    perQueryDisplay: 7,
  },
};

function getNewsLimitConfig(searchDepth) {
  if (searchDepth === 'deep') {
    return NEWS_LIMIT_CONFIG.deep;
  }

  return NEWS_LIMIT_CONFIG.standard;
}

function parseAIJsonSafely(response, fallback, label) {
  try {
    const parsed = safeParseJSON(response);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`${label} 결과가 비어 있습니다.`);
    }

    return parsed;
  } catch (error) {
    console.warn(`[${label} JSON 파싱 실패]`, error);
    return fallback;
  }
}

function cleanSearchText(value) {
  return String(value || '')
    .replace(/[“”"']/g, ' ')
    .replace(/[^\w가-힣\s·.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDisplayText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuery(value) {
  return cleanSearchText(value)
    .replace(/\b3y\b|\b5y\b|\b10y\b|\ball\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueList(items) {
  const seen = new Set();

  return items
    .map((item) => normalizeQuery(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function splitTerms(value) {
  return cleanSearchText(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .filter((term) => !KOREAN_STOP_WORDS.has(term));
}

function getKeywordTerms(entities, inputText) {
  const topicTerms = splitTerms(entities?.topic || '');
  const keywordTerms = Array.isArray(entities?.keywords)
    ? entities.keywords.flatMap((keyword) => splitTerms(keyword))
    : [];
  const fallbackTerms = splitTerms(inputText).slice(0, 8);

  return uniqueList([
    ...topicTerms,
    ...keywordTerms,
    ...fallbackTerms,
  ]);
}

function parseCustomSearchRange(searchRange) {
  const value = String(searchRange || '');

  if (!value.startsWith('custom:')) {
    return null;
  }

  const [, startDate = '', endDate = ''] = value.split(':');

  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (start > end) {
    return null;
  }

  return {
    startDate,
    endDate,
    start,
    end,
  };
}

function getRangeLabel(searchRange) {
  const customRange = parseCustomSearchRange(searchRange);

  if (customRange) {
    return `${customRange.startDate} ~ ${customRange.endDate}`;
  }

  if (searchRange === '3y') return '최근 3년';
  if (searchRange === '5y') return '최근 5년';
  if (searchRange === '10y') return '최근 10년';
  if (searchRange === 'all') return '전체 기간';
  if (searchRange === 'custom') return '직접 선택 기간';

  return '최근 기간';
}

function getRangeYears(searchRange) {
  if (searchRange === '3y') return 3;
  if (searchRange === '5y') return 5;
  if (searchRange === '10y') return 10;
  return null;
}

function parseNewsPubDate(pubDate) {
  if (!pubDate) {
    return null;
  }

  const parsed = new Date(pubDate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isNewsWithinRange(item, searchRange) {
  if (searchRange === 'all') {
    return true;
  }

  const pubDate = parseNewsPubDate(item?.pubDate);

  if (!pubDate) {
    return false;
  }

  const customRange = parseCustomSearchRange(searchRange);

  if (customRange) {
    return pubDate >= customRange.start && pubDate <= customRange.end;
  }

  const years = getRangeYears(searchRange);

  if (!years) {
    return true;
  }

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);

  return pubDate >= cutoff;
}

function getNewsRelevanceContext({ entities, inputText }) {
  const person = cleanSearchText(entities?.person || '');
  const topic = cleanSearchText(entities?.topic || '');
  const keywordTerms = getKeywordTerms(entities, inputText)
    .filter((term) => term !== person)
    .filter((term) => term !== topic)
    .filter((term) => term !== '불명')
    .slice(0, 12);

  return {
    person: person && person !== '불명' ? person : '',
    topic: topic && topic !== '불명' ? topic : '',
    terms: keywordTerms,
  };
}

function getNewsText(item) {
  return [
    cleanDisplayText(item?.title),
    cleanDisplayText(item?.description),
  ]
    .join(' ')
    .toLowerCase();
}

function getNewsRelevanceScore(item, context) {
  const title = cleanDisplayText(item?.title).toLowerCase();
  const text = getNewsText(item);

  const person = context.person.toLowerCase();
  const topic = context.topic.toLowerCase();

  let score = 0;
  let matchedTerms = 0;

  const hasPerson = Boolean(person && text.includes(person));
  const hasTopic = Boolean(topic && text.includes(topic));

  if (hasPerson) {
    score += 5;
  }

  if (hasTopic) {
    score += 4;
  }

  context.terms.forEach((term) => {
    const normalizedTerm = term.toLowerCase();

    if (!normalizedTerm) {
      return;
    }

    if (text.includes(normalizedTerm)) {
      matchedTerms += 1;
      score += title.includes(normalizedTerm) ? 2 : 1;
    }
  });

  return {
    score,
    matchedTerms,
    hasPerson,
    hasTopic,
  };
}

function isRelevantNewsItem(item, context) {
  const title = cleanDisplayText(item?.title);
  const description = cleanDisplayText(item?.description);

  if (!title && !description) {
    return false;
  }

  if (!context.person && !context.topic && context.terms.length === 0) {
    return true;
  }

  const result = getNewsRelevanceScore(item, context);

  if (context.person) {
    return (
      (result.hasPerson && (result.hasTopic || result.matchedTerms >= 1)) ||
      (result.hasTopic && result.matchedTerms >= 1) ||
      result.score >= 8
    );
  }

  if (context.topic) {
    return (
      result.hasTopic ||
      result.matchedTerms >= 2 ||
      result.score >= 3
    );
  }

  return result.matchedTerms >= 2 || result.score >= 2;
}

function sortNewsByRelevanceAndDate(items, context) {
  return [...items].sort((a, b) => {
    const aScore = getNewsRelevanceScore(a, context).score;
    const bScore = getNewsRelevanceScore(b, context).score;

    if (bScore !== aScore) {
      return bScore - aScore;
    }

    const aDate = parseNewsPubDate(a?.pubDate)?.getTime() || 0;
    const bDate = parseNewsPubDate(b?.pubDate)?.getTime() || 0;

    return bDate - aDate;
  });
}

function buildNewsSearchQueries({ entities, inputText, searchDepth }) {
  const person = cleanSearchText(entities?.person || '');
  const topic = cleanSearchText(entities?.topic || '');
  const terms = getKeywordTerms(entities, inputText);

  const primaryTerms = terms.slice(0, 3).join(' ');
  const firstTerm = terms[0] || topic || cleanSearchText(inputText).slice(0, 20);
  const secondTerm = terms[1] || '';

  const queries = [];

  if (person && topic) {
    queries.push(`${person} ${topic}`);
    queries.push(`${person} ${topic} 발언`);
    queries.push(`${person} ${topic} 입장`);
  }

  if (person && primaryTerms) {
    queries.push(`${person} ${primaryTerms}`);
    queries.push(`${person} ${primaryTerms} 과거 발언`);
  }

  if (topic) {
    queries.push(`${topic} 기사`);
    queries.push(`${topic} 논란`);
    queries.push(`${topic} 공약`);
  }

  if (firstTerm && secondTerm) {
    queries.push(`${firstTerm} ${secondTerm}`);
    queries.push(`${firstTerm} ${secondTerm} 기사`);
  }

  if (firstTerm) {
    queries.push(`${firstTerm} 발언`);
  }

  const limit = searchDepth === 'deep' ? 6 : 4;

  return uniqueList(queries).slice(0, limit);
}

function buildAssemblySearchQueries({ entities, inputText }) {
  const topic = cleanSearchText(entities?.topic || '');
  const terms = getKeywordTerms(entities, inputText);

  const legalTerms = terms.filter((term) =>
    /법|법안|개정|개정안|특별법|지원법|처벌법|관리법/.test(term)
  );

  const queries = [];

  if (topic && topic.length <= 24) {
    queries.push(topic);
  }

  if (legalTerms.length > 0) {
    queries.push(...legalTerms);
  }

  if (terms.length >= 2) {
    queries.push(`${terms[0]} ${terms[1]}`);
  }

  queries.push(...terms.slice(0, 4));

  return uniqueList(queries)
    .filter((query) => query.length >= 2)
    .slice(0, 3);
}

function buildAssemblySpeechQueries({ entities, inputText }) {
  const person = cleanSearchText(entities?.person || '');
  const topic = cleanSearchText(entities?.topic || '');
  const terms = getKeywordTerms(entities, inputText);

  const queries = [];

  if (person && person !== '불명') {
    queries.push(person);
  }

  if (topic && topic.length <= 24) {
    queries.push(topic);
  }

  if (terms.length >= 2) {
    queries.push(`${terms[0]} ${terms[1]}`);
  }

  queries.push(...terms.slice(0, 3));

  return uniqueList(queries)
    .filter((query) => query.length >= 2)
    .slice(0, 3);
}

function buildYouTubeSearchQuery({ entities, inputText }) {
  const person = cleanSearchText(entities?.person || '');
  const topic = cleanSearchText(entities?.topic || '');
  const terms = getKeywordTerms(entities, inputText).slice(0, 2).join(' ');

  if (person && topic) {
    return `${person} ${topic} 발언 인터뷰 기자회견`;
  }

  if (person && terms) {
    return `${person} ${terms} 발언 인터뷰`;
  }

  if (topic) {
    return `${topic} 발언 인터뷰 기자회견`;
  }

  if (terms) {
    return `${terms} 발언 인터뷰`;
  }

  return `${cleanSearchText(inputText).slice(0, 50)} 발언 인터뷰`;
}

function formatQueryListForPrompt(label, queries) {
  if (!queries.length) {
    return `${label}: 검색어 없음`;
  }

  return `${label}:\n${queries
    .map((query, index) => `${index + 1}. ${query}`)
    .join('\n')}`;
}

function formatNewsSourcesForPrompt(newsSources = []) {
  if (!newsSources.length) {
    return '관련 뉴스 검색 결과 없음';
  }

  return newsSources
    .map((item, index) => {
      return `
${index + 1}. ${cleanDisplayText(item.title) || '제목 없음'}
- 요약: ${cleanDisplayText(item.description) || '요약 없음'}
- 발행일: ${item.pubDate || '확인 필요'}
- 링크: ${item.originallink || item.link || '링크 없음'}
`;
    })
    .join('\n');
}

function formatAssemblySourcesForPrompt(assemblySources = []) {
  if (!assemblySources.length) {
    return '관련 국회 공식자료 검색 결과 없음';
  }

  return assemblySources
    .map((item, index) => {
      return `
${index + 1}. ${item.title || '제목 없음'}
- 자료 유형: ${item.sourceLabel || '국회 공식자료'}
- 의안번호: ${item.billNo || '확인 필요'}
- 제안자/기관: ${item.proposer || '확인 필요'}
- 처리 상태: ${item.status || '확인 필요'}
- 소관/위원회: ${item.committee || '확인 필요'}
- 일자: ${item.date || '확인 필요'}
- 링크: ${item.link || '링크 없음'}
`;
    })
    .join('\n');
}

function formatAssemblySpeechSourcesForPrompt(speechSources = []) {
  if (!speechSources.length) {
    return '관련 국회 발언영상 검색 결과 없음';
  }

  return speechSources
    .map((item, index) => {
      return `
${index + 1}. ${item.title || '회의 제목 확인 필요'}
- 발언자: ${item.speaker || '발언자 확인 필요'}
- 회의일자: ${item.takingDate || '일자 확인 필요'}
- 재생시간: ${item.playTime || '확인 필요'}
- 상세링크: ${item.detailLink || '링크 없음'}
`;
    })
    .join('\n');
}

function formatYouTubeSourcesForPrompt(videoSources = []) {
  if (!videoSources.length) {
    return '관련 YouTube 영상 검색 결과 없음';
  }

  return videoSources
    .map((item, index) => {
      return `
${index + 1}. ${item.title || '제목 없음'}
- 채널: ${item.channelTitle || '확인 필요'}
- 설명: ${item.description || '설명 없음'}
- 게시일: ${item.publishedAt || '확인 필요'}
- 링크: ${item.link || '링크 없음'}
`;
    })
    .join('\n');
}

function getNewsDedupeKey(item) {
  const cleanTitle = cleanDisplayText(item?.title)
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return [
    item?.originallink || item?.link || '',
    cleanTitle,
  ]
    .join('|')
    .toLowerCase();
}

function getAssemblyDedupeKey(item) {
  return [
    item?.billNo || '',
    item?.title || '',
    item?.proposer || '',
    item?.date || '',
  ]
    .join('|')
    .toLowerCase();
}

function getAssemblySpeechDedupeKey(item) {
  return [
    item?.title || '',
    item?.speaker || '',
    item?.takingDate || '',
    item?.playTime || '',
  ]
    .join('|')
    .toLowerCase();
}

function getYouTubeDedupeKey(item) {
  return [
    item?.videoId || '',
    item?.title || '',
    item?.channelTitle || '',
  ]
    .join('|')
    .toLowerCase();
}

function dedupeBy(items, getKey) {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);

    if (!key.trim()) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function getNewsSourcesSafely({
  queries,
  searchRange,
  searchDepth,
  entities,
  inputText,
}) {
  const config = getNewsLimitConfig(searchDepth);
  const relevanceContext = getNewsRelevanceContext({ entities, inputText });

  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const dateResult = await searchNewsSources({
        query,
        display: config.perQueryDisplay,
        sort: 'date',
      });

      const simResult = await searchNewsSources({
        query,
        display: config.perQueryDisplay,
        sort: 'sim',
      });

      return [
        ...(dateResult.items || []),
        ...(simResult.items || []),
      ];
    })
  );

  const items = settled
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value || []);

  const rejected = settled.filter((result) => result.status === 'rejected');

  if (rejected.length > 0) {
    console.warn('[일부 뉴스 검색 실패]', rejected.map((item) => item.reason?.message || item.reason));
  }

  const dedupedItems = dedupeBy(items, getNewsDedupeKey);
  const rangeFilteredItems = dedupedItems.filter((item) =>
    isNewsWithinRange(item, searchRange)
  );

  const strictlyRelevantItems = rangeFilteredItems.filter((item) =>
    isRelevantNewsItem(item, relevanceContext)
  );

  const looselyRelevantItems = rangeFilteredItems.filter((item) =>
    getNewsRelevanceScore(item, relevanceContext).score > 0
  );

  const selectedItems = strictlyRelevantItems.length >= config.promptLimit
    ? strictlyRelevantItems
    : dedupeBy(
        [
          ...strictlyRelevantItems,
          ...looselyRelevantItems,
        ],
        getNewsDedupeKey
      );

  const rankedItems = sortNewsByRelevanceAndDate(
    selectedItems,
    relevanceContext
  );

  const displaySources = rankedItems.slice(0, config.displayLimit);
  const promptSources = displaySources.slice(0, config.promptLimit);

  return {
    displaySources,
    promptSources,
  };
}

async function getAssemblySourcesSafely({ queries }) {
  const settled = await Promise.allSettled(
    queries.map((query) =>
      searchAssemblySources({
        query,
        display: 4,
      })
    )
  );

  const items = settled
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value?.items || []);

  const rejected = settled.filter((result) => result.status === 'rejected');

  if (rejected.length > 0) {
    console.warn('[일부 국회 공식자료 검색 실패]', rejected.map((item) => item.reason?.message || item.reason));
  }

  return dedupeBy(items, getAssemblyDedupeKey).slice(0, 5);
}

async function getAssemblySpeechSourcesSafely({ queries }) {
  const settled = await Promise.allSettled(
    queries.map((query) =>
      searchAssemblySpeechSources({
        query,
        display: 4,
      })
    )
  );

  const items = settled
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value?.items || []);

  const rejected = settled.filter((result) => result.status === 'rejected');

  if (rejected.length > 0) {
    console.warn('[일부 국회 발언영상 검색 실패]', rejected.map((item) => item.reason?.message || item.reason));
  }

  return dedupeBy(items, getAssemblySpeechDedupeKey).slice(0, 5);
}

async function getYouTubeSourcesSafely({ query }) {
  try {
    const youtubeResult = await searchYouTubeSources({
      query,
      display: 4,
    });

    return dedupeBy(
      youtubeResult.items || [],
      getYouTubeDedupeKey
    ).slice(0, 4);
  } catch (error) {
    console.warn('[YouTube 영상 검색 실패]', error.message || error);
    return [];
  }
}

function normalizeDateFromNews(pubDate) {
  if (!pubDate) return '일자 확인';

  const date = new Date(pubDate);

  if (Number.isNaN(date.getTime())) {
    return String(pubDate).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function createFallbackPastStatementsFromSources({
  usedNewsSources,
  usedAssemblySpeechSources,
}) {
  const newsItems = usedNewsSources.slice(0, 3).map((item) => ({
    date: normalizeDateFromNews(item.pubDate),
    source: '네이버 뉴스 기사 기반 확인 후보',
    quote: `${cleanDisplayText(item.title) || '관련 기사'} — 기사 원문 확인 필요`,
    summary: cleanDisplayText(item.description) || cleanDisplayText(item.title) || '기사 요약 확인 필요',
    hasConflict: false,
    conflictNote: '기사 제목·요약 기반 후보입니다. 실제 발언 원문 확인이 필요합니다.',
    stanceScore: null,
  }));

  const speechItems = usedAssemblySpeechSources.slice(0, 3).map((item) => ({
    date: item.takingDate || '일자 확인',
    source: `${item.speaker || '발언자 확인 필요'} / 국회의원 영상회의록`,
    quote: `${item.title || '회의 제목 확인 필요'} 관련 발언영상 확인 필요`,
    summary: `${item.title || '회의 제목 확인 필요'}에서 관련 발언 후보가 확인되었습니다.`,
    hasConflict: false,
    conflictNote: '국회 발언영상 기반 공식 발언 후보입니다. 영상 원문 확인이 필요합니다.',
    stanceScore: null,
  }));

  return [...newsItems, ...speechItems].slice(0, 5);
}

function createFallbackEntities(inputText) {
  return {
    person: '불명',
    topic: '입력문 기반 분석',
    keywords: [],
    todaySummary: inputText.slice(0, 120),
    currentStanceScore: null,
    evidenceNeeds: {
      sourceText: inputText.slice(0, 180),
      items: [],
    },
  };
}

function createFallbackPastData() {
  return {
    pastStatements: [],
  };
}

function createFallbackAnalysis() {
  return {
    verdict: 'unclear',
    label: '확인 필요',
    credibilityReason:
      'AI 응답 일부를 구조화하지 못했습니다. 원문과 출처를 추가 확인해야 합니다.',
    summary:
      'AI 응답 일부를 구조화하지 못했습니다. 입력문, 뉴스 기사 후보, 국회 발언영상 후보를 기준으로 기자의 추가 검토가 필요합니다.',
  };
}

function createFallbackQuestions() {
  return {
    questions: [
      '해당 발언을 뒷받침하는 공식 자료나 통계가 있는지 확인해 주시겠습니까?',
      '과거 입장과 현재 발언 사이에 달라진 배경이나 근거는 무엇입니까?',
      '관련 정책이나 사건에 대해 확인 가능한 원문 자료를 제시할 수 있습니까?',
      '발언에 포함된 수치나 표현의 기준 시점은 언제입니까?',
      '추가 검증이 필요한 부분에 대해 공식 입장을 밝힐 계획이 있습니까?',
    ],
  };
}

function normalizeEvidenceLevel(level) {
  if (level === 'high' || level === 'orange') return 'high';
  if (level === 'medium' || level === 'yellow') return 'medium';
  if (level === 'low') return 'low';
  return 'medium';
}

function getEvidenceItemsFromEntities(entities) {
  const items = entities?.evidenceNeeds?.items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      phrase: cleanDisplayText(item?.phrase),
      reason: cleanDisplayText(item?.reason),
      level: normalizeEvidenceLevel(item?.level),
    }))
    .filter((item) => item.phrase && item.reason)
    .slice(0, 3);
}

function toFiniteStanceScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(-100, Math.min(100, value));
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return Math.max(-100, Math.min(100, parsed));
    }
  }

  return null;
}

function getVerdictRank(verdict) {
  if (verdict === 'complete_reversal') return 3;
  if (verdict === 'partial_shift') return 2;
  if (verdict === 'unclear') return 1;
  if (verdict === 'consistent') return 0;
  return 0;
}

function getVerdictLabel(verdict) {
  if (verdict === 'complete_reversal') return '완전한 입장 번복';
  if (verdict === 'partial_shift') return '부분적 입장 변화';
  if (verdict === 'consistent') return '일관된 입장';
  return '불명확';
}

function getScoreDirectionLabel(score) {
  if (score >= 35) return '찬성·확대·강화 쪽';
  if (score <= -35) return '반대·축소·비판 쪽';
  return '중립 또는 불명확';
}

function getMaxStanceDiff({ currentScore, pastStatements }) {
  if (currentScore === null) {
    return null;
  }

  const scoredPastStatements = pastStatements
    .map((statement) => ({
      statement,
      score: toFiniteStanceScore(statement?.stanceScore),
    }))
    .filter((item) => item.score !== null);

  if (scoredPastStatements.length === 0) {
    return null;
  }

  return scoredPastStatements.reduce((best, item) => {
    const diff = Math.abs(currentScore - item.score);
    const oppositeDirection =
      Math.abs(currentScore) >= 30 &&
      Math.abs(item.score) >= 30 &&
      currentScore * item.score < 0;

    if (!best || diff > best.diff) {
      return {
        ...item,
        diff,
        oppositeDirection,
      };
    }

    return best;
  }, null);
}

function getStanceCorrectionSuggestion({ entities, pastStatements }) {
  const currentScore = toFiniteStanceScore(entities?.currentStanceScore);
  const conflictCount = pastStatements.filter((item) => item?.hasConflict).length;
  const maxDiffData = getMaxStanceDiff({
    currentScore,
    pastStatements,
  });

  if (pastStatements.length === 0) {
    return null;
  }

  if (!maxDiffData && conflictCount === 0) {
    return null;
  }

  const maxDiff = maxDiffData?.diff || 0;
  const hasOppositeDirection = Boolean(maxDiffData?.oppositeDirection);

  if (
    hasOppositeDirection &&
    maxDiff >= 80
  ) {
    return {
      verdict: 'complete_reversal',
      reason:
        `현재 입장 점수(${currentScore})와 과거 후보 점수(${maxDiffData.score})가 정반대 방향이며 차이가 ${maxDiff}점입니다.`,
      detail: {
        currentScore,
        pastScore: maxDiffData.score,
        maxDiff,
        conflictCount,
        currentDirection: getScoreDirectionLabel(currentScore),
        pastDirection: getScoreDirectionLabel(maxDiffData.score),
      },
    };
  }

  if (
    maxDiff >= 45 ||
    conflictCount >= 2 ||
    hasOppositeDirection
  ) {
    return {
      verdict: 'partial_shift',
      reason:
        maxDiffData
          ? `현재 입장 점수(${currentScore})와 과거 후보 점수(${maxDiffData.score})의 차이가 ${maxDiff}점입니다.`
          : `과거 후보 중 상반 가능성이 ${conflictCount}건 확인되었습니다.`,
      detail: {
        currentScore,
        pastScore: maxDiffData?.score ?? null,
        maxDiff,
        conflictCount,
        currentDirection: currentScore === null ? '불명확' : getScoreDirectionLabel(currentScore),
        pastDirection: maxDiffData?.score === null || maxDiffData?.score === undefined
          ? '불명확'
          : getScoreDirectionLabel(maxDiffData.score),
      },
    };
  }

  if (
    maxDiffData &&
    maxDiff <= 25 &&
    conflictCount === 0
  ) {
    return {
      verdict: 'consistent',
      reason:
        `현재 입장 점수와 과거 후보 점수 차이가 ${maxDiff}점으로 크지 않고, 상반 후보가 확인되지 않았습니다.`,
      detail: {
        currentScore,
        pastScore: maxDiffData.score,
        maxDiff,
        conflictCount,
        currentDirection: getScoreDirectionLabel(currentScore),
        pastDirection: getScoreDirectionLabel(maxDiffData.score),
      },
    };
  }

  return null;
}

function applyStanceCorrectionToAnalysis({
  analysis,
  entities,
  pastStatements,
}) {
  const suggestion = getStanceCorrectionSuggestion({
    entities,
    pastStatements,
  });

  if (!suggestion) {
    return analysis;
  }

  const currentVerdict = analysis?.verdict || 'unclear';
  const currentRank = getVerdictRank(currentVerdict);
  const suggestionRank = getVerdictRank(suggestion.verdict);

  if (suggestionRank <= currentRank && currentVerdict !== 'consistent') {
    return {
      ...analysis,
      stanceCorrection: {
        applied: false,
        suggestedVerdict: suggestion.verdict,
        reason: suggestion.reason,
        detail: suggestion.detail,
      },
    };
  }

  if (currentVerdict === suggestion.verdict) {
    return {
      ...analysis,
      stanceCorrection: {
        applied: false,
        suggestedVerdict: suggestion.verdict,
        reason: suggestion.reason,
        detail: suggestion.detail,
      },
    };
  }

  const correctedLabel = getVerdictLabel(suggestion.verdict);
  const correctionSentence =
    `점수 기반 보정: ${suggestion.reason}`;

  return {
    ...analysis,
    verdict: suggestion.verdict,
    label: correctedLabel,
    credibilityReason: [
      analysis?.credibilityReason,
      correctionSentence,
    ]
      .filter(Boolean)
      .join(' '),
    summary: [
      analysis?.summary || '',
      `다만 현재 발언과 과거 후보의 입장 점수 차이를 함께 보면 '${correctedLabel}' 가능성이 더 높습니다. 최종 판단은 원문 확인이 필요합니다.`,
    ]
      .filter(Boolean)
      .join(' '),
    stanceCorrection: {
      applied: true,
      originalVerdict: currentVerdict,
      correctedVerdict: suggestion.verdict,
      reason: suggestion.reason,
      detail: suggestion.detail,
    },
  };
}

function getSourceRoleNotice({
  newsSourcesText,
  assemblySourcesText,
  assemblySpeechSourcesText,
  youtubeSourcesText,
}) {
  return `
[출처 역할 구분]

1. 네이버 뉴스 검색 결과
- 기사 기반 과거 발언·입장 변화 후보로 사용할 수 있습니다.
- 단, 기사 제목과 요약만으로 확정하지 말고 "원문 확인 필요"를 병기하세요.

[네이버 뉴스 검색 결과]
${newsSourcesText}

2. 국회 공식자료 검색 결과
- 정책·법안·의안·의정활동 맥락을 확인하기 위한 공식자료 후보입니다.
- 과거 발언 원문으로 직접 인용하지 마세요.

[국회 공식자료 검색 결과]
${assemblySourcesText}

3. 국회 발언영상 검색 결과
- 국회의원 발언영상 기반의 공식 발언 후보입니다.
- 발언자, 회의일자, 회의제목은 공식자료 후보로 사용할 수 있습니다.
- 다만 자막 전문이 아니므로 정확한 문장 인용은 "영상 원문 확인 필요"로 표시하세요.

[국회 발언영상 검색 결과]
${assemblySpeechSourcesText}

4. YouTube 영상 검색 결과
- 일반 영상 제목·설명·채널명을 기반으로 한 "발언 원출처 후보"입니다.
- YouTube 결과만으로 과거 발언을 생성하지 마세요.
- 영상 내용을 직접 확인하지 않은 상태에서는 발언 원문처럼 인용하지 마세요.

[YouTube 영상 출처 후보]
${youtubeSourcesText}
`;
}

export async function runFactCheckAnalysis({
  provider,
  model,
  inputText,
  searchRange,
  searchDepth,
  dnaEnabled,
  onStepChange,
}) {
  try {
    onStepChange?.(0, 'active');

    const extractResponse = await callAI({
      provider,
      model,
      systemPrompt: extractInfoPrompt,
      userPrompt: `다음 발언 또는 기사에서 핵심 정보를 추출하세요.\n\n${inputText}`,
    });

    const entities = parseAIJsonSafely(
      extractResponse,
      createFallbackEntities(inputText),
      '핵심 정보 추출'
    );

    const evidenceItems = getEvidenceItemsFromEntities(entities);

    onStepChange?.(0, 'done');

    onStepChange?.(1, 'active');

    const newsSearchQueries = buildNewsSearchQueries({
      entities,
      inputText,
      searchDepth,
    });

    const assemblySearchQueries = buildAssemblySearchQueries({
      entities,
      inputText,
    });

    const assemblySpeechSearchQueries = buildAssemblySpeechQueries({
      entities,
      inputText,
    });

    const youtubeSearchQuery = buildYouTubeSearchQuery({
      entities,
      inputText,
    });

    const [
      newsSourceBundle,
      usedAssemblySources,
      usedAssemblySpeechSources,
      usedYouTubeSources,
    ] = await Promise.all([
      getNewsSourcesSafely({
        queries: newsSearchQueries,
        searchRange,
        searchDepth,
        entities,
        inputText,
      }),
      getAssemblySourcesSafely({ queries: assemblySearchQueries }),
      getAssemblySpeechSourcesSafely({ queries: assemblySpeechSearchQueries }),
      getYouTubeSourcesSafely({ query: youtubeSearchQuery }),
    ]);

    const usedNewsSources = newsSourceBundle.displaySources;
    const promptNewsSources = newsSourceBundle.promptSources;

    const newsSourcesText = formatNewsSourcesForPrompt(promptNewsSources);
    const assemblySourcesText = formatAssemblySourcesForPrompt(usedAssemblySources);
    const assemblySpeechSourcesText = formatAssemblySpeechSourcesForPrompt(
      usedAssemblySpeechSources
    );
    const youtubeSourcesText = formatYouTubeSourcesForPrompt(usedYouTubeSources);

    const sourceRoleNotice = getSourceRoleNotice({
      newsSourcesText,
      assemblySourcesText,
      assemblySpeechSourcesText,
      youtubeSourcesText,
    });

    const pastResponse = await callAI({
      provider,
      model,
      systemPrompt: searchPastStatementsPrompt,
      userPrompt: `
오늘의 발언과 비교할 과거 발언·기사 후보를 정리하세요.

중요:
- 이 단계에서는 [네이버 뉴스 검색 결과]와 [국회 발언영상 검색 결과]만 사용하세요.
- 국회 공식자료는 법안·정책 맥락 자료이므로 과거 발언 타임라인 생성에 직접 사용하지 마세요.
- YouTube 영상 후보는 과거 발언 타임라인 생성에 사용하지 마세요.
- 뉴스 검색 결과에 없는 발언을 새로 만들어내지 마세요.
- 국회 발언영상은 공식 발언 후보로 사용할 수 있지만, 자막 전문이 아니므로 정확한 문장 인용은 하지 마세요.
- 기사 제목·요약 또는 발언영상 제목만으로 발언 원문을 확정하지 말고 "원문 확인 필요"를 표시하세요.
- 결과의 pastStatements에는 뉴스 기반 후보와 국회 발언영상 후보만 넣으세요.
- 검색 기간 기준은 ${getRangeLabel(searchRange)}입니다.
- 현재 발언과 과거 후보의 방향성이 다르면 hasConflict를 true로 표시하세요.
- 각 과거 후보에는 stanceScore를 반드시 -100에서 100 사이 숫자로 넣으세요.

[뉴스 검색어 목록]
${formatQueryListForPrompt('네이버 뉴스 검색어', newsSearchQueries)}

[국회 발언영상 검색어 목록]
${formatQueryListForPrompt('국회 발언영상 검색어', assemblySpeechSearchQueries)}

[오늘의 발언]
${inputText}

[현재 발언 입장 점수]
${entities.currentStanceScore ?? '확인 필요'}

[추출된 인물]
${entities.person || '불명'}

[추출된 주제]
${entities.topic || '불명'}

[네이버 뉴스 검색 결과]
${newsSourcesText}

[국회 발언영상 검색 결과]
${assemblySpeechSourcesText}
`,
    });

    const rawPastData = parseAIJsonSafely(
      pastResponse,
      createFallbackPastData(),
      '과거 발언 정리'
    );

    const pastStatementsFromAI = Array.isArray(rawPastData.pastStatements)
      ? rawPastData.pastStatements
      : [];

    const fallbackPastStatements = createFallbackPastStatementsFromSources({
      usedNewsSources: promptNewsSources,
      usedAssemblySpeechSources,
    });

    const pastData = {
      pastStatements:
        pastStatementsFromAI.length > 0
          ? pastStatementsFromAI
          : fallbackPastStatements,
    };

    onStepChange?.(1, 'done');

    onStepChange?.(2, 'active');

    const compareResponse = await callAI({
      provider,
      model,
      systemPrompt: compareStatementsPrompt,
      userPrompt: `
오늘 발언과 과거 발언·기사 후보를 비교해 주세요.

중요:
- 과거 발언 타임라인은 아래 [뉴스·국회 발언영상 기반 과거 후보]만 사용하세요.
- 국회 공식자료는 정책·법안·의안 맥락 확인용입니다.
- YouTube 결과는 영상 출처 후보일 뿐이며, 실제 발언 원문으로 단정하지 마세요.
- YouTube 제목·설명만 보고 과거 발언을 새로 만들지 마세요.
- 확인되지 않은 내용은 단정하지 말고 "확인 필요"로 처리하세요.
- 발언의 입장 변화, 모순 가능성, 근거가 필요한 표현을 중심으로 분석하세요.
- 단, 현재 입장 점수와 과거 입장 점수 차이가 크거나 방향이 반대라면 "일관된 입장"으로 처리하지 마세요.
- 점수 차이가 45점 이상이면 부분적 입장 변화 가능성을 검토하세요.
- 점수 방향이 정반대이고 차이가 80점 이상이면 완전한 입장 번복 가능성을 검토하세요.

[오늘의 발언]
${inputText}

[현재 발언 입장 점수]
${entities.currentStanceScore ?? '확인 필요'}

[뉴스·국회 발언영상 기반 과거 후보]
${JSON.stringify(pastData.pastStatements || [], null, 2)}

[API별 검색어]
${formatQueryListForPrompt('네이버 뉴스 검색어', newsSearchQueries)}
${formatQueryListForPrompt('국회 공식자료 검색어', assemblySearchQueries)}
${formatQueryListForPrompt('국회 발언영상 검색어', assemblySpeechSearchQueries)}
YouTube 검색어:
1. ${youtubeSearchQuery}

${sourceRoleNotice}
`,
    });

    const rawAnalysis = parseAIJsonSafely(
      compareResponse,
      createFallbackAnalysis(),
      '입장 변화 분석'
    );

    const analysis = applyStanceCorrectionToAnalysis({
      analysis: rawAnalysis,
      entities,
      pastStatements: Array.isArray(pastData.pastStatements)
        ? pastData.pastStatements
        : [],
    });

    onStepChange?.(2, 'done');

    onStepChange?.(3, 'active');

    const questionResponse = await callAI({
      provider,
      model,
      systemPrompt: generateQuestionsPrompt,
      userPrompt: `
아래 정보를 바탕으로 기자회견 질문 5개를 작성하세요.

중요:
- 질문은 공격적 표현보다 검증 가능한 근거를 요구하는 방식으로 작성하세요.
- 뉴스·국회 발언영상 기반 과거 후보를 중심으로 질문을 만드세요.
- 국회 공식자료가 있으면 정책·법안·의정활동 관련 확인 질문을 포함하세요.
- YouTube 영상 출처가 있으면 "해당 영상 발언의 원문 맥락 확인" 관점의 질문만 포함하세요.
- YouTube 제목·설명을 실제 발언처럼 인용하지 마세요.
- 확인되지 않은 내용을 사실로 단정하지 마세요.
- 입장 변화 보정 정보가 있으면 그 근거를 확인하는 질문을 포함하세요.

[인물]
${entities.person || '해당 인물'}

[오늘 발언 요약]
${entities.todaySummary || '요약 없음'}

[입장 변화 분석]
${analysis.summary || '분석 없음'}

[입장 변화 보정 정보]
${JSON.stringify(analysis.stanceCorrection || null, null, 2)}

[뉴스·국회 발언영상 기반 과거 후보]
${JSON.stringify(pastData.pastStatements || [], null, 2)}

${sourceRoleNotice}
`,
    });

    const questionData = parseAIJsonSafely(
      questionResponse,
      createFallbackQuestions(),
      '취재 질문 생성'
    );

    onStepChange?.(3, 'done');

    let dnaData = null;

    if (dnaEnabled) {
      onStepChange?.(4, 'active');

      try {
        const dnaResponse = await callAI({
          provider,
          model,
          systemPrompt: dnaAnalysisPrompt,
          userPrompt: `
아래 발언과 뉴스·국회 발언영상 기반 과거 후보를 바탕으로 언어 패턴을 분석하세요.

중요:
- 문체, 회피 표현, 모호한 표현, 책임 전가 표현을 중심으로 분석하세요.
- 뉴스 기사 후보와 국회 발언영상 후보를 종합해 자주 쓰는 말습관을 찾으세요.
- 이번 발언에서도 같은 말습관이 반복됐는지 repeatedInCurrent로 표시하세요.
- 오늘 발언에서 기자가 확인해야 할 의문점을 todayQuestions에 넣으세요.
- YouTube 영상 검색 결과는 언어 패턴 분석의 근거로 사용하지 마세요.
- 국회 공식자료는 정책 맥락 보조로만 참고하고, 발언 스타일 분석 근거로 쓰지 마세요.
- 사실관계가 불확실한 내용은 단정하지 마세요.
- 입장 변화 보정 정보가 있으면, 표현의 강도 변화나 회피 전략 변화도 함께 보세요.

[오늘의 발언]
${inputText}

[입장 변화 보정 정보]
${JSON.stringify(analysis.stanceCorrection || null, null, 2)}

[뉴스·국회 발언영상 기반 과거 후보]
${JSON.stringify(pastData.pastStatements || [], null, 2)}
`,
        });

        dnaData = parseAIJsonSafely(
          dnaResponse,
          null,
          '패턴 DNA 분석'
        );
      } catch (error) {
        console.warn('[패턴 DNA 분석 실패]', error.message || error);
        dnaData = null;
      }

      onStepChange?.(4, 'done');
    }

    return {
      isMock: false,
      currentText: inputText,
      searchRange,
      searchRangeLabel: getRangeLabel(searchRange),
      searchQuery: newsSearchQueries[0] || '',
      searchQueries: {
        news: newsSearchQueries,
        assembly: assemblySearchQueries,
        assemblySpeech: assemblySpeechSearchQueries,
        youtube: [youtubeSearchQuery],
      },
      assemblySearchQuery: assemblySearchQueries.join(' / '),
      assemblySpeechSearchQuery: assemblySpeechSearchQueries.join(' / '),
      youtubeSearchQuery,
      sourcePolicy:
        '입력문 하나에서 API별 검색어를 분리했습니다. 과거 발언 타임라인은 네이버 뉴스와 국회 발언영상 기반 후보로 생성하고, 국회 공식자료는 정책·법안 맥락 보조, YouTube는 영상 원출처 후보로만 사용합니다.',
      usedNewsSources,
      usedAssemblySources,
      usedAssemblySpeechSources,
      usedYouTubeSources,
      entities,
      evidenceItems,
      analysis,
      pastStatements: Array.isArray(pastData.pastStatements)
        ? pastData.pastStatements
        : [],
      questions: Array.isArray(questionData.questions)
        ? questionData.questions
        : [],
      dnaData,
    };
  } catch (error) {
    console.error('[FactCheck Analysis Error]', error);

    throw new Error(
      error.message ||
        '팩트체크 분석 중 오류가 발생했습니다. 서버와 API 설정을 확인해 주세요.'
    );
  }
}