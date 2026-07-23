import { useEffect, useState } from 'react';
import FactCheckInput from '../components/FactCheckInput';
import FactCheckProgress from '../components/FactCheckProgress';
import FactCheckResult from '../components/FactCheckResult';
import DnaResult from '../components/DnaResult';
import SimulationPanel from '../components/SimulationPanel';
import { demoFactCheckResult } from '../data/demoCases';
import { runFactCheckAnalysis } from '../services/factcheckService';
import { saveAnalysisToServer } from '../services/historyService';

function FactCheckPage({
  provider,
  model,
  runMode,
  isLoggedIn,
  loadedArchiveResult,
}) {
  const [inputText, setInputText] = useState('');
  const [searchRange, setSearchRange] = useState('3y');
  const [searchDepth, setSearchDepth] = useState('standard');
  const [dnaEnabled, setDnaEnabled] = useState(true);

  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [stepStatus, setStepStatus] = useState(['', '', '', '', '']);
  const [activeTab, setActiveTab] = useState('analysis');

  const updateStep = (index, nextStatus) => {
    setStepStatus((prev) =>
      prev.map((item, i) => (i === index ? nextStatus : item))
    );
  };

  const resetSteps = () => {
    setStepStatus(['', '', '', '', '']);
  };

  const saveResultToDatabase = async ({ savedResult, savedInputText }) => {
    if (!isLoggedIn) return;

    try {
      await saveAnalysisToServer({
        type: 'factcheck',
        inputText: savedInputText,
        result: savedResult,
        provider,
        model,
      });
    } catch (error) {
      console.warn('[MySQL 저장 실패]', error);
    }
  };

  useEffect(() => {
    if (!loadedArchiveResult) return;

    setResult(loadedArchiveResult);
    setStatus('done');
    setActiveTab('analysis');
  }, [loadedArchiveResult]);

  const handleAnalyze = async () => {
    const currentInputText = inputText.trim();

    if (!currentInputText) {
      alert('분석할 발언이나 기사를 입력해 주세요.');
      return;
    }

    if (runMode === 'real' && !isLoggedIn) {
      alert('실제 GPT 분석은 로그인 후 사용할 수 있습니다.');
      return;
    }

    setActiveTab('analysis');
    setStatus('loading');
    setResult(null);
    resetSteps();

    try {
      if (runMode === 'demo') {
        setTimeout(async () => {
          const demoResult = {
            ...demoFactCheckResult,
            currentText: currentInputText,
            runMode: 'demo',
          };

          setResult(demoResult);

          await saveResultToDatabase({
            savedResult: demoResult,
            savedInputText: currentInputText,
          });

          setStatus('done');
        }, 1200);

        return;
      }

      const realResult = await runFactCheckAnalysis({
        provider,
        model,
        inputText: currentInputText,
        searchRange,
        searchDepth,
        dnaEnabled,
        onStepChange: updateStep,
      });

      const resultWithMeta = {
        ...realResult,
        currentText: currentInputText,
        runMode: 'real',
      };

      setResult(resultWithMeta);

      await saveResultToDatabase({
        savedResult: resultWithMeta,
        savedInputText: currentInputText,
      });

      setStatus('done');
    } catch (error) {
      console.error(error);
      alert(`분석 중 오류가 발생했습니다.\n${error.message}`);

      setStatus('idle');
      resetSteps();
    }
  };

  const handleResetAnalysis = () => {
    setInputText('');
    setResult(null);
    setStatus('idle');
    setActiveTab('analysis');
    resetSteps();
  };

  return (
    <div className="page-wrap active" id="page-factcheck">
      <div className="split-wrap">
        <FactCheckInput
          inputText={inputText}
          setInputText={setInputText}
          searchRange={searchRange}
          setSearchRange={setSearchRange}
          searchDepth={searchDepth}
          setSearchDepth={setSearchDepth}
          dnaEnabled={dnaEnabled}
          setDnaEnabled={setDnaEnabled}
          onAnalyze={handleAnalyze}
        />

        <div className="right-panel">
          <div className="result-panel-head">
            <div className="result-panel-title-wrap">
              <div className="result-panel-kicker">분석 결과 보기</div>
              <div className="result-panel-title">
                분석 결과, 패턴 DNA, 기자회견 시뮬레이션을 전환해 확인합니다.
              </div>
            </div>

            <div className="result-tabs-shell">
              <div className="tab-bar">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
                  onClick={() => setActiveTab('analysis')}
                >
                  분석 결과
                </button>

                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'dna' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dna')}
                >
                  패턴 DNA
                </button>

                <button
                  type="button"
                  className={`tab-btn ${activeTab === 'sim' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sim')}
                >
                  기자회견 시뮬
                </button>
              </div>
            </div>
          </div>

          <div className="tab-content active">
            {activeTab === 'analysis' && status === 'idle' && (
              <div className="placeholder-wrap">
                <div className="ph-msg">
                  왼쪽에 발언이나 기사를 입력하고 분석을 시작하세요.
                  <br />
                  비로그인 상태에서는 예시 모드만 사용할 수 있습니다.
                </div>

                <div className="ph-steps">
                  <div className="ph-step">
                    <div className="ph-num">1</div>
                    핵심 인물·주제 자동 추출
                  </div>

                  <div className="ph-step">
                    <div className="ph-num">2</div>
                    과거 발언·기사 비교 검색
                  </div>

                  <div className="ph-step">
                    <div className="ph-num">3</div>
                    입장 변화 및 근거 필요 표현 분석
                  </div>

                  <div className="ph-step">
                    <div className="ph-num">4</div>
                    취재 질문 후보 생성
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && status === 'loading' && (
              <FactCheckProgress
                stepStatus={stepStatus}
                dnaEnabled={dnaEnabled}
              />
            )}

            {activeTab === 'analysis' && status === 'done' && result && (
              <FactCheckResult
                result={result}
                onReset={handleResetAnalysis}
                onNewAnalysis={handleResetAnalysis}
              />
            )}

            {activeTab === 'dna' && (
              <DnaResult dnaData={result?.dnaData} />
            )}

            {activeTab === 'sim' && (
              <SimulationPanel
                result={result}
                provider={provider}
                model={model}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FactCheckPage;