import { API_BASE_URL, REQUEST_TIMEOUTS, STATIC_DEMO } from '../config.js';
import { getAuthToken } from './authService.js';

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}

function getFriendlyTranscriptionError(error) {
  if (error?.name === 'AbortError') {
    return '음성 변환 요청 시간이 초과되었습니다. 더 짧은 파일로 다시 시도해 주세요.';
  }

  return error?.message || '음성 텍스트 변환 중 오류가 발생했습니다.';
}

function getFriendlyDocumentError(error) {
  if (error?.name === 'AbortError') {
    return '문서 추출 요청 시간이 초과되었습니다. 더 작은 파일로 다시 시도해 주세요.';
  }

  return error?.message || '문서 텍스트 추출 중 오류가 발생했습니다.';
}

function getAuthHeader() {
  const token = getAuthToken();

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function transcribeAudio(audioFile) {
  if (STATIC_DEMO) {
    throw new Error('포트폴리오 데모에서는 음성 변환을 사용할 수 없습니다. 예시 문장 또는 텍스트 파일을 이용해 주세요.');
  }

  if (!audioFile) {
    throw new Error('음성 파일을 선택해 주세요.');
  }

  const formData = new FormData();
  formData.append('audio', audioFile);

  const timeout = createTimeoutSignal(REQUEST_TIMEOUTS.audio || 60000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/audio/transcribe`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
      signal: timeout.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error || '음성 텍스트 변환 요청에 실패했습니다.'
      );
    }

    const text = String(data.text || '').trim();

    if (!text) {
      throw new Error('음성에서 변환된 텍스트가 비어 있습니다.');
    }

    return {
      text,
      model: data.model || '',
      filename: data.filename || audioFile.name,
    };
  } catch (error) {
    throw new Error(getFriendlyTranscriptionError(error));
  } finally {
    timeout.clear();
  }
}

export async function extractDocumentText(documentFile) {
  if (STATIC_DEMO) {
    throw new Error('포트폴리오 데모에서는 PDF·DOCX 추출을 사용할 수 없습니다. 예시 문장 또는 TXT 파일을 이용해 주세요.');
  }

  if (!documentFile) {
    throw new Error('문서 파일을 선택해 주세요.');
  }

  const formData = new FormData();
  formData.append('file', documentFile);

  const timeout = createTimeoutSignal(
    REQUEST_TIMEOUTS.document || REQUEST_TIMEOUTS.audio || 60000
  );

  try {
    const response = await fetch(`${API_BASE_URL}/api/files/extract-text`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
      signal: timeout.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error || '문서 텍스트 추출 요청에 실패했습니다.'
      );
    }

    const text = String(data.text || '').trim();

    if (!text) {
      throw new Error('문서에서 추출된 텍스트가 비어 있습니다.');
    }

    return {
      text,
      filename: data.filename || documentFile.name,
      mimeType: data.mimeType || documentFile.type || '',
      size: data.size || documentFile.size || 0,
    };
  } catch (error) {
    throw new Error(getFriendlyDocumentError(error));
  } finally {
    timeout.clear();
  }
}