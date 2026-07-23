function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRepeatedValue(item) {
  if (typeof item?.repeatedInCurrent === 'boolean') {
    return item.repeatedInCurrent;
  }

  if (typeof item?.repeatedToday === 'boolean') {
    return item.repeatedToday;
  }

  if (typeof item?.isRepeatedInCurrent === 'boolean') {
    return item.isRepeatedInCurrent;
  }

  if (typeof item?.currentMatched === 'boolean') {
    return item.currentMatched;
  }

  return null;
}

export function normalizePatterns(dnaData = {}) {
  return getArray(
    dnaData.patterns ||
      dnaData.frequentHabits ||
      dnaData.habitPatterns ||
      dnaData.recurringPatterns
  ).map((item) => ({
    ...item,
    type:
      item?.type ||
      item?.name ||
      item?.pattern ||
      item?.title ||
      '언어 패턴',
    interpretation:
      item?.interpretation ||
      item?.meaning ||
      item?.description ||
      item?.note ||
      '해석 정보가 없습니다.',
    examples: getArray(item?.examples || item?.quotes || item?.phrases),
    sourceBasis: item?.sourceBasis || item?.basis || '',
    repeatedInCurrent: getRepeatedValue(item),
    currentEvidence: item?.currentEvidence || '',
  }));
}

export function normalizeHabitItems(dnaData = {}) {
  return normalizePatterns(dnaData);
}

export function normalizeSignaturePhrases(dnaData = {}) {
  return getArray(
    dnaData.signaturePhrases ||
      dnaData.recurringPhrases ||
      dnaData.frequentPhrases
  ).map((item) => {
    if (typeof item === 'string') {
      return {
        phrase: item,
        repeatedInCurrent: null,
        source: '',
      };
    }

    return {
      phrase: item?.phrase || item?.text || item?.quote || '표현 확인 필요',
      repeatedInCurrent: getRepeatedValue(item),
      source: item?.source || item?.basis || '',
    };
  });
}

export function normalizeTodayQuestions(dnaData = {}) {
  return getArray(
    dnaData.todayQuestions ||
      dnaData.doubts ||
      dnaData.concerns ||
      dnaData.checkPoints
  ).map((item) => {
    if (typeof item === 'string') {
      return {
        question: item,
        reason: '',
      };
    }

    return {
      question: item?.question || item?.text || item?.point || '확인 질문',
      reason: item?.reason || item?.why || item?.note || '',
    };
  });
}