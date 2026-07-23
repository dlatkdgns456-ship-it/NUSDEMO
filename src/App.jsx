import { useEffect, useState } from 'react';
import './styles/global.css';
import GlobalNav from './components/GlobalNav';
import ApiBar from './components/ApiBar';
import FactCheckPage from './pages/FactCheckPage';
import PersonaWriterPage from './pages/PersonaWriterPage';
import SidebarArchive from './components/SidebarArchive';
import { getCurrentUser, logoutUser } from './services/authService';
import { STATIC_DEMO } from './config';

const DEFAULT_THEME = 'light-blue';
const DEFAULT_FONT_SIZE = 'base';

function getSavedTheme() {
  return localStorage.getItem('newsroom-theme') || DEFAULT_THEME;
}

function getSavedFontSize() {
  return localStorage.getItem('newsroom-font-size') || DEFAULT_FONT_SIZE;
}

function App() {
  const [currentPage, setCurrentPage] = useState('factcheck');

  const provider = 'openai';
  const model = 'gpt-4.1-mini';

  const [theme, setTheme] = useState(getSavedTheme);
  const [fontSize, setFontSize] = useState(getSavedFontSize);
  const [apiOpen, setApiOpen] = useState(true);
  const [runMode, setRunMode] = useState('demo');
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [loadedArchiveResult, setLoadedArchiveResult] = useState(null);
  const [loadedPersonaArchive, setLoadedPersonaArchive] = useState(null);

  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const isLoggedIn = Boolean(authUser);
  const authSessionKey = authUser?.id ? `user-${authUser.id}` : 'guest';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('newsroom-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem('newsroom-font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (STATIC_DEMO) {
      setAuthUser(null);
      setAuthChecking(false);
      setRunMode('demo');
      return;
    }

    const checkLogin = async () => {
      try {
        const user = await getCurrentUser();
        setAuthUser(user);

        if (!user) {
          setRunMode('demo');
        }
      } catch (error) {
        console.warn('[Auth Check Failed]', error);
        logoutUser();
        setAuthUser(null);
        setRunMode('demo');
      } finally {
        setAuthChecking(false);
      }
    };

    checkLogin();
  }, []);

  useEffect(() => {
    if (!authUser && runMode === 'real') {
      setRunMode('demo');
    }
  }, [authUser, runMode]);

  const clearLoadedResults = () => {
    setLoadedArchiveResult(null);
    setLoadedPersonaArchive(null);
    setArchiveOpen(false);
  };

  const handleThemeToggle = () => {
    setTheme((prevTheme) => {
      if (prevTheme === 'dark' || prevTheme === 'dark-navy' || prevTheme === 'dark-purple') {
        return 'light-blue';
      }

      return 'dark-navy';
    });
  };

  const handleOpenArchive = () => {
    if (STATIC_DEMO) {
      alert('포트폴리오 데모에서는 서버·MySQL 아카이브 기능을 사용할 수 없습니다.');
      return;
    }

    if (!authUser) {
      alert('분석 아카이브는 로그인 후 사용할 수 있습니다.');
      return;
    }

    setArchiveOpen(true);
  };

  const handleRunModeChange = (nextMode) => {
    if (nextMode === 'real' && !authUser) {
      alert('실제 GPT 분석은 로그인 후 사용할 수 있습니다.');
      setRunMode('demo');
      return;
    }

    setRunMode(nextMode);
  };

  const handleLoadArchive = (archiveDetail) => {
    if (!archiveDetail) return;

    if (archiveDetail.type === 'factcheck') {
      setLoadedArchiveResult(archiveDetail.result);
      setLoadedPersonaArchive(null);
      setCurrentPage('factcheck');
      return;
    }

    if (archiveDetail.type === 'persona') {
      setLoadedPersonaArchive(archiveDetail);
      setLoadedArchiveResult(null);
      setCurrentPage('persona');
    }
  };

  const handleLogin = async () => {
    throw new Error('포트폴리오 데모에서는 로그인 기능을 사용할 수 없습니다.');
  };

  const handleRegister = async () => {
    throw new Error('포트폴리오 데모에서는 회원가입 기능을 사용할 수 없습니다.');
  };

  const handleLogout = () => {
    logoutUser();
    clearLoadedResults();
    setAuthUser(null);
    setRunMode('demo');
    setCurrentPage('factcheck');
  };

  return (
    <>
      <GlobalNav
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        onThemeToggle={handleThemeToggle}
        apiOpen={apiOpen}
        setApiOpen={setApiOpen}
        onOpenArchive={handleOpenArchive}
        authUser={authUser}
        authChecking={authChecking}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
        portfolioDemo={STATIC_DEMO}
      />

      {STATIC_DEMO && (
        <div className="portfolio-demo-badge">PORTFOLIO DEMO · 예시 모드</div>
      )}

      <SidebarArchive
        key={`archive-${authSessionKey}`}
        open={archiveOpen}
        setOpen={setArchiveOpen}
        onLoadArchive={handleLoadArchive}
      />

      {apiOpen && (
        <ApiBar
          runMode={runMode}
          setRunMode={handleRunModeChange}
          isLoggedIn={isLoggedIn}
          portfolioDemo={STATIC_DEMO}
        />
      )}

      {currentPage === 'factcheck' && (
        <FactCheckPage
          key={`factcheck-${authSessionKey}`}
          provider={provider}
          model={model}
          runMode={runMode}
          isLoggedIn={isLoggedIn}
          loadedArchiveResult={loadedArchiveResult}
        />
      )}

      {currentPage === 'persona' && (
        <PersonaWriterPage
          key={`persona-${authSessionKey}`}
          provider={provider}
          model={model}
          runMode={runMode}
          isLoggedIn={isLoggedIn}
          loadedPersonaArchive={loadedPersonaArchive}
        />
      )}

      <footer>
        <span className="ft-txt">
          NEWSROOM AI — 발언 검증과 독자 맞춤 기사 작성을 돕는 기자 보조 시스템
        </span>

        <span className="ft-txt">
          AI 분석 결과는 참고용이며 기자의 판단과 원문 검증이 필요합니다
        </span>
      </footer>
    </>
  );
}

export default App;