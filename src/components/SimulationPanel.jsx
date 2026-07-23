import { useEffect, useState } from 'react';
import { generateSimulationAnswer } from '../services/simulationService';

function getInitialMessages(person) {
  return [
    {
      role: 'ai',
      text: `${person || '분석 대상'} 기자회견을 시작하겠습니다. 질문 주시기 바랍니다.`,
      tactic: '',
    },
  ];
}

function getSimulationReady(result) {
  return Boolean(result && (result.dnaData || result.analysis || result.pastStatements));
}

function SimulationPanel({ result, provider, model }) {
  const person = result?.entities?.person || '분석 대상';

  const [messages, setMessages] = useState(() => getInitialMessages(person));
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealMode, setRevealMode] = useState(true);

  const simulationReady = getSimulationReady(result);

  useEffect(() => {
    setMessages(getInitialMessages(person));
    setQuestion('');
    setLoading(false);
  }, [result, person]);

  const handleSend = async () => {
    if (!question.trim() || loading) {
      return;
    }

    const userQuestion = question.trim();

    const nextMessages = [
      ...messages,
      {
        role: 'user',
        text: userQuestion,
        tactic: '',
      },
    ];

    setMessages(nextMessages);
    setQuestion('');
    setLoading(true);

    try {
      const answerData = await generateSimulationAnswer({
        provider,
        model,
        result,
        question: userQuestion,
        history: nextMessages.map((message) => ({
          role: message.role,
          text: message.text,
        })),
      });

      setMessages([
        ...nextMessages,
        {
          role: 'ai',
          text: answerData.answer || '답변을 생성하지 못했습니다.',
          tactic: answerData.tactic || '',
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages([
        ...nextMessages,
        {
          role: 'ai',
          text: `시뮬레이션 답변 생성 중 오류가 발생했습니다. ${error.message}`,
          tactic: '오류 발생',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  };

  const resetSimulation = () => {
    setMessages(getInitialMessages(person));
    setQuestion('');
    setLoading(false);
  };

  if (!simulationReady) {
    return (
      <div className="sim-empty-state-clean">
        <div className="sim-empty-state-inner">
          <div className="sim-empty-state-title">
            분석 완료 후 기자회견 시뮬레이션을 진행할 수 있습니다.
          </div>

          <div className="sim-empty-state-desc">
            기자 질문에 대해 분석 대상의 답변 방식을 가정해보고,
            회피·방어·전환 전략을 함께 확인합니다.
          </div>

          <button
            type="button"
            className="sim-empty-state-button"
            disabled
          >
            분석 후 시뮬레이션 시작
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-interface">
      <div className="sim-hero">
        <div>
          <div className="sim-kicker">PRESS CONFERENCE SIMULATION</div>
          <div className="sim-title">모의 기자회견</div>
          <div className="sim-desc">
            분석 결과를 바탕으로 {person}에게 던질 질문을 입력하고, 예상 답변과 답변 전략을 확인합니다.
          </div>
        </div>

        <div className="sim-hero-meta">
          <div className="sim-subject-card">
            <span className="sim-avatar">AI</span>
            <div>
              <div className="sim-subject-label">분석 대상</div>
              <div className="sim-subject">{person}</div>
            </div>
          </div>

          <span className={`sim-status ${loading ? 'loading' : 'live'}`}>
            {loading ? '응답 생성 중' : '대기 중'}
          </span>
        </div>
      </div>

      <div className="sim-control-row">
        <button
          type="button"
          className={`sim-reveal-toggle ${revealMode ? 'on' : ''}`}
          onClick={() => setRevealMode((prev) => !prev)}
        >
          답변 전략 분석 {revealMode ? 'ON' : 'OFF'}
        </button>

        <button
          type="button"
          className="sim-reset-btn"
          onClick={resetSimulation}
        >
          대화 초기화
        </button>
      </div>

      <div className="sim-messages">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}-${message.text}`}
            className={`sim-msg ${message.role === 'user' ? 'user' : 'ai'}`}
          >
            <div className="sim-avatar">
              {message.role === 'user' ? '기자' : 'AI'}
            </div>

            <div className="sim-message-body">
              <div className="sim-bubble">
                {message.text}
              </div>

              {message.role === 'ai' && revealMode && message.tactic && (
                <div className="sim-reveal">
                  <b>답변 전략</b>
                  <span>{message.tactic}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="sim-typing show">
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
            <span>답변을 구성하는 중입니다.</span>
          </div>
        )}
      </div>

      <div className="sim-input-panel">
        <div className="sim-input-guide">
          <div className="sim-input-title">기자 질문 입력</div>
          <div className="sim-input-sub">
            Enter를 누르거나 전송 버튼을 클릭하면 예상 답변이 생성됩니다.
          </div>
        </div>

        <div className="sim-input-row">
          <input
            id="sim-input"
            type="text"
            placeholder="예) 과거 발언과 오늘 발언의 입장이 달라진 이유를 설명해 주시겠습니까?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <button
            type="button"
            className="sim-send"
            onClick={handleSend}
            disabled={loading || !question.trim()}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimulationPanel;