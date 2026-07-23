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

function getFriendlyHistoryError(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError') {
    return '서버 응답 시간이 길어 요청이 중단되었습니다.';
  }

  if (message.includes('Failed to fetch')) {
    return '서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.';
  }

  if (
    message.includes('로그인이 필요합니다') ||
    message.includes('만료') ||
    message.includes('유효하지')
  ) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (message.includes('MySQL') || message.includes('DB')) {
    return '분석 기록 저장소 연결 상태를 확인해 주세요.';
  }

  return message || '요청 처리 중 오류가 발생했습니다.';
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUTS.history);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || '요청 처리 중 오류가 발생했습니다.');
    }

    return data;
  } catch (error) {
    throw new Error(getFriendlyHistoryError(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function saveAnalysisToServer({
  type,
  inputText,
  result,
  provider,
  model,
}) {
  return await requestJson(`${API_BASE_URL}/api/history`, {
    method: 'POST',
    body: JSON.stringify({
      type,
      inputText,
      result,
      provider,
      model,
    }),
  });
}

export async function getAnalysisHistory({
  type,
  limit = 50,
} = {}) {
  const params = new URLSearchParams();

  if (type) {
    params.set('type', type);
  }

  if (limit) {
    params.set('limit', String(limit));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE_URL}/api/history?${queryString}`
    : `${API_BASE_URL}/api/history`;

  const data = await requestJson(url, {
    method: 'GET',
  });

  return Array.isArray(data.items) ? data.items : [];
}

export async function getAnalysisHistoryById(id) {
  const data = await requestJson(`${API_BASE_URL}/api/history/${id}`, {
    method: 'GET',
  });

  return data.item;
}

export async function deleteAnalysisHistoryById(id) {
  return await requestJson(`${API_BASE_URL}/api/history/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteAllAnalysisHistory() {
  return await requestJson(`${API_BASE_URL}/api/history`, {
    method: 'DELETE',
  });
}