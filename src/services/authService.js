import { API_BASE_URL, REQUEST_TIMEOUTS } from '../config';

const AUTH_TOKEN_KEY = 'newsroom_ai_jwt';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveAuthToken(token) {
  if (!token) return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function getAuthHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function getFriendlyAuthError(error) {
  const message = String(error?.message || '');

  if (error?.name === 'AbortError') {
    return '서버 응답 시간이 길어 요청이 중단되었습니다.';
  }

  if (message.includes('Failed to fetch')) {
    return '서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.';
  }

  if (
    message.includes('만료') ||
    message.includes('유효하지') ||
    message.includes('로그인이 필요합니다') ||
    message.includes('401')
  ) {
    return '로그인 정보가 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.';
  }

  return message || '인증 요청 처리 중 오류가 발생했습니다.';
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUTS.auth);

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
    throw new Error(getFriendlyAuthError(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function registerUser({ email, password }) {
  const data = await requestJson(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (data.token) {
    saveAuthToken(data.token);
  }

  return data;
}

export async function loginUser({ email, password }) {
  const data = await requestJson(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (data.token) {
    saveAuthToken(data.token);
  }

  return data;
}

export async function getCurrentUser() {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const data = await requestJson(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
    });

    return data.user || null;
  } catch (error) {
    clearAuthToken();
    throw error;
  }
}

export function logoutUser() {
  clearAuthToken();
}