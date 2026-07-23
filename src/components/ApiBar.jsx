function ApiBar({ runMode, setRunMode, isLoggedIn, portfolioDemo = false }) {
  return (
    <div id="api-bar">
      <div className="api-inner api-inner-mode-only">
        <span className="api-label">실행 모드</span>

        <div className="pvd-tabs">
          <button
            className={`pvd-btn ${runMode === 'demo' ? 'active' : ''}`}
            onClick={() => setRunMode('demo')}
            type="button"
          >
            예시 모드
          </button>

          <button
            className={`pvd-btn ${runMode === 'real' ? 'active' : ''}`}
            onClick={() => setRunMode('real')}
            type="button"
            disabled={!isLoggedIn}
            title={!isLoggedIn ? '로그인 후 실제 분석을 사용할 수 있습니다.' : ''}
          >
            실제 분석
          </button>
        </div>

        <span id="key-st">
          {portfolioDemo
            ? '포트폴리오 시연: 저장된 예시 결과 사용'
            : !isLoggedIn
              ? '비로그인 상태: 예시 모드만 사용 가능'
            : runMode === 'demo'
              ? '저장된 예시 결과 사용'
              : '서버 GPT 분석 사용'}
        </span>
      </div>
    </div>
  );
}

export default ApiBar;