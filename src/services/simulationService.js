import { callAI } from './aiClient';
import { STATIC_DEMO } from '../config';
import { safeParseJSON } from '../utils/jsonParser';
import {
  normalizePatterns,
  normalizeSignaturePhrases,
  normalizeTodayQuestions,
} from '../utils/normalizers';

function cleanText(value, fallback = '') {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function createFallbackAnswer(errorMessage = '') {
  return {
    answer:
      '그 부분은 추가 확인이 필요한 사안입니다. 현재로서는 정치적인 방향과 실제 집행 과정의 차이를 함께 봐야 한다고 말씀드리겠습니다.',
    tactic:
      errorMessage
        ? `기본 회피 답변으로 대체했습니다. 원인: ${errorMessage}`
        : '직접 단정은 피하고 추가 확인 필요성을 강조하는 전략',
  };
}

function parseSimulationResponse(response) {
  try {
    const parsed = safeParseJSON(response);

    if (!parsed || typeof parsed !== 'object') {
      return createFallbackAnswer('응답이 JSON 객체가 아닙니다.');
    }

    return {
      answer: cleanText(parsed.answer) || createFallbackAnswer().answer,
      tactic: cleanText(parsed.tactic) || '사용된 답변 전략 정보가 없습니다.',
    };
  } catch (error) {
    console.warn('[Simulation JSON Parse Failed]', error);
    return createFallbackAnswer(error.message);
  }
}

export async function generateSimulationAnswer({
  provider,
  model,
  result,
  question,
  history,
}) {
  if (STATIC_DEMO) {
    await new Promise((resolve) => window.setTimeout(resolve, 550));

    const asksEvidence = /근거|수치|자료|전문가|기준/.test(question);
    const asksChange = /과거|입장|바뀐|변화|번복/.test(question);

    if (asksEvidence) {
      return {
        answer: '해당 표현의 비교 기준과 자료 범위는 관계 자료를 다시 확인해 구체적으로 설명드리겠습니다. 현재 단계에서는 수치를 단정하기보다 검증 가능한 기준을 먼저 제시하는 것이 맞다고 봅니다.',
        tactic: '수치 기준 확인으로 유보',
      };
    }

    if (asksChange) {
      return {
        answer: '과거와 현재의 정책 환경이 완전히 같다고 보기는 어렵습니다. 기존 원칙을 버렸다기보다 안전성·비용·에너지 안보를 함께 고려해 현실적인 선택지를 다시 검토하는 과정이라고 말씀드리겠습니다.',
        tactic: '상황 변화 강조·부분 변화로 축소',
      };
    }

    return {
      answer: '그 부분은 단일한 기준만으로 판단하기 어렵습니다. 관련 절차와 자료를 종합적으로 확인한 뒤 국민이 이해할 수 있도록 구체적인 내용을 설명드리겠습니다.',
      tactic: '종합 검토 강조·확답 유보',
    };
  }

  const entities = result?.entities || {};
  const analysis = result?.analysis || {};
  const dnaData = result?.dnaData || {};

  const patterns = normalizePatterns(dnaData);
  const signaturePhrases = normalizeSignaturePhrases(dnaData);
  const todayQuestions = normalizeTodayQuestions(dnaData);

  const systemPrompt = `
당신은 기자회견 시뮬레이션 AI입니다.

사용자는 기자 역할을 합니다.
당신은 실제 인물인 척하지 않고, 제공된 분석 결과를 바탕으로 "가상의 기자회견 답변"을 생성합니다.

중요 원칙:
1. 실제 인물의 실제 발언이라고 주장하지 마세요.
2. 답변은 2~4문장으로 간결하게 작성하세요.
3. 기자 질문에 직접 반응하되, 분석된 발언 패턴을 자연스럽게 반영하세요.
4. 입장 변화 보정 정보가 있으면 질문을 회피하거나 해명할 때 그 지점을 의식해서 답변하세요.
5. "원문 확인 필요", "추가 검증 필요", "상황 변화", "정책 환경 변화", "구체적 기준 확인" 같은 표현을 자연스럽게 사용할 수 있습니다.
6. 없는 사실, 없는 수치, 없는 과거 발언을 새로 만들지 마세요.
7. tactic에는 사용한 답변 전략을 기자가 이해할 수 있게 한 줄로 설명하세요.
8. 반드시 JSON 형식만 출력하세요.
9. 설명 문장, 마크다운, 코드블록은 출력하지 마세요.

출력 형식:
{
  "answer": "기자회견 답변",
  "tactic": "사용한 회피 전술 또는 답변 전략 설명"
}
`;

  const userPrompt = `
[분석 대상]
${entities.person || '분석 대상 인물'}

[핵심 주제]
${entities.topic || '주제 확인 필요'}

[오늘 발언 요약]
${entities.todaySummary || ''}

[입장 변화 분석]
판정: ${analysis.label || '확인 필요'}
요약: ${analysis.summary || ''}
신뢰 판단 근거: ${analysis.credibilityReason || ''}

[입장 변화 보정 정보]
${JSON.stringify(analysis.stanceCorrection || null, null, 2)}

[과거 발언·기사 후보]
${JSON.stringify(result?.pastStatements || [], null, 2)}

[취재 질문 후보]
${JSON.stringify(result?.questions || [], null, 2)}

[언어 패턴 DNA 요약]
${dnaData.profile || ''}

[반복 언어 패턴]
${JSON.stringify(patterns, null, 2)}

[자주 반복된 표현]
${JSON.stringify(signaturePhrases, null, 2)}

[오늘 발언에서 확인할 의문점]
${JSON.stringify(todayQuestions, null, 2)}

[캐릭터 설명]
${dnaData.characterBrief || ''}

[이전 대화]
${JSON.stringify(history || [], null, 2)}

[기자 질문]
${question}

답변 작성 지침:
- 질문이 과거와 현재 입장 차이를 묻는다면, 정면 부정보다는 "당시 상황과 현재 조건이 다르다"는 식의 해명 전략을 우선 사용하세요.
- 질문이 근거, 통계, 수치를 요구한다면 구체 수치를 새로 만들지 말고 "자료 기준을 확인해 설명하겠다"는 방식으로 답하세요.
- 질문이 책임 소재를 묻는다면 개인 단정 대신 제도, 절차, 관계기관 검토를 언급하는 전략을 사용할 수 있습니다.
- DNA의 repeatedInCurrent가 true인 표현이나 패턴은 답변 말투에 자연스럽게 반영하세요.
- todayQuestions에 있는 의문점은 기자가 파고드는 약점이므로, 답변에서 그 부분을 완전히 인정하기보다는 조건, 맥락, 검증 필요성으로 방어하세요.
- tactic에는 "상황 변화 강조", "원문 확인 필요로 유보", "책임 주체 분산", "원칙 반복", "수치 기준 확인으로 지연"처럼 구체적으로 쓰세요.
`;

  const response = await callAI({
    provider,
    model,
    systemPrompt,
    userPrompt,
  });

  return parseSimulationResponse(response);
}