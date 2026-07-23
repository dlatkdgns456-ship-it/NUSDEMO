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

function getFriendlyYouTubeError(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError') {
    return 'YouTube 검색 응답 시간이 길어 검색을 건너뛰었습니다.';
  }

  if (message.includes('Failed to fetch')) {
    return 'YouTube 검색 서버에 연결할 수 없습니다.';
  }

  if (message.includes('로그인') || message.includes('만료')) {
    return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (message.includes('YOUTUBE_API_KEY')) {
    return 'YouTube API 키 설정을 확인해 주세요.';
  }

  if (message.includes('quota') || message.includes('할당량')) {
    return 'YouTube Data API 사용량 한도를 확인해 주세요.';
  }

  if (message.includes('timeout') || message.includes('시간')) {
    return 'YouTube 검색 응답 시간이 길어 검색을 건너뛰었습니다.';
  }

  return message || 'YouTube 영상 검색에 실패했습니다.';
}

export async function searchYouTubeSources({
  query,
  display = 5,
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
  }, REQUEST_TIMEOUTS.youtube);

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      display: String(display),
    });

    const response = await fetch(
      `${API_BASE_URL}/api/video/youtube/search?${params.toString()}`,
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
      throw new Error(data?.error || 'YouTube 영상 검색에 실패했습니다.');
    }

    return {
      query: data.query || query,
      total: data.total || 0,
      items: Array.isArray(data.items) ? data.items : [],
    };
  } catch (error) {
    throw new Error(getFriendlyYouTubeError(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}