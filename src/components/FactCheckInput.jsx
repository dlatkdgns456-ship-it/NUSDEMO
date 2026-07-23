import { useCallback, useEffect, useRef, useState } from 'react';
import { factCheckExamples } from '../data/demoCases';
import {
  extractDocumentText,
  transcribeAudio,
} from '../services/transcriptionService';

const ACCEPTED_FILE_TYPES = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.log',
  '.rtf',
  '.docx',
  '.hwpx',
  '.pdf',
  'audio/*',
  '.mp3',
  '.wav',
  '.m4a',
  '.webm',
  '.mp4',
].join(',');

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'log',
  'rtf',
]);

const MEDIA_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'webm',
  'mp4',
]);

const MEDIA_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
  'video/mp4',
  'video/webm',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'docx',
  'hwpx',
  'pdf',
]);

function getLocalDateString(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffset);

  return localDate.toISOString().slice(0, 10);
}

function getDefaultStartDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 3);

  return getLocalDateString(date);
}

function parseCustomSearchRange(searchRange) {
  const value = String(searchRange || '');

  if (!value.startsWith('custom:')) {
    return {
      startDate: '',
      endDate: '',
    };
  }

  const [, startDate = '', endDate = ''] = value.split(':');

  return {
    startDate,
    endDate,
  };
}

function makeCustomSearchRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'custom';
  }

  return `custom:${startDate}:${endDate}`;
}

function getFileExtension(file) {
  const fileName = String(file?.name || '');
  const parts = fileName.split('.');

  if (parts.length <= 1) return '';

  return parts.pop().toLowerCase();
}

function isTextFile(file) {
  const extension = getFileExtension(file);
  const mimeType = String(file?.type || '').toLowerCase();

  return mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension);
}

function isMediaFile(file) {
  const extension = getFileExtension(file);
  const mimeType = String(file?.type || '').toLowerCase();

  return MEDIA_EXTENSIONS.has(extension) || MEDIA_MIME_TYPES.has(mimeType);
}

function isDocumentFile(file) {
  return DOCUMENT_EXTENSIONS.has(getFileExtension(file));
}

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

async function readFileAsInputText(file) {
  const fileName = file?.name || '선택한 파일';

  if (isTextFile(file)) {
    const text = String(await file.text()).trim();

    if (!text) {
      throw new Error(`${fileName}: 파일 내용이 비어 있습니다.`);
    }

    return text;
  }

  if (isMediaFile(file)) {
    const result = await transcribeAudio(file);
    const transcript = String(result.text || '').trim();

    if (!transcript) {
      throw new Error(`${fileName}: 변환된 텍스트가 비어 있습니다.`);
    }

    return transcript;
  }

  if (isDocumentFile(file)) {
    const result = await extractDocumentText(file);
    const text = String(result.text || '').trim();

    if (!text) {
      throw new Error(`${fileName}: 문서에서 추출된 텍스트가 비어 있습니다.`);
    }

    return text;
  }

  throw new Error(
    `${fileName}: 지원하지 않는 파일 형식입니다. txt, docx, hwpx, pdf, mp3, wav, m4a, webm, mp4 파일을 사용해 주세요.`
  );
}

function FactCheckInput({
  inputText,
  setInputText,
  searchRange,
  setSearchRange,
  searchDepth,
  setSearchDepth,
  dnaEnabled,
  setDnaEnabled,
  onAnalyze,
}) {
  const fileInputRef = useRef(null);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileMessage, setFileMessage] = useState('');
  const [fileError, setFileError] = useState('');
  const [isFileDragActive, setIsFileDragActive] = useState(false);

  const parsedCustomRange = parseCustomSearchRange(searchRange);
  const [customStartDate, setCustomStartDate] = useState(
    parsedCustomRange.startDate || getDefaultStartDate()
  );
  const [customEndDate, setCustomEndDate] = useState(
    parsedCustomRange.endDate || getLocalDateString()
  );

  const isStandardDepth = searchDepth === 'standard' || searchDepth === 'normal';
  const isCustomRange =
    searchRange === 'custom' || String(searchRange || '').startsWith('custom:');

  const hasInvalidCustomRange =
    isCustomRange &&
    customStartDate &&
    customEndDate &&
    customStartDate > customEndDate;

  useEffect(() => {
    if (!String(searchRange || '').startsWith('custom:')) return;

    const nextRange = parseCustomSearchRange(searchRange);

    if (nextRange.startDate) {
      setCustomStartDate(nextRange.startDate);
    }

    if (nextRange.endDate) {
      setCustomEndDate(nextRange.endDate);
    }
  }, [searchRange]);

  const appendTextToInput = useCallback((nextText) => {
    const cleanText = String(nextText || '').trim();

    if (!cleanText) return;

    setInputText((prevText) => {
      const currentText = String(prevText || '').trim();

      if (!currentText) {
        return cleanText;
      }

      return `${currentText}\n\n${cleanText}`;
    });
  }, [setInputText]);

  const handleFileList = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);

    if (!files.length || isProcessingFile) return;

    setIsProcessingFile(true);
    setFileMessage('');
    setFileError('');

    const successNames = [];
    const errorMessages = [];

    try {
      for (const file of files) {
        try {
          const text = await readFileAsInputText(file);

          appendTextToInput(text);
          successNames.push(file.name);
        } catch (error) {
          errorMessages.push(
            error.message || `${file.name}: 파일 처리 중 오류가 발생했습니다.`
          );
        }
      }

      if (successNames.length > 0) {
        setFileMessage(
          `${successNames.join(', ')} 파일 내용을 입력창에 추가했습니다.`
        );
      }

      if (errorMessages.length > 0) {
        setFileError(errorMessages.join('\n'));
      }
    } finally {
      setIsProcessingFile(false);
    }
  }, [appendTextToInput, isProcessingFile]);

  const handleFileButtonClick = () => {
    if (isProcessingFile) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const files = event.target.files;

    event.target.value = '';

    if (!files?.length) return;

    await handleFileList(files);
  };

  const handleTextAreaDragEnter = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();
    setIsFileDragActive(true);
  };

  const handleTextAreaDragOver = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    setIsFileDragActive(true);
  };

  const handleTextAreaDragLeave = (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();
    setIsFileDragActive(false);
  };

  const handleTextAreaDrop = async (event) => {
    if (!isFileDrag(event)) return;

    event.preventDefault();
    event.stopPropagation();
    setIsFileDragActive(false);

    const files = event.dataTransfer?.files;

    if (files?.length) {
      await handleFileList(files);
    }
  };

  const handleSelectCustomRange = () => {
    const nextStartDate = customStartDate || getDefaultStartDate();
    const nextEndDate = customEndDate || getLocalDateString();

    setCustomStartDate(nextStartDate);
    setCustomEndDate(nextEndDate);
    setSearchRange(makeCustomSearchRange(nextStartDate, nextEndDate));
  };

  const handleCustomStartDateChange = (event) => {
    const nextStartDate = event.target.value;

    setCustomStartDate(nextStartDate);
    setSearchRange(makeCustomSearchRange(nextStartDate, customEndDate));
  };

  const handleCustomEndDateChange = (event) => {
    const nextEndDate = event.target.value;

    setCustomEndDate(nextEndDate);
    setSearchRange(makeCustomSearchRange(customStartDate, nextEndDate));
  };

  return (
    <>
      <div className="left-panel">
        <div className="lp-top">
          <div className="eyebrow">발언 분석 입력</div>
          <div className="lp-title">오늘의 발언 또는 기사</div>
          <div className="lp-desc">
            공인의 발언이나 뉴스 기사를 입력하면, 유사한 과거 발언과 비교 분석 결과를 보여드립니다.
            <br />
            검색 범위를 설정하여 원하는 기간과 깊이로 분석할 수 있습니다.
          </div>
        </div>

        <div className="lp-body">
          <div className="input-section">
            <div className="input-label-row">
              <div>
                <div className="field-lbl">발언 / 기사 입력</div>
                <div className="field-sub">
                  직접 입력하거나 문서·음성·영상 파일을 텍스트로 변환해 넣을 수 있습니다.
                </div>
              </div>

              <button
                type="button"
                className="audio-upload-box file-upload-box"
                onClick={handleFileButtonClick}
                disabled={isProcessingFile}
                title="txt, docx, hwpx, pdf, mp3, wav, m4a, webm, mp4 파일을 입력에 반영합니다."
              >
                <span className="audio-upload-title">
                  {isProcessingFile ? '파일 처리 중' : '파일 불러오기'}
                </span>
                <span className="audio-upload-desc">
                  txt, Word(docx), 한글(hwpx), PDF, 음성·영상
                </span>
              </button>
            </div>

            <textarea
              id="today-input"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onDragEnter={handleTextAreaDragEnter}
              onDragOver={handleTextAreaDragOver}
              onDragLeave={handleTextAreaDragLeave}
              onDrop={handleTextAreaDrop}
              placeholder="예) 이재명 대표는 오늘 기자회견에서 '원자력 발전은 미래 에너지의 핵심이며 단계적으로 확대해야 한다'고 밝혔다..."
            />

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div className="ex-row">
              <span className="ex-label">예시</span>

              <button
                type="button"
                className="ex-chip"
                onClick={() => setInputText(factCheckExamples.nuclear)}
                disabled={isProcessingFile}
              >
                원자력 입장 변화
              </button>

              <button
                type="button"
                className="ex-chip"
                onClick={() => setInputText(factCheckExamples.economy)}
                disabled={isProcessingFile}
              >
                경제 정책
              </button>

              <button
                type="button"
                className="ex-chip"
                onClick={() => setInputText(factCheckExamples.housing)}
                disabled={isProcessingFile}
              >
                부동산 발언
              </button>
            </div>

            {fileMessage ? (
              <div className="transcription-message success">
                {fileMessage}
              </div>
            ) : null}

            {fileError ? (
              <div className="transcription-message error">
                {fileError}
              </div>
            ) : null}
          </div>

          <div className="range-section">
            <div className="field-lbl">검색 범위</div>

            <div className="range-grid">
              <div className="range-row">
                <span className="range-label">기간</span>

                <div className="tog-group range-period-group">
                  <button
                    type="button"
                    className={`tog-btn ${searchRange === '3y' ? 'active' : ''}`}
                    onClick={() => setSearchRange('3y')}
                    disabled={isProcessingFile}
                  >
                    3년
                  </button>

                  <button
                    type="button"
                    className={`tog-btn ${searchRange === '5y' ? 'active' : ''}`}
                    onClick={() => setSearchRange('5y')}
                    disabled={isProcessingFile}
                  >
                    5년
                  </button>

                  <button
                    type="button"
                    className={`tog-btn ${searchRange === '10y' ? 'active' : ''}`}
                    onClick={() => setSearchRange('10y')}
                    disabled={isProcessingFile}
                  >
                    10년
                  </button>

                  <button
                    type="button"
                    className={`tog-btn ${isCustomRange ? 'active' : ''}`}
                    onClick={handleSelectCustomRange}
                    disabled={isProcessingFile}
                  >
                    직접 선택
                  </button>
                </div>
              </div>

              {isCustomRange && (
                <div className="custom-date-box">
                  <div className="custom-date-head">
                    <span>직접 기간 선택</span>
                    <small>
                      기사 발행일 기준으로 검색 범위를 제한합니다.
                    </small>
                  </div>

                  <div className="custom-date-grid">
                    <label>
                      시작일
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={handleCustomStartDateChange}
                        disabled={isProcessingFile}
                      />
                    </label>

                    <label>
                      종료일
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={handleCustomEndDateChange}
                        disabled={isProcessingFile}
                      />
                    </label>
                  </div>

                  {hasInvalidCustomRange ? (
                    <div className="custom-date-warning">
                      시작일은 종료일보다 늦을 수 없습니다.
                    </div>
                  ) : (
                    <div className="custom-date-summary">
                      선택 기간: {customStartDate || '시작일'} ~ {customEndDate || '종료일'}
                    </div>
                  )}
                </div>
              )}

              <div className="range-row">
                <span className="range-label">깊이</span>

                <div className="tog-group">
                  <button
                    type="button"
                    className={`tog-btn ${isStandardDepth ? 'active' : ''}`}
                    onClick={() => setSearchDepth('standard')}
                    disabled={isProcessingFile}
                  >
                    표준
                  </button>

                  <button
                    type="button"
                    className={`tog-btn ${searchDepth === 'deep' ? 'active' : ''}`}
                    onClick={() => setSearchDepth('deep')}
                    disabled={isProcessingFile}
                  >
                    심층
                  </button>
                </div>
              </div>

              <div className="range-row">
                <span className="range-label">DNA</span>

                <div className="tog-group">
                  <button
                    type="button"
                    className={`tog-btn ${dnaEnabled ? 'active' : ''}`}
                    onClick={() => setDnaEnabled(true)}
                    disabled={isProcessingFile}
                  >
                    포함
                  </button>

                  <button
                    type="button"
                    className={`tog-btn ${!dnaEnabled ? 'active' : ''}`}
                    onClick={() => setDnaEnabled(false)}
                    disabled={isProcessingFile}
                  >
                    생략
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="analyze-btn"
            onClick={onAnalyze}
            disabled={isProcessingFile || hasInvalidCustomRange}
          >
            {isProcessingFile ? '파일 처리 중...' : '발언 비교 분석 시작'}
          </button>
        </div>
      </div>

      {isFileDragActive && (
        <div className="file-drop-overlay">
          <div className="file-drop-card">
            <div className="file-drop-title">파일을 추가하세요</div>
            <div className="file-drop-sub">
              txt, Word(docx), 한글(hwpx), PDF, 음성·영상 파일을 입력창에 추가할 수 있습니다.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FactCheckInput;