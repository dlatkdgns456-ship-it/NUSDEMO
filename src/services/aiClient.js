import { API_BASE_URL, REQUEST_TIMEOUTS } from '../config';
import { getAuthToken } from './authService';

function getAuthHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function getFriendlyAIError(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError') {
    return 'AI 응답 시간이 너무 길어 요청이 중단되었습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (message.includes('Failed to fetch')) {
    return 'AI 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.';
  }

  if (
    message.includes('401') ||
    message.includes('로그인') ||
    message.includes('만료') ||
    message.includes('유효하지')
  ) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (message.includes('OPENAI_API_KEY')) {
    return '서버의 GPT API 키 설정을 확인해 주세요.';
  }

  if (message.includes('quota') || message.includes('billing')) {
    return 'GPT API 사용량 또는 결제 설정을 확인해 주세요.';
  }

  if (message.includes('timeout') || message.includes('시간')) {
    return 'AI 응답 시간이 너무 길어 요청이 중단되었습니다. 잠시 후 다시 시도해 주세요.';
  }

  return message || 'AI 서버 요청에 실패했습니다.';
}

export async function callAI({
  provider,
  model,
  systemPrompt,
  userPrompt,
}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUTS.ai);

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      signal: controller.signal,
      body: JSON.stringify({
        provider,
        model,
        systemPrompt,
        userPrompt,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || 'AI 서버 요청에 실패했습니다.');
    }

    if (!data?.text) {
      throw new Error('AI 서버 응답이 비어 있습니다.');
    }

    return data.text;
  } catch (error) {
    throw new Error(getFriendlyAIError(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}