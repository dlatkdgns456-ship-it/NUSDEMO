import { useState } from 'react';
import HumanReviewBox from './HumanReviewBox';

function getVerdictClass(verdict) {
  if (verdict === 'complete_reversal') return 'reversal';
  if (verdict === 'partial_shift') return 'shift';
  if (verdict === 'consistent') return 'consistent';
  return 'unclear';
}

function getVerdictAccent(verdict) {
  if (verdict === 'consistent') return 'var(--nr-result-blue-strong)';
  if (verdict === 'complete_reversal') return 'var(--nr-result-orange-strong)';
  if (verdict === 'partial_shift') return 'var(--nr-result-purple-strong)';
  return 'var(--nr-result-source-strong)';
}

function getConflictTone(statement) {
  return statement?.hasConflict ? 'conflict' : 'consistent';
}

// 상반 가능성 -> 일관되지 않음으로 직관적 변경
function getConflictLabel(statement) {
  return statement?.hasConflict ? '일관되지 않음' : '일관된 흐름';
}

// 상반 판단일 경우 눈에 확 띄는 빨간색 계열 적용
function getConflictColor(statement) {
  return statement?.hasConflict
    ? '#ef4444' 
    : 'var(--nr-result-blue-strong)';
}

function getEvidenceLevelLabel(level) {
  if (level === 'high') return '강한 확인 필요';
  if (level === 'low') return '낮은 확인 필요';
  return '확인 필요';
}

const evidenceRules = [
  { phrase: '역대 최대', reason: '비교 기준·기간·예산 범위 확인 필요', level: 'high' },
  { phrase: '최대 규모', reason: '비교 기준과 산정 방식 확인 필요', level: 'high' },
  { phrase: '대부분', reason: '조사 자료·표본·응답 비율 확인 필요', level: 'medium' },
  { phrase: '다수', reason: '구체적인 인원·비율·출처 확인 필요', level: 'medium' },
  { phrase: '효과가 없다', reason: '실증 자료·평가 기준 확인 필요', level: 'high' },
  { phrase: '효과 없다', reason: '실증 자료·평가 기준 확인 필요', level: 'high' },
  { phrase: '국민이 원하지 않는', reason: '여론조사 자료와 조사 시점 확인 필요', level: 'high' },
  { phrase: '논란', reason: '논란의 주체와 근거 자료 확인 필요', level: 'medium' },
  { phrase: '의혹', reason: '제기 주체와 검증된 사실관계 확인 필요', level: 'high' },
  { phrase: '문제', reason: '문제의 범위와 객관 자료 확인 필요', level: 'medium' },
  { phrase: '강조', reason: '발언 맥락과 반복 여부 확인 필요', level: 'low' },
];

function cleanDisplayText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueTexts(items) {
  const seen = new Set();
  return items
    .map((item) => cleanDisplayText(item))
    .filter(Boolean)
    .filter((item) => item.length >= 2)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getHighlightKeywords(entities) {
  const keywords = Array.isArray(entities?.keywords) ? entities.keywords : [];
  return uniqueTexts([entities?.person, entities?.topic, ...keywords]).slice(0, 12);
}

function highlightKeywordText(text, keywords = []) {
  const cleanText = cleanDisplayText(text);
  if (!cleanText || keywords.length === 0) return cleanText;

  const phrases = uniqueTexts(keywords)
    .filter((keyword) => cleanText.toLowerCase().includes(keyword.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  if (phrases.length === 0) return cleanText;

  const pattern = new RegExp(`(${phrases.map((phrase) => escapeRegExp(phrase)).join('|')})`, 'gi');

  return cleanText.split(pattern).map((part, index) => {
    const matched = phrases.find((phrase) => phrase.toLowerCase() === part.toLowerCase());
    if (!matched) return part;
    return <mark key={`${part}-${index}`} className="keyword-mark">{part}</mark>;
  });
}

function getEvidenceItems(result) {
  if (Array.isArray(result?.evidenceItems) && result.evidenceItems.length > 0) {
    return result.evidenceItems;
  }
  const text = result?.currentText || result?.entities?.todaySummary || result?.analysis?.summary || '';
  const found = [];
  evidenceRules.forEach((rule) => {
    if (text.includes(rule.phrase) && !found.some((item) => item.phrase === rule.phrase)) {
      found.push(rule);
    }
  });
  return found;
}

function highlightEvidenceText(text, items) {
  if (!text || items.length === 0) return text;
  const phrases = items.map((item) => item.phrase).filter(Boolean).sort((a, b) => b.length - a.length);
  if (phrases.length === 0) return text;
  const pattern = new RegExp(`(${phrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

  return text.split(pattern).map((part, index) => {
    const matched = items.find((item) => item.phrase === part);
    if (!matched) return part;
    return <mark key={`${part}-${index}`} className={`ev-mark ${matched.level || 'medium'}`}>{part}</mark>;
  });
}

function getNewsSources(result) {
  if (!Array.isArray(result?.usedNewsSources)) return [];
  return result.usedNewsSources.filter((item) => item && (item.title || item.description)).slice(0, 15);
}

function getAssemblySources(result) {
  if (!Array.isArray(result?.usedAssemblySources)) return [];
  return result.usedAssemblySources.filter((item) => item && item.title).slice(0, 5);
}

function getAssemblySpeechSources(result) {
  if (!Array.isArray(result?.usedAssemblySpeechSources)) return [];
  return result.usedAssemblySpeechSources.filter((item) => item && (item.title || item.speaker)).slice(0, 5);
}

function getYouTubeSources(result) {
  if (!Array.isArray(result?.usedYouTubeSources)) return [];
  return result.usedYouTubeSources.filter((item) => item && item.title).slice(0, 5);
}

function getNewsLink(item) {
  return item?.originallink || item?.link || '';
}

// 타임라인용 원문 링크 추출
function getTimelineLink(statement) {
  return statement?.originallink || statement?.link || statement?.detailLink || statement?.url || statement?.sourceUrl || '';
}

function getSourceLabel(item) {
  const link = getNewsLink(item);
  if (!link) return '출처 링크 없음';
  try {
    const url = new URL(link);
    return url.hostname.replace('www.', '');
  } catch {
    return '뉴스 출처';
  }
}

function getCleanDate(value) {
  if (!value) return '일자 확인 필요';
  try { return String(value).slice(0, 10); } catch { return value; }
}

function hasActualQuote(statement) {
  const quote = cleanDisplayText(statement?.quote);
  if (!quote) return false;
  const uncertainPatterns = [
    '원문 확인 필요', '기사 원문 확인 필요', '영상 원문 확인 필요',
    '발언 내용 확인 필요', '관련 발언영상 확인 필요', '회의 제목 확인 필요',
    '제목 확인 필요', '확인 후보', '기사 제목', '제목·요약 기반',
  ];
  return !uncertainPatterns.some((pattern) => quote.includes(pattern));
}

function getTimelineSummary(statement) {
  const summary = cleanDisplayText(statement?.summary);
  if (summary) return summary;
  const quote = cleanDisplayText(statement?.quote);
  if (!quote) return '요약 정보가 없습니다. 원문 확인 후 비교가 필요합니다.';
  return quote
    .replace(/—\s*기사 원문 확인 필요/g, '')
    .replace(/관련 발언영상 확인 필요/g, '')
    .replace(/원문 확인 필요/g, '')
    .replace(/\s+/g, ' ').trim() || '요약 정보가 없습니다. 원문 확인 후 비교가 필요합니다.';
}

function getSourceTotal({ newsSources, assemblySources, assemblySpeechSources, youtubeSources }) {
  return newsSources.length + assemblySources.length + assemblySpeechSources.length + youtubeSources.length;
}

function getSearchRangeLabel(result) {
  return result?.searchRangeLabel || '검색 기간 확인 필요';
}

function SourceSummaryCard({ label, count, desc, tone = 'source' }) {
  return (
    <div className={`source-summary-card source-summary-${tone}`}>
      <div className="source-summary-count">{count}</div>
      <div>
        <div className="source-summary-label">{label}</div>
        <div className="source-summary-desc">{desc}</div>
      </div>
    </div>
  );
}

// 텍스트 기반의 깔끔한 접기/펼치기 버튼
const ToggleButton = ({ isExpanded, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      border: 'none',
      color: 'var(--text3)',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      padding: '4px 8px',
      outline: 'none',
      whiteSpace: 'nowrap'
    }}
  >
    {isExpanded ? '접기 ▲' : '자세히 보기 ▼'}
  </button>
);

function FactCheckResult({ result, onNewAnalysis }) {
  // 접기/펼치기 제어를 위한 상태 (순서 변경 및 API 출처 기본 닫힘 적용)
  const [showEvidence, setShowEvidence] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showQuestions, setShowQuestions] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  
  // API 출처들은 처음에 모두 접힌 상태로 설정
  const [showNews, setShowNews] = useState(false);
  const [showSpeech, setShowSpeech] = useState(false);
  const [showAssembly, setShowAssembly] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);

  const entities = result?.entities || {};
  const analysis = result?.analysis || {};
  const pastStatements = Array.isArray(result?.pastStatements) ? result.pastStatements : [];
  const questions = Array.isArray(result?.questions) ? result.questions : [];

  const verdictClass = getVerdictClass(analysis.verdict);
  const verdictAccent = getVerdictAccent(analysis.verdict);
  const highlightKeywords = getHighlightKeywords(entities);
  const evidenceItems = getEvidenceItems(result);
  const evidenceText = result?.currentText || entities.todaySummary || analysis.summary || '';

  const newsSources = getNewsSources(result);
  const assemblySources = getAssemblySources(result);
  const assemblySpeechSources = getAssemblySpeechSources(result);
  const youtubeSources = getYouTubeSources(result);
  const sourceTotal = getSourceTotal({ newsSources, assemblySources, assemblySpeechSources, youtubeSources });

  const conflictCount = pastStatements.filter((item) => item.hasConflict).length;

  const handleCopy = async () => {
    const text = [
      `[분석 대상] ${entities.person || ''} / ${entities.topic || ''}`,
      `[검색 기간] ${getSearchRangeLabel(result)}`,
      `[판정] ${analysis.label || ''}`,
      `[요약] ${analysis.summary || ''}`,
      '',
      '[근거 확인 필요]',
      ...(evidenceItems.length > 0
        ? evidenceItems.map((item) => `- ${item.phrase}: ${item.reason}`)
        : ['- 자동 탐지된 근거 확인 표현 없음']),
      '',
      '[과거 발언·기사 후보 타임라인]',
      ...(pastStatements.length > 0
        ? pastStatements.map((statement, index) => {
            const actualQuote = hasActualQuote(statement);
            const label = actualQuote ? '실제 발언 후보' : '요약 후보';
            return `${index + 1}. ${statement.date || '일자 확인'} / ${statement.source || '출처 확인 필요'}\n   [${label}] ${actualQuote ? statement.quote : getTimelineSummary(statement)}\n   ${statement.conflictNote || '원문 확인 후 비교 검토 필요'}`;
          })
        : ['- 비교 가능한 과거 발언·기사 후보 없음']),
      '',
      '[참고 뉴스 출처]',
      ...(newsSources.length > 0
        ? newsSources.map((item, index) => {
            const link = getNewsLink(item);
            return `${index + 1}. ${cleanDisplayText(item.title) || '제목 없음'}\n   ${cleanDisplayText(item.description) || ''}\n   ${link}`;
          })
        : ['- 참고 뉴스 출처 없음']),
      '',
      '[국회 발언영상 후보]',
      ...(assemblySpeechSources.length > 0
        ? assemblySpeechSources.map((item, index) => {
            return `${index + 1}. ${item.title || '회의 제목 확인 필요'}\n   발언자: ${item.speaker || '확인 필요'}\n   회의일자: ${item.takingDate || '확인 필요'}\n   ${item.detailLink || ''}`;
          })
        : ['- 국회 발언영상 후보 없음']),
      '',
      '[국회 공식자료]',
      ...(assemblySources.length > 0
        ? assemblySources.map((item, index) => {
            return `${index + 1}. ${item.title || '제목 없음'}\n   유형: ${item.sourceLabel || '국회 공식자료'}\n   상태: ${item.status || '확인 필요'}\n   ${item.link || ''}`;
          })
        : ['- 국회 공식자료 없음']),
      '',
      '[YouTube 영상 출처 후보]',
      ...(youtubeSources.length > 0
        ? youtubeSources.map((item, index) => {
            return `${index + 1}. ${item.title || '제목 없음'}\n   채널: ${item.channelTitle || '확인 필요'}\n   ${item.link || ''}`;
          })
        : ['- 영상 출처 후보 없음']),
      '',
      '[취재 질문]',
      ...(questions.length > 0
        ? questions.map((question, index) => `Q${index + 1}. ${question}`)
        : ['- 생성된 질문 없음']),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('분석 결과를 복사했습니다.');
    } catch {
      alert('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.');
    }
  };

  return (
    <div className="result-wrap show">
      {result?.isMock && (
        <div className="verdict-banner unclear">
          <div>
            <div className="verdict-lbl">시연용 예시 화면</div>
            <div className="verdict-txt">{result.demoNotice}</div>
          </div>
        </div>
      )}

      {/* 분석 개요 */}
      <div className="result-overview-card">
        <div className="result-overview-main">
          <div className="result-overview-kicker">분석 개요</div>
          <div className="result-overview-title">
            {entities.person || '대상 미확인'} · {entities.topic || '주제 미확인'}
          </div>
          <div className="result-overview-desc">
            {highlightKeywordText(
              entities.todaySummary || analysis.summary || '입력문을 기준으로 발언 맥락과 과거 후보를 비교했습니다.',
              highlightKeywords
            )}
          </div>
        </div>
        <div className="result-overview-meta">
          <div className="result-meta-pill">검색 기간 <strong>{getSearchRangeLabel(result)}</strong></div>
          <div className="result-meta-pill">참고 출처 <strong>{sourceTotal}건</strong></div>
          <div className="result-meta-pill">과거 후보 <strong>{pastStatements.length}건</strong></div>
        </div>
      </div>

      {/* 핵심 키워드 */}
      <div className="entity-bar result-keyword-bar">
        <span className="entity-lbl">핵심 키워드</span>
        <span className="echip echip-person">{entities.person || '대상 미확인'}</span>
        <span className="echip echip-topic">{entities.topic || '주제 미확인'}</span>
        {(Array.isArray(entities.keywords) ? entities.keywords : []).map((keyword) => (
          <span key={keyword} className="echip echip-kw">{keyword}</span>
        ))}
      </div>

      {/* 현재 판정 3구획 매트릭스 */}
      <div className="metrics-row result-metrics-row">
        <div className={`metric-box metric-box-verdict metric-${verdictClass}`}>
          <div className="metric-lbl" style={{ color: verdictAccent }}>현재 판정</div>
          <div className="metric-main-label">{analysis.label || '입장 변화 분석'}</div>
          <div className="metric-sub">{analysis.credibilityReason || '원문과 출처 확인이 필요합니다.'}</div>
        </div>

        <div className={`metric-box metric-box-conflict ${conflictCount > 0 ? 'has-conflict' : 'no-conflict'}`}>
          <div className="metric-val">{conflictCount}</div>
          <div className="metric-lbl">일관되지 않음</div>
          <div className="metric-sub">{pastStatements.length}건 중</div>
        </div>

        <div className="metric-box metric-box-source">
          <div className="metric-val">{sourceTotal}</div>
          <div className="metric-lbl">참고 출처</div>
          <div className="metric-sub">뉴스·국회·영상</div>
        </div>
      </div>

      {/* 최종 요약 배너 */}
      <div className={`verdict-banner result-verdict-card ${verdictClass}`} style={{ borderLeft: `4px solid ${verdictAccent}` }}>
        <div>
          <div className="verdict-lbl" style={{ color: verdictAccent }}>{analysis.label || '분석 결과'}</div>
          <div className="verdict-txt">
            {highlightKeywordText(analysis.summary || '분석 요약이 없습니다.', highlightKeywords)}
          </div>
        </div>
      </div>

      {/* 1. 근거 필요 표시 */}
      <div className="evidence-wrap evidence-premium result-block-evidence">
        <div className="evidence-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="evidence-title">근거 필요 표시</span>
            <div className="evidence-sub">단정적 표현, 수치 표현, 여론 표현처럼 추가 확인이 필요한 문장을 표시합니다.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="evidence-count">{evidenceItems.length}개 표현</span>
            <ToggleButton isExpanded={showEvidence} onClick={() => setShowEvidence(!showEvidence)} />
          </div>
        </div>

        {showEvidence && (
          <>
            <div className="evidence-text">
              {evidenceItems.length > 0 ? highlightEvidenceText(evidenceText, evidenceItems) : '현재 문장에서 자동 탐지된 근거 확인 표현이 없습니다.'}
            </div>
            {evidenceItems.length > 0 && (
              <div className="evidence-list">
                {evidenceItems.map((item) => (
                  <div key={item.phrase} className={`evidence-item evidence-${item.level || 'medium'}`}>
                    <span className={`ev-dot ${item.level || 'medium'}`} />
                    <div className="ev-content">
                      <div className="ev-line">
                        <span className="ev-phrase">{item.phrase}</span>
                        <span className="ev-level">{getEvidenceLevelLabel(item.level)}</span>
                      </div>
                      <div className="ev-reason">{item.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. 과거 발언·기사 타임라인 */}
      <div className="res-section timeline-section">
        <div className="sec-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="sec-title">과거 발언·기사 후보 타임라인</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="sec-count">{pastStatements.length}건</span>
            <ToggleButton isExpanded={showTimeline} onClick={() => setShowTimeline(!showTimeline)} />
          </div>
        </div>

        {showTimeline && (
          <div className="timeline">
            {pastStatements.length > 0 ? (
              pastStatements.map((statement, index) => {
                const actualQuote = hasActualQuote(statement);
                const tone = getConflictTone(statement);
                const color = getConflictColor(statement);
                const summary = getTimelineSummary(statement);
                const link = getTimelineLink(statement); // 타임라인 원문 링크 추출

                return (
                  <div key={`${statement.date || index}-${statement.source || index}`} className={`tl-item ${tone}`} style={{ borderLeft: `4px solid ${color}` }}>
                    
                    <div className="tl-left">
                      <div className="tl-date">{statement.date || '일자 확인'}</div>
                      <div className="tl-tone-label" style={{
                        color: statement?.hasConflict ? '#ef4444' : 'var(--blue)',
                        fontWeight: '900',
                        backgroundColor: statement?.hasConflict ? '#fef2f2' : 'transparent',
                        padding: statement?.hasConflict ? '4px 8px' : '0',
                        borderRadius: '6px',
                        marginTop: '4px',
                        textAlign: 'center',
                        fontSize: '12px',
                        marginLeft: statement?.hasConflict ? '-13px' : '0'
                      }}>
                        {getConflictLabel(statement)}
                      </div>
                    </div>

                    <div className="tl-right">
                      {/* 원문 보기 버튼을 여기서 제거하고 박스 우측 하단으로 이동 */}
                      <div className="tl-source">
                        <span>{statement.source || '출처 확인 필요'}</span>
                      </div>

                      {actualQuote ? (
                        <>
                          <div className="tl-type-label">실제 발언 후보</div>
                          <div className="tl-quote" style={{ borderLeft: `3px solid ${color}` }}>
                            “{highlightKeywordText(statement.quote, highlightKeywords)}”
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="tl-type-label">요약 후보</div>
                          <div className="tl-quote">
                            {highlightKeywordText(summary, highlightKeywords)}
                          </div>
                          <div className="tl-conflict-note" style={{ color: 'var(--nr-result-source-strong)' }}>
                            기사 제목·요약 또는 영상 메타데이터 기반 후보입니다. 실제 문장 인용은 원문 확인이 필요합니다.
                          </div>
                        </>
                      )}

                      {/* 일관되지 않음 🚨 하이라이트 박스 추가 */}
                      {statement.conflictNote && (
                        <div className="tl-conflict-note" style={{
                          color: statement?.hasConflict ? '#b91c1c' : 'var(--result-sub)',
                          backgroundColor: statement?.hasConflict ? '#fef2f2' : 'transparent',
                          padding: statement?.hasConflict ? '12px 16px' : '0',
                          borderLeft: statement?.hasConflict ? '3px solid #ef4444' : 'none',
                          borderRadius: statement?.hasConflict ? '8px' : '0',
                          marginTop: '12px',
                          fontWeight: statement?.hasConflict ? '700' : 'normal'
                        }}>
                          {statement?.hasConflict ? '🚨 판단 근거: ' : '비교 메모: '}
                          {statement.conflictNote}
                        </div>
                      )}

                      {/* ▼ 원문 보기 버튼을 박스의 우측 하단에 고정 ▼ */}
                      {link && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-10px' }}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="news-source-link"
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              backgroundColor: 'var(--surface2)',
                              borderRadius: '999px',
                              color: 'var(--blue)',
                              textDecoration: 'none',
                              fontWeight: '800'
                            }}
                          >
                            원문 보기
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-note">비교 가능한 과거 발언·기사 후보가 아직 정리되지 않았습니다.</div>
            )}
          </div>
        )}
      </div>

      {/* 3. 취재 질문 후보 */}
      <div className="res-section question-section">
        <div className="sec-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="sec-title">취재 질문 후보</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="sec-count">{questions.length}개</span>
            <ToggleButton isExpanded={showQuestions} onClick={() => setShowQuestions(!showQuestions)} />
          </div>
        </div>

        {showQuestions && (
          <div className="qs-list">
            {questions.length > 0 ? (
              questions.map((question, index) => (
                <div key={`${question}-${index}`} className="qs-item">
                  <span className="qs-num">Q{index + 1}</span>
                  <span className="qs-text">{highlightKeywordText(question, highlightKeywords)}</span>
                </div>
              ))
            ) : (
              <div className="empty-note">생성된 취재 질문이 없습니다.</div>
            )}
          </div>
        )}
      </div>

      {/* 4. 출처 수집 현황 */}
      <div className="source-summary-wrap result-block-source-summary">
        <div className="source-summary-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="source-summary-title">출처 수집 현황</div>
            <div className="source-summary-sub">분석에 활용된 검색 결과를 API별로 분리해 표시합니다.</div>
          </div>
          <ToggleButton isExpanded={showSummary} onClick={() => setShowSummary(!showSummary)} />
        </div>

        {showSummary && (
          <div className="source-summary-grid">
            <SourceSummaryCard label="네이버 뉴스" count={newsSources.length} desc="기사 기반 과거 발언·입장 후보" tone="news" />
            <SourceSummaryCard label="국회 발언영상" count={assemblySpeechSources.length} desc="공식 발언영상 후보" tone="speech" />
            <SourceSummaryCard label="국회 공식자료" count={assemblySources.length} desc="법안·정책 맥락 자료" tone="assembly" />
            <SourceSummaryCard label="YouTube 영상" count={youtubeSources.length} desc="영상 원출처 후보" tone="youtube" />
          </div>
        )}
      </div>

      {/* 5. 개별 API 리스트 (뉴스, 국회, 유튜브 등) - 각각 토글 버튼 배치 및 기본 숨김 처리 */}
      {newsSources.length > 0 && (
        <div className="news-source-wrap news-source-news">
          <div className="news-source-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="news-source-title">참고 뉴스 출처</div>
              <div className="news-source-sub">네이버 뉴스 검색 API로 수집한 참고 기사입니다. 최종 사실 판단은 기자 검토가 필요합니다.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="news-source-count">{newsSources.length}건</span>
              <ToggleButton isExpanded={showNews} onClick={() => setShowNews(!showNews)} />
            </div>
          </div>
          {showNews && (
            <div className="news-source-list">
              {newsSources.map((item, index) => {
                const link = getNewsLink(item);
                return (
                  <div key={`${item.title}-${index}`} className="news-source-item">
                    <div className="news-source-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="news-source-body">
                      <div className="news-source-name">{highlightKeywordText(item.title || '제목 없음', highlightKeywords)}</div>
                      <div className="news-source-desc">{highlightKeywordText(item.description || '요약 정보가 없습니다.', highlightKeywords)}</div>
                      <div className="news-source-meta">
                        <span>{item.pubDate || '발행일 확인 필요'}</span>
                        <span>{getSourceLabel(item)}</span>
                        {link && <a href={link} target="_blank" rel="noreferrer" className="news-source-link">원문 보기</a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {assemblySpeechSources.length > 0 && (
        <div className="news-source-wrap news-source-speech">
          <div className="news-source-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="news-source-title">국회 발언영상 후보</div>
              <div className="news-source-sub">열린국회정보 API로 수집한 국회의원 영상회의록 기반 발언 후보입니다.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="news-source-count">{assemblySpeechSources.length}건</span>
              <ToggleButton isExpanded={showSpeech} onClick={() => setShowSpeech(!showSpeech)} />
            </div>
          </div>
          {showSpeech && (
            <div className="news-source-list">
              {assemblySpeechSources.map((item, index) => (
                <div key={`${item.title || item.speaker}-${index}`} className="news-source-item">
                  <div className="news-source-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="news-source-body">
                    <div className="news-source-name">{highlightKeywordText(item.title || '회의 제목 확인 필요', highlightKeywords)}</div>
                    <div className="news-source-desc">{item.speaker || '발언자 확인 필요'}{item.playTime ? ` · 재생시간 ${item.playTime}` : ''}</div>
                    <div className="news-source-meta">
                      <span>{item.sourceLabel || '국회의원 영상회의록'}</span>
                      <span>{item.takingDate || '회의일자 확인 필요'}</span>
                      {item.detailLink && <a href={item.detailLink} target="_blank" rel="noreferrer" className="news-source-link">영상회의록 보기</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {assemblySources.length > 0 && (
        <div className="news-source-wrap news-source-assembly">
          <div className="news-source-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="news-source-title">국회 공식자료 후보</div>
              <div className="news-source-sub">열린국회정보 API로 수집한 의안·법안 관련 공식자료 후보입니다.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="news-source-count">{assemblySources.length}건</span>
              <ToggleButton isExpanded={showAssembly} onClick={() => setShowAssembly(!showAssembly)} />
            </div>
          </div>
          {showAssembly && (
            <div className="news-source-list">
              {assemblySources.map((item, index) => (
                <div key={`${item.billNo || item.title}-${index}`} className="news-source-item">
                  <div className="news-source-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="news-source-body">
                    <div className="news-source-name">{highlightKeywordText(item.title || '제목 없음', highlightKeywords)}</div>
                    <div className="news-source-desc">{item.proposer || '제안자 확인 필요'}{item.status ? ` · ${item.status}` : ''}{item.committee ? ` · ${item.committee}` : ''}</div>
                    <div className="news-source-meta">
                      <span>{item.sourceLabel || '국회 공식자료'}</span>
                      <span>{item.billNo || '의안번호 확인 필요'}</span>
                      <span>{item.date || '일자 확인 필요'}</span>
                      {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="news-source-link">원문 보기</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {youtubeSources.length > 0 && (
        <div className="news-source-wrap news-source-youtube">
          <div className="news-source-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="news-source-title">YouTube 영상 출처 후보</div>
              <div className="news-source-sub">YouTube Data API로 수집한 영상 후보입니다. 실제 발언 원문과 맥락은 영상 확인이 필요합니다.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="news-source-count">{youtubeSources.length}건</span>
              <ToggleButton isExpanded={showYoutube} onClick={() => setShowYoutube(!showYoutube)} />
            </div>
          </div>
          {showYoutube && (
            <div className="news-source-list">
              {youtubeSources.map((item, index) => (
                <div key={`${item.videoId || item.title}-${index}`} className="news-source-item">
                  <div className="news-source-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="news-source-body">
                    <div className="news-source-name">{highlightKeywordText(item.title || '제목 없음', highlightKeywords)}</div>
                    <div className="news-source-desc">{item.description || '영상 설명이 없습니다.'}</div>
                    <div className="news-source-meta">
                      <span>{item.channelTitle || '채널 확인 필요'}</span>
                      <span>{getCleanDate(item.publishedAt)}</span>
                      {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="news-source-link">영상 보기</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. 기자 검토 메모 (토글 및 중복 제목 제거 후 원본 유지) */}
      <div className="res-section">
        <HumanReviewBox />
      </div>

      <div className="action-row">
        <button className="act-btn" onClick={handleCopy}>결과 복사</button>
        <button className="act-btn" onClick={() => window.print()}>인쇄</button>
        <button className="act-btn" onClick={onNewAnalysis}>새 분석</button>
      </div>
    </div>
  );
}

export default FactCheckResult;