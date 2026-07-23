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

function getFriendlyImageError(error) {
  if (error?.name === 'AbortError') {
    return '이미지 생성 요청 시간이 초과되었습니다. 내용을 조금 줄여 다시 시도해 주세요.';
  }

  return error?.message || '이미지 생성 중 오류가 발생했습니다.';
}

export async function generateNewsroomImage({
  title = '',
  content = '',
  target = '',
  style = '',
  size = '1024x1024',
  quality = 'high', // 기본값을 high로 변경
  outputFormat = 'png',
} = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanContent = String(content || '').trim();

  if (!cleanTitle && !cleanContent) {
    throw new Error('이미지 생성을 위한 제목 또는 기사 내용이 필요합니다.');
  }

  if (STATIC_DEMO) {
    await new Promise((resolve) => window.setTimeout(resolve, 650));

    const safeTitle = cleanTitle.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
    const safeTarget = String(target || '일반 독자').replace(/[&<>"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#10223f"/><stop offset="1" stop-color="#5d89c8"/></linearGradient></defs>
      <rect width="1024" height="1024" fill="url(#g)"/>
      <circle cx="840" cy="170" r="210" fill="#ffffff" opacity=".08"/>
      <circle cx="180" cy="900" r="260" fill="#ffffff" opacity=".06"/>
      <text x="84" y="120" fill="#bcd6ff" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4">NEWSROOM AI · DEMO</text>
      <line x1="84" y1="160" x2="940" y2="160" stroke="#ffffff" opacity=".35"/>
      <text x="84" y="390" fill="#ffffff" font-family="Arial, sans-serif" font-size="66" font-weight="800">${safeTitle.slice(0,22)}</text>
      <text x="84" y="465" fill="#e8f1ff" font-family="Arial, sans-serif" font-size="32">${safeTarget}</text>
      <rect x="84" y="690" width="856" height="160" rx="28" fill="#ffffff" opacity=".10"/>
      <text x="124" y="760" fill="#ffffff" font-family="Arial, sans-serif" font-size="28">포트폴리오 시연용 카드뉴스 이미지</text>
      <text x="124" y="810" fill="#d7e6ff" font-family="Arial, sans-serif" font-size="21">실제 AI 생성 결과가 아닌 정적 데모입니다.</text>
    </svg>`;

    return {
      imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      prompt: 'portfolio static demo',
      model: 'Static Demo',
      size,
      quality: 'demo',
      outputFormat: 'svg',
    };
  }

  const token = getAuthToken();

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  // [프롬프트 고도화] 얼굴 배제, 상황 중심, 실사 느낌, 안전한 톤을 유지하면서
  // 국기 등의 상징물을 찌그러짐 없이 완벽하게 구현하고, 주제를 은유적으로 표현하도록 유도
  const strictStylePrompt = "Photorealistic editorial news photography representing the core subject of the news article. Visualize the main concept using a single, clear, and profound metaphorical scenario or object. Focus strictly on the SITUATION, PLACE, and SCENE, but make it directly relatable to the theme of the article (e.g., diplomatic tables with national flags, an empty witness stand in a courtroom, a rising financial graph, an unfinished border wall). CRITICAL RULE 1: ABSOLUTELY NO human faces or recognizable specific people. CRITICAL RULE 2: If national flags or specific symbolic objects are rendered, ensure their patterns, colors, and proportions are PERFECTly accurate and precise, with NO distortion. If human presence is strictly necessary for the metaphor, use only blurred background crowds, extreme wide shots where people are part of the scenery, or high-contrast back-views/silhouettes. Maintain a safe, professional, journalistic tone suitable for news thumbnails.";
  
  const enforcedStyle = style ? `${strictStylePrompt} Additional style: ${style}` : strictStylePrompt;

  const timeout = createTimeoutSignal(REQUEST_TIMEOUTS.image || 120000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: cleanTitle,
        content: cleanContent,
        target,
        style: enforcedStyle, 
        size,
        quality: 'high', // 에러 해결: 허용된 값 중 가장 높은 'high' 사용
        outputFormat,
      }),
      signal: timeout.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || '이미지 생성 요청에 실패했습니다.');
    }

    if (!data.imageUrl) {
      throw new Error('이미지 생성 결과가 비어 있습니다.');
    }

    return {
      imageUrl: data.imageUrl,
      prompt: data.prompt || '',
      model: data.model || '',
      size: data.size || size,
      quality: data.quality || quality,
      outputFormat: data.outputFormat || outputFormat,
    };
  } catch (error) {
    throw new Error(getFriendlyImageError(error));
  } finally {
    timeout.clear();
  }
}