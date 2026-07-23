import { useEffect, useState } from 'react';
import { generateNewsroomImage } from '../services/imageGenerationService';

const ERA_LABELS = {
  '1020': '10·20대 타겟',
  '3040': '30·40대 타겟',
  '5060': '50·60대 타겟',
  '7080': '70·80대 타겟',
};

function buildImageContent(result) {
  return [
    result?.lead,
    result?.body,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2400);
}

function PersonaOutput({ result, loading, era, mode }) {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);

  useEffect(() => {
    setImageLoading(false);
    setImageError('');
    setGeneratedImage(null);
  }, [result, era, mode]);

  const handleGenerateImage = async () => {
    if (!result || imageLoading) return;

    setImageLoading(true);
    setImageError('');

    try {
      const imageResult = await generateNewsroomImage({
        title: result.title || '뉴스 카드뉴스 이미지',
        content: buildImageContent(result),
        target: ERA_LABELS[era] || era || '일반 독자',
        style: 'clean Korean editorial card news thumbnail, soft navy and sky-blue accents',
        size: '1024x1024',
        quality: 'low',
        outputFormat: 'png',
      });

      setGeneratedImage(imageResult);
    } catch (error) {
      setImageError(error.message || '이미지 생성 중 오류가 발생했습니다.');
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="p-output-panel">
      <div className="p-panel-label">결과물</div>

      {!loading && !result && (
        <div className="p-out-ph">
          <div className="p-out-ph-icon">◎</div>
          왼쪽에서 팩트 또는 기사를 입력하고
          <br />
          세대 타겟 선택 후 실행하세요.
        </div>
      )}

      {loading && (
        <div className="p-loading show">
          <span className="trans-load-txt">기사를 작성하는 중...</span>
        </div>
      )}

      {!loading && result && (
        <div className="p-out-result" style={{ display: 'block' }}>
          {result.isMock && (
            <div className="verdict-banner unclear" style={{ margin: '0 0 1rem 0' }}>
              <div className="verdict-icon">ⓘ</div>
              <div>
                <div className="verdict-lbl">시연용 예시 결과</div>
                <div className="verdict-txt">{result.demoNotice}</div>
              </div>
            </div>
          )}

          <div className="p-out-meta">
            <div className="p-out-tags">
              <span className={`p-out-badge p-out-badge-${era}`}>
                {ERA_LABELS[era]}
              </span>

              <span className="p-out-mode">
                {mode === 'generate' ? '팩트 → 기사 생성' : '기사 변환'}
              </span>
            </div>

            <button
              type="button"
              className="p-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(
                  `제목: ${result.title}\n\n리드문: ${result.lead}\n\n본문: ${result.body}`
                );
              }}
            >
              복사
            </button>
          </div>

          <div className="p-out-body-wrap">
            <div className="trans-card" style={{ marginTop: '0.5rem' }}>
              <div className="trans-card-body" style={{ lineHeight: 1.8 }}>
                <div
                  className="art-title"
                  style={{
                    fontWeight: 700,
                    fontSize: '15px',
                    marginBottom: '0.5rem',
                  }}
                >
                  {result.title}
                </div>

                <div
                  className="art-lead"
                  style={{
                    fontSize: '13px',
                    opacity: 0.85,
                    marginBottom: '0.6rem',
                  }}
                >
                  {result.lead}
                </div>

                <div className="art-body" style={{ fontSize: '13px' }}>
                  {result.body}
                </div>
              </div>
            </div>

            <div
              className="trans-card"
              style={{
                marginTop: '0.9rem',
                borderStyle: 'dashed',
              }}
            >
              <div className="trans-card-body">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginBottom: '0.65rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '13px',
                        marginBottom: '0.2rem',
                      }}
                    >
                      카드뉴스 이미지 초안
                    </div>

                    <div
                      style={{
                        fontSize: '11px',
                        lineHeight: 1.5,
                        color: 'var(--text3)',
                      }}
                    >
                      보도 사진이 아닌 카드뉴스·썸네일용 시각 자료 초안입니다.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-copy-btn"
                    onClick={handleGenerateImage}
                    disabled={imageLoading}
                    style={{
                      whiteSpace: 'nowrap',
                      opacity: imageLoading ? 0.65 : 1,
                      cursor: imageLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {imageLoading ? '생성 중...' : '이미지 생성'}
                  </button>
                </div>

                {imageError && (
                  <div
                    style={{
                      fontSize: '11px',
                      lineHeight: 1.5,
                      color: 'var(--danger)',
                      marginBottom: '0.7rem',
                    }}
                  >
                    {imageError}
                  </div>
                )}

                {imageLoading && (
                  <div
                    style={{
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '16px',
                      border: '1px solid var(--line)',
                      fontSize: '12px',
                      color: 'var(--text3)',
                    }}
                  >
                    기사 내용을 바탕으로 카드뉴스 이미지를 생성하는 중입니다...
                  </div>
                )}

                {!imageLoading && generatedImage?.imageUrl && (
                  <div>
                    <img
                      src={generatedImage.imageUrl}
                      alt="생성된 카드뉴스 이미지 초안"
                      style={{
                        width: '100%',
                        maxHeight: '360px',
                        objectFit: 'contain',
                        borderRadius: '16px',
                        border: '1px solid var(--line)',
                        background: 'var(--bg2)',
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginTop: '0.65rem',
                        fontSize: '11px',
                        color: 'var(--text3)',
                      }}
                    >
                      <span>
                        {generatedImage.model || 'image model'} · {generatedImage.size}
                      </span>

                      <a
                        href={generatedImage.imageUrl}
                        download="newsroom-cardnews-draft.png"
                        className="p-copy-btn"
                        style={{
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        이미지 저장
                      </a>
                    </div>

                    <div
                      style={{
                        marginTop: '0.65rem',
                        fontSize: '10px',
                        lineHeight: 1.5,
                        color: 'var(--text3)',
                      }}
                    >
                      생성 이미지는 실제 사건 현장이나 보도 사진이 아닙니다. 최종 사용 전 기자와 편집자의 검토가 필요합니다.
                    </div>
                  </div>
                )}

                {!imageLoading && !generatedImage && !imageError && (
                  <div
                    style={{
                      fontSize: '11px',
                      lineHeight: 1.6,
                      color: 'var(--text3)',
                    }}
                  >
                    변환된 기사 내용을 바탕으로 디지털 기사, 카드뉴스, 썸네일에 활용할 수 있는 중립적 일러스트 초안을 생성합니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonaOutput;