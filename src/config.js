export const STATIC_DEMO = true;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const REQUEST_TIMEOUTS = {
  auth: 15000,
  ai: 90000,
  news: 12000,
  history: 15000,
  assembly: 15000,
  assemblySpeech: 15000,
  youtube: 15000,
  audio: 60000,
  document: 60000,
  image: 120000,
};