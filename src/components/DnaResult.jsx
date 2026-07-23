import {
  normalizeHabitItems,
  normalizeSignaturePhrases,
  normalizeTodayQuestions,
} from '../utils/normalizers';

function getText(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function getRepeatLabel(item) {
  if (item?.repeatedInCurrent === true) return '이번 발언에서도 반복';
  if (item?.repeatedInCurrent === false) return '이번 발언에서는 약함';
  return '반복 여부 확인 필요';
}

function getRepeatClass(item) {
  if (item?.repeatedInCurrent === true) return 'repeated';
  if (item?.repeatedInCurrent === false) return 'weak';
  return 'unknown';
}

function DnaResult({ dnaData }) {
  if (!dnaData) {
    return (
      <div className="dna-empty-state">
        <div className="dna-empty-state-inner">
          <div className="dna-empty-state-title">
            분석 실행 후 발언 패턴 DNA 프로파일이 나타납니다.
          </div>

          <div className="dna-empty-state-desc">
            회피 화법, 조건부 표현, 책임 분산, 모호한 기준을 중심으로 분석합니다.
          </div>
        </div>
      </div>
    );
  }

  const profile = getText(
    dnaData.profile || dnaData.summary,
    '언어 패턴 프로파일 정보가 없습니다.'
  );

  const habitItems = normalizeHabitItems(dnaData);
  const signaturePhrases = normalizeSignaturePhrases(dnaData);
  const todayQuestions = normalizeTodayQuestions(dnaData);

  return (
    <div className="dna-result">
      <section className="dna-profile">
        <div className="dna-section-head">
          <div>
            <div className="dna-kicker">PATTERN DNA</div>
            <div className="dna-profile-title">언어 패턴 프로파일</div>
          </div>

          <div className="dna-profile-count">
            {habitItems.length}개 패턴
          </div>
        </div>

        <div className="dna-profile-text">
          {profile}
        </div>
      </section>

      <section className="dna-section">
        <div className="dna-section-head">
          <div>
            <div className="dna-section-title">자주 나타나는 말습관</div>
            <div className="dna-section-sub">
              과거 발언 후보와 오늘 발언을 비교해 반복되는 표현 습관을 정리합니다.
            </div>
          </div>
        </div>

        <div className="patterns-grid">
          {habitItems.length > 0 ? (
            habitItems.map((pattern, index) => {
              const repeatClass = getRepeatClass(pattern);

              return (
                <article
                  key={`${pattern.type}-${index}`}
                  className={`pattern-item pattern-${repeatClass}`}
                >
                  <div className="pattern-hdr">
                    <div className="pattern-name">
                      {pattern.type || '패턴 유형 확인 필요'}
                    </div>

                    <span className={`pattern-repeat ${repeatClass}`}>
                      {getRepeatLabel(pattern)}
                    </span>
                  </div>

                  <div className="pattern-interp">
                    {pattern.interpretation || '해석 정보가 없습니다.'}
                  </div>

                  {pattern.sourceBasis && (
                    <div className="pattern-basis">
                      <strong>근거</strong>
                      <span>{pattern.sourceBasis}</span>
                    </div>
                  )}

                  {pattern.currentEvidence && (
                    <div className="pattern-basis">
                      <strong>이번 발언 근거</strong>
                      <span>{pattern.currentEvidence}</span>
                    </div>
                  )}

                  {pattern.examples?.length > 0 && (
                    <div className="pattern-examples">
                      {pattern.examples.map((example, exampleIndex) => (
                        <span
                          key={`${example}-${exampleIndex}`}
                          className="pattern-ex"
                        >
                          “{example}”
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty-note">
              반복적으로 확인된 언어 패턴이 아직 없습니다.
            </div>
          )}
        </div>
      </section>

      {signaturePhrases.length > 0 && (
        <section className="dna-section">
          <div className="dna-section-head">
            <div>
              <div className="dna-section-title">대표 반복 표현</div>
              <div className="dna-section-sub">
                자주 쓰이는 문장 조각과 오늘 발언에서의 반복 여부를 표시합니다.
              </div>
            </div>
          </div>

          <div className="sig-phrases">
            {signaturePhrases.map((item, index) => {
              const repeatClass = getRepeatClass(item);

              return (
                <span
                  key={`${item.phrase}-${index}`}
                  className={`sig-phrase sig-${repeatClass}`}
                  title={item.source || ''}
                >
                  “{item.phrase}”

                  {item.repeatedInCurrent === true && (
                    <strong>반복</strong>
                  )}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {todayQuestions.length > 0 && (
        <section className="dna-section">
          <div className="dna-section-head">
            <div>
              <div className="dna-section-title">오늘 발언에서 확인할 의문점</div>
              <div className="dna-section-sub">
                패턴 분석을 바탕으로 기자가 추가 확인해야 할 질문 후보입니다.
              </div>
            </div>
          </div>

          <div className="dna-question-list">
            {todayQuestions.map((item, index) => (
              <div key={`${item.question}-${index}`} className="dna-question-item">
                <span className="dna-question-num">
                  Q{index + 1}
                </span>

                <div className="dna-question-body">
                  <div className="dna-question-text">
                    {item.question}
                  </div>

                  {item.reason && (
                    <div className="dna-question-reason">
                      확인 이유: {item.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default DnaResult;