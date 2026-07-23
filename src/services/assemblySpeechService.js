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

function getFriendlyAssemblySpeechError(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError') {
    return '국회 발언영상 검색 응답 시간이 길어 검색을 건너뛰었습니다.';
  }

  if (message.includes('Failed to fetch')) {
    return '국회 발언영상 검색 서버에 연결할 수 없습니다.';
  }

  if (message.includes('로그인') || message.includes('만료')) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (message.includes('ASSEMBLY_API_KEY')) {
    return '국회 API 키 설정을 확인해 주세요.';
  }

  if (message.includes('timeout') || message.includes('시간')) {
    return '국회 발언영상 검색 응답 시간이 길어 검색을 건너뛰었습니다.';
  }

  return message || '국회 발언영상 검색에 실패했습니다.';
}

export async function searchAssemblySpeechSources({
  query,
  ct = '22',
  years,
  display = 5,
}) {
  if (!query || !query.trim()) {
    return {
      query: '',
      items: [],
      sources: [],
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUTS.assemblySpeech);

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      ct: String(ct),
      display: String(display),
    });

    if (years) {
      params.set('years', String(years));
    }

    const response = await fetch(
      `${API_BASE_URL}/api/official/assembly/speech/search?${params.toString()}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          ...getAuthHeaders(),
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || '국회 발언영상 검색에 실패했습니다.');
    }

    return {
      query: data.query || query,
      ct: data.ct || ct,
      years: Array.isArray(data.years) ? data.years : [],
      items: Array.isArray(data.items) ? data.items : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
    };
  } catch (error) {
    throw new Error(getFriendlyAssemblySpeechError(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}