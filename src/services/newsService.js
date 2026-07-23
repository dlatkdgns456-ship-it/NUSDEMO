import { API_BASE_URL, REQUEST_TIMEOUTS } from '../config';

function getFriendlyNewsError(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError') {
    return '뉴스 검색 응답 시간이 길어 검색을 건너뛰었습니다.';
  }

  if (message.includes('Failed to fetch')) {
    return '뉴스 검색 서버에 연결할 수 없습니다.';
  }

  if (message.includes('NAVER_CLIENT')) {
    return '네이버 뉴스 API 키 설정을 확인해 주세요.';
  }

  if (message.includes('quota') || message.includes('limit')) {
    return '네이버 뉴스 API 사용량 한도를 확인해 주세요.';
  }

  if (message.includes('timeout') || message.includes('시간')) {
    return '뉴스 검색 응답 시간이 길어 검색을 건너뛰었습니다.';
  }

  return message || '뉴스 검색에 실패했습니다.';
}

export async function searchNewsSources({
  query,
  display = 5,
  sort = 'date',
}) {
  if (!query || !query.trim()) {
    return {
      query: '',
      total: 0,
      items: [],
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUTS.news);

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      display: String(display),
      sort,
    });

    const response = await fetch(
      `${API_BASE_URL}/api/news/search?${params.toString()}`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || '뉴스 검색에 실패했습니다.');
    }

    return {
      query: data.query || query,
      total: data.total || 0,
      items: Array.isArray(data.items) ? data.items : [],
    };
  } catch (error) {
    throw new Error(getFriendlyNewsError(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}