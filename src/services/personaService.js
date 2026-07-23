import { callAI } from './aiClient';
import { safeParseJSON } from '../utils/jsonParser';
import { personaPrompts } from '../prompts/personaPrompts';

function parsePersonaResponse(response) {
  try {
    const parsed = safeParseJSON(response);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('AI 응답이 비어 있습니다.');
    }

    return parsed;
  } catch (error) {
    console.warn('[Persona JSON 파싱 실패]', error);

    return {
      title: '기사 생성 결과 확인 필요',
      lead: 'AI 응답 형식을 완전히 구조화하지 못했습니다. 아래 원문 응답을 참고해 주세요.',
      body: response || '응답 내용이 없습니다.',
      warnings: [
        'AI 응답 형식이 예상한 JSON 구조와 다릅니다.',
        '기사 내용은 기자의 확인과 수정이 필요합니다.',
      ],
    };
  }
}

export async function generatePersonaArticle({
  provider,
  model,
  era,
  inputText,
  mode,
}) {
  const systemPrompt = personaPrompts[era];

  if (!systemPrompt) {
    throw new Error('선택한 세대 페르소나 프롬프트를 찾을 수 없습니다.');
  }

  const userPrompt =
    mode === 'generate'
      ? `
다음 팩트를 바탕으로 선택한 독자층에 맞는 기사를 작성하세요.

중요:
- 선택된 세대의 문체 규칙을 반드시 지키세요.
- 모든 세대가 비슷한 일반 기사체로 나오면 실패입니다.
- 제목, 리드문, 본문에서 세대별 차이가 분명히 보여야 합니다.
- 10·20대는 쉬운 말, 짧은 문장, 제한적 유행어가 보여야 합니다.
- 30·40대는 생활비, 직장, 가계, 자녀, 주거 등 현실 영향이 보여야 합니다.
- 50·60대는 정통 신문 기사체와 사회적 의미가 보여야 합니다.
- 70·80대는 한글(漢字) 병기가 최소 6개 이상 들어가야 합니다.

[팩트]
${inputText}
`
      : `
다음 기사를 선택한 독자층에 맞게 재작성하세요.
핵심 사실은 유지하고, 문체와 설명 방식만 바꾸세요.

중요:
- 선택된 세대의 문체 규칙을 반드시 지키세요.
- 모든 세대가 비슷한 일반 기사체로 나오면 실패입니다.
- 제목, 리드문, 본문에서 세대별 차이가 분명히 보여야 합니다.
- 10·20대는 쉬운 말, 짧은 문장, 제한적 유행어가 보여야 합니다.
- 30·40대는 생활비, 직장, 가계, 자녀, 주거 등 현실 영향이 보여야 합니다.
- 50·60대는 정통 신문 기사체와 사회적 의미가 보여야 합니다.
- 70·80대는 한글(漢字) 병기가 최소 6개 이상 들어가야 합니다.

[원본 기사]
${inputText}
`;

  try {
    const response = await callAI({
      provider,
      model,
      systemPrompt,
      userPrompt,
    });

    return {
      isMock: false,
      ...parsePersonaResponse(response),
    };
  } catch (error) {
    console.error('[Persona Generate Error]', error);

    throw new Error(
      error.message ||
        '세대별 기사 생성 중 오류가 발생했습니다. 서버와 API 설정을 확인해 주세요.'
    );
  }
}