import { useEffect, useState } from 'react';
import {
  getAnalysisHistory,
  getAnalysisHistoryById,
  deleteAnalysisHistoryById,
  deleteAllAnalysisHistory,
} from '../services/historyService';

function formatDate(value) {
  if (!value) return '저장 시간 확인 불가';

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function getArchiveTitle(item) {
  const result = item?.result || {};
  const entities = result.entities || {};
  const analysis = result.analysis || {};

  if (item.type === 'factcheck') {
    const person = entities.person || '분석 대상';
    const topic = entities.topic || analysis.label || '팩트체크 기록';
    return `${person} · ${topic}`;
  }

  if (item.type === 'persona') {
    return result.title || result.headline || '세대별 기사 기록';
  }

  return item.inputText || '분석 기록';
}

function getArchiveSummary(item) {
  const result = item?.result || {};
  const analysis = result.analysis || {};
  const correction = analysis.stanceCorrection;

  if (item.type === 'factcheck') {
    const summary = analysis.summary || item.inputText || '팩트체크 분석 결과';

    if (correction?.applied) {
      return `[입장 보정 적용] ${summary}`;
    }

    return summary;
  }

  if (item.type === 'persona') {
    return result.lead || result.body || item.inputText || '세대별 기사 생성 결과';
  }

  return item.inputText || '';
}

function getTypeLabel(type) {
  if (type === 'factcheck') return '팩트체크';
  if (type === 'persona') return '세대별 기사';
  return '기록';
}

function getFactCheckBadgeClass(result) {
  const verdict = result?.analysis?.verdict;

  if (verdict === 'complete_reversal') return 'badge-reversal';
  if (verdict === 'partial_shift') return 'badge-shift';
  if (verdict === 'consistent') return 'badge-consistent';

  return 'badge-unclear';
}

function getArchiveBadgeClass(archive) {
  if (archive.type === 'factcheck') {
    return getFactCheckBadgeClass(archive.result || {});
  }

  if (archive.type === 'persona') {
    return 'badge-consistent';
  }

  return 'badge-unclear';
}

function SidebarArchive({ open, setOpen, onLoadArchive }) {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadArchives = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const items = await getAnalysisHistory({
        limit: 50,
      });

      setArchives(items);
    } catch (error) {
      console.error('[Archive Load Error]', error);
      setErrorMessage(error.message || '분석 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    loadArchives();
  }, [open]);

  const handleLoad = async (archive) => {
    try {
      const detail = await getAnalysisHistoryById(archive.id);

      if (!detail?.result) {
        alert('불러올 분석 결과가 없습니다.');
        return;
      }

      onLoadArchive?.(detail);
      setOpen(false);
    } catch (error) {
      console.error('[Archive Detail Load Error]', error);
      alert(`분석 기록을 불러오지 못했습니다.\n${error.message}`);
    }
  };

  const handleDeleteOne = async (event, archive) => {
    event.stopPropagation();

    const ok = confirm('이 분석 기록을 삭제할까요?');
    if (!ok) return;

    try {
      await deleteAnalysisHistoryById(archive.id);
      setArchives((prev) => prev.filter((item) => item.id !== archive.id));
    } catch (error) {
      console.error('[Archive Delete Error]', error);
      alert(`분석 기록을 삭제하지 못했습니다.\n${error.message}`);
    }
  };

  const handleDeleteAll = async () => {
    const ok = confirm('모든 분석 아카이브 기록을 삭제할까요?');
    if (!ok) return;

    try {
      await deleteAllAnalysisHistory();
      setArchives([]);
      setErrorMessage('');
    } catch (error) {
      console.error('[Archive Delete All Error]', error);
      alert(`전체 분석 기록을 삭제하지 못했습니다.\n${error.message}`);
    }
  };

  const handleRefresh = () => {
    loadArchives();
  };

  return (
    <>
      <div
        id="sidebar-overlay"
        className={open ? 'show' : ''}
        onClick={() => setOpen(false)}
      />

      <aside id="sidebar" className={open ? 'open' : ''}>
        <div className="sb-head">
          <div className="sb-title-wrap">
            <span className="sb-line-folder" aria-hidden="true" />

            <div>
              <div className="sb-title">분석 아카이브</div>
              <div className="sb-subtitle">저장된 분석 결과를 다시 불러옵니다</div>
            </div>
          </div>

          <button
            type="button"
            className="sb-close"
            onClick={() => setOpen(false)}
            title="아카이브 닫기"
          >
            ✕
          </button>
        </div>

        <div className="sb-body">
          {loading && (
            <div className="sb-empty">
              MySQL에서 분석 기록을 불러오는 중입니다.
            </div>
          )}

          {!loading && errorMessage && (
            <div className="sb-empty">
              {errorMessage}
              <br />
              서버와 MySQL 연결 상태를 확인해 주세요.
            </div>
          )}

          {!loading && !errorMessage && archives.length === 0 && (
            <div className="sb-empty">
              저장된 분석 기록이 없습니다.
              <br />
              분석 후 자동 저장됩니다.
            </div>
          )}

          {!loading &&
            !errorMessage &&
            archives.map((archive) => {
              const title = getArchiveTitle(archive);
              const summary = getArchiveSummary(archive);
              const badgeClass = getArchiveBadgeClass(archive);

              return (
                <div
                  key={archive.id}
                  className="sb-item"
                  onClick={() => handleLoad(archive)}
                >
                  <div className="sb-item-top">
                    <div className="sb-item-name">
                      {title.length > 42
                        ? `${title.slice(0, 42)}...`
                        : title}
                    </div>

                    <button
                      className="sb-delete-one"
                      type="button"
                      onClick={(event) => handleDeleteOne(event, archive)}
                      title="이 기록 삭제"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="sb-item-meta">
                    {formatDate(archive.createdAt)}
                  </div>

                  {summary && (
                    <div className="sb-item-desc">
                      {summary.length > 70
                        ? `${summary.slice(0, 70)}...`
                        : summary}
                    </div>
                  )}

                  <div className="sb-badge-row">
                    <span className={`sb-badge ${badgeClass}`}>
                      {getTypeLabel(archive.type)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="sb-foot">
          <button
            type="button"
            className="sb-clear"
            onClick={handleRefresh}
          >
            기록 새로고침
          </button>

          <button
            type="button"
            className="sb-clear sb-clear-danger"
            onClick={handleDeleteAll}
          >
            전체 삭제
          </button>
        </div>
      </aside>
    </>
  );
}

export default SidebarArchive;