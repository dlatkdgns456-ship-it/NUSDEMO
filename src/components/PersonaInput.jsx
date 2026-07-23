import { personaExamples } from '../data/demoCases';

function PersonaInput({
  mode,
  setMode,
  era,
  setEra,
  inputText,
  setInputText,
  onGenerate,
}) {
  return (
    <div className="p-input-panel">
      <div className="p-panel-label">입력</div>

      <div className="persona-mode-tabs" style={{ marginBottom: '1.2rem' }}>
        <button
          className={`pm-tab ${mode === 'generate' ? 'active' : ''}`}
          onClick={() => setMode('generate')}
        >
          ✦ 팩트로 기사 생성
        </button>

        <button
          className={`pm-tab ${mode === 'convert' ? 'active' : ''}`}
          onClick={() => setMode('convert')}
        >
          ⇄ 기존 기사 변환
        </button>
      </div>

      <div className="p-field">
        <label className="p-field-label">세대 타겟 선택</label>

        <div className="p-era-grid">
          <button
            className={`p-era-chip ${era === '1020' ? 'active' : ''}`}
            data-era="1020"
            onClick={() => setEra('1020')}
          >
            10·20대<span>MZ</span>
          </button>

          <button
            className={`p-era-chip ${era === '3040' ? 'active' : ''}`}
            data-era="3040"
            onClick={() => setEra('3040')}
          >
            30·40대<span>밀레니얼</span>
          </button>

          <button
            className={`p-era-chip ${era === '5060' ? 'active' : ''}`}
            data-era="5060"
            onClick={() => setEra('5060')}
          >
            50·60대<span>부머</span>
          </button>

          <button
            className={`p-era-chip ${era === '7080' ? 'active' : ''}`}
            data-era="7080"
            onClick={() => setEra('7080')}
          >
            70·80대<span>경로세대</span>
          </button>
        </div>
      </div>

      <div className="p-field">
        <label className="p-field-label">
          {mode === 'generate' ? '기사 팩트 입력' : '변환할 기사 입력'}
        </label>

        <textarea
          className="p-textarea"
          rows="8"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder={
            mode === 'generate'
              ? '취재한 팩트를 자유롭게 입력하세요.'
              : '변환할 기사 본문을 여기에 붙여넣으세요.'
          }
        />

        <div className="p-ex-row">
          <button
            className="p-ex-pill"
            onClick={() => setInputText(personaExamples.rate)}
          >
            금리 인상
          </button>

          <button
            className="p-ex-pill"
            onClick={() => setInputText(personaExamples.ai)}
          >
            AI 일자리
          </button>

          <button
            className="p-ex-pill"
            onClick={() => setInputText(personaExamples.realEstate)}
          >
            부동산
          </button>
        </div>
      </div>

      <button className="p-gen-btn" onClick={onGenerate}>
        {mode === 'generate' ? '기사 생성하기 →' : '기사 변환하기 →'}
      </button>
    </div>
  );
}

export default PersonaInput;