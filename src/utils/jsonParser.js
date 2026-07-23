export function safeParseJSON(text) {
  try {
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1) {
      throw new Error('JSON 객체를 찾지 못했습니다.');
    }

    const jsonOnly = cleaned.slice(start, end + 1);

    return JSON.parse(jsonOnly);
  } catch (error) {
    console.error('JSON 파싱 실패:', error);
    console.error('AI 원본 응답:', text);
    throw new Error('AI 응답을 JSON으로 변환하지 못했습니다.');
  }
}