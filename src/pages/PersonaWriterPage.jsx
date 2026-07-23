import { useEffect, useState } from 'react';
import PersonaInput from '../components/PersonaInput';
import PersonaOutput from '../components/PersonaOutput';
import { demoPersonaResult } from '../data/demoCases';
import { generatePersonaArticle } from '../services/personaService';
import { saveAnalysisToServer } from '../services/historyService';

function PersonaWriterPage({
  provider,
  model,
  runMode,
  isLoggedIn,
  loadedPersonaArchive,
}) {
  const [mode, setMode] = useState('generate');
  const [era, setEra] = useState('5060');
  const [inputText, setInputText] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!loadedPersonaArchive) return;

    const archiveResult = loadedPersonaArchive.result || {};

    setInputText(loadedPersonaArchive.inputText || '');
    setResult(archiveResult);

    if (archiveResult.selectedEra) {
      setEra(archiveResult.selectedEra);
    }

    if (archiveResult.selectedMode) {
      setMode(archiveResult.selectedMode);
    }
  }, [loadedPersonaArchive]);

  const saveResultToDatabase = async ({ savedResult, savedInputText }) => {
    if (!isLoggedIn) return;

    try {
      await saveAnalysisToServer({
        type: 'persona',
        inputText: savedInputText,
        result: savedResult,
        provider,
        model,
      });
    } catch (error) {
      console.warn('[MySQL 저장 실패]', error);
    }
  };

  const handleGenerate = async () => {
    const currentInputText = inputText.trim();

    if (!currentInputText) {
      alert('기사 팩트 또는 변환할 기사를 입력해 주세요.');
      return;
    }

    if (runMode === 'real' && !isLoggedIn) {
      alert('실제 GPT 기사 생성은 로그인 후 사용할 수 있습니다.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      if (runMode === 'demo') {
        setTimeout(async () => {
          const demoResult = {
            ...demoPersonaResult,
            selectedEra: era,
            selectedMode: mode,
            runMode: 'demo',
          };

          setResult(demoResult);

          await saveResultToDatabase({
            savedResult: demoResult,
            savedInputText: currentInputText,
          });

          setLoading(false);
        }, 1000);

        return;
      }

      const realResult = await generatePersonaArticle({
        provider,
        model,
        era,
        inputText: currentInputText,
        mode,
      });

      const resultWithMeta = {
        ...realResult,
        selectedEra: era,
        selectedMode: mode,
        runMode: 'real',
      };

      setResult(resultWithMeta);

      await saveResultToDatabase({
        savedResult: resultWithMeta,
        savedInputText: currentInputText,
      });

      setLoading(false);
    } catch (error) {
      console.error(error);
      alert(`기사 생성 중 오류가 발생했습니다.\n${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="page-wrap active" id="page-persona">
      <div className="persona-page">
        <div className="persona-hero">
          <div className="persona-hero-tag">One Source, Multi-Use</div>

          <h1>
            하나의 팩트로
            <br />
            <em>네 개의 기사</em>를 씁니다
          </h1>

          <p className="persona-hero-desc">
            팩트를 입력하거나 기존 기사를 붙여넣으면 서버에 연결된 AI가
            세대별 언어·화법으로 즉시 재작성합니다.
          </p>

          <div className="persona-stats">
            <div className="p-stat">
              <span className="p-stat-num">4</span>
              <span className="p-stat-label">세대 페르소나</span>
            </div>

            <div className="p-stat">
              <span className="p-stat-num">2</span>
              <span className="p-stat-label">생성 모드</span>
            </div>

            <div className="p-stat">
              <span className="p-stat-num">漢</span>
              <span className="p-stat-label">70·80대 한자 병기</span>
            </div>
          </div>
        </div>

        <div className="persona-main">
          <div className="persona-grid-wrap">
            <PersonaInput
              mode={mode}
              setMode={setMode}
              era={era}
              setEra={setEra}
              inputText={inputText}
              setInputText={setInputText}
              onGenerate={handleGenerate}
            />

            <PersonaOutput
              result={result}
              loading={loading}
              era={era}
              mode={mode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonaWriterPage;