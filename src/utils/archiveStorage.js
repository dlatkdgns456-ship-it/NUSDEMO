const STORAGE_KEY = 'newsroom_ai_factcheck_archives';

export function getArchives() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('아카이브 불러오기 실패:', error);
    return [];
  }
}

export function saveArchive(result) {
  const archives = getArchives();

  const newArchive = {
    id: Date.now(),
    savedAt: new Date().toLocaleString('ko-KR'),
    title: makeArchiveTitle(result),
    result,
  };

  const nextArchives = [newArchive, ...archives].slice(0, 30);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextArchives));

  return nextArchives;
}

export function clearArchives() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

function makeArchiveTitle(result) {
  const person = result?.entities?.person || '분석 대상';
  const topic = result?.entities?.topic || '주제 없음';
  const label = result?.analysis?.label || '분석 결과';

  return `${person} · ${topic} · ${label}`;
}