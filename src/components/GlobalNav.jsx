import { useEffect, useRef, useState } from 'react';

const THEME_OPTIONS = [
  { value: 'light-blue', label: '라이트 블루' },
  { value: 'soft-sky', label: '소프트 스카이' },
  { value: 'soft-lavender', label: '소프트 라벤더' },
  { value: 'calm-gray', label: '캄 그레이' },
  { value: 'dark-navy', label: '다크 네이비' },
  { value: 'dark-purple', label: '다크 퍼플' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: '작게' },
  { value: 'base', label: '기본' },
  { value: 'large', label: '크게' },
];

function getUserInitial(email = '') {
  const value = String(email || '').trim();

  if (!value) return 'N';

  const localPart = value.split('@')[0] || value;
  return localPart.slice(0, 1).toUpperCase();
}

function GlobalNav({
  currentPage,
  setCurrentPage,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  apiOpen,
  setApiOpen,
  onOpenArchive,
  authUser,
  authChecking,
  onLogin,
  onRegister,
  onLogout,
  portfolioDemo = false,
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const accountWrapRef = useRef(null);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      const accountWrap = accountWrapRef.current;

      if (!accountWrap) return;

      if (!accountWrap.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [accountMenuOpen]);

  const openLogin = () => {
    setAuthMode('login');
    setAuthError('');
    setAuthOpen(true);
    setAccountMenuOpen(false);
  };

  const openRegister = () => {
    setAuthMode('register');
    setAuthError('');
    setAuthOpen(true);
    setAccountMenuOpen(false);
  };

  const closeAuth = () => {
    setAuthOpen(false);
    setAuthError('');
    setPassword('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setAuthError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      if (authMode === 'login') {
        await onLogin?.({
          email: email.trim(),
          password,
        });
      } else {
        await onRegister?.({
          email: email.trim(),
          password,
        });
      }

      closeAuth();
    } catch (error) {
      setAuthError(error.message || '인증 처리 중 오류가 발생했습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    const ok = confirm('로그아웃할까요?');
    if (!ok) return;

    setAccountMenuOpen(false);
    onLogout?.();
  };

  return (
    <>
      <nav className="global-nav">
        <div className="gnav-inner">
          <button
            type="button"
            className="gnav-menu"
            onClick={onOpenArchive}
            title="분석 아카이브 열기"
          >
            ☰
          </button>

          <div className="gnav-logo">
            <div className="gnav-badge">NR</div>
            <div>
              <div className="gnav-name">
                NEWS<em>·</em>ROOM AI
              </div>
              <div className="gnav-sub">기자 보조 통합 시스템</div>
            </div>
          </div>

          <div className="gnav-sep" />

          <div className="page-switcher">
            <button
              type="button"
              className={`page-btn ${currentPage === 'factcheck' ? 'active' : ''}`}
              onClick={() => setCurrentPage('factcheck')}
            >
              <span className="nr-line-icon nr-search-icon" aria-hidden="true" />
              <span>팩트체크 AI</span>
            </button>

            <button
              type="button"
              className={`page-btn ${currentPage === 'persona' ? 'active' : ''}`}
              onClick={() => setCurrentPage('persona')}
            >
              <span>✦</span>
              <span>세대별 기사 쓰기</span>
            </button>
          </div>

          <button
            type="button"
            className="nav-mode-btn"
            onClick={() => setApiOpen(!apiOpen)}
          >
            모드 {apiOpen ? '▾' : '▸'}
          </button>
        </div>
      </nav>

      <div className="bottom-account-wrap" ref={accountWrapRef}>
        <button
          type="button"
          className="bottom-profile-only-btn"
          onClick={() => setAccountMenuOpen((prev) => !prev)}
          title={authUser ? authUser.email : '로그인'}
        >
          <span className="bottom-avatar">
            {authChecking ? '·' : authUser ? getUserInitial(authUser.email) : 'N'}
          </span>
        </button>

        <button
          type="button"
          className="bottom-profile-hint"
          onClick={() => setAccountMenuOpen((prev) => !prev)}
        >
          {portfolioDemo ? '포트폴리오 데모 · 화면 설정' : authUser ? '프로필 및 설정' : '프로필을 눌러 로그인·회원가입'}
        </button>

        {accountMenuOpen && (
          <div className="bottom-account-menu">
            <div className="account-menu-user">
              <span className="bottom-avatar large">
                {authUser ? getUserInitial(authUser.email) : 'N'}
              </span>

              <div>
                <div className="account-user-name">
                  {authUser ? authUser.email : 'NEWSROOM AI'}
                </div>
                <div className="account-user-plan">
                  {portfolioDemo ? '포트폴리오 데모' : authUser ? '로그인됨' : '게스트 모드'}
                </div>
              </div>
            </div>

            <div className="account-menu-divider" />

            <label className="account-menu-row">
              <span>테마</span>
              <select
                value={theme}
                onChange={(event) => setTheme?.(event.target.value)}
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="account-menu-row">
              <span>글자 크기</span>
              <select
                value={fontSize || 'base'}
                onChange={(event) => setFontSize?.(event.target.value)}
              >
                {FONT_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="account-menu-divider" />

            {portfolioDemo ? (
              <div className="account-menu-demo-note">
                이 페이지는 포트폴리오 시연용입니다. 로그인·회원가입·서버 저장은 제외되어 있습니다.
              </div>
            ) : authUser ? (
              <button
                type="button"
                className="account-menu-action"
                onClick={handleLogout}
              >
                <span className="account-menu-symbol">↪</span>
                <span>로그아웃</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="account-menu-action"
                  onClick={openLogin}
                >
                  <span className="account-menu-symbol">○</span>
                  <span>로그인</span>
                </button>

                <button
                  type="button"
                  className="account-menu-action"
                  onClick={openRegister}
                >
                  <span className="account-menu-symbol">＋</span>
                  <span>회원가입</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {authOpen && !portfolioDemo && (
        <div className="auth-modal-backdrop" onClick={closeAuth}>
          <div
            className="auth-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal-head">
              <div>
                <div className="auth-modal-kicker">
                  NEWSROOM AI ACCOUNT
                </div>

                <div className="auth-modal-title">
                  {authMode === 'login' ? '로그인' : '회원가입'}
                </div>
              </div>

              <button
                type="button"
                className="auth-modal-close"
                onClick={closeAuth}
              >
                ✕
              </button>
            </div>

            <div className="auth-mode-tabs">
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
              >
                로그인
              </button>

              <button
                type="button"
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
              >
                회원가입
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@email.com"
                  autoComplete="email"
                />
              </label>

              <label>
                비밀번호
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    authMode === 'register'
                      ? '8자 이상 입력'
                      : '비밀번호 입력'
                  }
                  autoComplete={
                    authMode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                />
              </label>

              {authError && (
                <div className="auth-error">
                  {authError}
                </div>
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? '처리 중...'
                  : authMode === 'login'
                    ? '로그인'
                    : '회원가입'}
              </button>
            </form>

            <div className="auth-help">
              {authMode === 'login'
                ? '회원가입한 이메일과 비밀번호로 로그인하세요.'
                : '비밀번호는 8자 이상이어야 합니다.'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalNav;