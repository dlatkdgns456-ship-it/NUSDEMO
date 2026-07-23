const baseProgressSteps = [
  {
    title: '핵심 정보 추출',
    desc: '인물, 주제, 키워드와 근거 확인 표현 파악',
  },
  {
    title: '과거 발언·기사 검색',
    desc: '뉴스·국회 발언영상·공식자료 후보 수집',
  },
  {
    title: '입장 변화 분석',
    desc: '과거·현재 입장 차이와 상반 가능성 대조',
  },
  {
    title: '취재 질문 생성',
    desc: '기자가 바로 물어볼 수 있는 질문 리스트 생성',
  },
];

const dnaProgressStep = {
  title: 'DNA 패턴 분석',
  desc: '반복 말습관·회피 화법·오늘 발언 의문점 정리',
};

function FactCheckProgress({ stepStatus, dnaEnabled = true }) {
  const progressSteps = dnaEnabled
    ? [...baseProgressSteps, dnaProgressStep]
    : baseProgressSteps;

  return (
    <div className="progress-wrap show">
      <div className="prog-title">분석 진행 중...</div>

      <div className="steps-list">
        {progressSteps.map((step, index) => {
          const currentStatus = stepStatus[index] || '';

          return (
            <div
              key={step.title}
              className={`step-item ${currentStatus}`}
            >
              <div className="step-ic">
                {currentStatus === 'done' ? '✓' : index + 1}
              </div>

              <div className="step-info">
                <div className="step-nm">{step.title}</div>
                <div className="step-ds">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FactCheckProgress;