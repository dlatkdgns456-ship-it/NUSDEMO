import { useState } from 'react';

function HumanReviewBox() {
  const [reviewStatus, setReviewStatus] = useState('need_review');
  const [memo, setMemo] = useState('');
  const [savedReview, setSavedReview] = useState(null);

  const handleSave = () => {
    if (!memo.trim()) {
      alert('검토 메모를 입력해 주세요.');
      return;
    }

    const statusLabel = {
      accepted: 'AI 결과 수용',
      needs_edit: '수정 필요',
      reanalyze: '재분석 필요',
      need_review: '검토 필요',
    };

    setSavedReview({
      status: reviewStatus,
      statusLabel: statusLabel[reviewStatus],
      memo,
      savedAt: new Date().toLocaleString('ko-KR'),
    });

    alert('기자 검토 메모가 저장되었습니다.');
  };

  return (
    <div className="res-section">
      <div className="sec-hdr">
        
        <span className="sec-title">기자 검토 메모</span>
      </div>

      <div
        className="verdict-banner unclear"
        style={{ margin: '0 0 1rem 0' }}
      >
        <div className="verdict-icon">ⓘ</div>
        <div>
          <div className="verdict-lbl">Human-in-the-Loop</div>
          <div className="verdict-txt">
            AI 분석 결과는 참고용입니다. 최종 판단은 기자가 원문, 맥락,
            출처를 직접 확인한 뒤 결정합니다.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button
          className={`act-btn ${reviewStatus === 'accepted' ? 'copied' : ''}`}
          onClick={() => setReviewStatus('accepted')}
        >
          AI 결과 수용
        </button>

        <button
          className={`act-btn ${reviewStatus === 'needs_edit' ? 'copied' : ''}`}
          onClick={() => setReviewStatus('needs_edit')}
        >
          수정 필요
        </button>

        <button
          className={`act-btn ${reviewStatus === 'reanalyze' ? 'copied' : ''}`}
          onClick={() => setReviewStatus('reanalyze')}
        >
          재분석 필요
        </button>
      </div>

      <textarea
        className="p-textarea"
        rows="5"
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        placeholder="AI 분석 결과 중 추가 확인이 필요한 부분, 표현 수정이 필요한 부분, 기자가 직접 검증해야 할 내용을 기록하세요."
      />

      <div className="action-row" style={{ padding: '.8rem 0 0' }}>
        <button className="act-btn" onClick={handleSave}>
          검토 메모 저장
        </button>
      </div>

      {savedReview && (
        <div
          className="verdict-banner consistent"
          style={{ margin: '1rem 0 0 0' }}
        >
          <div className="verdict-icon">✓</div>
          <div>
            <div className="verdict-lbl">
              {savedReview.statusLabel} · {savedReview.savedAt}
            </div>
            <div className="verdict-txt">{savedReview.memo}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HumanReviewBox;