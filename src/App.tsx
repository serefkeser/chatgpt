// ============================================================================
// OTONOM - Gemini Canvas Uyumlu Versiyon (Firebase KALDIRILDI — Local-First)
// ============================================================================
// Akis: S1 -> M1 analiz -> yuklenen gorseller -> S2 -> M2 analiz -> yuklenen gorseller -> ...
// Sabit gorsel tum sahnelere atanir, tum sahnelerde yuklenen gorsel kullanilir
// Coklu blokta sure siniri yok - dogal okuma hizinda bitir
// Seslendirme daima %80, arka plan muzik daima %29
//
// MODULER YAPI:
//   M1:  Constants & Config       - API key, flags, CORS proxies, APP_VERSION
//   M2:  Core Utilities           - Storage, Audio, EventBus, logging, helpers
//   M3:  Network                  - NetworkUtils (fetch retry, image, base64)
//   M4:  Asset Manager            - IndexedDB servisleri
//   M5:  Logic Engine             - AI analiz (haber, elestiri, iddia, guzel soz, OCR)
//   M6:  Media Synthesis          - Gorsel uretim servisleri
//   M7:  Ambient Audio            - Atmosfer sesleri
//   M8:  Render Engine            - Canvas video render
//   M9:  Workflow Coordinator     - Is akis yoneticisi
//   M10: App (React UI)           - Ana component ve tum UI
//
// FIREBASE KALDIRMA NOTU:
//   - Auth, session, Firestore, onSnapshot, signIn... tamamen silindi.
//   - Ayarlar: SafeStorage (localStorage) effect'leri ile yerelde saklanir.
//   - Medya/muzik: IndexedDB (AssetManagerService) uzerinden okunur/yazilir.
//   - Arayuz ve video isleme tarayicida; Gemini metin/ses icin internet gerekir.
// ============================================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchFreeGemini, isFreeTierStop, resetFreeTierStop, assertFreeTierAvailable, sourceImages, imageForBlock } from './free-tier.mjs';

// ============================================================================
// SVG ICON SYSTEM (lucide-react yerine - Gemini Canvas uyumluluğu)
// ============================================================================
const ICONS = {
  Download: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  RotateCcw: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>,
  UploadCloud: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>,
  Music: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  Trash2: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Volume2: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>,
  Clock: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Loader2: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>,
  Copy: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  AlertCircle: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Activity: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Server: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  Database: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  ShieldCheck: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  ImagePlus: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Smartphone: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  Clapperboard: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 6h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/><path d="M4 6h10"/><line x1="2" y1="12" x2="6" y2="12"/></svg>,
  Type: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  Palette: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>,
  Globe: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  MessageSquare: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Monitor: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Filter: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Wand2: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m3 21 9-9"/><path d="M12 22V8"/><path d="M12 2 4 10"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/></svg>,
  CloudRain: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><line x1="12" y1="15" x2="12" y2="18"/><line x1="10" y1="17" x2="14" y2="17"/></svg>,
  ChevronDown: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="6 9 12 15 18 9"/></svg>,
  Film: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="10" y1="2" x2="10" y2="22"/></svg>,
  FileText: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Layers: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  RefreshCw: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
  Share2: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Check: ({size=14, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>,
  Link2: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Newspaper: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="18" y1="14" x2="18" y2="18"/><line x1="15" y1="18" x2="21" y2="18"/><line x1="6" y1="7" x2="6.01" y2="7"/><line x1="6" y1="11" x2="6.01" y2="11"/><line x1="6" y1="15" x2="6.01" y2="15"/></svg>,
  Scissors: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  ExternalLink: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Eye: ({size=16, ...p}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};
const { Download, RotateCcw, UploadCloud, Music, Trash2, Volume2, Clock, Loader2, Copy, AlertCircle, Activity, Server, Database, ShieldCheck, ImagePlus, Smartphone, Clapperboard, Type, Palette, Globe, MessageSquare, Monitor, Filter, Wand2, CloudRain, ChevronDown, Film, FileText, Layers, RefreshCw, Share2, Check, Link2, Newspaper, Scissors, ExternalLink, Eye } = ICONS;

// ============================================================================
// M1: CONSTANTS & CONFIG
// ============================================================================
const APP_VERSION = {
  major: 1, minor: 44, hotfix: 'Chatgpt_1.44',
  toString() { return `OTONOM Chatgpt_${this.major}.${this.minor}`; },
  toBadge() { return `${this.toString()} • GitHub Pages`; }
};

const RENDER_CONFIG = {
  FPS: 30, TIMER_WORKER_INTERVAL_MS: 1000 / 30, WINDOW_SIZE: 5,
  VOICE_VOLUME: 0.80, BGM_VOLUME: 0.29, SPEECH_RATE: 1.0,
  VIDEO_BITS_PER_SECOND: 4_000_000, MIN_CROP_SIZE: 10, MAX_BLOCKS: 10,
  SCALE_FACTOR: 1, MAX_CUSTOM_SCENE_IMAGES: 5
};

const AI_CONFIG = {
  TEMPERATURE: 0.8, MAX_OUTPUT_TOKENS: 150, SCENE_COUNT: 3,
  GEMINI_MODEL: 'gemini-2.5-flash',
  OCR_MODELS: ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
};

const ECONOMIC_DATA = {
  aclikSiniri: { value: '35.759 TL', baseline2002: '1.522 TL', note: 'dört kişilik aile, TÜRK-İŞ', dataAsOf: 'Haziran 2026' },
  yoksullukSiniri: { value: '116.478 TL', baseline2002: '4.560 TL', note: 'dört kişilik aile, TÜRK-İŞ', dataAsOf: 'Haziran 2026' },
  asgariUcret: { value: '28.075 TL', baseline2002: '184 TL', note: 'net', dataAsOf: 'Ocak 2026' },
  enDusukEmekliMaasi: { value: '23.552 TL', baseline2002: '150 TL', note: '', dataAsOf: null },
  tufeYillik: { value: '%32.11', baseline2002: '%29.7', note: 'TÜİK', dataAsOf: 'Haziran 2026' },
  tufeAylik: { value: '%0.99', baseline2002: null, note: 'TÜİK', dataAsOf: 'Haziran 2026' },
  tcmbYilSonuBeklenti: { value: '%29', baseline2002: '%35', note: '', dataAsOf: null },
  tcmbPolitikaFaizi: { value: '%37', baseline2002: '%59', note: '', dataAsOf: null },
  dolarTl: { value: '47.05', baseline2002: '1.35', note: '', dataAsOf: '30 Temmuz 2026' },
  euroTl: { value: '54.07', baseline2002: '1.28', note: '', dataAsOf: '30 Temmuz 2026' },
  gramAltin: { value: '6.222 TL', baseline2002: '15.5 TL', note: '', dataAsOf: '30 Temmuz 2026' },
  ceyrekAltin: { value: '10.223 TL', baseline2002: '25 TL', note: '', dataAsOf: '30 Temmuz 2026' },
  issizlik: { value: '%8.2', baseline2002: '%10.3', note: '', dataAsOf: null }
};

const buildEconomicDataBlock = () => {
  const d = ECONOMIC_DATA;
  const withDate = (item) => item.dataAsOf ? `${item.note ? item.note + ' ' : ''}${item.dataAsOf}`.trim() : item.note;
  const withBaseline = (item) => {
    let line = `- ${item.label}: ${item.value}`;
    if (item.dataAsOf) line += `(${withDate(item)})`;
    if (item.baseline2002) line += `[2002: ${item.baseline2002}]`;
    return line;
  };
  const items = [
    { ...d.aclikSiniri, label: 'Açlık Sınırı' }, { ...d.yoksullukSiniri, label: 'Yoksulluk Sınırı' },
    { ...d.asgariUcret, label: 'Asgari Ücret' }, { ...d.enDusukEmekliMaasi, label: 'En Düşük Emekli Maaşı' },
    { ...d.tufeYillik, label: 'TÜFE Yıllık' }, { ...d.tufeAylik, label: 'TÜFE Aylık' },
    { ...d.tcmbYilSonuBeklenti, label: 'TCMB Yıl Sonu Beklenti' }, { ...d.tcmbPolitikaFaizi, label: 'TCMB Politika Faizi' },
    { ...d.dolarTl, label: 'Dolar/TL' }, { ...d.euroTl, label: 'Euro/TL' },
    { ...d.gramAltin, label: 'Gram Altın' }, { ...d.ceyrekAltin, label: 'Çeyrek Altın' },
    { ...d.issizlik, label: 'İşsizlik' }
  ];
  return items.map(withBaseline).join('\n');
};

const ERROR_PATTERNS = [
  /görselde\s+(herhangi\s+)?bir\s+metin\s+bulunmamaktadır/i, /bu\s+görselde\s+metin\s+yok/i,
  /no\s+text\s+found\s+in\s+(the\s+)?image/i, /görselde\s+yazı\s+bulunamadı/i,
  /metin\s+bulunamadı/i, /cannot\s+(read|find|detect)\s+text/i,
  /ocr\s+(failed|error|başarısız)/i, /bu\s+resimde\s+yazı\s+yok/i
];


let _linkedInServerUrl = '';
const getLinkedInServerUrl = async () => {
  if (_linkedInServerUrl) return _linkedInServerUrl;
  const isHttpsRemoteOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
  if (isHttpsRemoteOrigin) { addSystemLog('Remote cloud ortamı: LinkedIn yerel sunucu atlandı (PNA engeli).', 'info'); return null; }
  try { const r = await fetch('https://localhost:3001/', { signal: AbortSignal.timeout(2000) }); if (r.ok) { _linkedInServerUrl = 'https://localhost:3001'; return _linkedInServerUrl; } } catch(e) {}
  try { const r = await fetch('https://127.0.0.1:3001/', { signal: AbortSignal.timeout(2000) }); if (r.ok) { _linkedInServerUrl = 'https://127.0.0.1:3001'; return _linkedInServerUrl; } } catch(e) {}
  try { const r = await fetch('http://localhost:3000/', { signal: AbortSignal.timeout(2000) }); if (r.ok) { _linkedInServerUrl = 'http://localhost:3000'; return _linkedInServerUrl; } } catch(e) {}
  try { const r = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(2000) }); if (r.ok) { _linkedInServerUrl = 'http://127.0.0.1:3000'; return _linkedInServerUrl; } } catch(e) {}
  return '';
};

const shareToLinkedInAPI = async (text, imageBase64 = null, linkUrl = null, linkTitle = null, videoBase64 = null) => {
  const baseUrl = await getLinkedInServerUrl();
  if (!baseUrl) throw new Error('LinkedIn sunucu bulunamadı — linkedin_server.py çalışıyor mu?');
  const body = { commentary: text };
  if (imageBase64) body.image_base64 = imageBase64;
  if (linkUrl) body.link_url = linkUrl;
  if (linkTitle) body.link_title = linkTitle;
  if (videoBase64) body.video_base64 = videoBase64;
  let r;
  if (videoBase64) {
    const base64Data = videoBase64.includes(',') ? videoBase64.split(',')[1] : videoBase64;
    const byteChars = atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const videoBlob = new Blob([byteArray], { type: 'video/mp4' });
    const totalSize = videoBlob.size;
    const chunkSize = 800 * 1024;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    const uploadId = 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    addSystemLog('Video parçalı yükleme: ' + (totalSize / 1024 / 1024).toFixed(1) + ' MB, ' + totalChunks + ' parça', 'info');
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = videoBlob.slice(start, end);
      const formData = new FormData();
      formData.append('upload_id', uploadId);
      formData.append('chunk_index', i.toString());
      formData.append('total_chunks', totalChunks.toString());
      formData.append('chunk', chunk, 'chunk_' + i + '.bin');
      const cr = await fetch(`${baseUrl}/linkedin/upload-chunk`, { method: 'POST', body: formData });
      if (!cr.ok) { const err = await cr.json().catch(() => ({})); throw new Error('Chunk ' + (i+1) + ' yükleme hatası: ' + (err.detail || cr.status)); }
      addSystemLog('Parça ' + (i+1) + '/' + totalChunks + ' yüklendi', 'info');
    }
    addSystemLog('Video LinkedIn\'e yükleniyor...', 'info');
    const shareForm = new FormData();
    shareForm.append('upload_id', uploadId);
    shareForm.append('commentary', text);
    r = await fetch(`${baseUrl}/linkedin/share-chunked`, { method: 'POST', body: shareForm });
  } else {
    r = await fetch(`${baseUrl}/linkedin/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.detail || `LinkedIn API hatası: ${r.status}`); }
  return await r.json();
};

const blobUrlToBase64 = async (blobUrl) => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
  addSystemLog('Video dosya boyutu: ' + sizeMB + ' MB', 'info');
  if (blob.size > 100 * 1024 * 1024) throw new Error('Video çok büyük (' + sizeMB + ' MB). LinkedIn limiti 100MB.');
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
};

const fetchWikimediaImages = async (query, limit = 3) => {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:bitmap+${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1280&format=json`;
    const r = await fetch(searchUrl);
    if (!r.ok) return [];
    const data = await r.json();
    const images = [];
    const pages = data.query?.pages || {};
    for (const page of Object.values(pages)) { const ii = page.imageinfo?.[0]; if (ii?.mime?.startsWith('image/')) images.push(ii.thumburl || ii.url); }
    return images;
  } catch (e) { return []; }
};

const GAZETE_PROXY_ENDPOINTS = { gazeteoku: 'http://localhost:3457/gazeteoku', aydinlik: 'http://localhost:3457/aydinlik', yenimesaj: 'http://localhost:3457/yenimesaj', gzt: 'http://localhost:3457/gzt' };
const ALLOWED_GAZETELER = ['Akşam', 'Analiz', 'Aydınlık', 'BirGün', 'Cumhuriyet', 'Diriliş Postası', 'Dünya', 'Evrensel', 'Gazete Pencere', 'Fanatik', 'Fotomaç', 'Hürriyet', 'Karar', 'Korkusuz', 'Milat', 'Milli Gazete', 'Milliyet', 'Nasıl Bir Ekonomi', 'Nefes', 'Posta', 'Sabah', 'Sözcü', 'Takvim', 'Tavır Gazetesi', 'Türkiye', 'Yeniçağ', 'Yeni Asya', 'Yeni Birlik', 'Yeni Mesaj', 'Yeni Şafak'];
const _isCanvasHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
const CORS_PROXIES = [
  { url: (u) => `https://www.whateverorigin.org/get?url=${encodeURIComponent(u)}`, json: true },
  { url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, json: false },
  { url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, json: true },
  { url: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`, json: false },
  ...(_isCanvasHttps ? [] : [{ url: (u) => `http://localhost:3457/proxy?url=${encodeURIComponent(u)}`, json: false, local: true }]),
];

// ============================================================================
// M2: CORE UTILITIES
// ============================================================================
const SafeStorage = {
  memoryStore: {},
  getItem: (key) => { try { return localStorage.getItem(key); } catch (e) { return SafeStorage.memoryStore[key] || null; } },
  setItem: (key, value) => { try { localStorage.setItem(key, value); } catch (e) { SafeStorage.memoryStore[key] = value; } },
  removeItem: (key) => { try { localStorage.removeItem(key); } catch (e) { delete SafeStorage.memoryStore[key]; } }
};

// v1.37 Buffer API anahtarı artık TSX/localStorage içinde tutulmaz.
// Anahtar yalnız OTONOM Buffer Bridge Chrome eklentisinin chrome.storage.local alanındadır.
SafeStorage.removeItem('BUFFER_API_KEY');

// The key stays in this tab, never in the public bundle or persistent preferences.
SafeStorage.removeItem('GEMINI_API_KEY');
let apiKey = '';
try { apiKey = sessionStorage.getItem('OTONOM_GEMINI_API_KEY') || ''; } catch (_) {}
const setGeminiApiKey = (key) => {
  apiKey = (key || '').trim();
  resetFreeTierStop();
  try {
    if (apiKey) sessionStorage.setItem('OTONOM_GEMINI_API_KEY', apiKey);
    else sessionStorage.removeItem('OTONOM_GEMINI_API_KEY');
  } catch (_) {}
};
const getGeminiApiKey = () => apiKey;
const NVIDIA_API_KEY = "";
const GROQ_API_KEY = "";

const _getAudioCtx = () => { if (!window._globalAudioCtx) window._globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (window._globalAudioCtx.state === 'suspended') window._globalAudioCtx.resume().catch((e) => { ErrorHandler.silent(e); }); return window._globalAudioCtx; };
const _suspendAudioCtx = () => { if (window._globalAudioCtx && window._globalAudioCtx.state === 'running') window._globalAudioCtx.suspend().catch((e) => { ErrorHandler.silent(e); }); };

class EventBus { constructor() { this.listeners = {}; } on(event, callback) { if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(callback); } emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data)); } }
const sysEventBus = new EventBus();
const _logBuffer = [];
const addSystemLog = (text, type = 'info') => { const time = new Date().toLocaleTimeString('tr-TR'); const entry = { text, type, timestamp: time }; _logBuffer.push(entry); sysEventBus.emit('SYS_LOG_ADD', entry); console.log(`[SYS_LOG] [${type.toUpperCase()}] ${text}`); };
window.addSystemLog = addSystemLog;

const ErrorHandler = { silent(e) { console.warn('[OTONOM]', e?.message || e); }, log(e, context = '') { addSystemLog(`${context ? context + ': ' : ''}${e?.message || e}`, 'warn'); }, fatal(e, context = '') { addSystemLog(`${context ? context + ': ' : ''}${e?.message || e}`, 'error'); throw e; }, sync(e) { console.warn("Otomatik senkronizasyon hatası:", e); } };

const sanitizeText = (text) => { if (!text || typeof text !== 'string') return ''; let cleaned = text.replace(/<[^>]>/g, ''); cleaned = cleaned.replace(/javascript:/gi, ''); cleaned = cleaned.replace(/on\w+\s=/gi, ''); cleaned = cleaned.replace(/data:/gi, ''); cleaned = cleaned.replace(/vbscript:/gi, ''); cleaned = cleaned.replace(/&#\d+;/g, ''); cleaned = cleaned.replace(/&#x[0-9a-f]+;/gi, ''); cleaned = cleaned.replace(/\s+/g, ' ').trim(); return cleaned; };
const sanitizeForLog = (text, maxLen = 100) => { const cleaned = sanitizeText(text); return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned; };


// === TIKTOK UYUMLU DİL KATMANI ===
// Sadece sansasyonel/yanıltıcı ifade biçimini yumuşatır; haberin olgusal içeriğini değiştirmez.
const makeTikTokSafeText = (value) => {
  if (!value || typeof value !== 'string') return value || '';
  let t = value;
  const replacements = [
    [/\bBUNU\s+GİZLİYORLAR\b/gi, 'GÜNDEMDE NE VAR'],
    [/\bŞOK\s+GELİŞME\b/gi, 'DİKKAT ÇEKEN GELİŞME'],
    [/\bŞOK\b/gi, 'DİKKAT ÇEKEN'],
    [/\bSKANDAL\b/gi, 'TARTIŞMA'],
    [/\bREZALET\b/gi, 'TEPKİ ÇEKEN DURUM'],
    [/\bİFŞA\b/gi, 'İNCELEME'],
    [/\bBOMBA\s+GELİŞME\b/gi, 'ÖNEMLİ GELİŞME'],
    [/\bKESİN\s+KANIT\b/gi, 'MEVCUT BULGULAR'],
    [/\bHERKES\s+BUNU\s+KONUŞUYOR\b/gi, 'GÜNDEMDEKİ KONU']
  ];
  replacements.forEach(([rx, rep]) => { t = t.replace(rx, rep); });
  return t.replace(/\s+/g, ' ').trim();
};

const makeTikTokSafeHeadline = (value, maxWords = 4) => {
  const safe = makeTikTokSafeText(value || '')
    .replace(/[“”"'`´‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = safe.split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.join(' ').trim() || 'GÜNDEMDEKİ GELİŞME';
};
const useDebounce = (value, delay = 300) => { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]); return debounced; };

const FIX_CHECKLIST = Object.freeze([
  { version: '1.7', key: 'GAZETE_TARIH_TR', text: 'Gazete Takip tarihi Europe/Istanbul saat dilimine sabitlendi.' },
  { version: '1.16', key: 'GAZETE_KAPAK_SECIMI', text: 'Gazete placeholder/stale aday yarışması ve merkez kapak seçim sırası düzeltildi.' },
  { version: '1.22', key: 'GAZETE_DIREKT_VIDEO', text: 'Gazete kartına tek tıkla doğrudan video ve bitince 30 gazetelik listeye dönüş sabitlendi.' },
  { version: '1.25', key: 'GAZETE_TAM_BOY', text: 'Gazete videosunda yatay preview reddedilip portre/tam-boy gerçek kapak seçimi sabitlendi.' },
  { version: '1.26', key: 'INSTAGRAM_CFR_30', text: 'Instagram 23-60 FPS için MP4 gerçek 30.000 CFR doğrulaması eklendi.' },
  { version: '1.27', key: 'ILK_KARE_SIYAH', text: 'Video ilk karesinin siyah çıkması çift katmanlı clickbait-frame korumasıyla kapatıldı.' },
  { version: '1.28', key: 'GUZEL_SOZ_SABIT_INTRO', text: 'Güzel Söz videoları sabit Güzel Sözler.mp4 ile başlar; intro bitince mevcut FR/DE/EN/TR süreci boşluksuz devam eder.' },
  { version: '1.29', key: 'GUZEL_SOZ_INTRO_INDEXEDDB', text: 'Güzel Sözler.mp4 TSX Base64 içinden çıkarıldı; bir kez seçilip IndexedDB Blob olarak kalıcı saklanır. Beyaz ekran/kod şişmesi giderildi.' },
  { version: '1.30', key: 'CFR_AV_SYNC', text: '30 FPS CFR dönüşümünde görüntü süresini kısaltan setpts=N/(30*TB) kaldırıldı; orijinal zaman çizelgesi korunarak ses-görüntü senkronu sabitlendi.' },
  { version: '1.31', key: 'EN_TRANSLATION_PROPER_NOUN', text: 'İngilizce çeviride Yıldız/Kenter gibi Türkçe karakter taşıyan özel adların yanlışlıkla Türkçe sanılıp reddedilmesi kaldırıldı; EN gerçek çeviri olarak korunur ve seslendirilir.' },
  { version: '1.32', key: 'HABER_SON_SOZ', text: 'Son Söz yalnız Haber/Gazete akışında zorunlu kapanış sahnesidir; slide benzerliği nedeniyle artık atlanmaz. Güzel Söz akışında Son Söz oluşturulmaz.' },
  { version: '1.33', key: 'SON_SOZ_MUSIC_INDEPENDENT', text: 'Haber/Gazete Son Söz alanı render öncesi zorunlu doğrulanır; boşsa otomatik onarılır. Son Söz TTS müzik seçiminden önce hazırlanır ve müzik seçili olmasa da sahne/ses atlanmaz.' },
  { version: '1.34', key: 'INSTAGRAM_CFR_NO_BYPASS', text: 'Buffer/Instagram video kaynağı blob/data/http fark etmeksizin önce Blob olur, 30.000 FPS CFR doğrulanır; public HTTPS video URL artık CFR adımını atlayamaz ve doğrulama olmadan Buffer postu oluşturulmaz.' },
  { version: '1.35', key: 'TR_TTS_DIL_KURALI', text: 'Türkçe TTS metni ses sentezinden önce dil kurallarına göre normalize edilir; 17 Eylül → on yedi Eylül, 2026 → iki bin yirmi altı. Türkçe tarih/sayılar ham rakamla TTS’ye gönderilmez.' },
  { version: '1.36', key: 'GAZETE_OTONOM_0700', text: 'Gazete Takip sekmesi açık programda Türkiye saati 07:00’de bugünün manşetlerini yeniler; ekranda bulunan gazeteleri sırayla aynı tek-tık video akışıyla üretir, otomatik kaydeder, hata alanı atlayıp devam eder ve günlük özet kaydeder.' },
  { version: '1.37', key: 'BUFFER_EXTENSION_BRIDGE', text: 'Buffer bağlantısı localhost/BAT/CORS yolundan çıkarıldı; Chrome eklentisi background service worker üzerinden resmi api.buffer.com GraphQL API’sine bağlanır. API anahtarı yalnız eklenti storage alanında tutulur.' },
  { version: '1.37', key: 'GAZETE_BUFFER_5DK', text: '07:00 Gazete Otonomu başarılı her videoyu Buffer’a aktarır; gazeteler üç hedef kanalda customScheduled olarak 5 dakika arayla planlanır. Bir Buffer hatası sonraki gazete videosunu durdurmaz.' },
  { version: '1.38', key: 'UISTATE_TDZ_STARTUP', text: '07:00 otonomunun uiState senkron effect’i uiState tanımlanmadan önce çalıştırılmaktan çıkarıldı; Cannot access uiState before initialization beyaz ekranı giderildi.' },
  { version: '1.39', key: 'BUFFER_MEDIA_UPLOAD_EXTENSION', text: 'Buffer için public HTTPS medya yükleme de Chrome eklentisinin background worker’ına taşındı; Gemini iframe/CORS nedeniyle Catbox/tmpfiles upload kaçırma yolu kapatıldı. Cloudinary unsigned upload desteklenir, Catbox kalıcı fallback’tir.' },
  { version: '1.40', key: 'FFMPEG_SINGLE_THREAD_NO_SAB', text: 'Instagram CFR motoru @ffmpeg/core-st@0.11.1 + mainName=main ile gerçek single-thread çekirdeğe sabitlendi; SharedArrayBuffer/cross-origin-isolation gereksinimi kaldırıldı.' },
  { version: '1.41', key: 'DEFAULT_BGM_POLYUSHKA_20', text: 'Arka plan müziği başlangıçta otomatik polyushka olarak seçilir ve müzik seviyesi tüm render/önizleme akışlarında %20’ye sabitlenir.' },
  { version: '1.42', key: 'BUFFER_SINGLE_POST', text: 'Buffer GraphQL isteği yalnız uygulamanın kendi frame’inden gönderilir; parent/top frame çoğaltması kaldırıldı. PAYLAŞ için senkron in-flight kilidi eklendi; aynı tıklama her sosyal medya kanalında yalnız 1 post üretir.' },
  { version: '1.43', key: 'GAZETE_SURE_ADAPTIF_BUFFER', text: 'Her gazetenin video + public upload + Buffer planlama toplam süresi tutulur. Gün 5dk aralıkla başlar; herhangi bir toplam süre 5 dakikayı aşarsa sonraki Buffer slotları aynı gün otomatik 10dk aralığa çıkar.' },
  { version: '1.44', key: 'BUFFER_DURABLE_HOST_PREFLIGHT', text: 'Video CFR başlamadan önce Buffer Bridge kalıcı public medya hostunu doğrular. Cloudinary veya Catbox userhash yoksa 3 dakikalık CFR işlemine boşuna girilmez; planlı video için geçici anonim host kullanılmaz.' },
  { version: '1.44', key: 'BUFFER_INTERVAL_10_MIN', text: 'Gerçek ölçüm 5 dakikayı aştığı için 07:00 gazete Buffer planlama aralığı artık her gün doğrudan 10 dakika ile başlar.' },
  { version: '1.44', key: 'CFR_PROGRESS_THROTTLE', text: 'FFmpeg progress %100 tekrarları logdan kaldırıldı; CFR ilerlemesi yalnız 25/50/75/100 eşiklerinde birer kez yazılır.' }
]);


// === GÜZEL SÖZ SABİT GİRİŞ VİDEOSU v1.28 ===
// Kullanıcının verdiği "Güzel Sözler.mp4" dosyasının birebir gömülü kopyası.
// YALNIZCA Güzel Söz video render akışında kullanılır.
const GUZEL_SOZ_INTRO_MEDIA_ID = 'GUZEL_SOZ_FIXED_INTRO_V1';
const GUZEL_SOZ_INTRO_READY_KEY = 'ns_guzelSozIntroReady_v1';
const GUZEL_SOZ_INTRO_EXPECTED_DURATION = 6.066667;

// === v1.36 SABAH 07:00 GAZETE OTONOMU ===
const GAZETE_AUTO_0700_ENABLED_KEY = 'ns_gazeteAuto0700Enabled_v1';
const GAZETE_AUTO_0700_STATE_KEY = 'ns_gazeteAuto0700State_v1';
const GAZETE_AUTO_0700_START_MINUTE = 7 * 60;      // 07:00
const GAZETE_AUTO_0700_CATCHUP_END = 8 * 60 + 30;  // 08:30

const _getTurkeyClockParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const out = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }

  const hour = Number(out.hour || 0) % 24;
  const minute = Number(out.minute || 0);

  return {
    date: `${out.year}-${out.month}-${out.day}`,
    hour,
    minute,
    second: Number(out.second || 0),
    minutesOfDay: (hour * 60) + minute
  };
};

const _loadGazeteAuto0700State = () => {
  try {
    const raw = SafeStorage.getItem(GAZETE_AUTO_0700_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const _saveGazeteAuto0700State = (value) => {
  try {
    SafeStorage.setItem(GAZETE_AUTO_0700_STATE_KEY, JSON.stringify(value || {}));
  } catch (e) {
    ErrorHandler.silent(e);
  }
};

const ObjectURLManager = { _urls: new Set(), create(blob) { const url = URL.createObjectURL(blob); this._urls.add(url); return url; }, revoke(url) { if (url && this._urls.has(url)) { URL.revokeObjectURL(url); this._urls.delete(url); } else if (url) { URL.revokeObjectURL(url); } }, revokeAll() { this._urls.forEach(u => URL.revokeObjectURL(u)); this._urls.clear(); } };

const exportWorkflowLog = (jobState) => {
  const lines = [
    '=== AI News Studio Workflow Log ===',
    `Tarih: ${new Date().toLocaleString('tr-TR')}`,
    `Versiyon: ${APP_VERSION.toString()}`,
    ''
  ];

  lines.push('--- FIX CHECKLIST / REGRESSION GUARD ---');
  for (const fix of FIX_CHECKLIST) {
    lines.push(`[x] v${fix.version} | ${fix.key} | ${fix.text}`);
  }
  lines.push(`[x] CURRENT | ${APP_VERSION.toString()} | Checklist aktif; sonraki düzeltmeler sürüm numarasıyla bu bölüme eklenmelidir.`);
  lines.push('');

  lines.push('--- Sistem Logları ---');
  for (const e of _logBuffer) lines.push(`[${e.timestamp}] [${e.type.toUpperCase()}] ${e.text}`);
  lines.push('');
  lines.push('--- Workflow State ---');
  lines.push(`Job ID: ${jobState?.jobId || 'N/A'}`);
  lines.push(`Status: ${jobState?.status || 'N/A'}`);
  lines.push(`Slides: ${jobState?.script?.videoSlides?.length || 0}`);
  lines.push(`ImageBlocks: ${jobState?.script?.imageBlocks?.length || 0}`);
  lines.push(`Images generated: ${jobState?.assets?.images?.filter(Boolean).length || 0}/${jobState?.assets?.images?.length || 0}`);
  lines.push(`Audio generated: ${jobState?.assets?.audio?.filter(Boolean).length || 0}/${jobState?.assets?.audio?.length || 0}`);
  lines.push(`First-frame cover cached: ${!!jobState?.assets?._renderedClickbaitFrame}`);
  lines.push(`Config: ${JSON.stringify(jobState?.config || {}, null, 2)}`);
  lines.push('');
  lines.push('--- Slide Details ---');
  for (const [i, s] of (jobState?.script?.videoSlides || []).entries()) {
    lines.push(`S${i + 1}: "${(s.spokenText || '').substring(0, 80)}..." img=${!!jobState?.assets?.images?.[i]} aud=${!!jobState?.assets?.audio?.[i]}`);
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = ObjectURLManager.create(blob);
  a.download = `log_${APP_VERSION.hotfix}_${Date.now()}.txt`;
  a.click();
};
window.exportWorkflowLog = exportWorkflowLog;

const getWPS = (lang) => ({ 'en': 2.5, 'es': 2.6, 'fr': 2.4, 'tr': 2.2, 'ar': 2.2, 'de': 2.0, 'ru': 2.0 }[lang] || 2.2);
const _getTurkeyDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const out = {};
  parts.forEach(part => { if (part.type !== 'literal') out[part.type] = part.value; });
  return { year: out.year, month: out.month, day: out.day };
};
const _getTurkeyDateISO = (date = new Date()) => {
  const p = _getTurkeyDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
};
const _getCurrentMonthYearTR = () => new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  month: 'long',
  year: 'numeric'
}).format(new Date());
const _getCurrentDateTR = () => new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(new Date());

// === v1.35 TÜRKÇE TTS DİL KURALI ===
// Görsel metni değiştirmez; yalnız ses sentezine giden Türkçe metni düzeltir.
const TR_MONTHS = Object.freeze([
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]);

const _trUnderThousand = (value) => {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n === 0) return '';

  const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
  const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
  const parts = [];

  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    if (hundreds > 1) parts.push(ones[hundreds]);
    parts.push('yüz');
  }

  const ten = Math.floor(remainder / 10);
  const one = remainder % 10;
  if (ten > 0) parts.push(tens[ten]);
  if (one > 0) parts.push(ones[one]);

  return parts.join(' ');
};

const _trIntegerToWords = (value) => {
  let n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return 'sıfır';
  if (n < 0) return `eksi ${_trIntegerToWords(Math.abs(n))}`;

  const parts = [];
  const groups = [
    { value: 1_000_000_000, name: 'milyar' },
    { value: 1_000_000, name: 'milyon' },
    { value: 1_000, name: 'bin' }
  ];

  for (const group of groups) {
    const count = Math.floor(n / group.value);
    if (count > 0) {
      if (group.value === 1000 && count === 1) parts.push('bin');
      else parts.push(_trIntegerToWords(count), group.name);
      n %= group.value;
    }
  }

  if (n > 0) parts.push(_trUnderThousand(n));
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
};

const _normalizeTurkishTtsText = (input) => {
  let s = String(input || '').replace(/\s+/g, ' ').trim();
  if (!s) return s;

  const monthPattern = '(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)';

  // 17 Eylül 2026 -> on yedi Eylül, iki bin yirmi altı
  s = s.replace(
    new RegExp(`\\b([0-3]?\\d)\\s+${monthPattern}(?:\\s+(\\d{4}))?\\b`, 'gi'),
    (_, day, month, year) => {
      const canonicalMonth =
        TR_MONTHS.find(m => m.toLocaleLowerCase('tr-TR') === String(month).toLocaleLowerCase('tr-TR')) || month;
      return `${_trIntegerToWords(Number(day))} ${canonicalMonth}${year ? `, ${_trIntegerToWords(Number(year))}` : ''}`;
    }
  );

  // 17.09.2026 / 17-09-2026 / 17/09/2026
  s = s.replace(
    /\b([0-3]?\d)[./-]([01]?\d)[./-](\d{4})\b/g,
    (match, day, month, year) => {
      const monthIndex = Number(month) - 1;
      if (monthIndex < 0 || monthIndex > 11) return match;
      return `${_trIntegerToWords(Number(day))} ${TR_MONTHS[monthIndex]}, ${_trIntegerToWords(Number(year))}`;
    }
  );

  // Saat 14:30 -> saat on dört otuz
  s = s.replace(
    /\b(?:saat\s*)?([01]?\d|2[0-3]):([0-5]\d)\b/gi,
    (_, hour, minute) => `saat ${_trIntegerToWords(Number(hour))} ${_trIntegerToWords(Number(minute))}`
  );

  // %25 veya 25%
  const percentWords = (raw) => {
    const normalized = String(raw).replace(',', '.');
    const [whole, decimal] = normalized.split('.');
    if (!decimal) return `yüzde ${_trIntegerToWords(Number(whole))}`;
    const decimalWords = decimal.split('').map(d => _trIntegerToWords(Number(d))).join(' ');
    return `yüzde ${_trIntegerToWords(Number(whole))} virgül ${decimalWords}`;
  };
  s = s.replace(/%\s*(\d+(?:[.,]\d+)?)/g, (_, n) => percentWords(n));
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, n) => percentWords(n));

  // 3,5 -> üç virgül beş
  s = s.replace(/\b(\d+),(\d+)\b/g, (_, whole, decimal) =>
    `${_trIntegerToWords(Number(whole))} virgül ${decimal.split('').map(d => _trIntegerToWords(Number(d))).join(' ')}`
  );

  // Kalan bağımsız sayılar: 17 -> on yedi, 2026 -> iki bin yirmi altı
  s = s.replace(
    /(^|[^A-Za-zÇĞİÖŞÜçğıöşü0-9])(\d{1,10})(?=$|[^A-Za-zÇĞİÖŞÜçğıöşü0-9])/g,
    (_, prefix, digits) => `${prefix}${_trIntegerToWords(Number(digits))}`
  );

  return s
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?])(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
};

// === SON SÖZ ALINTI GEÇMİŞİ (tekrar etmeyen alıntı seçimi için) ===
// Her üretilen "Son Söz" alıntısı burada kalıcı olarak (localStorage) saklanır ve
// bir sonraki üretimde AI'ya "bunları tekrar etme" diye hatırlatılır.
const SON_SOZ_HISTORY_KEY = 'ns_sonSozHistory';
const SON_SOZ_HISTORY_MAX = 60;
const getSonSozHistory = () => { try { return JSON.parse(SafeStorage.getItem(SON_SOZ_HISTORY_KEY) || '[]'); } catch (e) { return []; } };
const addSonSozToHistory = (sonSoz, sonSozKaynak) => {
  if (!sonSoz || !sonSoz.trim()) return;
  const entry = sonSozKaynak && sonSozKaynak.trim() ? `${sonSoz.trim()} — ${sonSozKaynak.trim()}` : sonSoz.trim();
  const history = getSonSozHistory();
  if (history.includes(entry)) return;
  history.push(entry);
  SafeStorage.setItem(SON_SOZ_HISTORY_KEY, JSON.stringify(history.slice(-SON_SOZ_HISTORY_MAX)));
};
const buildSonSozHistoryPrompt = () => {
  const history = getSonSozHistory();
  if (!history.length) return 'Yok (henüz alıntı kullanılmadı).';
  return history.slice(-30).map((item, i) => `${i + 1}. ${item}`).join('\n');
};
// Son Söz + kaynağını tek, doğal okunacak metne birleştirir (TTS ve süre hesabı için).
const buildSonSozSpokenText = (sonSoz, sonSozKaynak) => {
  const soz = (sonSoz || '').trim();
  if (!soz) return '';
  const kaynak = (sonSozKaynak || '').trim();
  if (!kaynak) return soz;
  const filmAlintisi = /film|movie|sinema/i.test(kaynak);
  return filmAlintisi ? `${soz}. Bu alıntı ${kaynak} alındı.` : `${soz}. ${kaynak}.`;
};

const getDurationBounds = (dur) => { if (dur === '15') return { min: 15.0, max: 30.0 }; if (dur === '30') return { min: 30.0, max: 60.0 }; if (dur === '60') return { min: 60.0, max: 90.0 }; if (dur === '90') return { min: 90.0, max: 120.0 }; return { min: 0.0, max: 9999.0 }; };

// ============================================================================
// M3: NETWORK (Firebase kaldırıldı — tamamen yerel mod)
// ============================================================================
// Not: Firebase, auth, Firestore bağımlılıkları tamamen kaldırıldı.
// Kalıcılık katmanı: SafeStorage (localStorage) + IndexedDB (AssetManagerService).
const NetworkUtils = {
  fetchWithRetry: async (url, options, retries = 5) => {
    const baseDelay = 1000; const maxDelay = 30000;
    for (let i = 0; i < retries; i++) {
      const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
      const jitter = Math.random() * 500; const totalDelay = delay + jitter;
      try {
        const res = await (String(url).startsWith('https://generativelanguage.googleapis.com/') ? fetchFreeGemini(url, options) : fetch(url, options));
        if (res.ok) return res;
        if (res.status === 400 || res.status === 403 || res.status === 404) throw new Error(`HTTP_FAIL_${res.status}`);
        if (res.status === 401) {
          // Tek bir 401 yanıtını doğrudan geçersiz API anahtarı olarak yorumlama.
          // Aynı anahtarla önceki/sonraki paralel istekler başarılı olabildiği için
          // kısa bir yeniden deneme yap; yalnızca son denemede kalıcı hata bildir.
          if (i < Math.min(2, retries - 1)) {
            addSystemLog(`Gemini geçici yetkilendirme yanıtı (401). Yeniden deneniyor (${i + 1}/${Math.min(3, retries)})...`, 'warn');
            await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
            continue;
          }
          addSystemLog('Gemini yetkilendirmesi art arda başarısız oldu (401). API anahtarını ancak bu hata tüm denemelerde sürerse kontrol edin.', 'error');
          throw new Error('HTTP_FAIL_401');
        }
        if (res.status === 429 || res.status >= 500) { addSystemLog(`Yavaşlık (HTTP ${res.status}). Yeniden deneme (${i + 1}/${retries}) - ${(totalDelay / 1000).toFixed(1)}sn...`, "warn"); await new Promise(r => setTimeout(r, totalDelay)); continue; }
        throw new Error(`HTTP Error ${res.status}`);
      } catch (err) {
        if (err.message.startsWith('HTTP_FAIL_')) throw err;
        if (i === retries - 1) throw err;
        addSystemLog(`Bağlantı kesintisi. Yeniden deneniyor (${i + 1}/${retries}) - ${(totalDelay / 1000).toFixed(1)}sn...`, "warn");
        await new Promise(r => setTimeout(r, totalDelay));
      }
    }
    throw new Error('fetchWithRetry: tüm denemeler başarısız');
  },
  loadImage: (src) => new Promise((resolve) => { if (!src) return resolve(null); if (typeof src !== 'string') { console.warn('loadImage: src string değil', typeof src); return resolve(null); } const img = new Image(); if (src.startsWith('http')) img.crossOrigin = "Anonymous"; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src; }),
  fileToBase64: (file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); }),
  compressImage: (file) => new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width; let h = img.height; const maxW = 1080;
        if (w > maxW || h > maxW) { if (w > h) { h = Math.round((h / w) * maxW); w = maxW; } else { w = Math.round((w / h) * maxW); h = maxW; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, w, h);
        const res = canvas.toDataURL('image/jpeg', 0.7);
        canvas.width = 0; canvas.height = 0;
        resolve(res);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  })
};

// ============================================================================
// M4: ASSET MANAGER
// ============================================================================
const ASSET_DB = 'AINewsSaaS_Assets_v5';
const STORE_MEDIA = 'media_cache';
const STORE_JOBS = 'temporal_jobs';
const LIB_STORE = 'musicLib';
const DIR_STORE = 'dirHandles';

class AssetManagerService {
  static async getDB() { return new Promise((resolve, reject) => { const req = indexedDB.open(ASSET_DB, 2); req.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA, { keyPath: 'id' }); if (!db.objectStoreNames.contains(STORE_JOBS)) db.createObjectStore(STORE_JOBS, { keyPath: 'jobId' }); if (!db.objectStoreNames.contains(LIB_STORE)) db.createObjectStore(LIB_STORE, { keyPath: 'id' }); if (!db.objectStoreNames.contains(DIR_STORE)) db.createObjectStore(DIR_STORE, { keyPath: 'id' }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  static async saveMedia(id, data) { try { const db = await this.getDB(); const tx = db.transaction(STORE_MEDIA, 'readwrite'); tx.objectStore(STORE_MEDIA).put({ id, data, timestamp: Date.now() }); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async loadMedia(id) { try { const db = await this.getDB(); const tx = db.transaction(STORE_MEDIA, 'readonly'); const req = tx.objectStore(STORE_MEDIA).get(id); return new Promise(r => req.onsuccess = () => r(req.result?.data || null)); } catch (e) { return null; } }
  static async deleteMedia(id) { try { const db = await this.getDB(); const tx = db.transaction(STORE_MEDIA, 'readwrite'); tx.objectStore(STORE_MEDIA).delete(id); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async saveJobState(jobData) { try { const db = await this.getDB(); const tx = db.transaction(STORE_JOBS, 'readwrite'); tx.objectStore(STORE_JOBS).put(jobData); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async getPendingJob() { try { const db = await this.getDB(); const tx = db.transaction(STORE_JOBS, 'readonly'); const req = tx.objectStore(STORE_JOBS).getAll(); return new Promise(r => req.onsuccess = () => { const jobs = req.result || []; const pending = jobs.find(j => j.status !== 'COMPLETED' && j.status !== 'FAILED'); r(pending || null); }); } catch (e) { return null; } }
  static async clearJob(jobId) { try { const db = await this.getDB(); const tx = db.transaction(STORE_JOBS, 'readwrite'); tx.objectStore(STORE_JOBS).delete(jobId); } catch(e) { ErrorHandler.silent(e); } }
  static async saveMusicToLib(musicObj) { try { const db = await this.getDB(); const tx = db.transaction(LIB_STORE, 'readwrite'); tx.objectStore(LIB_STORE).put(musicObj); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async getAllMusicFromLib() { try { const db = await this.getDB(); const tx = db.transaction(LIB_STORE, 'readonly'); const req = tx.objectStore(LIB_STORE).getAll(); return new Promise(r => req.onsuccess = () => r(req.result || [])); } catch (e) { return []; } }
  static async migrateLegacyMusicLibraries() {
    try {
      if (typeof indexedDB.databases !== 'function') return 0;
      const dbInfos = await indexedDB.databases();
      const candidates = (dbInfos || [])
        .map(x => x?.name)
        .filter(name => name && name !== ASSET_DB && /^AINewsSaaS_Assets/i.test(name));
      if (candidates.length === 0) return 0;
      const current = await this.getAllMusicFromLib();
      const existingIds = new Set(current.map(m => m.id));
      let migrated = 0;
      for (const dbName of candidates) {
        try {
          const legacyDb = await new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (!legacyDb.objectStoreNames.contains(LIB_STORE)) { legacyDb.close(); continue; }
          const legacyMusic = await new Promise(resolve => {
            try {
              const tx = legacyDb.transaction(LIB_STORE, 'readonly');
              const req = tx.objectStore(LIB_STORE).getAll();
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => resolve([]);
            } catch (e) { resolve([]); }
          });
          legacyDb.close();
          for (const track of legacyMusic) {
            if (!track?.id || !track?.data || existingIds.has(track.id)) continue;
            if (await this.saveMusicToLib(track)) {
              existingIds.add(track.id);
              migrated++;
            }
          }
        } catch (e) { ErrorHandler.silent(e); }
      }
      return migrated;
    } catch (e) { ErrorHandler.silent(e); return 0; }
  }
  static async getMusicFromLib(id) { try { const db = await this.getDB(); const tx = db.transaction(LIB_STORE, 'readonly'); const req = tx.objectStore(LIB_STORE).get(id); return new Promise(r => req.onsuccess = () => r(req.result || null)); } catch (e) { return null; } }
  static async removeMusicFromLib(id) { try { const db = await this.getDB(); const tx = db.transaction(LIB_STORE, 'readwrite'); tx.objectStore(LIB_STORE).delete(id); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async saveDirHandle(handle) { try { const db = await this.getDB(); const tx = db.transaction(DIR_STORE, 'readwrite'); tx.objectStore(DIR_STORE).put({ id: 'musicDir', handle, name: handle.name, lastSync: Date.now() }); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async getDirHandle() { try { const db = await this.getDB(); const tx = db.transaction(DIR_STORE, 'readonly'); const req = tx.objectStore(DIR_STORE).get('musicDir'); return new Promise(r => req.onsuccess = () => r(req.result || null)); } catch (e) { return null; } }
  static async removeDirHandle() { try { const db = await this.getDB(); const tx = db.transaction(DIR_STORE, 'readwrite'); tx.objectStore(DIR_STORE).delete('musicDir'); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async saveDownloadsDirHandle(handle) { try { const db = await this.getDB(); const tx = db.transaction(DIR_STORE, 'readwrite'); tx.objectStore(DIR_STORE).put({ id: 'downloadsDir', handle, name: handle.name, timestamp: Date.now() }); return new Promise(r => tx.oncomplete = () => r(true)); } catch (e) { return false; } }
  static async getDownloadsDirHandle() { try { const db = await this.getDB(); const tx = db.transaction(DIR_STORE, 'readonly'); const req = tx.objectStore(DIR_STORE).get('downloadsDir'); return new Promise(r => req.onsuccess = () => r(req.result || null)); } catch (e) { return null; } }
}

const syncMusicFromDir = async (dirHandle, existingMusic) => {
  if (!dirHandle || typeof dirHandle.values !== 'function') return 0;
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'];
  const existingIds = new Set(existingMusic.map(m => m.id));
  let newCount = 0;
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && audioExts.some(ext => entry.name.toLowerCase().endsWith(ext))) {
        const file = await entry.getFile();
        const id = "fm_" + file.name.replace(/[^a-zA-Z0-9]/g, '') + "_" + file.size;
        if (existingIds.has(id)) continue;
        const b64 = await NetworkUtils.fileToBase64(file);
        await AssetManagerService.saveMusicToLib({ id, name: file.name, data: b64 });
        newCount++;
      }
    }
    if (dirHandle.name) { const db = await AssetManagerService.getDB(); const tx = db.transaction(DIR_STORE, 'readwrite'); tx.objectStore(DIR_STORE).put({ id: 'musicDir', handle: dirHandle, name: dirHandle.name, lastSync: Date.now() }); }
  } catch (e) { ErrorHandler.sync(e); }
  return newCount;
};

// ============================================================================
// M4b: HELPER
// ============================================================================
const analyzeQuoteEmotion = (text) => {
  const lower = text.toLowerCase();
  const mutluKelimeler = ['mutlu', 'sevinç', 'neşe', 'güle', 'eğlen', 'coşku', 'başarı', 'zafer', 'kazan', 'umut', 'güneş', 'aydınlık', 'güzel', 'sevgi', 'aşk', 'sev', 'tatlı', 'tat', 'bal', 'çiçek', 'bahar', 'yaz', 'dünya', 'yaşam', 'hayat'];
  const hüzünlüKelimeler = ['hüzün', 'üzgün', 'ağla', 'göz yaş', 'keder', 'acı', 'kayıp', 'ölüm', 'ayrılık', 'yalnız', 'yalnızlık', 'karanlık', 'gece', 'son', 'bitiş', 'veda', 'göç', 'hıçkırık', 'fırtına', 'yağmur', 'kış', 'soğuk', 'don', 'göz yaş'];
  const romantikKelimeler = ['aşk', 'sevda', 'sevgili', 'kalp', 'gönül', 'dudak', 'öp', 'sarı', 'kokla', 'tatlı', 'bal', 'gül', 'ay', 'yıldız', 'gece', 'rk', 'düş', 'rüya', 'özlem', 'bekle', 'hasret', 'vuslat', 'buluş'];
  let mutluSkor = 0, hüzünlüSkor = 0, romantikSkor = 0;
  mutluKelimeler.forEach(k => { if (lower.includes(k)) mutluSkor++; });
  hüzünlüKelimeler.forEach(k => { if (lower.includes(k)) hüzünlüSkor++; });
  romantikKelimeler.forEach(k => { if (lower.includes(k)) romantikSkor++; });
  const maxSkor = Math.max(mutluSkor, hüzünlüSkor, romantikSkor);
  if (maxSkor === 0) return 'notr';
  if (mutluSkor === maxSkor) return 'mutlu';
  if (hüzünlüSkor === maxSkor) return 'hüzünlü';
  return 'romantik';
};

const DEFAULT_BGM_NAME = 'polyushka';
const DEFAULT_BGM_VOLUME = 0.20;

const findDefaultPolyushkaTrack = (musicList = []) => {
  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\.[^.]+$/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (musicList || []).find(track => {
    const name = normalize(track?.name);
    return name === DEFAULT_BGM_NAME || name.includes(DEFAULT_BGM_NAME);
  }) || null;
};

const matchMusicToEmotion = (emotion, musicList) => {
  if (!musicList || musicList.length === 0) return null;
  const emotionKeywords = { 'mutlu': ['happy', 'upbeat', 'energetic', 'pop', 'joy', 'dance', 'fun', 'bright', 'major', 'optimistic', 'mutlu', 'neşeli', 'coşkulu', 'eğlence'], 'hüzünlü': ['sad', 'melancholy', 'emotional', 'piano', 'strings', 'slow', 'deep', 'minor', 'cry', 'sorrow', 'hüzün', 'üzüntü', 'agir', 'yavas', 'duygusal'], 'romantik': ['romantic', 'love', 'soft', 'gentle', 'dream', 'ambient', 'chill', 'relax', 'calm', 'aşk', 'sevgi', 'roma', 'duygusal', 'yavas'], 'notr': ['background', 'ambient', 'chill', 'lofi', 'calm', 'soft', 'neutral', 'minimal'] };
  const keywords = emotionKeywords[emotion] || emotionKeywords['notr'];
  let bestMatch = null; let bestScore = -1;
  for (const track of musicList) {
    const name = (track.name || '').toLowerCase();
    let score = 0;
    for (const kw of keywords) { if (name.includes(kw)) score += 2; }
    const ext = name.split('.').pop();
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) score += 0.5;
    if (score > bestScore) { bestScore = score; bestMatch = track; }
  }
  if (bestScore <= 0) { const idx = Math.floor(Math.random() * musicList.length); return musicList[idx]; }
  return bestMatch;
};

// [DEVAM EDECEK - BÖLÜM 2/4: M5 Logic Engine, M6 Media Synthesis, M7 Ambient Audio]

// ============================================================================
// M5: LOGIC ENGINE
// ============================================================================
// === ORTAK OCR YARDIMCILARI ===
const _splitIntoStrips = (srcB64, stripCount) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const strips = [];
      const stripHeight = Math.ceil(img.height / stripCount);
      for (let i = 0; i < stripCount; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = stripHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, i * stripHeight, img.width, stripHeight, 0, 0, img.width, stripHeight);
        strips.push(canvas.toDataURL('image/jpeg', 0.95).split(',')[1]);
      }
      resolve(strips);
    };
    img.onerror = () => resolve([srcB64]);
    img.src = 'data:image/jpeg;base64,' + srcB64;
  });
};

const _ocrCall = async (imageB64, prompt, model, imgType, apiKey) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const r = await NetworkUtils.fetchWithRetry(url, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [
        { inlineData: { mimeType: imgType, data: imageB64 } },
        { text: prompt }
      ] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 2048 }
    })
  });
  if (!r) return "";
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
};

const _OCR_MODELS = AI_CONFIG.OCR_MODELS;
const ocrWithFallback = async (b64Data, imgType, apiKey, logPrefix = 'Görsel') => {
  const models = _OCR_MODELS;
  const strategies = [
    { strips: 3, prompt: 'Bu şeritteki yazıyı oku. Sadece metni yaz, başka bir şey yazma.', label: '3 şerit' },
    { strips: 5, prompt: 'Bu görsel şeritteki yazıyı tam olarak oku. Sadece metni ver.', label: '5 şerit' },
    { strips: 0, prompt: 'Bu resimdeki tüm yazıyı en üstten en alta, satır satır yaz. Sadece metni ver.', label: 'tam görsel' }
  ];
  for (const strategy of strategies) {
    addSystemLog(`${logPrefix}: ${strategy.label} denemesi...`, 'info');
    for (const model of models) {
      try {
        if (strategy.strips > 0) {
          const strips = await _splitIntoStrips(b64Data, strategy.strips);
          const stripTexts = [];
          for (let i = 0; i < strips.length; i++) {
            const result = await _ocrCall(strips[i], strategy.prompt, model, imgType, apiKey);
            if (result.length > 2) {
              stripTexts.push(result);
              addSystemLog(`  Şerit ${i+1}: "${result.substring(0, 40)}..."`, 'info');
            }
          }
          if (stripTexts.length > 0) {
            const text = stripTexts.join('\n');
            addSystemLog(`✓ ${model} ${strategy.label} başarılı: ${text.length} karakter`, 'success');
            return text;
          }
        } else {
          const result = await _ocrCall(b64Data, strategy.prompt, model, imgType, apiKey);
          if (result.length > 15) {
            addSystemLog(`✓ ${model} ${strategy.label} başarılı: ${result.length} karakter`, 'success');
            return result;
          }
        }
      } catch (e) { if (isFreeTierStop(e)) throw e;
        addSystemLog(`  ${model} ${strategy.label} hatası: ${e.message}`, 'warn');
      }
    }
  }
  return '';
};

const _callGeminiAndParse = async (url, payload) => {
  const r = await NetworkUtils.fetchWithRetry(url, { method: 'POST', body: JSON.stringify(payload) });
  if (!r) throw new Error('API yanıt döndürmedi');
  const data = await r.json();
  if (data.candidates?.[0]?.finishReason === "SAFETY") throw new Error("İçerik güvenlik filtresine takıldı.");
  if (!data.candidates?.[0]?.content) throw new Error("Yapay Zeka API boş yanıt döndürdü.");
  let responseText = data.candidates[0].content.parts[0].text;
  responseText = responseText.replace(/`json/gi, '').replace(/`/g, '').trim();
  const jsonStart = responseText.indexOf('{'); const jsonEnd = responseText.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) responseText = responseText.substring(jsonStart, jsonEnd + 1);
  return JSON.parse(responseText);
};

const _base64ToBlob = (b64, mimeType = 'audio/mpeg') => {
  const raw = b64.includes(',') ? b64.split(',')[1] : b64;
  const byteString = atob(raw);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeType });
};

const _getLangInstruction = (lang) => {
  const map = { tr: 'TÜRKÇE', en: 'İNGİLİZCE', fr: 'FRANSIZCA', de: 'ALMANCA', es: 'İSPANYOLCA', ar: 'ARAPÇA', ru: 'RUSÇA' };
  return `BÜTÜN SENARYOYU ${map[lang] || 'TÜRKÇE'} YAZACAKSIN.`;
};

const _createTimerWorker = () => {
  const frameInterval = RENDER_CONFIG.TIMER_WORKER_INTERVAL_MS;
  const code = `let interval; self.onmessage = function(e) { if (e.data === 'start') interval = setInterval(() => self.postMessage('tick'), ${frameInterval}); if (e.data === 'stop') clearInterval(interval); };`;
  return new Worker(ObjectURLManager.create(new Blob([code], { type: 'application/javascript' })));
};

const _createSilentOsc = (audioCtx, audioDest) => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.001;
  osc.connect(gain); gain.connect(audioDest); osc.start();
  return { osc, gain };
};

const _getFontFamily = (fontStyle) => {
  if (fontStyle === 'classic') return "Georgia, 'Times New Roman', serif";
  if (fontStyle === 'typewriter') return "'Courier New', Courier, monospace";
  return "'Inter', 'Arial Black', Arial, sans-serif";
};

// === WebM → MP4 DÖNÜŞÜM (ffmpeg.wasm @0.11 — GERÇEK SINGLE THREAD) ===
let _ffmpegInstance = null;
let _ffmpegLoadingPromise = null;

const _loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector('script[src="' + src + '"]')) return resolve();

  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.onload = () => resolve();
  s.onerror = () => reject(new Error('Script yüklenemedi: ' + src));
  document.head.appendChild(s);
});

const _loadFFmpeg = async () => {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_ffmpegLoadingPromise) return _ffmpegLoadingPromise;

  _ffmpegLoadingPromise = (async () => {
    const wrapperUrl = `${import.meta.env.BASE_URL}vendor/ffmpeg/ffmpeg.min.js`;
    const singleThreadCoreUrl = new URL(`${import.meta.env.BASE_URL}vendor/ffmpeg/ffmpeg-core.js`, window.location.origin).href;

    addSystemLog(
      `Instagram CFR motoru yükleniyor: ffmpeg.wasm single-thread (SharedArrayBuffer gerektirmez). crossOriginIsolated=${String(window.crossOriginIsolated === true)}`,
      'info'
    );

    await _loadScript(wrapperUrl);

    const FFmpegLib = window.FFmpeg;
    if (!FFmpegLib || !FFmpegLib.createFFmpeg || !FFmpegLib.fetchFile) {
      throw new Error('ffmpeg.wasm wrapper yüklenemedi.');
    }

    // KRİTİK v1.40:
    // @ffmpeg/core-st gerçek single-thread build'dir.
    // mainName:'main' 0.11.x dokümantasyonunun single-thread kullanım şartıdır.
    // SharedArrayBuffer / COOP / COEP gerekmez.
    const ffmpeg = FFmpegLib.createFFmpeg({
      log: false,
      mainName: 'main',
      corePath: singleThreadCoreUrl
    });

    try {
      await ffmpeg.load();
    } catch (e) { if (isFreeTierStop(e)) throw e;
      const msg = String(e?.message || e);

      if (/SharedArrayBuffer/i.test(msg)) {
        throw new Error(
          'Single-thread FFmpeg yüklenirken beklenmeyen SharedArrayBuffer isteği oluştu. ' +
          'Multi-thread çekirdeğin cache’de kalmış olma ihtimali var; sayfayı Ctrl+Shift+R ile yenileyin. ' +
          `Asıl hata: ${msg}`
        );
      }

      throw e;
    }

    _ffmpegInstance = {
      ffmpeg,
      fetchFile: FFmpegLib.fetchFile,
      coreMode: 'single-thread',
      coreVersion: '@ffmpeg/core-st@0.11.1'
    };

    addSystemLog(
      '✓ FIX CHECKLIST v1.40: FFmpeg gerçek single-thread core-st yüklendi; SharedArrayBuffer bağımlılığı yok.',
      'success'
    );

    return _ffmpegInstance;
  })();

  try {
    return await _ffmpegLoadingPromise;
  } finally {
    _ffmpegLoadingPromise = null;
  }
};
const _readMp4Box = (view, offset, limit) => {
  if (offset + 8 > limit) return null;
  let size = view.getUint32(offset, false);
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7)
  );
  let headerSize = 8;

  if (size === 1) {
    if (offset + 16 > limit) return null;
    const hi = view.getUint32(offset + 8, false);
    const lo = view.getUint32(offset + 12, false);
    size = hi * 4294967296 + lo;
    headerSize = 16;
  } else if (size === 0) {
    size = limit - offset;
  }

  if (!Number.isFinite(size) || size < headerSize || offset + size > limit) return null;
  return {
    type,
    start: offset,
    size,
    dataStart: offset + headerSize,
    end: offset + size
  };
};

const _findMp4Children = (view, start, end, wantedType = null) => {
  const found = [];
  let offset = start;
  while (offset + 8 <= end) {
    const box = _readMp4Box(view, offset, end);
    if (!box) break;
    if (!wantedType || box.type === wantedType) found.push(box);
    offset = box.end;
  }
  return found;
};

const _findMp4Child = (view, parent, type) =>
  _findMp4Children(view, parent.dataStart, parent.end, type)[0] || null;

const _verifyInstagramCfrMp4 = async (blob) => {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  const root = { dataStart: 0, end: buffer.byteLength };

  const moov = _findMp4Children(view, root.dataStart, root.end, 'moov')[0];
  if (!moov) throw new Error('CFR doğrulama: MP4 moov kutusu bulunamadı.');

  const traks = _findMp4Children(view, moov.dataStart, moov.end, 'trak');
  for (const trak of traks) {
    const mdia = _findMp4Child(view, trak, 'mdia');
    if (!mdia) continue;

    const hdlr = _findMp4Child(view, mdia, 'hdlr');
    if (!hdlr || hdlr.dataStart + 12 > hdlr.end) continue;
    const handler = String.fromCharCode(
      view.getUint8(hdlr.dataStart + 8),
      view.getUint8(hdlr.dataStart + 9),
      view.getUint8(hdlr.dataStart + 10),
      view.getUint8(hdlr.dataStart + 11)
    );
    if (handler !== 'vide') continue;

    const mdhd = _findMp4Child(view, mdia, 'mdhd');
    if (!mdhd) throw new Error('CFR doğrulama: video mdhd bulunamadı.');

    const mdhdVersion = view.getUint8(mdhd.dataStart);
    const timescaleOffset = mdhdVersion === 1 ? mdhd.dataStart + 20 : mdhd.dataStart + 12;
    if (timescaleOffset + 4 > mdhd.end) throw new Error('CFR doğrulama: timescale okunamadı.');
    const timescale = view.getUint32(timescaleOffset, false);
    if (!timescale) throw new Error('CFR doğrulama: timescale geçersiz.');

    const minf = _findMp4Child(view, mdia, 'minf');
    const stbl = minf ? _findMp4Child(view, minf, 'stbl') : null;
    const stts = stbl ? _findMp4Child(view, stbl, 'stts') : null;
    if (!stts || stts.dataStart + 8 > stts.end) {
      throw new Error('CFR doğrulama: stts zaman tablosu bulunamadı.');
    }

    const entryCount = view.getUint32(stts.dataStart + 4, false);
    if (!entryCount) throw new Error('CFR doğrulama: kare zaman tablosu boş.');

    let firstDelta = null;
    let totalSamples = 0;
    let cursor = stts.dataStart + 8;

    for (let i = 0; i < entryCount; i++) {
      if (cursor + 8 > stts.end) throw new Error('CFR doğrulama: stts tablosu eksik.');
      const sampleCount = view.getUint32(cursor, false);
      const sampleDelta = view.getUint32(cursor + 4, false);
      cursor += 8;

      if (!sampleCount || !sampleDelta) throw new Error('CFR doğrulama: geçersiz kare süresi.');
      if (firstDelta === null) firstDelta = sampleDelta;
      if (sampleDelta !== firstDelta) {
        throw new Error(`CFR doğrulama: değişken kare süresi bulundu (${firstDelta}/${sampleDelta}).`);
      }
      totalSamples += sampleCount;
    }

    const fps = timescale / firstDelta;
    if (!(fps >= 23 && fps <= 60)) {
      throw new Error(`CFR doğrulama: Instagram dışı FPS (${fps.toFixed(3)}).`);
    }

    if (Math.abs(fps - 30) > 0.02) {
      throw new Error(`CFR doğrulama: hedef 30 FPS değil (${fps.toFixed(3)}).`);
    }

    return {
      ok: true,
      fps,
      timescale,
      sampleDelta: firstDelta,
      totalSamples,
      sttsEntries: entryCount
    };
  }

  throw new Error('CFR doğrulama: video track bulunamadı.');
};

const convertWebMtoMP4 = async (webmBlob, onProgress, firstFrameCoverBlob = null) => {
  const ffmpegRuntime = await _loadFFmpeg();
  const { ffmpeg, fetchFile } = ffmpegRuntime;

  addSystemLog(
    `CFR runtime: ${ffmpegRuntime.coreVersion || 'single-thread'} / threads=1 / SharedArrayBuffer=${typeof SharedArrayBuffer !== 'undefined' ? 'var' : 'yok-gerekmez'}`,
    'info'
  );

  if (onProgress) {
    ffmpeg.setProgress(({ ratio }) => {
      if (ratio > 0 && ratio <= 1) onProgress(Math.round(ratio * 100));
    });
  }

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inputName = `input_${stamp}.bin`;
  const outputName = `output_${stamp}.mp4`;
  const coverName = `cover_${stamp}.jpg`;

  try {
    ffmpeg.FS('writeFile', inputName, await fetchFile(webmBlob));
    if (firstFrameCoverBlob) {
      ffmpeg.FS('writeFile', coverName, await fetchFile(firstFrameCoverBlob));
    }

    // INSTAGRAM KALICI CFR + A/V SENKRON KURALI:
    // 1) fps=30, kaynak zaman çizelgesini koruyarak eksik kareleri çoğaltır / fazla kareleri düşürür.
    // 2) setpts=PTS-STARTPTS yalnız başlangıcı sıfırlar; video süresini yeniden hesaplamaz.
    // 3) -r 30 + -vsync cfr muxer/encoder çıkışını 30 CFR'a zorlar.
    // 4) video_track_timescale=30000 => MP4 stts delta=1000, yani tam 30.000 FPS.
    // 5) Çıktı MP4'ü JS içinde stts/mdhd üzerinden doğrulanmadan geri dönmez.
    // v1.30: N/(30*TB) KULLANILMAZ; manuel captureStream kare sayısı video süresini kısaltamaz.
    const baseVideoArgs = [
      '-r', '30',
      '-vsync', 'cfr',
      '-threads', '1',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-profile:v', 'high',
      '-level:v', '4.1',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-keyint_min', '60',
      '-sc_threshold', '0',
      '-video_track_timescale', '30000',
      '-af', 'aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS',
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '128k',
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart'
    ];

    if (firstFrameCoverBlob) {
      // BLACK-FIRST-FRAME REGRESSION GUARD:
      // Gerçek render edilmiş clickbait kapağını ilk 0.80 saniye videonun üzerine bindir.
      // Bu, MediaRecorder/decoder t=0'da siyah kare üretse bile Instagram/TikTok ilk
      // thumbnail karesinin siyah olmasını engeller.
      await ffmpeg.run(
        '-fflags', '+genpts',
        '-i', inputName,
        '-loop', '1',
        '-framerate', '30',
        '-i', coverName,
        '-filter_complex',
        "[0:v]fps=30,setpts=PTS-STARTPTS,scale=trunc(iw/2)*2:trunc(ih/2)*2[base];" +
        "[1:v]setpts=PTS-STARTPTS[cover0];" +
        "[cover0][base]scale2ref=w=main_w:h=main_h[cover][base2];" +
        "[base2][cover]overlay=0:0:enable='lte(t,0.80)':eof_action=pass[v]",
        '-map', '[v]',
        '-map', '0:a?',
        ...baseVideoArgs,
        outputName
      );
    } else {
      await ffmpeg.run(
        '-fflags', '+genpts',
        '-i', inputName,
        '-vf', 'fps=30,setpts=PTS-STARTPTS,scale=trunc(iw/2)*2:trunc(ih/2)*2',
        ...baseVideoArgs,
        outputName
      );
    }

    const data = ffmpeg.FS('readFile', outputName);
    const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });

    const cfr = await _verifyInstagramCfrMp4(mp4Blob);
    if (!cfr.ok) throw new Error('Instagram CFR doğrulaması başarısız.');

    addSystemLog(
      `✓ FIX CHECKLIST v1.40: MP4 ${cfr.fps.toFixed(3)} FPS CFR; single-thread core-st ile kodlandı, A/V zaman çizelgesi korundu.`,
      'success'
    );

    return mp4Blob;
  } finally {
    try { ffmpeg.FS('unlink', inputName); } catch (e) { if (isFreeTierStop(e)) throw e; ErrorHandler.silent(e); }
    try { ffmpeg.FS('unlink', coverName); } catch (e) { if (isFreeTierStop(e)) throw e; ErrorHandler.silent(e); }
    try { ffmpeg.FS('unlink', outputName); } catch (e) { if (isFreeTierStop(e)) throw e; ErrorHandler.silent(e); }
  }
};

// === OUTRO TEXTS & CTA LABELS ===
const _OUTRO_TEXTS = {
  tr: ["Abone olmayı, ", "beğenmeyi ve ", "paylaşmayı ", "ihmal etmeyin."],
  en: ["Don't forget to ", "subscribe, like ", "and share."],
  fr: ["N'oubliez pas de ", "vous abonner, ", "aimer et partager."],
  de: ["Vergessen Sie nicht ", "zu abonnieren, liken ", "und zu teilen."],
  es: ["No olvides ", "suscribirte, dar ", "me gusta y compartir."],
  ar: ["لا تنسَ ", "الاشتراك والإعجاب ", "والمشاركة."],
  ru: ["Не забудьте ", "подписаться, лайкнуть ", "и поделиться."]
};
const _CTA_LABELS = {
  tr: { sub: 'Abone Ol', like: 'Beğen', share: 'Paylaş' },
  en: { sub: 'Subscribe', like: 'Like', share: 'Share' },
  fr: { sub: "S'abonner", like: 'Aimer', share: 'Partager' },
  de: { sub: 'Abonnieren', like: 'Liken', share: 'Teilen' },
  es: { sub: 'Suscribir', like: 'Me gusta', share: 'Compartir' },
  ar: { sub: 'اشتراك', like: 'إعجاب', share: 'مشاركة' },
  ru: { sub: 'Подписка', like: 'Лайк', share: 'Поделиться' }
};

class LogicEngineService {
  static validateCurrency(text) {
    if (!text) return text;
    if (text.indexOf('$') > -1 && (text.indexOf('aclik') > -1 || text.indexOf('asgari') > -1 || text.indexOf('emekli') > -1 || text.indexOf('yoksulluk') > -1 || text.indexOf('maas') > -1)) {
      text = text.replace(/\$/g, 'TL');
    }
    return text;
  }

  static validateTurkishText(text) {
    if (!text) return text;
    const fixes = {
      'Turkiye': 'T\u00FCrkiye', 'turkiye': 't\u00FCrkiye',
      'Istanbul': '\u0130stanbul', 'istanbul': 'istanbul',
      'Izmir': '\u0130zmir', 'izmir': 'izmir',
      'asgari ucret': 'asgari \u00FCcret', 'Asgari Ucret': 'Asgari \u00FCcret',
      'issizlik': 'i\u015Fsizlik', 'Issizlik': '\u0130\u015Fsizlik',
      'buyume': 'b\u00FCy\u00FCme', 'Buyume': 'B\u00FCy\u00FCme',
      'doviz': 'd\u00F6viz', 'Doviz': 'D\u00F6viz',
      'borc': 'bor\u00E7', 'Borc': 'Bor\u00E7',
      'butce': 'b\u00FCt\u00E7e', 'Butce': 'B\u00FCt\u00E7e',
      'maas': 'maa\u015F', 'Maas': 'Maa\u015F',
      'ucurum': 'u\u00E7urum', 'Ucurum': 'U\u00E7urum',
      'yuzde': 'y\u00FCzde', 'Yuzde': 'Y\u00FCzde',
      'Aclik': 'A\u00E7l\u0131k', 'aclik': 'a\u00E7l\u0131k',
      'isci': 'i\u015F\u00E7i', 'Isci': '\u0130\u015F\u00E7i',
      'ogretmen': '\u00F6\u011Fretmen', 'Ogretmen': '\u00D6\u011Fretmen',
      'hemsire': 'hem\u015Fire', 'Hemsire': 'Hem\u015Fire',
      'muhendis': 'm\u00FChendis', 'Muhendis': 'M\u00FChendis',
    };
    Object.keys(fixes).forEach(function(wrong) { text = text.split(wrong).join(fixes[wrong]); });
    return text;
  }

  static validateEconomyData(data) {
    const errors = [];
    if (!data || !data.videoSlides) return errors;
    data.videoSlides.forEach(function(slide, i) {
      const text = (slide.spokenText || '') + ' ' + (slide.topText || '');
      if (text.indexOf('Turkiye') > -1 || text.indexOf('turkiye') > -1) {
        errors.push('Sahne ' + (i+1) + ': Turkiye yerine T\u00FCrkiye yaz\u0131lmal\u0131');
      }
      if (text.indexOf('$') > -1 && (text.indexOf('a\u00E7l\u0131k') > -1 || text.indexOf('asgari') > -1 || text.indexOf('emekli') > -1)) {
        errors.push('Sahne ' + (i+1) + ': T\u00FCrk ekonomik verisi $ ile g\u00F6sterilmi\u015F, TL olmal\u0131');
      }
    });
    return errors;
  }

  static async analyzeContent(inputData, inputType, config) {
    addSystemLog('İçerik analiz ediliyor...', 'info');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    if (config.tip === 'guzel_soz') return LogicEngineService._buildGuzelSozScript(inputData, inputType, config);
    if (config.tip === 'iddia_analizi') return LogicEngineService._analyzeIddia(inputData, inputType, config);

    let isUnlimited = config.duration === 'unlimited';
    let sceneCount = 4; let words = "80-95";
    const useForceExact = !isUnlimited;
    if (useForceExact) {
      const wps = getWPS(config.language);
      if (config.duration === '15') { sceneCount = 4; words = `${Math.floor(15 * wps)}-${Math.floor(25 * wps)}`; }
      else if (config.duration === '30') { sceneCount = 6; words = `${Math.floor(30 * wps)}-${Math.floor(52 * wps)}`; }
      else if (config.duration === '60') { sceneCount = 9; words = `${Math.floor(60 * wps)}-${Math.floor(82 * wps)}`; }
      else if (config.duration === '90') { sceneCount = 13; words = `${Math.floor(90 * wps)}-${Math.floor(112 * wps)}`; }
    } else { sceneCount = "İçeriğe göre en az 10, ortalama 18-25 sahne"; words = "İçeriği eksiksiz anlatacak kadar esnek"; }

    let styleInstruction = "Video stili: Tarafsız, analitik, ciddi ve keskin bir haber editörü.";
    if (config.videoStyle === 'prompt_output') styleInstruction = "Video stili: Özel Prompt Çıktısı. Kullanıcının girdiği metni doğrudan uygula.";
    const langInstruction = _getLangInstruction(config.language);
    const isImageOutput = config.outputType === 'image';
    let timeConstraint = isUnlimited ? `SÜRE SINIRI YOKTUR. Olayı detaylıca anlat.` : `DİNAMİK KISITLAYICI: Videonun hedef süresi ${config.duration === '15' ? '15-30' : config.duration === '30' ? '30-60' : config.duration === '60' ? '60-90' : '90-120'} saniyedir. Maksimum ${words.split('-')[1]} KELİME.`;
    let dynamicRules = "";
    if (config.analysisMode === 'yorumsuz') {
      dynamicRules = `BİRİNCİ KURAL (SADECE HABER - YORUMSUZ): Girdiyi dikkatlice incele. SADECE haberi tarafsızca anlat. 5N1K kurallarını uygula. Kendi yorumunu katma.\nİKİNCİ KURAL: 'mediaBlackout.show' değerini false yap.\nÜÇÜNCÜ KURAL: 'sonSoz' alanını tekrarlama.\nDÖRDÜNCÜ KURAL: Her sahnenin 'spokenText' metni NOKTA İLE BİTEN BİR CÜMLE OLMALIDIR.\n${timeConstraint}`;
    } else if (config.analysisMode === 'deep_analysis') {
      dynamicRules = `BİRİNCİ KURAL (DERİN ANALİZ): 5N1K dengesini sorgula ve sosyolojik/ekonomik etkileri analiz et.\nİKİNCİ KURAL: Skandalsa 'mediaBlackout.show' true yap.\nÜÇÜNCÜ KURAL: 'sonSoz' alanını tekrarlama.\nDÖRDÜNCÜ KURAL: Her sahnenin 'spokenText' metni NOKTA İLE BİTEN BİR CÜMLE OLMALIDIR.\n${timeConstraint}`;
    } else {
      dynamicRules = `BİRİNCİ KURAL (HABER 5N1K): Girdiyi incele, 5N1K kuralına sadık kalarak özetle.\nİKİNCİ KURAL: Skandal değilse 'mediaBlackout.show' false yap.\nÜÇÜNCÜ KURAL: 'sonSoz' alanını tekrarlama.\nDÖRDÜNCÜ KURAL: Her sahnenin 'spokenText' metni NOKTA İLE BİTEN BİR CÜMLE OLMALIDIR.\n${timeConstraint}`;
    }
    let sonSozInstruction = "";
    if (!isImageOutput) sonSozInstruction = `\n\nYEDİNCİ KURAL (SON SÖZ): Haberin/gazetenin GENEL OLARAK NE ANLATTIĞINA bak ve konuya en uygun, en vurucu ALINTIYI seç. Kaynak klasik bir atasözü OLMAK ZORUNDA DEĞİL — şunlardan herhangi biri olabilir ve konuya göre ÇEŞİTLENDİRİLMELİDİR: dünya liderleri, komutanlar/askeri stratejistler, filozoflar, düşünürler, yazarlar, şairler, ünlü film replikleri, çizgi film alıntıları. Alıntı GERÇEK ve DOĞRU olmalı; uydurma alıntı veya yanlış kaynak gösterme — emin değilsen daha güvenilir/bilinen bir alıntıya geç. Alıntının kendisini 'sonSoz' alanına yaz. 'sonSozKaynak' alanında kişi alıntısıysa SADECE söyleyen kişinin adını (ör: "Mustafa Kemal Atatürk", "Winston Churchill"), film alıntısıysa SADECE "Interstellar filminden" biçiminde film adını yaz. KESİNLİKLE TEKRAR ETME — aşağıdaki liste daha önce bu uygulamada kullanılmış alıntılardır, bunlardan hiçbirini tekrar seçme:\n${buildSonSozHistoryPrompt()}`;

    const sysPrompt = `Sen TikTok ve Instagram Reels için viral içerikler üreten profesyonel bir içerik üreticisisin. Karakterin: Zeki, gerçekleri söyleyen, 20 yaşında dertli bir genç.\n\nSENARYOYU ${isImageOutput ? 1 : sceneCount} SAHNE olacak şekilde böl!\nToplam konuşma metni ${words} kelime aralığında olmalıdır.\n\nDİL KURALI: ${langInstruction}\n${styleInstruction}\n${dynamicRules}\n\nEKONOMI KURALLARI (ekonomi haberi ise): Turkce karakter kullan, TL para birimi, sayi bicimi 85.450 TL, kaynak belirt (TUIK, TCMB, TURK-IS), aclik/yoksulluk siniri guncel olsun. Bilgi kartlari olustur: ENFLASYON %XX, ACLIK SINIRI XX.XXX TL.\n\nGAZETE BAŞLIKLARI: Görseldeki TÜM haber başlıklarını çıkar. Her başlık için 'baslik', 'aciklama', 'x', 'y', 'w', 'h' ver. En az 1, en fazla 15 başlık. Reklam, bulmaca, ilan HARİÇ.\n\nKAPAK VE VİRAL HOOK KURALLARI (MAKSİMUM 4 KELİME KURALI):\n1. 'thumbnailText': KESİNLİKLE MAKSİMUM 4 KELİME; merak uyandırıcı ama doğrulanmış, nötr ve yanıltıcı olmayan başlık. Gazete adını veya görsel başlığını tekrar ETME; sadece asıl clickbait cümleyi ver. 'şok', 'skandal', 'rezalet', 'ifşa', 'bunu gizliyorlar', 'bomba gelişme' gibi sansasyonel kalıpları kullanma.\n2. 'topText': KESİNLİKLE MAKSİMUM 4 KELİME. Gazete adını tekrar ETME; hakaret, aşağılama veya kesin hüküm içeren ifade kullanma.\n3. 'thumbnailImagePrompt': Sinematik ama açıkça editoryal/temsili İngilizce görsel promptu; gerçek olayın sahte kanıtı gibi görünmesin.\n\nTIKTOK TOPLULUK GÜVENLİĞİ KURALLARI:\n- Doğrulanmamış iddiaları kesin gerçek gibi yazma; 'iddia', 'öne sürüldü', 'açıklamaya göre', 'doğrulanamadı' gibi bağlam kullan.\n- Gerçek kişiler hakkında suçluluk, dolandırıcılık, yolsuzluk, şiddet veya ahlaki hüküm kurma; yalnızca güvenilir kaynakta açıkça doğrulanan statüyü aktar.\n- Hakaret, aşağılama, nefret, hedef gösterme, küçük düşürme ve taciz dili kullanma.\n- Şiddet/ölüm haberlerinde grafik veya sarsıcı ayrıntı verme; olayı nötr ve haber diliyle anlat.\n- Sağlık, seçim, kamu güvenliği ve kriz konularında doğrulanmamış kesinlik veya panik dili kullanma.\n- Başlık ile içerik aynı olguyu anlatmalı; yanıltıcı clickbait üretme.\n\nCLICKBAIT KANCA & GAZETE VİDEO AKIŞ KURALLARI:\n1. İLK SAHNE (CLICKBAIT HOOK): Video beyaz spiral not defteri sayfası stilinde clickbait kapakla başlar; en üstte sadece gazete adı veya görsel başlığı, altında tarih ve gün adı, onun altında SADECE haber başlığı / clickbait cümlesi yer alır. Gazete adını başlıkta ikinci kez yazma. Ortada Gündem Notları amblemi, en altta 'Abone olmayı unutmayın / Beğen / Yorum Yap / Paylaş' çağrısı olur. 'thumbnailText' sadece 3-4 kelimelik ana clickbait cümlesidir.\n2. DEVAM SAHNELERİ: GÖRÜNTÜ SABİT GAZETE İLK SAYFASI kalır. 'imagePrompts' dizisini BOŞ [] BIRAK.\n3. KAPANIŞ SAHNESİ: 'sonSoz' — konuya uygun, tekrarsız, kaynaklı vurucu alıntı (bkz. YEDİNCİ KURAL) + 'lastQuote' abone mesajı.\n- SIFIR HALÜSİNASYON: Okuyamadıysan 'isContentUnreadable' true yap.\n- ATATÜRK HASSASİYETİ: 'Atatürk' geçerse "Mustafa Kemal Atatürk, highly detailed, respectful portrait" ekle!${sonSozInstruction}\nDönüş ZORUNLU olarak JSON formatında olmalı.`;

    let parts = [];
    let extractStatsHint = "Olayı tam anla ve KISA BİR ÖZET ver.";
    if (config.analysisMode === 'yorumsuz') extractStatsHint = "SADECE haberi tarafsızca oku.";
    if (inputType === 'media' && Array.isArray(inputData)) {
      parts = inputData.map(file => { const b64 = file.data.split(',')[1]; return { inlineData: { mimeType: file.type || "application/octet-stream", data: b64 } }; });
      const isVideo = inputData.some(f => f.type?.startsWith('video'));
      const hasDoc = inputData.some(f => f.type && !f.type.startsWith('video') && !f.type.startsWith('image'));
      let introText = `Görselleri detaylıca incele.`;
      if (isVideo) introText = `Gönderilen medyaları izle.`;
      if (hasDoc) introText = `Gönderilen belgeleri oku, verileri analiz et.`;
      parts.unshift({ text: `${introText} ${extractStatsHint}` });
    } else if (inputType === 'prompt') { parts = [{ text: `AŞAĞIDAKİ TALİMATI UYGULA:\n\n${inputData}\n\n${extractStatsHint}` }]; }
    else if (inputType === 'url') { parts = [{ text: `[KRİTİK GÖREV]: URL'yi oku. \nURL: ${inputData}\n\nİçeriğe ulaştıysan haberi özetle. ${extractStatsHint}` }]; }
    else { parts = [{ text: `Aşağıdaki konuyu internette araştır. Haberi özetle. \n\n${inputData}\n\n${extractStatsHint}` }]; }

    const payload = {
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: sysPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            isContentUnreadable: { type: "BOOLEAN" },
            videoSlides: { type: "ARRAY", items: { type: "OBJECT", properties: { topText: { type: "STRING" }, spokenText: { type: "STRING" }, imagePrompts: { type: "ARRAY", items: { type: "STRING" } } }, required: ["topText", "spokenText", "imagePrompts"] } },
            thumbnailText: { type: "STRING" },
            sonSoz: { type: "STRING" },
            sonSozKaynak: { type: "STRING" },
            lastQuote: { type: "STRING" },
            thumbnailImagePrompt: { type: "STRING" },
            tiktokTitle: { type: "STRING" },
            tiktokDescription: { type: "STRING" },
            tiktokHashtags: { type: "ARRAY", items: { type: "STRING" } },
            kaynaklar: { type: "ARRAY", items: { type: "OBJECT", properties: { baslik: { type: "STRING" }, url: { type: "STRING" }, tarih: { type: "STRING" } }, required: ["baslik", "url"] } },
            mediaBlackout: { type: "OBJECT", properties: { show: { type: "BOOLEAN" }, percentageCovered: { type: "NUMBER" }, percentageIgnored: { type: "NUMBER" }, mediaNames: { type: "ARRAY", items: { type: "STRING" } }, explanation: { type: "STRING" } }, required: ["show", "percentageCovered", "percentageIgnored", "mediaNames", "explanation"] },
            gazeteBasliklari: { type: "ARRAY", items: { type: "OBJECT", properties: { baslik: { type: "STRING" }, aciklama: { type: "STRING" }, x: { type: "NUMBER" }, y: { type: "NUMBER" }, w: { type: "NUMBER" }, h: { type: "NUMBER" } }, required: ["baslik", "aciklama"] } },
            chartData: { type: "OBJECT", properties: { show: { type: "BOOLEAN" }, type: { type: "STRING" }, title: { type: "STRING" }, note: { type: "STRING" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, value: { type: "NUMBER" } }, required: ["label", "value"] } } } }
          },
          required: ["isContentUnreadable", "videoSlides", "thumbnailText", "sonSoz", "sonSozKaynak", "lastQuote", "thumbnailImagePrompt", "tiktokTitle", "tiktokDescription", "tiktokHashtags", "mediaBlackout"]
        }
      },
      tools: [{ google_search: {} }]
    };
    const parsedData = await _callGeminiAndParse(url, payload);
    if (parsedData.isContentUnreadable) throw new Error("Orijinal metne ulaşılamadı.");
    if (parsedData.tiktokTitle) parsedData.tiktokTitle = makeTikTokSafeText(parsedData.tiktokTitle);
    if (parsedData.tiktokDescription) parsedData.tiktokDescription = makeTikTokSafeText(parsedData.tiktokDescription);
    if (Array.isArray(parsedData.tiktokHashtags)) parsedData.tiktokHashtags = parsedData.tiktokHashtags.filter(Boolean).slice(0, 8);

    const _cleanMaxThreeWords = (text) => {
      if (!text) return "GÜNDEMDE NE VAR";
      let cleaned = text.replace(/\d{1,2}\s+[A-Za-zĞÜŞİÖÇğüşıöç]+\s+\d{4}/g, '')
                        .replace(/(Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar)/gi, '')
                        .replace(/Dünya|Pencere|Hürriyet|Milliyet|Sözcü|Sabah|Cumhuriyet/gi, '')
                        .replace(/[.,:;!?"-]+/g, ' ')
                        .trim();
      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length === 0) return "GÜNDEMDE NE VAR";
      if (words.length > 4) return words.slice(0, 4).join(' ').toUpperCase() + '!';
      return words.join(' ').toUpperCase() + '!';
    };
    if (parsedData.thumbnailText) parsedData.thumbnailText = makeTikTokSafeHeadline(_cleanMaxThreeWords(parsedData.thumbnailText), 4);
    if (parsedData.videoSlides) {
      const errPatterns = [/görselde.*metin.*bulunmamaktadır/i, /no.*text.*found/i, /metin.*bulunamadı/i, /cannot.*read.*text/i];
      parsedData.videoSlides = parsedData.videoSlides.map(slide => {
        let updatedSlide = { ...slide };
        if (updatedSlide.topText) updatedSlide.topText = _cleanMaxThreeWords(updatedSlide.topText);
        if (updatedSlide.spokenText && errPatterns.some(p => p.test(updatedSlide.spokenText))) updatedSlide.spokenText = updatedSlide.topText || "Bu görseldeki içerik hakkında bilgi veriliyor.";
        updatedSlide.imagePrompts = [];
        return updatedSlide;
      });
    }
    if (!parsedData.thumbnailImagePrompt || parsedData.thumbnailImagePrompt.trim() === '') {
      parsedData.thumbnailImagePrompt = "Ultra-dramatic high-contrast news clickbait concept art, shocked expressions, red neon question marks, set in Turkey, authentic Turkish news atmosphere, 8k resolution cinematic lighting";
    } else if (!parsedData.thumbnailImagePrompt.toLowerCase().includes('turkey') && !parsedData.thumbnailImagePrompt.toLowerCase().includes('turkish')) {
      parsedData.thumbnailImagePrompt += ", set in Turkey, authentic Turkish setting, realistic Turkish environment, clickbait style";
    }
    return parsedData;
  }

  static async analyzeContentForImage(inputData, inputType, config, imageIndex, totalImages, previousContext) {
    addSystemLog(`Görsel ${imageIndex + 1}/${totalImages} için sahneler üretiliyor...`, 'info');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    let styleInstruction = "Video stili: Tarafsız, analitik, ciddi ve keskin bir haber editörü.";
    if (config.videoStyle === 'prompt_output') styleInstruction = "Video stili: Özel Prompt Çıktısı. Kullanıcının girdiği metni doğrudan uygula.";
    const langInstruction = _getLangInstruction(config.language);
    let dynamicRules = "";
    if (config.analysisMode === 'yorumsuz') dynamicRules = `BİRİNCİ KURAL (SADECE HABER - YORUMSUZ): Girdiyi dikkatlice incele. SADECE haberi tarafsızca anlat. 5N1K kurallarını uygula.\nİKİNCİ KURAL: 'mediaBlackout.show' değerini false yap.\nÜÇÜNCÜ KURAL: Her sahnenin 'spokenText' metni NOKTA İLE BİTEN BİR CÜMLE OLMALIDIR.`;
    else if (config.analysisMode === 'deep_analysis') dynamicRules = `BİRİNCİ KURAL (DERİN ANALİZ): 5N1K dengesini sorgula ve sosyolojik/ekonomik etkileri analiz et.\nİKİNCİ KURAL: Skandalsa 'mediaBlackout.show' true yap.\nÜÇÜNCÜ KURAL: Her sahnenin 'spokenText' metni NOKTA İLE BİTEN BİR CÜMLE OLMALIDIR.`;
    else dynamicRules = `BİRİNCİ KURAL (HABER 5N1K): Girdiyi incele, 5N1K kuralına sadık kalarak özetle.\nİKİNCİ KURAL: Skandal değilse 'mediaBlackout.show' false yap.\nÜÇÜNCÜ KURAL: Her sahnenin 'spokenText' metni NOKTA İLE BİTEN BİR CÜMLE OLMALIDIR.`;
    const contextBlock = previousContext ? `\nÖNCEKİ BLOKLARIN ÖZETİ: ${previousContext}\nBu bilgileri tekrarlama, SADECE bu görseldeki yeni içeriğe odaklan.` : "";
    const isLastImage = imageIndex === totalImages - 1;
    const sonSozRule = isLastImage ? `\n\nYEDİNCİ KURAL (SON SÖZ): Haberin/gazetenin GENEL OLARAK NE ANLATTIĞINA bak ve konuya en uygun, en vurucu ALINTIYI seç. Kaynak klasik bir atasözü OLMAK ZORUNDA DEĞİL — şunlardan herhangi biri olabilir ve konuya göre ÇEŞİTLENDİRİLMELİDİR: dünya liderleri, komutanlar/askeri stratejistler, filozoflar, düşünürler, yazarlar, şairler, ünlü film replikleri, çizgi film alıntıları. Alıntı GERÇEK ve DOĞRU olmalı; uydurma alıntı veya yanlış kaynak gösterme. Alıntının kendisini 'sonSoz' alanına yaz. 'sonSozKaynak' alanında kişi alıntısıysa SADECE söyleyen kişinin adını, film alıntısıysa SADECE "Interstellar filminden" biçiminde film adını yaz. KESİNLİKLE TEKRAR ETME — daha önce kullanılan alıntılar:\n${buildSonSozHistoryPrompt()}` : "";

    const sysPrompt = `Bu, ${totalImages} görsellik bir videonun ${imageIndex + 1}. bloğudur.\nSen TikTok ve Instagram Reels için viral içerikler üreten profesyonel bir içerik üreticisisin.\n\nSENARYOYU TAM OLARAK 2 SAHNE olacak şekilde böl!\nToplam konuşma metni bu blok için 30-50 kelime aralığında olmalıdır.\n\nDİL KURALI: ${langInstruction}\n${styleInstruction}\n${dynamicRules}\n${contextBlock}\n\nGAZETE İLK SAYFASI VE YERLİ GÖRSEL KURALLARI:\n1. Eğer görsel bir gazete ilk sayfası ise 'imagePrompts' dizisini BOŞ [] BIRAK!\n2. GAZETE HARİCİ İÇERİKLER İÇİN: HER SAHNE İÇİN 'imagePrompts' DİZİSİNDE TAM 1 ADET AI GÖRSEL PROMPTU YAZ.\n3. TÜRKİYE VE TÜRK KÜLTÜRÜ BAZ ALINACAK. 'set in Turkey, authentic Turkish setting, realistic Turkish environment, Turkish people' eklenecek.\n4. TIKTOK UYUMLULUĞU: Sansasyonel/hakaret içeren dil kullanma; doğrulanmamış iddiayı kesin gerçek gibi yazma; gerçek kişiler için suçluluk veya ahlaki hüküm kurma; şiddeti grafik ayrıntılandırma. AI görseli gerçek olayın sahte kanıtı gibi göstermeyecek, editoryal/temsili olacak.\n- ATATÜRK HASSASİYETİ: 'Atatürk' geçerse "Mustafa Kemal Atatürk, highly detailed, respectful portrait" ekle!${sonSozRule}\nDönüş ZORUNLU olarak JSON formatında olmalı.`;

    let parts = [];
    let extractStatsHint = "Olayı tam anla ve KISA BİR ÖZET ver.";
    if (config.analysisMode === 'yorumsuz') extractStatsHint = "SADECE haberi tarafsızca oku.";
    if (inputType === 'media' && Array.isArray(inputData)) {
      const targetFile = inputData[0];
      if (targetFile) {
        const b64 = targetFile.data.split(',')[1];
        parts = [{ inlineData: { mimeType: targetFile.type || "application/octet-stream", data: b64 } }, { text: "Bu görseldeki haberi/konuyu detaylıca incele ve 2 sahnede anlat." }];
      } else { parts = [{ text: `Görsel bulunamadı.` }]; }
    } else if (inputType === 'prompt') { parts = [{ text: `AŞAĞIDAKİ TALİMATI UYGULA (Bu ${imageIndex + 1}/${totalImages} blok):\n\n${inputData}\n\n${extractStatsHint}` }]; }
    else if (inputType === 'url') { parts = [{ text: `[KRİTİK GÖREV]: URL'yi oku.\nURL: ${inputData}\nBu ${imageIndex + 1}/${totalImages} blok için içeriğe dayanarak haberi özetle. ${extractStatsHint}` }]; }
    else { parts = [{ text: `Aşağıdaki konuyu internette araştır. Bu ${imageIndex + 1}/${totalImages} blok için haberi özetle.\n\n${inputData}\n\n${extractStatsHint}` }]; }

    const payload = {
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: sysPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            isContentUnreadable: { type: "BOOLEAN" },
            videoSlides: { type: "ARRAY", items: { type: "OBJECT", properties: { topText: { type: "STRING" }, spokenText: { type: "STRING" }, imagePrompts: { type: "ARRAY", items: { type: "STRING" } } }, required: ["topText", "spokenText", "imagePrompts"] } },
            thumbnailText: { type: "STRING" },
            sonSoz: { type: "STRING" },
            sonSozKaynak: { type: "STRING" },
            lastQuote: { type: "STRING" },
            thumbnailImagePrompt: { type: "STRING" },
            kaynaklar: { type: "ARRAY", items: { type: "OBJECT", properties: { baslik: { type: "STRING" }, url: { type: "STRING" }, tarih: { type: "STRING" } }, required: ["baslik", "url"] } },
            mediaBlackout: { type: "OBJECT", properties: { show: { type: "BOOLEAN" }, percentageCovered: { type: "NUMBER" }, percentageIgnored: { type: "NUMBER" }, mediaNames: { type: "ARRAY", items: { type: "STRING" } }, explanation: { type: "STRING" } }, required: ["show", "percentageCovered", "percentageIgnored", "mediaNames", "explanation"] },
            gazeteBasliklari: { type: "ARRAY", items: { type: "OBJECT", properties: { baslik: { type: "STRING" }, aciklama: { type: "STRING" }, x: { type: "NUMBER" }, y: { type: "NUMBER" }, w: { type: "NUMBER" }, h: { type: "NUMBER" } }, required: ["baslik", "aciklama"] } },
            chartData: { type: "OBJECT", properties: { show: { type: "BOOLEAN" }, type: { type: "STRING" }, title: { type: "STRING" }, note: { type: "STRING" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, value: { type: "NUMBER" } }, required: ["label", "value"] } } } }
          },
          required: ["isContentUnreadable", "videoSlides", "thumbnailText", "sonSoz", "sonSozKaynak", "lastQuote", "thumbnailImagePrompt", "mediaBlackout", "gazeteBasliklari"]
        }
      },
      tools: [{ google_search: {} }]
    };
    const parsedData = await _callGeminiAndParse(url, payload);
    if (parsedData.isContentUnreadable) throw new Error("Orijinal metne ulaşılamadı.");
    const _cleanMaxThreeWords = (text) => {
      if (!text) return "GÜNDEMDE NE VAR";
      let cleaned = text.replace(/\d{1,2}\s+[A-Za-zĞÜŞİÖÇğüşıöç]+\s+\d{4}/g, '').replace(/[.,:;!?"-]+/g, ' ').trim();
      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length === 0) return "GÜNDEMDE NE VAR";
      if (words.length > 4) return words.slice(0, 4).join(' ').toUpperCase() + '!';
      return words.join(' ').toUpperCase() + '!';
    };
    if (parsedData.thumbnailText) parsedData.thumbnailText = makeTikTokSafeHeadline(_cleanMaxThreeWords(parsedData.thumbnailText), 4);
    if (parsedData.videoSlides) {
      const errPatterns = [/görselde.*metin.*bulunmamaktadır/i, /no.*text.*found/i, /metin.*bulunamadı/i];
      parsedData.videoSlides = parsedData.videoSlides.map(slide => {
        let updatedSlide = { ...slide };
        if (updatedSlide.topText) updatedSlide.topText = _cleanMaxThreeWords(updatedSlide.topText);
        if (updatedSlide.spokenText && errPatterns.some(p => p.test(updatedSlide.spokenText))) updatedSlide.spokenText = updatedSlide.topText || "Bu görseldeki içerik hakkında bilgi veriliyor.";
        return updatedSlide;
      });
    }
    addSystemLog(`Görsel ${imageIndex + 1} için ${parsedData.videoSlides?.length || 0} sahne üretildi.`, 'success');
    return parsedData;
  }


  static _normalizeFactText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,:;!?])/g, '$1')
      .trim();
  }

  static _limitWords(text, maxWords = 32) {
    const clean = this._normalizeFactText(text);
    if (!clean) return '';
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return clean;
    return words.slice(0, maxWords).join(' ').replace(/[.,:;!?]+$/g, '').trim() + '...';
  }

  static _sentenceize(text, maxWords = 32, fallback = 'Detay doğrulanamadı.') {
    let clean = this._limitWords(text, maxWords);
    if (!clean) clean = fallback;
    clean = clean.replace(/[;]+/g, ', ').replace(/\s+/g, ' ').trim();
    clean = clean.replace(/[.!?]+$/g, '').trim();
    return clean ? clean + '.' : fallback;
  }

  static _isEconomicFactText(text) {
    const t = String(text || '').toLowerCase();
    return /(asgari|maaş|ucret|ücret|enflasyon|kira|gıda|gida|açlık|aclik|yoksulluk|gelir|emekli|araba|otomobil|yakıt|yakit|market|fiyat|geçim|gecim|bütçe|butce|hane|aile|borç|banka|faiz|tcmb|tüik|tuik|türk-iş|turk-is)/.test(t);
  }

  static _formatEvidenceText(kanitlar = []) {
    const items = (Array.isArray(kanitlar) ? kanitlar : []).filter(Boolean).slice(0, 2).map(k => {
      const kaynak = this._normalizeFactText(k?.kaynak || 'Kaynak belirtilmedi');
      const veri = this._normalizeFactText(k?.veri || 'Veri detayı yok');
      return `${kaynak}: ${veri}`;
    });
    return items.join(' ');
  }


  static _pickPrimaryIddiaClaim(list = []) {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    if (items.length === 0) return null;
    const economic = items.find(item => this._isEconomicFactText(`${item?.iddia || ''} ${item?.analiz || ''} ${item?.sonuc || ''} ${item?.gundelikTesti || ''}`));
    return economic || items[0];
  }

  static _buildIddiaGenelOzet(parsedData = {}) {
    const claims = Array.isArray(parsedData.iddialar) ? parsedData.iddialar.filter(Boolean) : [];
    const target = this._pickPrimaryIddiaClaim(claims);
    const economic = !!target && this._isEconomicFactText(`${target?.iddia || ''} ${target?.analiz || ''} ${target?.sonuc || ''} ${target?.gundelikTesti || ''}`);
    const suitablePct = target?.turkiyeUygunlukOrani != null && String(target?.turkiyeUygunlukOrani).trim() !== ''
      ? this._normalizeFactText(target.turkiyeUygunlukOrani)
      : (economic ? 'resmi verilerle güvenilir biçimde hesaplanamadı' : 'belirlenemedi');
    return {
      soylenen: this._normalizeFactText(parsedData?.genelDegerlendirme?.soylenen || target?.iddia || 'Temel iddia net değil'),
      gercekte: this._normalizeFactText(parsedData?.genelDegerlendirme?.gercekteNeVar || target?.sonuc || target?.analiz || 'Gerçek tablo daha farklı görünüyor'),
      refahTarifi: this._normalizeFactText(parsedData?.genelDegerlendirme?.refahTarifi || (economic ? 'Refah, zorunlu giderler karşılandıktan sonra barınma, beslenme, ulaşım ve birikim imkanının aynı anda mümkün olmasıdır' : 'Sağlıklı bir tablo için iddianın gündelik yaşam ve resmi verilerle uyumlu olması gerekir')),
      uygunlukOrani: suitablePct,
      aciklama: this._normalizeFactText(parsedData?.genelDegerlendirme?.aciklama || (economic ? `Bu oranın yalnız resmi ve güvenilir verilerle desteklenmesi gerekir. Elde güvenilir oran yoksa yüzde uydurulamaz; kira, gıda ve temel gider baskısı ayrıca değerlendirilmelidir.` : 'İddianın geneli resmi veriler ve bağlamla birlikte değerlendirilmelidir.')),
      ekonomik: economic
    };
  }

  static _ensureIddiaClosing(parsedData = {}) {
    const summary = this._buildIddiaGenelOzet(parsedData);
    if (!parsedData.sonSoz || !String(parsedData.sonSoz).trim()) {
      parsedData.sonSoz = summary.ekonomik
        ? 'Refah söylemle değil, insanların temel ihtiyaçlarını zorlanmadan karşılayabildiği gerçek hayatla ölçülür.'
        : 'Bir iddianın gücü, ne kadar tekrar edildiğinde değil, kanıtla ne kadar ayakta kaldığında ortaya çıkar.';
    }
    if (!parsedData.sonSozKaynak || !String(parsedData.sonSozKaynak).trim()) {
      parsedData.sonSozKaynak = summary.ekonomik ? 'Editoryal değerlendirme — resmi veriler ve gündelik yaşam testi' : 'Editoryal değerlendirme — kanıt ve bağlam analizi';
    }
    return parsedData;
  }

  static _buildIddiaSlides(claims, config = {}, parsedData = null) {
    const list = Array.isArray(claims) ? claims.filter(Boolean) : [];
    if (list.length === 0) {
      return [{
        topText: 'DOĞRULAMA',
        spokenText: 'İçerikte doğrulanabilir net bir cümle bulunamadı.',
        imagePrompts: ['Editorial investigative visual, Turkish fact-check analyst, calm newsroom atmosphere, clearly illustrative, no text, no words, no letters, clean visual.'],
        _visualKey: 'iddia_main'
      }];
    }

    const isEconomic = list.some(item => this._isEconomicFactText(`${item?.iddia || ''} ${item?.gercekteNeVar || ''} ${item?.analiz || ''} ${item?.sonuc || ''}`));
    const visualMain = isEconomic
      ? 'Editorial illustration of a Turkish fact-check analyst comparing a public claim with household income, rent, groceries, transport and cost-of-living reality, balanced investigative mood, clearly illustrative, no text, no words, no letters, clean visual.'
      : 'Editorial illustration of a Turkish fact-check analyst comparing a public claim with official evidence and documents, balanced investigative mood, clearly illustrative, no text, no words, no letters, clean visual.';
    const visualProof = isEconomic
      ? 'Editorial collage of official statistics, household budget, rent, groceries, transport costs and everyday economic reality in Turkey, evidence-focused and clearly illustrative, no text, no words, no letters, clean visual.'
      : 'Editorial collage of official reports, source comparison, documents and evidence board, clean investigative visual, clearly illustrative, no text, no words, no letters, clean visual.';

    const slides = [];
    list.forEach((item, idx) => {
      const no = idx + 1;
      const original = this._normalizeFactText(item?.orijinalCumle || item?.iddia || `İddia ${no}`);
      const durum = this._normalizeFactText(item?.durum || 'Doğrulanamıyor');
      const reality = this._normalizeFactText(item?.gercekteNeVar || item?.analiz || item?.sonuc || 'Gerçek durum güvenilir kaynaklarla netleştirilemedi');
      const conclusion = this._normalizeFactText(item?.sonuc || '');
      const evidence = (Array.isArray(item?.kanitlar) ? item.kanitlar : []).filter(Boolean).slice(0, 2);
      const evidenceSpeech = evidence.map((k, i) => {
        const source = this._normalizeFactText(k?.kaynak || `Kaynak ${i + 1}`);
        const data = this._normalizeFactText(k?.veri || 'veri detayı belirtilmedi');
        return `${source} verisi ${data}`;
      }).join('. ');

      let spoken = `Söylenen cümle şu: ${original}. Bu cümle ${durum.toLowerCase()}. Gerçekte durum şu: ${reality}.`;
      if (evidenceSpeech) spoken += ` Bunu doğrulayan kanıt: ${evidenceSpeech}.`;
      if (conclusion && !spoken.toLowerCase().includes(conclusion.toLowerCase())) spoken += ` Sonuç olarak ${conclusion}.`;

      slides.push({
        topText: `${no}. CÜMLE — ${durum.toUpperCase()}`,
        spokenText: this._sentenceize(spoken, 85, `${original}. ${durum}. ${reality}.`),
        imagePrompts: [idx % 2 === 0 ? visualMain : visualProof],
        _visualKey: idx % 2 === 0 ? 'iddia_main' : 'iddia_proof'
      });
    });

    const finalSummary = this._buildIddiaGenelOzet(parsedData || { iddialar: list });
    const finalSpoken = finalSummary.ekonomik
      ? `Şimdi genel tabloyu karşılaştıralım. Söylenen anlatı şu: ${finalSummary.soylenen}. Gerçekte verilerin gösterdiği tablo şu: ${finalSummary.gercekte}. Refah dediğimiz şey, ${finalSummary.refahTarifi}. Türkiye'de bu refah tanımına uyan kesim için güvenilir oran ${finalSummary.uygunlukOrani}. ${finalSummary.aciklama}`
      : `Şimdi genel tabloyu karşılaştıralım. Söylenen anlatı şu: ${finalSummary.soylenen}. Gerçekte kanıtların gösterdiği tablo şu: ${finalSummary.gercekte}. ${finalSummary.aciklama}`;
    slides.push({
      topText: finalSummary.ekonomik ? 'SÖYLENEN / GERÇEK TABLO' : 'GENEL KARŞILAŞTIRMA',
      spokenText: this._sentenceize(finalSpoken, 90, 'Genel karşılaştırma hazırlandı.'),
      imagePrompts: [visualProof],
      _visualKey: 'iddia_proof'
    });
    return slides;
  }

  static async _analyzeIddia(inputData, inputType, config) {
    addSystemLog('İddia Analizi başlıyor...', 'info');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    let parts = [];
    if (inputType === 'media' && Array.isArray(inputData)) {
      parts = inputData.map(function(file) { const b64 = file.data.split(',')[1]; return { inlineData: { mimeType: file.type || 'application/octet-stream', data: b64 } }; });
      const isVideo = inputData.some(function(f) { return f.type && f.type.startsWith('video'); });
      const isAudio = inputData.some(function(f) { return f.type && f.type.startsWith('audio'); });
      parts.unshift({ text: isVideo ? 'Bu videoyu izle. İçindeki doğrulanabilir iddiaları cümle cümle çıkar.' : (isAudio ? 'Bu ses kaydını dinle. İçindeki doğrulanabilir iddiaları cümle cümle çıkar.' : 'Bu görseli incele. İçindeki doğrulanabilir iddiaları cümle cümle çıkar.') });
    } else if (inputType === 'prompt' || inputType === 'text') {
      parts = [{ text: 'Aşağıdaki metindeki doğrulanabilir iddiaları çıkar: ' + (typeof inputData === 'string' ? inputData : '') }];
    } else if (inputType === 'url') {
      parts = [{ text: 'Bu URL icindeki icerigi oku. Dogrulanabilir iddialari cikar: ' + inputData }];
    }
    const _curMonthYear = _getCurrentMonthYearTR();
    const _curDate = _getCurrentDateTR();
    const sysPrompt = `Sen bir fact-check ve doğrulama uzmanısın. Görevin verilen içeriği analiz etmek, doğrulanabilir iddiaları çıkarmak ve her bir iddiayı Türkiye'deki resmi kaynaklarla karşılaştırmaktır.\n\nADIM 1 — GİRDİYİ CÜMLE CÜMLE ANALİZ ET\nİçeriği baştan sona incele. Konuşmacının söylediği HER doğrulanabilir cümleyi veya cümle içindeki bağımsız doğrulanabilir önermeyi ayrı bir iddia olarak çıkar. Bir cümlede iki farklı doğrulanabilir iddia varsa bunları iki ayrı maddeye böl. 'iddia' ve 'orijinalCumle' alanlarında konuşmacının söylediğini mümkün olduğunca aynen koru; yorum ekleme.\n\nADIM 2 — KONUYA GÖRE VERİ KAYNAKLARI VE DOĞRULAMA\nKonu türüne göre DOĞRU kaynaklardan veri bul. GOOGLE SEARCH ARACINI AKTİF KULLAN.\n\nKONU EKONOMİ İSE — GÜNCEL VERİLER (${_curMonthYear}):\n${buildEconomicDataBlock()}\n\nKONU EKONOMİ DEĞİLSE:\n- Ekonomi verilerini konuyla ilgisi olmadan ASLA senaryoya ENJEKTE ETME.\n- Bunun YERİNE konuyla ilgili resmi kaynakları Google Search ile bul.\n\nADIM 3 — DOĞRULAMA VE DEĞERLENDİRME\nHer iddia için GOOGLE SEARCH ile araştır, resmi kaynaktan doğrula:\n1. Durum etiketi ver: Doğru, Kısmen Doğru, Eksik Bağlam, Yanlış, Doğrulanamıyor.\n2. Güven skoru hesapla (0-100).\n3. 'gercekteNeVar' alanına, bu cümlenin karşısındaki gerçek durumu açık ve doğrudan yaz. Format mantığı: 'Bu söylendi; fakat gerçekte durum şu...' gibi olmalı. Genelleme yapma.\n4. Kanıtları listele — kaynak, url, veri alanları ZORUNLU. Kanıt, doğrudan bu cümleyi doğrulamalı veya yanlışlamalı.\n5. Sonuç yaz: Bu cümlenin neden Doğru / Kısmen Doğru / Eksik Bağlam / Yanlış / Doğrulanamıyor olduğunu tek cümlede açıkla.\n6. KARŞILAŞTIRMA KURALI: Karşılaştırma sahnesi doğrulanabilir olgulara, bağlama ve kaynaklara odaklanmalı; suçlayıcı veya küçük düşürücü dil kullanma.\n7. KAYNAK ZORUNLULUĞU: Kanıt varsa MUTLAKA kaynak adı + URL + veri yaz.\n8. EN GÜNCEL VERİ KURALI: Devletin sunduğu resmi ve en güncel veriyi kullan.\n\nDÜRÜSTLÜK KURALLARI (ASLA İHLAL ETME):\n1. BİLMEDİĞİN bir şey için "Doğrulanamıyor" de. ASLA uydurma.\n2. Resmi kaynaktan teyit edilemeyen iddialar için "Doğrulanamıyor" kullan.\n3. Veriyi bulamadıysan "bu veriye ulaşamadım" de.\n4. Her rakamın arkasında MUTLAKA resmi kaynak olmalı.\n5. Tarih MUTLAKA belirt.\n6. Sayı biçimi: 26.500 TL.\n7. TARAFSIZ OL.\n8. KAYNAK ÇEŞİTLİLİĞİ: Tek kaynağa güvenme.\n\nADIM 4 — VİDEO SENARYOSU\nHer doğrulanabilir cümle için mantık AYNI olmalı: 'Söylenen cümle → Doğru/Yanlış etiketi → Gerçekte olan → Bunu kanıtlayan resmi veri'. Cümleleri birbirine karıştırma ve bir iddiaya başka iddianın kanıtını verme. Genel yorum yalnız en sonda yapılmalı.\nHer sahne NOKTA ile biten cümle olmalı.\nGÖRSEL YAZI KURALI: imagePrompts içinde "no text, no words, no letters, clean visual" ekle.\nDönüş ZORUNLU JSON.`;
    const payload = {
      contents: [{ role: 'user', parts: parts }],
      systemInstruction: { parts: [{ text: sysPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            isContentUnreadable: { type: 'BOOLEAN' },
            videoSlides: { type: 'ARRAY', items: { type: 'OBJECT', properties: { topText: { type: 'STRING' }, spokenText: { type: 'STRING' }, imagePrompts: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['topText', 'spokenText', 'imagePrompts'] } },
            thumbnailText: { type: 'STRING' },
            sonSoz: { type: 'STRING' },
            lastQuote: { type: 'STRING' },
            thumbnailImagePrompt: { type: 'STRING' },
            iddialar: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
              iddia: { type: 'STRING' }, orijinalCumle: { type: 'STRING' }, durum: { type: 'STRING' }, guvenSkoru: { type: 'NUMBER' },
              gercekteNeVar: { type: 'STRING' }, analiz: { type: 'STRING' },
              gundelikTesti: { type: 'STRING' },
              turkiyeUygunlukOrani: { type: 'STRING' },
              kanitlar: { type: 'ARRAY', items: { type: 'OBJECT', properties: { kaynak: { type: 'STRING' }, url: { type: 'STRING' }, veri: { type: 'STRING' } }, required: ['kaynak', 'veri'] } },
              sonuc: { type: 'STRING' }
            }, required: ['iddia', 'durum', 'guvenSkoru', 'analiz', 'gundelikTesti', 'kanitlar', 'sonuc'] } },
            genelDegerlendirme: { type: 'OBJECT', properties: { soylenen: { type: 'STRING' }, gercekteNeVar: { type: 'STRING' }, refahTarifi: { type: 'STRING' }, turkiyeUygunlukOrani: { type: 'STRING' }, aciklama: { type: 'STRING' } }, required: ['soylenen', 'gercekteNeVar', 'refahTarifi', 'turkiyeUygunlukOrani', 'aciklama'] },
            sonSozKaynak: { type: 'STRING' },
            mediaBlackout: { type: 'OBJECT', properties: { show: { type: 'BOOLEAN' }, percentageCovered: { type: 'NUMBER' }, percentageIgnored: { type: 'NUMBER' }, mediaNames: { type: 'ARRAY', items: { type: 'STRING' } }, explanation: { type: 'STRING' } }, required: ['show', 'percentageCovered', 'percentageIgnored', 'mediaNames', 'explanation'] }
          },
          required: ['isContentUnreadable', 'videoSlides', 'thumbnailText', 'sonSoz', 'lastQuote', 'thumbnailImagePrompt', 'iddialar', 'mediaBlackout']
        }
      },
      tools: [{ google_search: {} }]
    };
    const parsedData = await _callGeminiAndParse(url, payload);
    if (parsedData.isContentUnreadable) throw new Error('İçerik okunamadı.');
    LogicEngineService._ensureIddiaClosing(parsedData);
    parsedData.videoSlides = LogicEngineService._buildIddiaSlides(parsedData.iddialar || [], config, parsedData);
    if (!parsedData.thumbnailText || parsedData.thumbnailText.trim().length < 3) {
      const firstClaim = parsedData.iddialar?.[0]?.iddia || parsedData.genelDegerlendirme?.soylenen || 'İDDİA ANALİZİ';
      parsedData.thumbnailText = LogicEngineService._limitWords(firstClaim.toUpperCase(), 4);
    }
    if (!parsedData.thumbnailImagePrompt || !String(parsedData.thumbnailImagePrompt).trim()) {
      parsedData.thumbnailImagePrompt = 'Editorial investigative visual, Turkish fact-check analyst, cinematic notebook-cover composition, clean newsroom mood, clearly illustrative, no text, no words, no letters, clean visual.';
    }
    if (!parsedData.lastQuote) parsedData.lastQuote = 'Abone olmayı, beğenmeyi, yorum yapmayı ve paylaşmayı unutmayın.';
    parsedData._muteNarration = false;
    addSystemLog('İddia Analizi tamamlandı: ' + (parsedData.iddialar ? parsedData.iddialar.length : 0) + ' iddia.', 'success');
    return parsedData;
  }

  static getGuzelSozAnalysis(quoteText) {
    const themes = {
      'sabir': ['sabır', 'bekle', 'zaman', 'dayan'], 'azim': ['azim', 'çaba', 'gayret', 'mücadele', 'vazgeçme'],
      'başarı': ['başarı', 'kazan', 'hedef', 'zafer'], 'hayat': ['hayat', 'yaşam', 'ömür', 'nefes'],
      'mutluluk': ['mutluluk', 'sevinç', 'neşe', 'gülümse'], 'sevgi': ['sevgi', 'aşk', 'kalp', 'sev'],
      'anne': ['anne', 'annem', 'ana'], 'baba': ['baba', 'babam'], 'dostluk': ['dost', 'arkadaş', 'kardeş'],
      'inanç': ['inanç', 'iman', 'tanrı', 'allah'], 'umut': ['umut', 'beklenti', 'gelecek'],
      'özgürlük': ['özgürlük', 'hür', 'serbest'], 'cesaret': ['cesaret', 'korkusuz', 'yiğit'],
      'zaman': ['zaman', 'vakit', 'dakika', 'saat'], 'bilgelik': ['bilgi', 'bilge', 'akıl', 'hikmet'],
      'yalnızlık': ['yalnız', 'tek', 'kimsesiz'], 'huzur': ['huzur', 'sükunet', 'dingin'],
      'şükür': ['şükür', 'minnet', 'hamd'], 'doğa': ['doğa', 'ağaç', 'deniz', 'güneş', 'yıldız']
    };
    let detectedTheme = 'hayat';
    let maxScore = 0;
    const textLower = quoteText.toLowerCase();
    Object.keys(themes).forEach(function(theme) {
      let score = 0;
      themes[theme].forEach(function(keyword) { if (textLower.indexOf(keyword) > -1) score++; });
      if (score > maxScore) { maxScore = score; detectedTheme = theme; }
    });
    const emotions = {
      'hüzün': ['hüzün', 'acı', 'gözyaşı', 'ağla', 'keder'], 'umut': ['umut', 'bekle', 'gelecek', 'iyi'],
      'aşk': ['aşk', 'sevgi', 'kalp', 'sev'], 'nefret': ['nefret', 'kin', 'öfke'],
      'korku': ['korku', 'kork', 'tehlike'], 'sevinç': ['sevinç', 'mutlu', 'gül', 'neşe'],
      'öfke': ['öfke', 'kız', 'sinir'], 'gurur': ['gurur', 'onur', 'şeref'], 'özlem': ['özlem', 'hasret', 'bekle']
    };
    let detectedEmotion = 'umut';
    maxScore = 0;
    Object.keys(emotions).forEach(function(emo) {
      let score = 0;
      emotions[emo].forEach(function(keyword) { if (textLower.indexOf(keyword) > -1) score++; });
      if (score > maxScore) { maxScore = score; detectedEmotion = emo; }
    });
    const styleMap = { 'sabir': 'minimal', 'azim': 'dark', 'başarı': 'luxury', 'hayat': 'nature', 'mutluluk': 'warm', 'sevgi': 'romantic', 'umut': 'light', 'cesaret': 'epik', 'bilgelik': 'vintage', 'yalnızlık': 'film_noir', 'huzur': 'nature', 'doğa': 'nature', 'zaman': 'minimal', 'inanc': 'spiritual', 'dostluk': 'warm' };
    const detectedStyle = styleMap[detectedTheme] || 'cinematic';
    const musicMap = { 'sabir': 'soft piano', 'azim': 'motivational', 'başarı': 'cinematic orchestral', 'hayat': 'contemplative piano', 'mutluluk': 'upbeat', 'sevgi': 'romantic piano', 'anne': 'warm orchestral', 'baba': 'strong strings', 'umut': 'soft piano', 'cesaret': 'epic cinematic', 'doğa': 'nature sounds', 'bilgelik': 'meditation', 'yalnızlık': 'melancholic piano', 'huzur': 'ambient', 'şükür': 'light strings', 'zaman': 'minimal piano', 'inanc': 'spiritual ambient', 'dostluk': 'warm acoustic' };
    const suggestedMusic = musicMap[detectedTheme] || 'contemplative piano';
    const paletteMap = {
      'sabir': { ana: '#2c3e50', ikincil: '#34495e', vurgu: '#3498db', yazi: '#ecf0f1', arka: '#1a252f' },
      'azim': { ana: '#1a1a2e', ikincil: '#16213e', vurgu: '#e94560', yazi: '#ffffff', arka: '#0f0f23' },
      'başarı': { ana: '#2d1b69', ikincil: '#11001c', vurgu: '#ffd700', yazi: '#ffffff', arka: '#0a0015' },
      'hayat': { ana: '#1b4332', ikincil: '#2d6a4f', vurgu: '#95d5b2', yazi: '#ffffff', arka: '#081c15' },
      'sevgi': { ana: '#4a0e0e', ikincil: '#6b1d1d', vurgu: '#ff6b6b', yazi: '#ffffff', arka: '#1a0505' },
      'umut': { ana: '#1a365d', ikincil: '#2a4a7f', vurgu: '#63b3ed', yazi: '#ffffff', arka: '#0f1f3d' },
      'hüzün': { ana: '#2d3748', ikincil: '#4a5568', vurgu: '#a0aec0', yazi: '#e2e8f0', arka: '#1a202c' },
      'doğa': { ana: '#22543d', ikincil: '#276749', vurgu: '#68d391', yazi: '#ffffff', arka: '#1a3a2a' },
    };
    const palette = paletteMap[detectedTheme] || { ana: '#1a1a2e', ikincil: '#16213e', vurgu: '#e94560', yazi: '#ffffff', arka: '#0f0f23' };
    return {
      tema: detectedTheme, duygu: detectedEmotion, stil: detectedStyle, muzik: suggestedMusic, palet: palette,
      enerji: detectedEmotion === 'cesaret' || detectedEmotion === 'öfke' ? 80 : 40,
      pozitiflik: detectedEmotion === 'umut' || detectedEmotion === 'sevinç' ? 80 : 50
    };
  }

  static getGuzelSozImagePrompts(quoteText, analysis) {
    const tema = analysis.tema || 'hayat';
    const stil = analysis.stil || 'cinematic';
    const duygu = analysis.duygu || 'umut';
    return [
      'Ultra realistic ' + stil + ' style, ' + tema + ' theme, 8K HDR, professional lighting, depth of field, film color grading, golden ratio composition, volumetric light, photorealistic masterpiece.',
      'Cinematic emotional shot, ' + duygu + ' feeling, ' + stil + ' aesthetic, dramatic lighting, 8K HDR, award winning photography, professional color grading, bokeh background.',
      'Symbolic powerful image, ' + tema + ' concept, ' + stil + ' style, epic composition, 8K HDR, volumetric light, cinematic depth, masterpiece quality.'
    ];
  }

  static async _translateQuoteMultilang(quoteText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const normalizeTranslation = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const normalizeCompare = (value) => normalizeTranslation(value).toLocaleLowerCase('tr-TR');
    const sourceHasTurkishChars = /[çğıöşüÇĞİÖŞÜ]/.test(String(quoteText || ''));

    const payload = {
      contents: [{
        parts: [{
          text: `Aşağıdaki sözü/alıntıyı dört ayrı dile çevir.

ORİJİNAL:
"${quoteText}"

ZORUNLU DİLLER:
- fr: doğal ve edebi Fransızca
- de: doğal ve edebi Almanca
- en: doğal ve edebi İNGİLİZCE
- tr: doğal Türkçe

KURALLAR:
- Anlamı, tonu ve duyguyu koru.
- Her alan SADECE kendi dilinde olmalı.
- "en" alanına Türkçe metni ASLA kopyalama.
- Açıklama, yorum, görsel tarifi veya ek cümle ekleme.
- SADECE istenen JSON'u döndür.`
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            fr: { type: "STRING" },
            de: { type: "STRING" },
            en: { type: "STRING" },
            tr: { type: "STRING" }
          },
          required: ["fr", "de", "en", "tr"]
        }
      }
    };

    try {
      const r = await NetworkUtils.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (r && r.ok) {
        const d = await r.json();
        const rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(rawText);

        let fr = normalizeTranslation(parsed.fr) || quoteText;
        let de = normalizeTranslation(parsed.de) || quoteText;
        let en = normalizeTranslation(parsed.en);
        let tr = normalizeTranslation(parsed.tr) || quoteText;

        // v1.31 KALICI EN KONTROLÜ:
        // Türkçe karakter görmek TEK BAŞINA hata değildir.
        // Özel adlar (örn. "Yıldız Kenter", "Atatürk") İngilizce çeviride doğal olarak
        // Türkçe karakter taşıyabilir. Eski kontrol bunları yanlışlıkla Türkçe sanıp
        // geçerli İngilizceyi reddediyordu.
        //
        // EN yalnızca boşsa veya Türkçe kaynak cümleyi tamamen kopyaladıysa yeniden çevrilir.
        const englishLooksWrong =
          !en ||
          (sourceHasTurkishChars && normalizeCompare(en) === normalizeCompare(quoteText)) ||
          /^translation unavailable\b/i.test(en);

        if (englishLooksWrong) {
          addSystemLog('İngilizce çeviri doğrulaması başarısız — EN tek başına yeniden çevriliyor.', 'warn');

          const enPayload = {
            contents: [{
              parts: [{
                text: `Translate the following quote into natural, fluent English.

QUOTE:
"${quoteText}"

Rules:
- Return ONLY the English translation.
- Preserve the meaning and emotional tone.
- Do not explain.
- Do not add commentary.
- Do not describe an image.
- Do not return Turkish.`
              }]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 512
            }
          };

          try {
            const er = await NetworkUtils.fetchWithRetry(url, {
              method: 'POST',
              body: JSON.stringify(enPayload)
            });

            if (er && er.ok) {
              const ed = await er.json();
              const retryEn = normalizeTranslation(
                ed.candidates?.[0]?.content?.parts?.[0]?.text || ''
              )
                .replace(/^["“”]+|["“”]+$/g, '')
                .trim();

              if (retryEn) en = retryEn;
            }
          } catch (englishRetryError) {
            addSystemLog('İngilizce ikinci çeviri denemesi başarısız: ' + englishRetryError.message, 'warn');
          }
        }

        // Son doğrulama: özel adlardaki Türkçe karakterleri ASLA hata sayma.
        const englishStillWrong =
          !en ||
          (sourceHasTurkishChars && normalizeCompare(en) === normalizeCompare(quoteText)) ||
          /^translation unavailable\b/i.test(en);

        if (englishStillWrong) {
          // Bir son plain-English denemesi yap. Kullanıcıya "Translation unavailable"
          // sahnesi üretmek yerine gerçek çeviri için son kez zorla.
          addSystemLog('İngilizce çeviri son doğrulamada geçemedi — EN son kez düz metin olarak yeniden çevriliyor.', 'warn');

          try {
            const finalEnPayload = {
              contents: [{
                parts: [{
                  text: `Translate ONLY the quote below into fluent natural English.
Keep people's names exactly as written, even if they contain Turkish characters.
Return ONLY the translated quote. No labels, no explanation.

"${quoteText}"`
                }]
              }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 512
              }
            };

            const finalEnResponse = await NetworkUtils.fetchWithRetry(url, {
              method: 'POST',
              body: JSON.stringify(finalEnPayload)
            });

            if (finalEnResponse?.ok) {
              const finalEnData = await finalEnResponse.json();
              const finalEn = normalizeTranslation(
                finalEnData.candidates?.[0]?.content?.parts?.[0]?.text || ''
              )
                .replace(/^["“”]+|["“”]+$/g, '')
                .trim();

              if (
                finalEn &&
                normalizeCompare(finalEn) !== normalizeCompare(quoteText) &&
                !/^translation unavailable\b/i.test(finalEn)
              ) {
                en = finalEn;
              }
            }
          } catch (finalEnglishError) {
            addSystemLog('İngilizce son çeviri denemesi hatası: ' + finalEnglishError.message, 'warn');
          }
        }

        // Artık sahte "Translation unavailable" sahnesi üretme.
        // EN gerçekten üretilemediyse işi açık hata ile durdur; yanlış video üretme.
        const englishFailed =
          !en ||
          /^translation unavailable\b/i.test(en) ||
          (sourceHasTurkishChars && normalizeCompare(en) === normalizeCompare(quoteText));

        if (englishFailed) {
          throw new Error('İngilizce çeviri üretilemedi. EN sahnesi yanlış/fallback metinle oluşturulmadı.');
        }

        addSystemLog(`✓ FIX CHECKLIST v1.31: İngilizce gerçek çeviri doğrulandı; özel adlardaki Türkçe karakterler korundu.`, 'success');

        addSystemLog('Çok dilli çeviri tamamlandı ve doğrulandı (FR/DE/EN/TR)', 'success');
        return { fr, de, en, tr };
      }
    } catch (e) { if (isFreeTierStop(e)) throw e;
      addSystemLog('Çeviri hatası: ' + e.message + ' — diller ayrı fallback ile hazırlanacak', 'warn');
    }

    // EN sahnesinde sahte hata metni oluşturma. Çok dilli Güzel Söz için
    // İngilizce gerçek çeviri zorunludur; üretilemiyorsa yanlış video yerine açık hata ver.
    throw new Error('Çok dilli çeviri tamamlanamadı: İngilizce gerçek çeviri üretilemedi.');
  }

  static async _buildGuzelSozScript(inputData, inputType, config) {
    let quoteText = "";
    if (typeof inputData === 'string') {
      quoteText = inputData.trim();
      addSystemLog(`Metin girdisi: ${quoteText.length} karakter, ${quoteText.split(/\s+/).length} kelime`, 'info');
    } else if (Array.isArray(inputData) && inputData.length > 0) {
      const videoFile = inputData.find(f => f.type?.startsWith('video/'));
      const imageFile = inputData.find(f => f.type?.startsWith('image/'));
      if (videoFile) {
        addSystemLog('Video dosyası algılandı, kare çıkarılıyor...', 'info');
        const extractFrame = () => new Promise((resolve) => {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          const raw = videoFile.data.includes(',') ? videoFile.data.split(',')[1] : videoFile.data;
          const blob = _base64ToBlob(raw, videoFile.type || 'video/mp4');
          video.src = ObjectURLManager.create(blob);
          video.onloadeddata = () => { video.currentTime = Math.min(1, video.duration * 0.1); };
          video.onseeked = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
              canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
              ObjectURLManager.revoke(video.src);
              resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
            } catch (e) { if (isFreeTierStop(e)) throw e; ObjectURLManager.revoke(video.src); resolve(null); }
          };
          video.onerror = () => { ObjectURLManager.revoke(video.src); resolve(null); };
          setTimeout(() => { ObjectURLManager.revoke(video.src); resolve(null); }, 10000);
        });
        const frameB64 = await extractFrame();
        if (frameB64) {
          addSystemLog('Videodan kare başarıyla çıkarıldı, OCR başlıyor...', 'success');
          quoteText = await ocrWithFallback(frameB64, 'image/jpeg', apiKey, 'Video OCR');
        }
        if (!quoteText) { quoteText = videoFile.name?.replace(/[_-]/g, ' ').replace(/\.[^.]+$/, '') || "Güzel bir söz"; addSystemLog('OCR başarısız, dosya adı kullanıldı.', 'warn'); }
      } else if (imageFile) {
        addSystemLog('Resim OCR başlıyor (şerit tabanlı)...', 'info');
        const b64Data = imageFile.data.split(',')[1] || imageFile.data;
        const ocrImgType = imageFile.type || 'image/jpeg';
        quoteText = await ocrWithFallback(b64Data, ocrImgType, apiKey, 'Görsel OCR');
        if (!quoteText) { const rawName = imageFile.name.replace(/[_-]/g, ' ').replace(/\.[^.]+$/, ''); quoteText = rawName.length > 5 ? rawName : "Güzel bir söz"; addSystemLog('OCR başarısız, dosya adı kullanıldı.', 'warn'); }
      } else {
        quoteText = inputData[0].name?.replace(/[_-]/g, ' ').replace(/\.[^.]+$/, '') || "Güzel bir söz";
      }
    }
    const isError = ERROR_PATTERNS.some(p => p.test(quoteText));
    if (isError) {
      addSystemLog(`OCR hata mesajı algılandı: "${quoteText.substring(0, 50)}" → dosya adı kullanılacak`, 'warn');
      if (inputType === 'media' && Array.isArray(inputData) && inputData[0]?.name) quoteText = inputData[0].name.replace(/[_-]/g, ' ').replace(/\.[^.]+$/, '');
      else quoteText = "Güzel bir söz";
    }
    if (!quoteText || quoteText.length < 3) quoteText = "Güzel bir söz";
    addSystemLog(`Son söz metni: ${quoteText.length} karakter`, 'info');
    const emotion = analyzeQuoteEmotion(quoteText);
    addSystemLog(`Güzel söz: "${quoteText.substring(0, 60)}..." (duygu: ${emotion})`, 'info');
    const ataturkKeywords = ['atatürk', 'mustafa kemal', 'samsun', 'kurtuluş', 'cumhuriyet', 'bağımsızlık', 'milli mücadele', 'inkılap', 'devrim', 'paşa', 'gazi', 'anıtkabir', '19 mayıs', 'ulus'];
    const lowerQuote = quoteText.toLowerCase();
    const isAtaturkRelated = ataturkKeywords.some(kw => lowerQuote.includes(kw));
    if (isAtaturkRelated) addSystemLog('Atatürk içerikli söz tespit edildi — özel görseller üretilecek.', 'info');
    let sceneDescriptions = [];
    const sceneCount = 4;
    const perspectivePrompts = isAtaturkRelated ? [
      `Mustafa Kemal Atatürk standing heroically at Samsun harbor in 1919, dawn light, Turkish flag waving, cinematic patriotic scene, epic composition.`,
      `A dramatic scene of the Turkish War of Independence: soldiers marching through Anatolian mountains, Atatürk leading the charge, golden sunset, heroic atmosphere.`,
      `Modern Turkey's founding vision: Atatürk's reforms symbolized — women in modern clothing, new Turkish alphabet, secular education, Ankara parliament building, hopeful dawn light.`,
      `A respectful symbolic portrait of Mustafa Kemal Atatürk with the Turkish flag and a hopeful modern Turkey in the background, dignified cinematic lighting.`
    ] : [
      `A cinematic scene representing the meaning of this quote. Focus on the MAIN MESSAGE.`,
      `An artistic interpretation of this quote's emotional core. Focus on the FEELING.`,
      `A symbolic visual metaphor for this quote. Focus on the DEEPER MEANING.`,
      `A fourth cinematic interpretation of the quote, visually distinct from the previous scenes, focusing on its UNIVERSAL MESSAGE.`
    ];
    for (let i = 0; i < sceneCount; i++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ parts: [{ text: `Generate a detailed English image prompt for this quote.\n\nQuote: "${quoteText}"\nEmotion: ${emotion}\nPerspective: ${perspectivePrompts[i]}\n\nRules:\n- 1-2 sentences, detailed and visual\n- NO text in the image\n- Cinematic lighting and composition\n- Match the emotional tone` }] }],
          generationConfig: { temperature: AI_CONFIG.TEMPERATURE, maxOutputTokens: AI_CONFIG.MAX_OUTPUT_TOKENS }
        };
        const r = await NetworkUtils.fetchWithRetry(url, { method: 'POST', body: JSON.stringify(payload) });
        if (!r) continue;
        const data = await r.json();
        const desc = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (desc) { sceneDescriptions.push(desc); addSystemLog(`Sahne ${i + 1} tanımlandı.`, 'success'); }
      } catch (e) { if (isFreeTierStop(e)) throw e; addSystemLog(`Sahne ${i + 1} hatası: ${e.message}`, 'warn'); }
    }
    if (sceneDescriptions.length === 0) {
      if (isAtaturkRelated) {
        sceneDescriptions = [
          'Mustafa Kemal Atatürk at Samsun harbor 1919, dawn, Turkish flag, cinematic patriotic scene, epic composition',
          'Turkish War of Independence, soldiers marching through Anatolian mountains, golden sunset, heroic atmosphere',
          'Founding of modern Turkey, Ankara parliament, secular reforms, hopeful dawn light, national pride',
          'Respectful symbolic portrait of Mustafa Kemal Atatürk, Turkish flag, modern Turkey, dignified cinematic lighting'
        ];
      } else {
        const stopWords = ['bir', 'ile', 'için', 'olan', 'değil', 'daha', 'çok', 'kadar', 'sonra', 'önce', 'böyle', 'şöyle', 'ancak', 'hem', 'ya', 'ki', 'ise', 'gibi', 'ama', 've', 'da', 'de', 'mi', 'mı', 'mu', 'mü', 'ben', 'sen', 'biz', 'siz', 'o', 'bu', 'şu', 'ne', 'nasıl', 'neden', 'niçin', 'kim', 'kime', 'kimin', 'her', 'hiç'];
        const words = quoteText.toLowerCase().replace(/[^\wçğıöşüÇĞIİÖŞÜ\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
        const uniqueWords = [...new Set(words)].slice(0, 8);
        const emotionSceneMap = {
          'mutlu': 'bright, sunny, joyful atmosphere, warm golden colors, people smiling, soft bokeh lights, celebration mood',
          'hüzünlü': 'melancholic, rainy window, emotional, soft blue lighting, contemplative mood, lone figure, misty atmosphere',
          'romantik': 'romantic sunset, candlelight, intimate setting, soft focus, dreamy atmosphere, warm tones, couple silhouette',
          'notr': 'artistic, symbolic, abstract geometric, dramatic lighting, cinematic composition'
        };
        const emotionScene = emotionSceneMap[emotion] || emotionSceneMap['notr'];
        for (let i = 0; i < 4; i++) {
          sceneDescriptions.push(uniqueWords.length > 0
            ? `A symbolic ${emotionScene} scene variation ${i + 1} representing: ${uniqueWords.join(', ')} — highly detailed, cinematic composition`
            : `A beautiful artistic scene with ${emotionScene} variation ${i + 1} — highly detailed, cinematic composition`);
        }
      }
    }
    let realImageUrls = [];
    if (isAtaturkRelated) {
      addSystemLog('Atatürk görselleri Wikimedia Commons\'tan çekiliyor...', 'info');
      const searchQueries = ['Mustafa Kemal Atatürk', 'Samsun 1919', 'Turkish War of Independence'];
      for (const q of searchQueries) { const urls = await fetchWikimediaImages(q, 1); realImageUrls.push(...urls); }
      if (realImageUrls.length > 0) addSystemLog(`${realImageUrls.length} gerçek Atatürk görseli bulundu.`, 'success');
      else addSystemLog('Wikimedia\'dan görsel bulunamadı — yerel arka plan kullanılacak.', 'warn');
    }
    const translations = await LogicEngineService._translateQuoteMultilang(quoteText);
    const multilangTexts = [translations.fr, translations.de, translations.en, translations.tr];
    const multilangLabels = ['FR', 'DE', 'EN', 'TR'];
    return {
      isContentUnreadable: false,
      videoSlides: sceneDescriptions.map((desc, i) => ({ topText: multilangTexts[i] || quoteText, spokenText: multilangTexts[i] || quoteText, imagePrompts: [desc], _lang: multilangLabels[i] })),
      thumbnailText: quoteText.length > 120 ? quoteText.substring(0, 120) + '...' : quoteText,
      sonSoz: "", sonSozKaynak: "", lastQuote: quoteText, thumbnailImagePrompt: sceneDescriptions[0] || "",
      tiktokTitle: quoteText.substring(0, 60), tiktokDescription: quoteText,
      tiktokHashtags: isAtaturkRelated ? ['#atatürk', '#mustafakemal', '#samsun', '#19mayıs', '#kurtuluşsavaşı', '#cumhuriyet'] : ['#güzelsöz', '#özlüsöz', '#motivasyon'],
      _suggestedMusic: null, _isAtaturkRelated: isAtaturkRelated, _realImageUrls: realImageUrls,
      mediaBlackout: { show: false, percentageCovered: 0, percentageIgnored: 0, mediaNames: [], explanation: "" },
      chartData: { show: false, type: "bar", title: "", note: "", items: [] },
      _isGuzelSoz: true, _isMultilang: true, _multilangTexts: multilangTexts, _multilangLabels: multilangLabels,
      _emotion: emotion, _sceneCount: sceneDescriptions.length
    };
  }
}

// ============================================================================
// M6: MEDIA SYNTHESIS
// ============================================================================
class MediaSynthesisService {
  static generateProceduralFallback(prompt, imageStyle) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024; const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(512, 512, 50, 512, 512, 600); grad.addColorStop(0, '#1e1b4b'); grad.addColorStop(0.5, '#0f172a'); grad.addColorStop(1, '#020617'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 1024);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
    for (let y = 0; y < 1024; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.font = "bold 24px 'Inter', Arial"; ctx.textAlign = 'center'; ctx.fillText("OTONOM", 512, 950);
    return canvas.toDataURL('image/jpeg', 0.85);
  }
  static generateQuoteFallback(quoteText, emotion) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024; const ctx = canvas.getContext('2d');
    const colorMap = {
      'mutlu': { bg1: '#fbbf24', bg2: '#f59e0b', accent: '#fcd34d', glow: '#fef3c7' },
      'hüzünlü': { bg1: '#3b82f6', bg2: '#1d4ed8', accent: '#93c5fd', glow: '#dbeafe' },
      'romantik': { bg1: '#ec4899', bg2: '#be185d', accent: '#f9a8d4', glow: '#fce7f3' },
      'notr': { bg1: '#6366f1', bg2: '#4338ca', accent: '#a5b4fc', glow: '#e0e7ff' }
    };
    const colors = colorMap[emotion] || colorMap['notr'];
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, colors.bg1); grad.addColorStop(0.5, colors.bg2); grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * 1024; const y = Math.random() * 1024; const r = 50 + Math.random() * 150;
      const circleGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
      circleGrad.addColorStop(0, colors.accent + '40'); circleGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = circleGrad; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const words = quoteText.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    ctx.fillStyle = colors.glow + '30'; ctx.font = "bold 80px Georgia, serif"; ctx.textAlign = 'center';
    words.forEach((word, i) => {
      const x = 150 + (i % 3) * 250; const y = 300 + Math.floor(i / 3) * 200;
      ctx.save(); ctx.translate(x, y); ctx.rotate((Math.random() - 0.5) * 0.3);
      ctx.fillText(word.substring(0, 8), 0, 0); ctx.restore();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = "bold 120px Georgia, serif"; ctx.textAlign = 'center';
    ctx.fillText('"', 150, 250); ctx.fillText('"', 900, 850);
    return canvas.toDataURL('image/jpeg', 0.9);
  }
  static async generateImage(prompt, imageStyle = 'cinematic', resolution = '4K', isGuzelSoz = false, emotion = 'notr', quoteText = '') {
    addSystemLog('Yüklü görsel yok: tarayıcıda yerel arka plan hazırlanıyor. AI görsel servisi kullanılmıyor.', 'info');
    if (isGuzelSoz && quoteText) return this.generateQuoteFallback(quoteText, emotion);
    return this.generateProceduralFallback(prompt, imageStyle);
  }
  static async generateAudio(text, voice, language = 'auto') {
    if (!text || voice === 'none') return null;
    let cleanText = text.replace(/[*_#]/g, '').replace(/\.\.\./g, ', ').replace(/\n/g, ' ').replace(/[:;/\|{}[\]<>^~`]/g, ', ').replace(/\s+/g, ' ').trim();
    cleanText = cleanText.replace(/\bİYİ\s+Parti/g, 'İYİ Parti').replace(/\bİYİ\b(?!\s+Parti)/g, 'İYİ Parti');

    const normalizedLanguage = String(language || 'auto').toLowerCase();
    if (normalizedLanguage === 'tr' || normalizedLanguage === 'tr-tr') {
      const beforeTr = cleanText;
      cleanText = _normalizeTurkishTtsText(cleanText);

      if (cleanText !== beforeTr) {
        addSystemLog(
          `✓ FIX CHECKLIST v1.35: Türkçe TTS normalize edildi: "${beforeTr.substring(0, 55)}" → "${cleanText.substring(0, 75)}"`,
          'info'
        );
      }
    }

    if (cleanText.length < 2) return null;
    const expectedMinDuration = Math.max(2.0, (cleanText.split(/\s+/).length / 2.5));
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 0) addSystemLog(`Ses sentezleniyor (${voice}): "${cleanText.substring(0, 40)}..."`, 'info');
        else addSystemLog(`TTS deneme ${attempt + 1}/${maxRetries + 1}...`, 'info');
        const payload = { model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: cleanText }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } };
        const r = await NetworkUtils.fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!r || !r.ok) { addSystemLog(`TTS API yanıt hatası: ${r?.status || 'undefined'}`, 'warn'); continue; }
        const d = await r.json();
        const b64Data = d.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!b64Data) { addSystemLog('TTS API boş ses döndürdü.', 'warn'); continue; }
        let sampleRate = 24000;
        const binaryStr = atob(b64Data);
        const pcmBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) pcmBytes[i] = binaryStr.charCodeAt(i);
        const audioDuration = pcmBytes.length / (sampleRate * 2);
        if (audioDuration < expectedMinDuration * 0.5 && attempt < maxRetries) { addSystemLog(`Ses çok kısa (${audioDuration.toFixed(1)}sn), tekrar deneniyor...`, 'warn'); continue; }
        const pcmView = new DataView(pcmBytes.buffer);
        let maxAmplitude = 0;
        for (let i = 0; i < pcmView.byteLength - 1; i += 2) { const sample = Math.abs(pcmView.getInt16(i, true)); if (sample > maxAmplitude) maxAmplitude = sample; }
        if (maxAmplitude > 0 && maxAmplitude < 16000) {
          const boostFactor = Math.min(26000 / maxAmplitude, 3.0);
          for (let i = 0; i < pcmView.byteLength - 1; i += 2) {
            let sample = pcmView.getInt16(i, true);
            sample = Math.round(sample * boostFactor);
            sample = Math.max(-32768, Math.min(32767, sample));
            pcmView.setInt16(i, sample, true);
          }
          addSystemLog(`Ses normalize edildi (boost: ${boostFactor.toFixed(1)}x)`, 'info');
        }
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);
        const view = new DataView(wavBuffer);
        const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeString(0, 'RIFF'); view.setUint32(4, 36 + pcmBytes.length, true); writeString(8, 'WAVE'); writeString(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true); writeString(36, 'data'); view.setUint32(40, pcmBytes.length, true);
        new Uint8Array(wavBuffer, 44).set(pcmBytes);
        addSystemLog(`Ses hazır: ${(pcmBytes.length / 1024).toFixed(0)}KB, ${sampleRate}Hz`, 'success');
        return { wavBuffer, sampleRate };
      } catch (e) { if (isFreeTierStop(e)) throw e;
        if (e.message === 'HTTP_FAIL_401' && attempt < maxRetries) {
          addSystemLog(`TTS yetkilendirme yanıtı geçici olarak başarısız oldu; ses yeniden deneniyor (${attempt + 2}/${maxRetries + 1}).`, 'warn');
        } else {
          addSystemLog(`TTS deneme ${attempt + 1} hatası: ${e.message}`, 'warn');
        }
        if (attempt === maxRetries) { addSystemLog('TTS tüm denemeler başarısız.', 'error'); return null; }
      }
    }
    return null;
  }
}

// ============================================================================
// M7: AMBIENT AUDIO
// ============================================================================
class AmbientAudioService {
  static createNoiseBuffer(audioCtx, type = 'white') {
    const bufferSize = audioCtx.sampleRate * 5; const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate); const data = buffer.getChannelData(0); let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) { const white = Math.random() * 2 - 1; if (type === 'brown') { data[i] = (lastOut + (0.02 * white)) / 1.02; lastOut = data[i]; data[i] *= 3.5; } else { data[i] = white * 0.5; } }
    return buffer;
  }
  static getAmbientNode(audioCtx, type) {
    const noiseBuffer = this.createNoiseBuffer(audioCtx, type === 'fire' ? 'brown' : 'white');
    const noiseSource = audioCtx.createBufferSource(); noiseSource.buffer = noiseBuffer; noiseSource.loop = true;
    const filter = audioCtx.createBiquadFilter(); const gain = audioCtx.createGain();
    if (type === 'rain') { filter.type = 'lowpass'; filter.frequency.value = 800; gain.gain.value = 0.3; noiseSource.connect(filter).connect(gain); }
    else if (type === 'waves') { filter.type = 'lowpass'; filter.frequency.value = 400; const lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1; const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 1.5; gain.gain.value = 0.3; lfo.connect(lfoGain).connect(gain.gain); lfo.start(); noiseSource.connect(filter).connect(gain); }
    else return null;
    noiseSource.start(0); return { source: noiseSource, gainNode: gain };
  }
}

// [DEVAM EDECEK - BÖLÜM 3/4: M8 Render Engine + M9 Workflow Coordinator]

// ============================================================================
// M8: RENDER ENGINE
// ============================================================================

const FIXED_CLICKBAIT_TEMPLATE_SRC = `${import.meta.env.BASE_URL}assets/fixed-clickbait.png`;
const FIXED_CLICKBAIT_TEMPLATE_IMG = (typeof Image !== 'undefined') ? (() => { const img = new Image(); img.src = FIXED_CLICKBAIT_TEMPLATE_SRC; return img; })() : null;

const RenderWorkerService = {
  _outroParticles: [],

  wrapText: (ctx, text, maxWidth) => {
    if (!text) return [];
    const words = text.split(" "); const lines = []; let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      if (ctx.measureText(currentLine + " " + words[i]).width < maxWidth) currentLine += " " + words[i];
      else { lines.push(currentLine); currentLine = words[i]; }
    }
    lines.push(currentLine); return lines;
  },

  calculateSubtitles: (text, exactAudioDur) => {
    if (!text) return [];
    const words = text.replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const safeDur = Math.max(exactAudioDur, 0.1);
    const subs = []; const wordsPerSub = 4;
    const totalSubs = Math.ceil(words.length / wordsPerSub);
    const baseDurPerSub = safeDur / totalSubs;
    let currentStartTime = 0;
    for (let i = 0; i < words.length; i += wordsPerSub) {
      const chunkWords = [];
      for (let j = 0; j < wordsPerSub && i + j < words.length; j++) chunkWords.push(words[i + j]);
      const chunkText = chunkWords.join(' ').trim();
      const isLastSub = (i + wordsPerSub >= words.length);
      const chunkDur = isLastSub ? (safeDur - currentStartTime) : baseDurPerSub;
      subs.push({ text: chunkText, startSec: currentStartTime, endSec: Math.min(currentStartTime + chunkDur + 0.15, safeDur) });
      currentStartTime += chunkDur;
    }
    return subs;
  },


  calculateSpeechSyncedSubtitles: (text, exactSpeechDur, startOffset = 0) => {
    if (!text) return [];
    const words = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) return [];
    const chunks = [];
    let current = [];
    for (const word of words) {
      current.push(word);
      const sentenceBreak = /[.!?]$/.test(word);
      const softBreak = /[,;:]$/.test(word);
      if ((sentenceBreak && current.length >= 2) || (softBreak && current.length >= 4) || current.length >= 6) {
        chunks.push(current);
        current = [];
      }
    }
    if (current.length) chunks.push(current);
    const weights = chunks.map(chunk => {
      const raw = chunk.join(' ');
      const letters = raw.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/g, '').length;
      let pause = 0;
      if (/[.!?]$/.test(raw)) pause += 8;
      else if (/[,;:]$/.test(raw)) pause += 4;
      return Math.max(4, letters + pause);
    });
    const totalWeight = Math.max(1, weights.reduce((a, b) => a + b, 0));
    const safeDur = Math.max(0.1, exactSpeechDur || 0.1);
    let cursor = Math.max(0, startOffset || 0);
    return chunks.map((chunk, idx) => {
      const dur = safeDur * (weights[idx] / totalWeight);
      const item = { text: chunk.join(' '), startSec: cursor, endSec: cursor + dur };
      cursor += dur;
      return item;
    });
  },

  drawImageContain: (ctx, img, w, h) => {
    const iw = img.videoWidth || img.naturalWidth || img.width || 0;
    const ih = img.videoHeight || img.naturalHeight || img.height || 0;
    if (iw < 1 || ih < 1) return;
    const imgRatio = iw / ih; const canvasRatio = w / h;
    let drawW = w, drawH = h, offsetX = 0, offsetY = 0;
    if (imgRatio > canvasRatio) { drawH = w / imgRatio; offsetY = (h - drawH) / 2; }
    else { drawW = h * imgRatio; offsetX = (w - drawW) / 2; }
    ctx.fillStyle = "black"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  },

  drawImageCover: (ctx, img, w, h) => {
    const iw = img.videoWidth || img.naturalWidth || img.width || 0;
    const ih = img.videoHeight || img.naturalHeight || img.height || 0;
    if (iw < 1 || ih < 1) return;
    const imgRatio = iw / ih; const canvasRatio = w / h;
    let drawW = w, drawH = h, offsetX = 0, offsetY = 0;
    if (imgRatio > canvasRatio) { drawW = h * imgRatio; offsetX = (w - drawW) / 2; }
    else { drawH = w / imgRatio; offsetY = (h - drawH) / 2; }
    ctx.fillStyle = "black"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  },

  drawChartOverlay: (ctx, chartData, w, h, fontFamily) => {
    if (!chartData || !chartData.show || !chartData.items || chartData.items.length === 0) return;
    const items = chartData.items;
    const maxValue = Math.max(...items.map(it => it.value), 1);
    const chartW = w * 0.70;
    const chartH = h * 0.35;
    const chartX = (w - chartW) / 2;
    const chartY = h * 0.30;
    const barCount = items.length;
    const barGap = chartW / (barCount * 3);
    const barW = (chartW - barGap * (barCount + 1)) / barCount;
    const barColors = ['#DC2626', '#2563EB', '#6B7280', '#059669', '#D97706', '#7C3AED'];
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(chartX - 30, chartY - 50, chartW + 60, chartH + 80);
    if (chartData.title) {
      ctx.font = `800 ${w > 800 ? 32 : 24}px ${fontFamily}`;
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(chartData.title, w / 2, chartY - 25);
    }
    items.forEach((item, i) => {
      const barH = (item.value / maxValue) * chartH;
      const bx = chartX + barGap + i * (barW + barGap);
      const by = chartY + chartH - barH;
      const color = barColors[i % barColors.length];
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, barW, barH);
      ctx.font = `900 ${w > 800 ? 28 : 20}px ${fontFamily}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(String(item.value), bx + barW / 2, by - 6);
      ctx.font = `700 ${w > 800 ? 20 : 16}px ${fontFamily}`;
      ctx.fillStyle = '#E5E7EB';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, bx + barW / 2, chartY + chartH + 8);
    });
    if (chartData.note) {
      ctx.font = `600 ${w > 800 ? 18 : 14}px ${fontFamily}`;
      ctx.fillStyle = '#9CA3AF';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(chartData.note, w / 2, chartY + chartH + 50);
    }
    ctx.restore();
  },

  drawThumbnail: (ctx, img, text, w, h, fontFamily, sourceName, config) => {
    const baseW = 941;
    const baseH = 1672;
    const sx = w / baseW;
    const sy = h / baseH;
    const now = new Date();
    const dateLocale = ({ tr:'tr-TR', en:'en-US', fr:'fr-FR', de:'de-DE', es:'es-ES', ar:'ar-SA', ru:'ru-RU' })[config?.language || 'tr'] || 'tr-TR';
    const dateStr = now.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    const dayStr = now.toLocaleDateString(dateLocale, { weekday: 'long' }).toUpperCase();
    const topLabel = (sourceName || config?.sourceName || (config?.tip === 'gazete' ? 'GAZETE ADI' : 'GÖRSEL BAŞLIĞI')).toUpperCase();
    const sourceTokens = topLabel.replace(/[\/|]+/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
    let cleanedHeadline = ((text || 'GÜNDEMDEKİ GELİŞME').toUpperCase())
      .replace(/[.,:;!?\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    let headlineTokens = cleanedHeadline.split(/\s+/).filter(Boolean);
    if (sourceTokens.length && headlineTokens.length) {
      while (headlineTokens.length && sourceTokens.includes(headlineTokens[0])) headlineTokens.shift();
      const joinedSource = sourceTokens.join(' ');
      const joinedHeadline = headlineTokens.join(' ');
      if (joinedHeadline.startsWith(joinedSource + ' ')) {
        headlineTokens = joinedHeadline.substring(joinedSource.length).trim().split(/\s+/).filter(Boolean);
      }
    }
    if (headlineTokens.length === 0) headlineTokens = cleanedHeadline.split(/\s+/).filter(Boolean);
    const headlineWords = headlineTokens.slice(0, 4);
    const headline = headlineWords.join(' ') || 'GÜNDEMDEKİ GELİŞME';
    const templateFont = '"Arial Black", "Inter", "Segoe UI", Arial, sans-serif';

    ctx.clearRect(0, 0, w, h);
    if (FIXED_CLICKBAIT_TEMPLATE_IMG && FIXED_CLICKBAIT_TEMPLATE_IMG.complete && FIXED_CLICKBAIT_TEMPLATE_IMG.naturalWidth > 0) {
      ctx.drawImage(FIXED_CLICKBAIT_TEMPLATE_IMG, 0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#051431');
      grad.addColorStop(0.5, '#082354');
      grad.addColorStop(1, '#031127');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(20 * sx, 16 * sy, w - 40 * sx, h - 32 * sy);
    }

    const cover = (x, y, width, height) => {
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(x * sx, y * sy, width * sx, height * sy);
    };

    // Clear only dynamic text regions, preserve the fixed notebook / logo / CTA visuals
    cover(210, 118, 520, 64);   // top title area
    cover(250, 186, 440, 48);   // date area
    cover(85, 250, 780, 320);   // main headline area

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top label
    ctx.fillStyle = '#11327f';
    let topFont = Math.round(36 * Math.min(sx, sy));
    ctx.font = `900 ${topFont}px ${templateFont}`;
    let topText = topLabel;
    while (ctx.measureText(topText).width > 520 * sx && topFont > 18) {
      topFont -= 1;
      ctx.font = `900 ${topFont}px ${templateFont}`;
    }
    ctx.fillText(topText, 470.5 * sx, 154 * sy);

    // Date + weekday
    ctx.fillStyle = '#243861';
    ctx.font = `700 ${Math.round(26 * Math.min(sx, sy))}px ${templateFont}`;
    ctx.fillText(`${dateStr} • ${dayStr}`, 470.5 * sx, 206 * sy);

    // Main clickbait headline - locked layout like the master template
    let titleFont = Math.round(104 * Math.min(sx, sy));
    ctx.font = `900 ${titleFont}px ${templateFont}`;
    let lines = RenderWorkerService.wrapText(ctx, headline, 760 * sx);
    while (lines.length > 2 && titleFont > 52) {
      titleFont -= 3;
      ctx.font = `900 ${titleFont}px ${templateFont}`;
      lines = RenderWorkerService.wrapText(ctx, headline, 780 * sx);
    }
    if (lines.length > 2) lines = [headlineWords.slice(0, 2).join(' '), headlineWords.slice(2).join(' ')].filter(Boolean);
    const lineHeight = titleFont * 1.02;
    const startY = (lines.length === 1 ? 405 : 350) * sy;
    lines.forEach((line, i) => {
      ctx.fillStyle = (i === 0) ? '#0c2d8b' : '#ff6b00';
      ctx.font = `900 ${titleFont}px ${templateFont}`;
      ctx.fillText(line, 470.5 * sx, startY + i * lineHeight);
    });
  },

  drawStar: (ctx, cx, cy, spikes, outerRadius, innerRadius, color = "#FFFFFF") => {
    let rot = (Math.PI / 2) * 3; let step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius; let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y); rot += step;
      x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y); rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  },

  renderGuzelSoz: async (jobData, canvasElement, w, h, cx, fontFamily, preferences) => {
    addSystemLog('Güzel söz render başlıyor...', 'info');
    const isMultilang = !!jobData.script._isMultilang;
    const slideCount = jobData.script._sceneCount || (isMultilang ? 4 : 1);
    const allTexts = isMultilang ? jobData.script.videoSlides.map(s => s.spokenText || "") : [jobData.script.videoSlides[0]?.spokenText || ""];
    const allLabels = isMultilang ? (jobData.script._multilangLabels || ['FR', 'DE', 'EN', 'TR']) : [];
    const quoteText = allTexts[0];
    const FPS = 30;
    const PAGE_TURN_SECONDS = isMultilang ? 0.60 : 0.0;
    const SPEECH_LEAD_IN = 0.18;
    const SPEECH_TAIL = 0.34;
    const BUFFER_TAIL = 0.8;
    const SPEECH_RATE = Math.max(0.5, Number(RENDER_CONFIG?.SPEECH_RATE || 1));
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    canvasElement.width = w;
    canvasElement.height = h;
    const ctx = canvasElement.getContext('2d');
    addSystemLog(`Canvas: ${w}x${h}`, 'info');

    const audioCtx = _getAudioCtx();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch((e) => { ErrorHandler.silent(e); });
    const audioDest = audioCtx ? audioCtx.createMediaStreamDestination() : null;
    const { osc: silentOsc, gain: silentGain } = _createSilentOsc(audioCtx, audioDest);
    const maxAllowedDur = 120.0;

    const sceneDurations = [];
    const sceneAudioBuffers = [];
    const sceneSpeechDurations = [];
    const sceneVoiceLocalStarts = [];
    let audioPlayed = false;

    for (let si = 0; si < (isMultilang ? slideCount : 1); si++) {
      const audioData = jobData.assets.audio[si];
      let segDur = 5.2;
      let playedSpeechDur = 0;
      if (audioData?.wavBuffer && audioCtx) {
        try {
          let bufferCopy;
          if (audioData.wavBuffer instanceof ArrayBuffer) bufferCopy = audioData.wavBuffer.slice(0);
          else if (audioData.wavBuffer?.buffer instanceof ArrayBuffer) bufferCopy = audioData.wavBuffer.buffer.slice(0);
          else bufferCopy = audioData.wavBuffer;
          const audioBuf = await audioCtx.decodeAudioData(bufferCopy);
          sceneAudioBuffers.push(audioBuf);
          playedSpeechDur = audioBuf.duration / SPEECH_RATE;
          const wordCount = (allTexts[si] || "").split(/\s+/).filter(Boolean).length;
          const minDur = Math.max(3.8, (wordCount / 2.35) + 1.7);
          segDur = Math.min(Math.max(SPEECH_LEAD_IN + playedSpeechDur + SPEECH_TAIL + (si < slideCount - 1 ? PAGE_TURN_SECONDS : 0.18), minDur), maxAllowedDur);
          audioPlayed = true;
          addSystemLog(`Ses ${si + 1}/${isMultilang ? slideCount : 1}: raw ${audioBuf.duration.toFixed(2)}sn / oynatılan ${playedSpeechDur.toFixed(2)}sn → sahne ${segDur.toFixed(2)}sn${isMultilang ? ' (' + allLabels[si] + ')' : ''}`, 'info');
        } catch (e) {
          addSystemLog('Ses decode hatası: ' + e.message, 'warn');
          sceneAudioBuffers.push(null);
        }
      } else {
        sceneAudioBuffers.push(null);
        const wordCount = (allTexts[si] || "").split(/\s+/).filter(Boolean).length;
        playedSpeechDur = Math.max(2.4, wordCount / 2.5);
        segDur = Math.min(Math.max(SPEECH_LEAD_IN + playedSpeechDur + SPEECH_TAIL + (si < slideCount - 1 ? PAGE_TURN_SECONDS : 0.18), 4.0), maxAllowedDur);
      }
      sceneSpeechDurations.push(playedSpeechDur);
      sceneVoiceLocalStarts.push(SPEECH_LEAD_IN);
      sceneDurations.push(segDur);
    }

    if (!audioPlayed) addSystemLog('Ses yok, görsel süre kullanılacak', 'warn');

    const totalAudioDur = sceneDurations.reduce((a, b) => a + b, 0);
    const totalDuration = Math.min(totalAudioDur + BUFFER_TAIL, maxAllowedDur + BUFFER_TAIL);
    const totalFrames = Math.round(totalDuration * FPS);
    addSystemLog(`Toplam süre: ${totalDuration.toFixed(2)}sn`, 'info');

    let bgmSource, masterGain;
    let bgmSourceNeedsStart = false;
    const bgmTargetVolume = DEFAULT_BGM_VOLUME;
    let ambientSound = jobData.preferences.ambientSound || 'none';
    if (ambientSound !== 'none') {
      const ambientTypes = ['rain', 'wind', 'waves', 'fire'];
      if (ambientTypes.includes(ambientSound)) {
        try {
          const ambientObj = AmbientAudioService.getAmbientNode(audioCtx, ambientSound);
          if (ambientObj) {
            bgmSource = ambientObj.source;
            masterGain = audioCtx.createGain();
            // Sabit intro sırasında mevcut Güzel Söz sesi/müziği başlamasın.
            masterGain.gain.value = 0;
            ambientObj.gainNode.connect(masterGain);
            masterGain.connect(audioDest);
            addSystemLog('Atmosfer sesi: ' + ambientSound, 'success');
          }
        } catch (e) { addSystemLog('Atmosfer sesi hatası: ' + e.message, 'warn'); }
      } else {
        try {
          const track = await AssetManagerService.getMusicFromLib(ambientSound);
          if (track && track.data && audioCtx) {
            const blob = _base64ToBlob(track.data);
            const musicUrl = ObjectURLManager.create(blob);
            const res = await fetch(musicUrl);
            const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
            if (!bgmSource) {
              bgmSource = audioCtx.createBufferSource();
              bgmSource.buffer = buf;
              bgmSource.loop = true;
            }
            masterGain = audioCtx.createGain();
            masterGain.gain.value = bgmTargetVolume;
            bgmSource.connect(masterGain);
            masterGain.connect(audioDest);
            // v1.28: müzik sabit giriş videosundan SONRA başlatılacak.
            bgmSourceNeedsStart = true;
            addSystemLog('Müzik hazır: ' + track.name + ' (Güzel Söz sabit intro sonrası başlayacak)', 'success');
          } else {
            addSystemLog(`Müzik bulunamadı: ${ambientSound}`, 'warn');
          }
        } catch (e) {
          addSystemLog('Müzik yükleme hatası: ' + e.message, 'warn');
        }
      }
    } else {
      addSystemLog('Müzik seçilmedi', 'warn');
    }

    const stream = canvasElement.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];
    if (audioDest) audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));

    let mimeType = 'video/webm; codecs=vp8,opus';
    if (jobData.config.videoFormat === 'mp4') {
      if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4000000, audioBitsPerSecond: 128000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const loadedImages = [];
    const imageSlotCount = isMultilang ? slideCount : Math.max(1, jobData.assets.images.length);
    for (let imageIndex = 0; imageIndex < imageSlotCount; imageIndex++) {
      const imgData = jobData.assets.images[imageIndex] || jobData.assets.thumbnail || null;
      let loaded = null;
      if (imgData) loaded = await NetworkUtils.loadImage(imgData);
      if (!loaded && imageIndex > 0) loaded = loadedImages[imageIndex - 1] || null;
      loadedImages.push(loaded);
    }
    if (loadedImages.length === 0) loadedImages.push(null);
    addSystemLog(`${loadedImages.length} dil/görsel slotu hazır, ${totalFrames} kare render edilecek.`, 'info');

    const sceneBoundaries = [];
    let cumFrame = 0;
    for (let si = 0; si < sceneDurations.length; si++) {
      cumFrame += Math.round(sceneDurations[si] * FPS);
      sceneBoundaries.push(cumFrame);
    }

    const drawBaseImage = (img, tNorm = 0) => {
      if (!img) {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, w, h);
        return;
      }
      const zoom = 1.02 + (0.06 * tNorm);
      const panX = Math.sin(tNorm * Math.PI) * (w * 0.018);
      const panY = Math.cos(tNorm * Math.PI * 0.7) * (h * 0.015);
      ctx.save();
      ctx.translate(w / 2 + panX, h / 2 + panY);
      ctx.scale(zoom, zoom);
      const imgRatio = img.width / img.height;
      const canRatio = w / h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > canRatio) {
        sh = img.height;
        sw = sh * canRatio;
        sx = (img.width - sw) / 2;
      } else {
        sw = img.width;
        sh = sw / canRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
      ctx.restore();
    };

    const drawPageTurn = (currentImg, nextImg, sceneProgress, turnProgress) => {
      drawBaseImage(nextImg || currentImg, 0.03 + (sceneProgress * 0.04));
      if (!currentImg) return;
      const foldX = w * (1 - (0.82 * turnProgress));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(foldX, 0);
      ctx.lineTo(Math.max(0, foldX - (34 * turnProgress)), h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.clip();
      drawBaseImage(currentImg, sceneProgress * 0.85);
      ctx.restore();

      const shadow = ctx.createLinearGradient(foldX - 90, 0, foldX + 18, 0);
      shadow.addColorStop(0, 'rgba(0,0,0,0)');
      shadow.addColorStop(0.55, 'rgba(0,0,0,0.20)');
      shadow.addColorStop(0.82, 'rgba(255,255,255,0.22)');
      shadow.addColorStop(1, 'rgba(255,255,255,0.42)');
      ctx.fillStyle = shadow;
      ctx.fillRect(foldX - 100, 0, 130, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.46)';
      ctx.lineWidth = Math.max(2, w * 0.0036);
      ctx.beginPath();
      ctx.moveTo(foldX, 0);
      ctx.lineTo(Math.max(0, foldX - (34 * turnProgress)), h);
      ctx.stroke();
    };

    const fitQuoteLayout = (textValue) => {
      let fontSize = w > 800 ? 46 : 38;
      let lines = [];
      let lh = fontSize * 1.34;
      while (fontSize > 22) {
        ctx.font = `900 ${fontSize}px ${fontFamily}`;
        lines = RenderWorkerService.wrapText(ctx, textValue, w * 0.84).filter(Boolean);
        lh = fontSize * 1.34;
        if ((lines.length * lh) <= (h * 0.62)) break;
        fontSize -= 2;
      }
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
      lines = RenderWorkerService.wrapText(ctx, textValue, w * 0.84).filter(Boolean);
      lh = fontSize * 1.34;
      return { lines, fontSize, lh, totalChars: lines.reduce((s, line) => s + line.length, 0) };
    };

    const drawAnimatedTextLine = (line, y, revealFloat, fontSize) => {
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const lineWidth = ctx.measureText(line).width;
      const startX = cx - (lineWidth / 2);
      let x = startX;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        const chW = ctx.measureText(ch).width;
        if (ch === ' ') {
          x += chW;
          continue;
        }
        const delta = revealFloat - ci;
        if (delta >= 0) {
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#000000';
          ctx.lineJoin = 'round';
          ctx.strokeText(ch, x, y);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(ch, x, y);
        } else if (delta > -6) {
          const t = clamp(1 - ((-delta) / 6), 0, 1);
          const driftX = Math.sin((ci + 1) * 1.73) * 30 * (1 - t);
          const driftY = (-34 - (Math.cos((ci + 1) * 0.93) * 12)) * (1 - t);
          const rot = (1 - t) * 0.28 * (ci % 2 === 0 ? 1 : -1);
          ctx.save();
          ctx.translate(x + driftX + (chW / 2), y + driftY);
          ctx.rotate(rot);
          ctx.globalAlpha = 0.20 + (0.80 * t);
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.70)';
          ctx.lineJoin = 'round';
          ctx.strokeText(ch, -chW / 2, 0);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(ch, -chW / 2, 0);
          ctx.restore();
        }
        x += chW;
      }
    };

    const drawAnimatedQuote = (textValue, revealProgress) => {
      const layout = fitQuoteLayout(textValue);
      const startY = (h - (layout.lines.length * layout.lh)) / 2;
      const revealCharsFloat = layout.totalChars * clamp(revealProgress, 0, 1);
      let charCursor = 0;
      layout.lines.forEach((line, li) => {
        const y = startY + (li * layout.lh) + (layout.lh / 2);
        const lineRevealFloat = clamp(revealCharsFloat - charCursor, -6, line.length + 1);
        drawAnimatedTextLine(line, y, lineRevealFloat, layout.fontSize);
        charCursor += line.length;
      });
    };

    // === v1.28 GÜZEL SÖZ SABİT INTRO ===
    // Recorder başlamadan önce ilk video karesi canvas'a çizilir.
    // Böylece intro, çıktı videosunun gerçek 0. karesidir.
    let guzelSozIntroVideo = null;
    let guzelSozIntroUrl = null;
    let guzelSozIntroDuration = 0;

    const drawGuzelSozIntroFrame = (video) => {
      if (!video || !video.videoWidth || !video.videoHeight) return;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      const sourceRatio = video.videoWidth / video.videoHeight;
      const canvasRatio = w / h;
      let dw, dh, dx, dy;

      if (sourceRatio > canvasRatio) {
        dw = w;
        dh = w / sourceRatio;
        dx = 0;
        dy = (h - dh) / 2;
      } else {
        dh = h;
        dw = h * sourceRatio;
        dx = (w - dw) / 2;
        dy = 0;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, dx, dy, dw, dh);
    };

    try {
      const storedIntro = await AssetManagerService.loadMedia(GUZEL_SOZ_INTRO_MEDIA_ID);

      let introBlob = null;
      if (storedIntro instanceof Blob) {
        introBlob = storedIntro;
      } else if (storedIntro instanceof ArrayBuffer) {
        introBlob = new Blob([storedIntro], { type: 'video/mp4' });
      } else if (ArrayBuffer.isView(storedIntro)) {
        introBlob = new Blob([storedIntro.buffer], { type: 'video/mp4' });
      } else if (typeof storedIntro === 'string' && storedIntro.startsWith('data:video/')) {
        const storedResponse = await fetch(storedIntro);
        introBlob = await storedResponse.blob();
      }

      if (!introBlob || !introBlob.size) {
        throw new Error('Güzel Sözler.mp4 IndexedDB kaydı bulunamadı.');
      }

      guzelSozIntroUrl = ObjectURLManager.create(introBlob);
      guzelSozIntroVideo = document.createElement('video');
      guzelSozIntroVideo.src = guzelSozIntroUrl;
      guzelSozIntroVideo.preload = 'auto';
      guzelSozIntroVideo.muted = true;
      guzelSozIntroVideo.playsInline = true;
      guzelSozIntroVideo.setAttribute('playsinline', '');

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Güzel Söz giriş videosu yükleme zaman aşımı.')), 12000);
        const clean = () => {
          clearTimeout(timeout);
          guzelSozIntroVideo.onloadeddata = null;
          guzelSozIntroVideo.onerror = null;
        };
        guzelSozIntroVideo.onloadeddata = () => { clean(); resolve(); };
        guzelSozIntroVideo.onerror = () => { clean(); reject(new Error('Güzel Söz giriş videosu açılamadı.')); };
        guzelSozIntroVideo.load();
      });

      guzelSozIntroDuration =
        Number.isFinite(guzelSozIntroVideo.duration) && guzelSozIntroVideo.duration > 0
          ? guzelSozIntroVideo.duration
          : GUZEL_SOZ_INTRO_EXPECTED_DURATION;

      drawGuzelSozIntroFrame(guzelSozIntroVideo);
      if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();

      addSystemLog(
        `✓ FIX CHECKLIST v1.28: Güzel Söz sabit intro hazır (${guzelSozIntroDuration.toFixed(2)}sn, ${guzelSozIntroVideo.videoWidth}x${guzelSozIntroVideo.videoHeight}).`,
        'success'
      );
    } catch (introLoadErr) {
      addSystemLog(`Güzel Söz sabit intro yüklenemedi; mevcut süreç bozulmadan devam edecek: ${introLoadErr.message}`, 'warn');
      guzelSozIntroVideo = null;
      guzelSozIntroDuration = 0;
      if (guzelSozIntroUrl) {
        try { ObjectURLManager.revoke(guzelSozIntroUrl); } catch (e) { ErrorHandler.silent(e); }
        guzelSozIntroUrl = null;
      }
    }

    recorder.start(100);

    const timerWorker = _createTimerWorker();
    timerWorker.postMessage('start');
    let frameResolvers = [];
    timerWorker.onmessage = () => {
      const resolvers = frameResolvers;
      frameResolvers = [];
      resolvers.forEach(r => r());
    };
    const nextFrame = () => new Promise(resolve => { frameResolvers.push(resolve); });

    // Önce yalnız sabit MP4 oynar. Bittiği ilk karede mevcut Güzel Söz
    // render akışı devam eder; ekstra bekleme/fade eklenmez.
    if (guzelSozIntroVideo) {
      sysEventBus.emit('PROGRESS', { step: 'RENDER', percent: 25, text: 'Güzel Söz giriş videosu ekleniyor...' });

      try {
        guzelSozIntroVideo.currentTime = 0;
        await guzelSozIntroVideo.play();

        const safetyEnd = performance.now() + ((guzelSozIntroDuration + 2.0) * 1000);
        while (
          !guzelSozIntroVideo.ended &&
          guzelSozIntroVideo.currentTime < Math.max(0, guzelSozIntroDuration - 0.015) &&
          performance.now() < safetyEnd
        ) {
          drawGuzelSozIntroFrame(guzelSozIntroVideo);
          if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
          await nextFrame();
        }

        guzelSozIntroVideo.pause();
        addSystemLog('✓ Güzel Söz sabit intro tamamlandı → mevcut süreç boşluksuz devam ediyor.', 'success');
      } catch (introPlayErr) {
        addSystemLog(`Güzel Söz intro oynatma uyarısı; mevcut süreç devam ediyor: ${introPlayErr.message}`, 'warn');
      } finally {
        try {
          guzelSozIntroVideo.pause();
          guzelSozIntroVideo.removeAttribute('src');
          guzelSozIntroVideo.load();
        } catch (e) { ErrorHandler.silent(e); }

        if (guzelSozIntroUrl) {
          try { ObjectURLManager.revoke(guzelSozIntroUrl); } catch (e) { ErrorHandler.silent(e); }
          guzelSozIntroUrl = null;
        }
        guzelSozIntroVideo = null;
      }
    }

    // Sabit intro bittikten SONRA eski Güzel Söz müzik/atmosfer akışı başlar.
    if (masterGain && audioCtx) {
      try { masterGain.gain.setValueAtTime(bgmTargetVolume, audioCtx.currentTime); } catch (e) { masterGain.gain.value = bgmTargetVolume; }
    }
    if (bgmSource && bgmSourceNeedsStart) {
      try { bgmSource.start(0); } catch (e) { ErrorHandler.silent(e); }
      bgmSourceNeedsStart = false;
    }

    sysEventBus.emit('PROGRESS', { step: 'RENDER', percent: 30, text: 'Güzel söz render ediliyor...' });

    const scheduledVoiceSources = [];
    if (audioPlayed && audioCtx && audioDest) {
      const scheduleBaseTime = audioCtx.currentTime + 0.40;
      let relativeStart = 0;
      for (let si = 0; si < sceneAudioBuffers.length; si++) {
        const audioBuf = sceneAudioBuffers[si];
        if (audioBuf) {
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuf;
          source.playbackRate.value = SPEECH_RATE;
          const gain = audioCtx.createGain();
          gain.gain.value = preferences?.narratorVolume ?? 0.8;
          source.connect(gain);
          gain.connect(audioDest);
          source.start(scheduleBaseTime + relativeStart + sceneVoiceLocalStarts[si]);
          scheduledVoiceSources.push(source);
          addSystemLog(`Dil ${si + 1}/${sceneAudioBuffers.length}: ${allLabels[si] || ''} ses +${(relativeStart + sceneVoiceLocalStarts[si]).toFixed(2)}sn başlıyor.`, 'success');
        }
        relativeStart += sceneDurations[si] || 0;
      }
    }

    for (let frame = 0; frame < totalFrames; frame++) {
      const progress = frame / totalFrames;
      const elapsed = frame / FPS;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      let currentSceneIndex = 0;
      for (let si = 0; si < sceneBoundaries.length; si++) {
        if (frame < sceneBoundaries[si]) {
          currentSceneIndex = si;
          break;
        }
        currentSceneIndex = si;
      }
      currentSceneIndex = clamp(currentSceneIndex, 0, Math.max(0, slideCount - 1));

      const sceneStartFrame = currentSceneIndex > 0 ? sceneBoundaries[currentSceneIndex - 1] : 0;
      const sceneEndFrame = sceneBoundaries[currentSceneIndex] || totalFrames;
      const sceneFrameCount = Math.max(1, sceneEndFrame - sceneStartFrame);
      const frameInScene = frame - sceneStartFrame;
      const localSceneTime = frameInScene / FPS;
      const sceneDuration = sceneDurations[currentSceneIndex] || 4;
      const sceneProgress = clamp(frameInScene / sceneFrameCount, 0, 1);

      const currentImage = loadedImages[Math.min(currentSceneIndex, loadedImages.length - 1)] || null;
      const nextImage = loadedImages[Math.min(currentSceneIndex + 1, loadedImages.length - 1)] || currentImage;

      const turnStartTime = sceneDuration - PAGE_TURN_SECONDS;
      const turnProgress = (isMultilang && currentSceneIndex < slideCount - 1 && localSceneTime >= turnStartTime)
        ? clamp((localSceneTime - turnStartTime) / PAGE_TURN_SECONDS, 0, 1)
        : 0;

      if (turnProgress > 0.001) drawPageTurn(currentImage, nextImage, sceneProgress, turnProgress);
      else drawBaseImage(currentImage, sceneProgress);

      const ov = ctx.createLinearGradient(0, 0, 0, h);
      ov.addColorStop(0, "rgba(0,0,0,0.50)");
      ov.addColorStop(0.28, "rgba(0,0,0,0.12)");
      ov.addColorStop(0.72, "rgba(0,0,0,0.14)");
      ov.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, w, h);

      const currentText = isMultilang ? (allTexts[currentSceneIndex] || quoteText) : quoteText;
      const currentLabel = isMultilang ? (allLabels[currentSceneIndex] || '') : '';

      const speechStartLocal = sceneVoiceLocalStarts[currentSceneIndex] || SPEECH_LEAD_IN;
      const speechEndLocal = speechStartLocal + (sceneSpeechDurations[currentSceneIndex] || 2.5);
      const revealProgress = clamp((localSceneTime - speechStartLocal) / Math.max(0.9, (speechEndLocal - speechStartLocal)), 0, 1);

      ctx.save();
      const fadeIn = clamp((localSceneTime / 0.45), 0, 1);
      ctx.globalAlpha = fadeIn;

      if (isMultilang && currentLabel) {
        ctx.font = `bold ${w > 800 ? 28 : 22}px ${fontFamily}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#000000";
        ctx.lineJoin = "round";
        ctx.strokeText(currentLabel, w - 30, 30);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(currentLabel, w - 30, 30);
      }

      drawAnimatedQuote(currentText, revealProgress);
      ctx.restore();

      if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
      if (frame % 30 === 0) {
        sysEventBus.emit('PROGRESS', {
          step: 'RENDER',
          percent: Math.min(90, 30 + (progress * 60)),
          text: `${elapsed.toFixed(1)}sn / ${totalDuration.toFixed(1)}sn`
        });
      }
      await nextFrame();
    }

    if (typeof scheduledVoiceSources !== 'undefined') {
      scheduledVoiceSources.forEach(source => { try { source.stop(); } catch (e) { ErrorHandler.silent(e); } });
    }
    if (bgmSource) { try { bgmSource.stop(); } catch (e) { ErrorHandler.silent(e); } }
    if (masterGain) masterGain.disconnect();
    silentOsc.stop();
    silentOsc.disconnect();
    timerWorker.postMessage('stop');
    timerWorker.terminate();
    addSystemLog('Recorder durduruluyor...', 'info');

    const videoPromise = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const finalRecordedDuration = totalDuration + guzelSozIntroDuration;
        addSystemLog(`Video hazır: ${(blob.size / 1024).toFixed(0)}KB, ${finalRecordedDuration.toFixed(1)}sn (intro ${guzelSozIntroDuration.toFixed(1)}sn + mevcut süreç ${totalDuration.toFixed(1)}sn)`, blob.size > 0 ? 'success' : 'error');
        if (blob.size === 0) return reject(new Error("Video oluşturulamadı."));
        resolve({ url: ObjectURLManager.create(blob), blobType: blob.type });
      };
    });

    if (recorder.state !== 'inactive') {
      try { recorder.requestData(); } catch (e) { ErrorHandler.silent(e); }
      await new Promise(r => setTimeout(r, 200));
      recorder.stop();
    }
    stream.getTracks().forEach(t => t.stop());
    return await videoPromise;
  },

  executeRender: async (jobData, canvasElement, preferences) => {
    if (jobData.script) {
      if (jobData.script.thumbnailText) jobData.script.thumbnailText = makeTikTokSafeHeadline(LogicEngineService.validateTurkishText(jobData.script.thumbnailText), 4);
      if (jobData.script.sonSoz) jobData.script.sonSoz = LogicEngineService.validateTurkishText(jobData.script.sonSoz);
      if (jobData.script.sonSozKaynak) jobData.script.sonSozKaynak = LogicEngineService.validateTurkishText(jobData.script.sonSozKaynak);
      if (jobData.script.lastQuote) jobData.script.lastQuote = LogicEngineService.validateTurkishText(jobData.script.lastQuote);
      if (jobData.script.videoSlides) {
        jobData.script.videoSlides.forEach(function(slide) {
          if (slide.spokenText) slide.spokenText = makeTikTokSafeText(LogicEngineService.validateTurkishText(slide.spokenText));
          if (slide.topText) slide.topText = makeTikTokSafeHeadline(LogicEngineService.validateTurkishText(slide.topText), 4);
        });
      }
    }
    const econErrors = LogicEngineService.validateEconomyData(jobData.script);
    if (econErrors.length > 0) addSystemLog('Ekonomi uyarilari: ' + econErrors.join(', '), 'warn');
    addSystemLog('Video render başlatılıyor...', 'info');
    const aspectRatio = jobData.config.aspectRatio || '9:16';
    const w = aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 1080 : 720;
    const h = aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 1080 : 1280;
    const cx = w / 2;
    canvasElement.width = w; canvasElement.height = h;
    const ctx = canvasElement.getContext('2d');
    ctx.fillStyle = "#0B0F19"; ctx.fillRect(0, 0, w, h);
    if (jobData.config.outputType === 'image') {
      sysEventBus.emit('PROGRESS', { step: 'RENDER', percent: 90, text: 'Görsel Paketleniyor...' });
      const promptImageToUse = jobData.assets.images[0] || jobData.assets.thumbnail;
      if (promptImageToUse) { const sImg = await NetworkUtils.loadImage(promptImageToUse); if (sImg) RenderWorkerService.drawImageContain(ctx, sImg, w, h); }
      return new Promise((resolve) => { canvasElement.toBlob((blob) => resolve(ObjectURLManager.create(blob)), 'image/png'); });
    }
    if (jobData.script._isGuzelSoz) {
      return RenderWorkerService.renderGuzelSoz(jobData, canvasElement, w, h, cx, _getFontFamily(jobData.config.fontStyle), preferences);
    }
    const targetDurStr = jobData.config.duration || '30'; const isUnlimited = targetDurStr === 'unlimited';
    const hasMultipleBlocks = (jobData.script.imageBlocks || []).length > 1;
    const useForceExact = !isUnlimited && !hasMultipleBlocks && jobData.config.tip !== 'iddia_analizi';
    const bounds = getDurationBounds(targetDurStr); const limitSec = useForceExact ? bounds.max : 9999;
    let globalRenderedSec = 0;
    const getAudioDur = (audioData, fallbackText) => {
      if (audioData?.wavBuffer) {
        let byteLength = 0;
        if (audioData.wavBuffer instanceof ArrayBuffer) byteLength = audioData.wavBuffer.byteLength;
        else if (audioData.wavBuffer.buffer instanceof ArrayBuffer) byteLength = audioData.wavBuffer.buffer.byteLength;
        else if (audioData.wavBuffer.byteLength) byteLength = audioData.wavBuffer.byteLength;
        if (byteLength > 44) { const sampleRate = audioData.sampleRate || 24000; return (byteLength - 44) / (sampleRate * 2); }
      }
      const wordsCount = (fallbackText || "").trim().split(/\s+/).filter(Boolean).length;
      if (wordsCount === 0) return 0.5;
      return Math.max(1.0, wordsCount / getWPS(jobData.config.language));
    };
    let rawKapakDur = jobData.assets.thumbnailAudio ? (getAudioDur(jobData.assets.thumbnailAudio, jobData.script.thumbnailText) + 0.05) : 1.0;
    if (jobData.config.tip === 'iddia_analizi' || jobData.script._muteNarration) rawKapakDur = Math.max(3.2, rawKapakDur);
    let rawSonSozDur = jobData.script.sonSoz ? (getAudioDur(jobData.assets.sonSozAudio, buildSonSozSpokenText(jobData.script.sonSoz, jobData.script.sonSozKaynak)) + 0.05) : 0;
    if (jobData.config.tip === 'iddia_analizi' || jobData.script._muteNarration) rawSonSozDur = Math.max(rawSonSozDur, jobData.script.sonSoz ? 4.5 : 0);
    let rawOutroDur = Math.max(4.0, getAudioDur(jobData.assets.outroAudio, jobData.script.lastQuote) + 0.05);
    const rawMediaDurations = {};
    for (let ri = 0; ri < jobData.script.videoSlides.length; ri++) {
      const rs = jobData.script.videoSlides[ri];
      if (rs._isRawMedia && jobData.script._originalMedia) {
        const rm = jobData.script._originalMedia[rs._rawMediaIndex || 0];
        if (rm) {
          try {
            const rawBlob = _base64ToBlob(rm.data);
            const rawUrl = ObjectURLManager.create(rawBlob);
            const tmpEl = document.createElement(rm.type && rm.type.startsWith('video') ? 'video' : 'audio');
            tmpEl.src = rawUrl; tmpEl.preload = 'metadata';
            await new Promise((res, rej) => { tmpEl.onloadedmetadata = res; tmpEl.onerror = rej; setTimeout(res, 5000); });
            rawMediaDurations[ri] = isFinite(tmpEl.duration) ? tmpEl.duration : 10.0;
            ObjectURLManager.revoke(rawUrl);
          } catch(e) { rawMediaDurations[ri] = 10.0; }
        }
      }
    }
    let rawSlideSecs = jobData.script.videoSlides.map((s, i) => {
      if (s._isRawMedia && rawMediaDurations[i] != null) return rawMediaDurations[i];
      return getAudioDur(jobData.assets.audio[i], s.spokenText) + 0.3;
    });
    let rawCushion = 0.5;
    let totalNaturalSec = rawKapakDur + rawSonSozDur + rawOutroDur + rawCushion + rawSlideSecs.reduce((a, b) => a + b, 0);
    let scaleFactor = 1.0;
    if (hasMultipleBlocks) { addSystemLog(`Çoklu blok: Süre sınırı yok. Doğal okuma hızı (${totalNaturalSec.toFixed(1)}sn).`, 'info'); }
    else if (useForceExact) {
      if (totalNaturalSec > bounds.max) { scaleFactor = bounds.max / totalNaturalSec; addSystemLog(`Süre limitine sığdırılıyor (${scaleFactor.toFixed(2)}x)...`, "warn"); }
      else if (totalNaturalSec < bounds.min) { scaleFactor = bounds.min / totalNaturalSec; addSystemLog(`Minimum süre yakalanıyor (${scaleFactor.toFixed(2)}x)...`, "warn"); }
    }
    const timerWorker = _createTimerWorker(); timerWorker.postMessage('start');
    let frameResolvers = [];
    timerWorker.onmessage = () => {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const resolvers = frameResolvers; frameResolvers = []; resolvers.forEach(r => r());
    };
    const nextFrame = () => new Promise(resolve => { frameResolvers.push(resolve); });
    const audioCtx = _getAudioCtx(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch((e) => { ErrorHandler.silent(e); });
    const audioDest = audioCtx ? audioCtx.createMediaStreamDestination() : null;
    const { osc: silentOsc, gain: silentGain } = _createSilentOsc(audioCtx, audioDest);
    const keepAliveOsc = audioCtx.createOscillator(); const keepAliveGain = audioCtx.createGain(); keepAliveGain.gain.value = 0.00001; keepAliveOsc.connect(keepAliveGain); keepAliveGain.connect(audioCtx.destination); keepAliveGain.connect(audioDest); keepAliveOsc.start();
    const fontFamily = _getFontFamily(jobData.config.fontStyle);
    const FPS = 30;

    // İlk kare koruması: captureStream siyah canvas üzerinde oluşturulmayacak.
    // Thumbnail çizildikten sonra stream/track başlatılır.
    let stream = null;
    let videoTrack = null;
    let combinedStream = null;

    let mimeType = 'video/webm; codecs="vp8, opus"';
    if (jobData.config.videoFormat === 'mp4') { if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'; else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4'; }
    if (!MediaRecorder.isTypeSupported(mimeType)) { mimeType = 'video/webm;codecs=vp8,opus'; if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'; }
    const playAudio = async (audioData, requestedDuration = null, fallbackText = "") => {
      if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume().catch((e) => { ErrorHandler.silent(e); });
      let baseExactDur = getAudioDur(audioData, fallbackText);
      let speechStartSec = 0;
      let speechEndSec = baseExactDur;
      let audioEndPromise = null;
      let sourceNode = null;
      if (audioData?.wavBuffer && audioCtx) {
        try {
          let bufferCopy;
          if (audioData.wavBuffer instanceof ArrayBuffer) bufferCopy = audioData.wavBuffer.slice(0);
          else if (audioData.wavBuffer.buffer instanceof ArrayBuffer) bufferCopy = audioData.wavBuffer.buffer.slice(0);
          else if (typeof audioData.wavBuffer === 'object') { const uint8 = new Uint8Array(Object.values(audioData.wavBuffer)); bufferCopy = uint8.buffer.slice(0); }
          else bufferCopy = audioData.wavBuffer;
          const audioBuf = await audioCtx.decodeAudioData(bufferCopy);
          const playbackRate = RENDER_CONFIG.SPEECH_RATE || 1;
          baseExactDur = audioBuf.duration / playbackRate;

          // İddia Analizi altyazısını gerçek konuşmanın başladığı ve bittiği yere hizala.
          if (jobData.config.tip === 'iddia_analizi' && audioBuf.length > 0) {
            const channelCount = Math.max(1, audioBuf.numberOfChannels || 1);
            const threshold = 0.006;
            const step = Math.max(1, Math.floor(audioBuf.sampleRate * 0.002));
            let first = -1;
            let last = -1;
            for (let sample = 0; sample < audioBuf.length; sample += step) {
              let peak = 0;
              for (let ch = 0; ch < channelCount; ch++) {
                const data = audioBuf.getChannelData(ch);
                peak = Math.max(peak, Math.abs(data[sample] || 0));
              }
              if (peak >= threshold) { first = sample; break; }
            }
            for (let sample = audioBuf.length - 1; sample >= 0; sample -= step) {
              let peak = 0;
              for (let ch = 0; ch < channelCount; ch++) {
                const data = audioBuf.getChannelData(ch);
                peak = Math.max(peak, Math.abs(data[sample] || 0));
              }
              if (peak >= threshold) { last = sample; break; }
            }
            if (first >= 0) speechStartSec = Math.max(0, (first / audioBuf.sampleRate) / playbackRate);
            if (last >= first && last >= 0) speechEndSec = Math.min(baseExactDur, ((last + step) / audioBuf.sampleRate) / playbackRate);
            else speechEndSec = baseExactDur;
          } else {
            speechStartSec = 0;
            speechEndSec = baseExactDur;
          }

          const source = audioCtx.createBufferSource(); source.buffer = audioBuf;
          source.playbackRate.value = playbackRate;
          const gain = audioCtx.createGain(); gain.gain.value = preferences?.narratorVolume ?? 0.8;
          source.connect(gain); gain.connect(audioDest); source.start(0);
          sourceNode = source;
          audioEndPromise = new Promise(resolve => { source.onended = resolve; });
        } catch (e) { console.warn("Ses decode hatası:", e); }
      }
      const scaledExactDur = baseExactDur * scaleFactor;
      let totalDur;
      if (jobData.config.tip === 'iddia_analizi') {
        // Konuşma asla yarıda kesilmez. Sahne gerçek ses bitene kadar kalır.
        totalDur = Math.max(baseExactDur + 0.40, requestedDuration || 0);
      } else {
        totalDur = requestedDuration !== null ? (requestedDuration * scaleFactor) : (scaledExactDur + 0.3);
      }
      return { exactDur: jobData.config.tip === 'iddia_analizi' ? baseExactDur : scaledExactDur, totalDur, audioEndPromise, sourceNode, speechStartSec, speechEndSec };
    };

    const renderSonSozScene = async (text, kaynak, audioData, duration) => {
      let startT = performance.now(); const safeText = text || "";
      const sonSozSpokenFallback = buildSonSozSpokenText(text, kaynak) || safeText;
      const sonSozResult = await playAudio(audioData, duration, sonSozSpokenFallback);
      const sonSozAudioEnd = sonSozResult.audioEndPromise;
      const lang = jobData.config.language || 'tr';
      const hasYorum = jobData.config.yorum && jobData.config.yorum.trim().length > 0;
      let yorumAudioResult = null;
      if (hasYorum) {
        const yorumText = jobData.config.yorum || "";
        if (jobData.assets.yorumAudio) {
          yorumAudioResult = await playAudio(jobData.assets.yorumAudio, null, yorumText);
        } else {
          const wps = getWPS(lang);
          const words = yorumText.trim().split(/\s+/).filter(Boolean).length;
          const fakeDur = Math.max(1.0, words / wps) + 0.3;
          yorumAudioResult = { totalDur: fakeDur, audioEndPromise: null };
        }
      }
      const sonSozFrames = Math.max(1, Math.round(sonSozResult.totalDur * FPS));
      const yorumFrames = Math.max(0, Math.round((yorumAudioResult?.totalDur || 0) * FPS));
      const totalFrames = sonSozFrames + yorumFrames;
      let yorumStarted = false;
      let yorumAudioEnd = null;
      const topSafe = h * 0.08;
      const headerH = h * 0.10;
      const bottomLimit = h * 0.48;
      const headerText = (() => { if (lang === 'de') return "SCHLUSSWORT"; if (lang === 'en') return "FINAL WORDS"; if (lang === 'fr') return "MOT DE LA FIN"; if (lang === 'es') return "ÚLTIMAS PALABRAS"; if (lang === 'ar') return "الكلمة الأخيرة"; if (lang === 'ru') return "ПОСЛЕСЛОВИЕ"; return "SON SÖZ"; })();
      const fullContent = hasYorum ? `${text} — ${jobData.config.yorum}`.replace(/\n+/g, ' ') : text;
      const kaynakLine = (kaynak && kaynak.trim()) ? `— ${kaynak.trim()}` : '';
      let bodyFontSize = w > 800 ? 42 : 30;
      const kaynakFontSize = Math.round(bodyFontSize * 0.52);
      const kaynakLh = kaynakFontSize * 1.4;
      const kaynakBlockH = kaynakLine ? (kaynakLh + h * 0.02) : 0;
      ctx.font = `900 ${bodyFontSize}px ${fontFamily}`;
      let lines = RenderWorkerService.wrapText(ctx, fullContent, w * 0.85);
      let lh = bodyFontSize * 1.35;
      const startYBase = topSafe + headerH + h * 0.02;
      const availableH = bottomLimit - startYBase - h * 0.02 - kaynakBlockH;
      while ((lines.length * lh) > availableH && bodyFontSize > 14) {
        bodyFontSize -= 2;
        ctx.font = `900 ${bodyFontSize}px ${fontFamily}`;
        lines = RenderWorkerService.wrapText(ctx, fullContent, w * 0.85);
        lh = bodyFontSize * 1.35;
      }
      const totalTextH = lines.length * lh;
      const startY = startYBase + Math.max(0, (availableH - totalTextH) / 2);
      for (let frame = 0; frame < totalFrames; frame++) {
        if (hasYorum && frame >= sonSozFrames && !yorumStarted) {
          yorumAudioEnd = yorumAudioResult?.audioEndPromise || null;
          yorumStarted = true;
        }
        ctx.fillStyle = "#030712"; ctx.fillRect(0, 0, w, h / 2);
        ctx.fillStyle = "#E11D48"; ctx.font = `900 ${w > 800 ? 54 : 44}px ${fontFamily}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(headerText.toUpperCase(), cx, topSafe + headerH / 2);
        ctx.font = `900 ${bodyFontSize}px ${fontFamily}`; ctx.fillStyle = "#F3F4F6"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        lines.forEach((line, idx) => { ctx.fillText(line, cx, startY + (idx * lh)); });
        if (kaynakLine) {
          ctx.font = `italic 700 ${kaynakFontSize}px ${fontFamily}`;
          ctx.fillStyle = "#FBBF24"; ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(kaynakLine, cx, startY + totalTextH + h * 0.02);
        }
        const fX = 0, fY = h / 2, fW = w, fH = h / 2; ctx.save();
        switch (lang.toLowerCase()) {
          case 'tr': { ctx.fillStyle = "#E30A17"; ctx.fillRect(fX, fY, fW, fH); const centerX = fX + fW / 2; const centerY = fY + fH / 2; const rOuter = fH * 0.28; const rInner = fH * 0.22; const shiftX = fH * 0.08; ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(centerX - shiftX / 2, centerY, rOuter, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#E30A17"; ctx.beginPath(); ctx.arc(centerX - shiftX / 2 + shiftX, centerY, rInner, 0, Math.PI * 2); ctx.fill(); RenderWorkerService.drawStar(ctx, centerX + fH * 0.16, centerY, 5, fH * 0.10, fH * 0.04, "#FFFFFF"); break; }
          case 'de': { const sH = fH / 3; ctx.fillStyle = "#000000"; ctx.fillRect(fX, fY, fW, sH); ctx.fillStyle = "#DD0000"; ctx.fillRect(fX, fY + sH, fW, sH); ctx.fillStyle = "#FFCE00"; ctx.fillRect(fX, fY + sH * 2, fW, sH); break; }
          case 'en': { ctx.fillStyle = "#012169"; ctx.fillRect(fX, fY, fW, fH); ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = fH * 0.1; ctx.beginPath(); ctx.moveTo(fX, fY); ctx.lineTo(fX + fW, fY + fH); ctx.moveTo(fX + fW, fY); ctx.lineTo(fX, fY + fH); ctx.stroke(); ctx.strokeStyle = "#C8102E"; ctx.lineWidth = fH * 0.04; ctx.beginPath(); ctx.moveTo(fX, fY); ctx.lineTo(fX + fW, fY + fH); ctx.moveTo(fX + fW, fY); ctx.lineTo(fX, fY + fH); ctx.stroke(); ctx.fillStyle = "#FFFFFF"; const cwW = fW * 0.16; const cwH = fH * 0.16; ctx.fillRect(fX + fW / 2 - cwW / 2, fY, cwW, fH); ctx.fillRect(fX, fY + fH / 2 - cwH / 2, fW, cwH); ctx.fillStyle = "#C8102E"; const rcwW = fW * 0.10; const rcwH = fH * 0.10; ctx.fillRect(fX + fW / 2 - rcwW / 2, fY, rcwW, fH); ctx.fillRect(fX, fY + fH / 2 - rcwH / 2, fW, rcwH); break; }
          case 'fr': { const sW = fW / 3; ctx.fillStyle = "#00209F"; ctx.fillRect(fX, fY, sW, fH); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(fX + sW, fY, sW, fH); ctx.fillStyle = "#F63847"; ctx.fillRect(fX + sW * 2, fY, sW, fH); break; }
          case 'es': { const rH = fH / 4; const yH = fH / 2; ctx.fillStyle = "#C60B1E"; ctx.fillRect(fX, fY, fW, rH); ctx.fillStyle = "#F1BF00"; ctx.fillRect(fX, fY + rH, fW, yH); ctx.fillStyle = "#C60B1E"; ctx.fillRect(fX, fY + rH + yH, fW, rH); break; }
          case 'ru': { const sH = fH / 3; ctx.fillStyle = "#FFFFFF"; ctx.fillRect(fX, fY, fW, sH); ctx.fillStyle = "#0039A6"; ctx.fillRect(fX, fY + sH, fW, sH); ctx.fillStyle = "#D52B1E"; ctx.fillRect(fX, fY + sH * 2, fW, sH); break; }
          case 'ar': { const rW = fW * 0.22; ctx.fillStyle = "#E01E37"; ctx.fillRect(fX, fY, rW, fH); const restW = fW - rW; const sH = fH / 3; ctx.fillStyle = "#107C41"; ctx.fillRect(fX + rW, fY, restW, sH); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(fX + rW, fY + sH, restW, sH); ctx.fillStyle = "#000000"; ctx.fillRect(fX + rW, fY + sH * 2, restW, sH); break; }
          default: { ctx.fillStyle = "#111827"; ctx.fillRect(fX, fY, fW, fH); break; }
        }
        ctx.restore(); globalRenderedSec += 1 / FPS; if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame(); await nextFrame();
      }
      if (sonSozAudioEnd) await sonSozAudioEnd;
      if (yorumAudioEnd) await yorumAudioEnd;
      if (sonSozResult.sourceNode) { try { sonSozResult.sourceNode.stop(); } catch(e){} }
      if (yorumAudioResult?.sourceNode) { try { yorumAudioResult.sourceNode.stop(); } catch(e){} }
      addSystemLog(`Son söz sahnesi render edildi.`, 'success');
    };

    const SAFE_ZONE = { topUnsafe: 0.08, subtitleY: 0.72, bottomUnsafe: 0.78, rightUnsafeStart: 0.86 };
    const renderScene = async (imgObj, text, audioData, duration, isThumbnail = false, isOutro = false, topText = null, slideIndex = -1, chartData = null, transition = 'none', useContain = false, zoomCoords = null) => {
      let startT = performance.now(); const { exactDur, totalDur, audioEndPromise, sourceNode, speechStartSec = 0, speechEndSec = exactDur } = await playAudio(audioData, duration, text);
      let audioEnded = false;
      if (audioEndPromise) audioEndPromise.then(() => { audioEnded = true; });
      const subs = (isThumbnail || isOutro) ? [] : (jobData.config.tip === 'iddia_analizi'
        ? RenderWorkerService.calculateSpeechSyncedSubtitles(text, Math.max(0.1, speechEndSec - speechStartSec), speechStartSec)
        : RenderWorkerService.calculateSubtitles(text, exactDur));
      const totalFrames = Math.max(1, Math.round(totalDur * FPS));
      const transitionFrames = Math.min(8, Math.floor(totalFrames * 0.15));
      const zoomPanSeed = zoomCoords ? { panX: (Math.random() - 0.5) * 20, panY: (Math.random() - 0.5) * 20 } : null;
      for (let frame = 0; frame < totalFrames; frame++) {
        const progress = frame / totalFrames; const elapsedSec = frame / FPS;
        const activeSub = subs.find(s => elapsedSec >= s.startSec && elapsedSec < s.endSec)?.text || "";
        let alpha = 1;
        let offsetX = 0;
        if (transition === 'fadeIn' && frame < transitionFrames) alpha = frame / transitionFrames;
        else if (transition === 'fadeOut' && frame > totalFrames - transitionFrames) alpha = (totalFrames - frame) / transitionFrames;
        else if (transition === 'crossfade' && frame < transitionFrames) alpha = frame / transitionFrames;
        else if (transition === 'slideIn' && frame < transitionFrames) offsetX = w * (1 - frame / transitionFrames);
        else if (transition === 'slideOut' && frame > totalFrames - transitionFrames) offsetX = -w * ((frame - (totalFrames - transitionFrames)) / transitionFrames);
        ctx.save();
        ctx.globalAlpha = alpha;
        if (offsetX !== 0) ctx.translate(offsetX, 0);
        if (imgObj) {
          if (zoomCoords) {
            const z = zoomCoords;
            const zx = (z.x / 100) * imgObj.width;
            const zy = (z.y / 100) * imgObj.height;
            const zw = (z.w / 100) * imgObj.width;
            const zh = (z.h / 100) * imgObj.height;
            const t = progress;
            const zoom = 1.0 + 0.15 * t;
            const panX = zoomPanSeed.panX * t;
            const panY = zoomPanSeed.panY * t;
            ctx.save();
            ctx.translate(w / 2 + panX, h / 2 + panY);
            ctx.scale(zoom, zoom);
            const scale = Math.max(w / zw, h / zh);
            const drawW = zw * scale;
            const drawH = zh * scale;
            ctx.drawImage(imgObj, zx, zy, zw, zh, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          } else if (useContain) {
            RenderWorkerService.drawImageContain(ctx, imgObj, w, h);
          } else {
            RenderWorkerService.drawImageCover(ctx, imgObj, w, h);
          }
        }
        if (chartData && chartData.show && !isThumbnail && !isOutro) {
          RenderWorkerService.drawChartOverlay(ctx, chartData, w, h, fontFamily);
        }
        if (isThumbnail) { RenderWorkerService.drawThumbnail(ctx, imgObj, text, w, h, fontFamily, jobData.config.sourceName, jobData.config); }
        else if (!isOutro) {
          const grad = ctx.createLinearGradient(0, h * 0.45, 0, h); grad.addColorStop(0, "transparent"); grad.addColorStop(1, "rgba(0,0,0,0.95)"); ctx.fillStyle = grad; ctx.fillRect(0, h * 0.45, w, h * 0.55);
          if (topText) {
            let topFontSize = w > 800 ? 46 : 38;
            ctx.font = `900 ${topFontSize}px ${fontFamily}`;
            let lines = RenderWorkerService.wrapText(ctx, topText, w * 0.85);
            const maxLines = jobData.script._isGuzelSoz ? 10 : 5;
            while (lines.length > maxLines && topFontSize > 18) {
              topFontSize -= 2;
              ctx.font = `900 ${topFontSize}px ${fontFamily}`;
              lines = RenderWorkerService.wrapText(ctx, topText, w * 0.85);
            }
            const lh = topFontSize * 1.3;
            const boxH = lines.length * lh + 30;
            const boxW = Math.min(w * 0.92, w * 0.85 + 80);
            const boxX = cx - (boxW / 2);
            const boxY = h * 0.06;
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, 16);
            else ctx.rect(boxX, boxY, boxW, boxH);
            ctx.fill();
            ctx.fillStyle = "#FFD700";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            lines.forEach((line, i) => { ctx.fillText(line.trim(), cx, boxY + (boxH / 2) - ((lines.length - 1) * lh / 2) + (i * lh)); });
          }
          if (jobData.config.sourceName && slideIndex > 0) {
            const srcText = jobData.config.sourceName;
            const srcFontSize = w > 800 ? 50 : 40;
            ctx.font = `900 ${srcFontSize}px 'Inter', Arial`;
            const textW = ctx.measureText(srcText).width;
            const bubbleW = textW + 60;
            const bubbleH = srcFontSize + 40;
            const bubbleX = w - bubbleW - 16;
            const bubbleY = 16;
            ctx.fillStyle = "#DC2626";
            ctx.beginPath();
            const bR = bubbleH / 2;
            ctx.moveTo(bubbleX + bR, bubbleY);
            ctx.lineTo(bubbleX + bubbleW - bR, bubbleY);
            ctx.arc(bubbleX + bubbleW - bR, bubbleY + bR, bR, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(bubbleX + bR, bubbleY + bubbleH);
            ctx.arc(bubbleX + bR, bubbleY + bR, bR, Math.PI / 2, -Math.PI / 2);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(bubbleX + 20, bubbleY + bubbleH);
            ctx.lineTo(bubbleX + 10, bubbleY + bubbleH + 14);
            ctx.lineTo(bubbleX + 35, bubbleY + bubbleH);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(srcText, bubbleX + bubbleW / 2, bubbleY + bubbleH / 2);
          }
          if (activeSub && jobData.config.subtitles !== 'off') { let subFontSize = w > 800 ? 65 : 50; ctx.font = `900 ${subFontSize}px ${fontFamily}`; let displaySub = activeSub.trim(); while (ctx.measureText(displaySub).width > w * 0.95 && subFontSize > 30) { subFontSize -= 2; ctx.font = `900 ${subFontSize}px ${fontFamily}`; } const subTextW = ctx.measureText(displaySub).width; const subPadX = 20; const subPadY = 8; const subBoxW = subTextW + subPadX * 2; const subBoxH = subFontSize + subPadY * 2; const subBoxX = cx - subBoxW / 2; const subBoxY = h * SAFE_ZONE.subtitleY - subBoxH / 2; ctx.fillStyle = "#2563EB"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(subBoxX, subBoxY, subBoxW, subBoxH, 8); else ctx.rect(subBoxX, subBoxY, subBoxW, subBoxH); ctx.fill(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "white"; ctx.fillText(displaySub, cx, h * SAFE_ZONE.subtitleY); }
        }
        if (isOutro) {
          ctx.clearRect(0, 0, w, h);
          if (FIXED_CLICKBAIT_TEMPLATE_IMG && FIXED_CLICKBAIT_TEMPLATE_IMG.complete && FIXED_CLICKBAIT_TEMPLATE_IMG.naturalWidth > 0) {
            ctx.drawImage(FIXED_CLICKBAIT_TEMPLATE_IMG, 0, 0, w, h);
          } else {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#051431');
            grad.addColorStop(0.5, '#082354');
            grad.addColorStop(1, '#031127');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#f4f4f4';
            ctx.fillRect(20 * (w / 941), 16 * (h / 1672), w - 40 * (w / 941), h - 32 * (h / 1672));
          }
          const sx = w / 941;
          const sy = h / 1672;
          ctx.fillStyle = '#f4f4f4';
          ctx.fillRect(90 * sx, 105 * sy, 760 * sx, 470 * sy);
          ctx.fillRect(120 * sx, 95 * sy, 700 * sx, 120 * sy);
          ctx.fillRect(220 * sx, 185 * sy, 500 * sx, 60 * sy);

          const outroQuote1 = 'NE SÖYLENDİĞİNE DEĞİL, NE YAPILDIĞINA BAK';
          const outroQuote2 = 'EYLEMLER KELİMELERDEN DAHA YÜKSEK SESLE KONUŞUR';
          const outroFontFamily = '"Arial Black", "Inter", "Segoe UI", Arial, sans-serif';
          const quotePanelX = 90 * sx;
          const quotePanelY = 105 * sy;
          const quotePanelW = 760 * sx;
          const quotePanelH = 470 * sy;
          const quoteTextW = 690 * sx;
          const quoteCenterX = quotePanelX + (quotePanelW / 2);
          const minScale = Math.min(sx, sy);
          const targetQuoteFont = 33 * minScale;

          const fitOutroQuote = (quote, startFontPx, maxLines = 2) => {
            let fontSize = startFontPx;
            let lines = [];
            while (fontSize >= 22 * minScale) {
              ctx.font = `900 ${fontSize}px ${outroFontFamily}`;
              lines = RenderWorkerService.wrapText(ctx, quote, quoteTextW).filter(Boolean);
              if (lines.length <= maxLines) break;
              fontSize -= 1.0 * minScale;
            }
            if (!lines.length) {
              ctx.font = `900 ${fontSize}px ${outroFontFamily}`;
              lines = [quote];
            }
            const lineHeight = fontSize * 1.08;
            return { lines, fontSize, lineHeight, blockHeight: lineHeight * lines.length };
          };

          const quote1Layout = fitOutroQuote(outroQuote1, targetQuoteFont, 2);
          const quote2Layout = fitOutroQuote(outroQuote2, targetQuoteFont, 2);
          const dividerGap = 12 * sy;
          const sectionGap = 16 * sy;
          const topPadding = 18 * sy;
          const bottomPadding = 18 * sy;
          const totalQuotesHeight = quote1Layout.blockHeight + dividerGap + sectionGap + quote2Layout.blockHeight;
          const usableH = quotePanelH - topPadding - bottomPadding;
          const baseY = quotePanelY + topPadding + Math.max(0, (usableH - totalQuotesHeight) / 2);

          const drawQuoteLines = (layout, topY, color) => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(255,255,255,0.97)';
            ctx.lineJoin = 'round';
            ctx.font = `900 ${layout.fontSize}px ${outroFontFamily}`;
            layout.lines.forEach((line, idx) => {
              const y = topY + idx * layout.lineHeight;
              ctx.lineWidth = Math.max(2.2, layout.fontSize * 0.075);
              ctx.strokeText(line, quoteCenterX, y);
              ctx.fillText(line, quoteCenterX, y);
            });
          };

          const quote1Top = baseY;
          const dividerY = quote1Top + quote1Layout.blockHeight + 8 * sy;
          const quote2Top = dividerY + dividerGap + 8 * sy;

          drawQuoteLines(quote1Layout, quote1Top, '#103183');

          ctx.strokeStyle = '#ff7a00';
          ctx.lineWidth = Math.max(2, 2.2 * minScale);
          ctx.beginPath();
          ctx.moveTo(quoteCenterX - 82 * sx, dividerY);
          ctx.lineTo(quoteCenterX - 18 * sx, dividerY);
          ctx.moveTo(quoteCenterX + 18 * sx, dividerY);
          ctx.lineTo(quoteCenterX + 82 * sx, dividerY);
          ctx.stroke();
          ctx.fillStyle = '#ff7a00';
          ctx.beginPath();
          ctx.arc(quoteCenterX, dividerY, Math.max(3, 4.0 * minScale), 0, Math.PI * 2);
          ctx.fill();

          drawQuoteLines(quote2Layout, quote2Top, '#ff6f00');
        }

        ctx.restore();
        globalRenderedSec += 1 / FPS; if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame(); await nextFrame();
      }
      if (sourceNode && !audioEnded) {
        if (jobData.config.tip === 'iddia_analizi' && audioEndPromise) { try { await audioEndPromise; } catch(e) {} }
        else { try { sourceNode.stop(); } catch(e) {} }
      }
      addSystemLog(`Sahne ${isThumbnail ? 'kapak' : isOutro ? 'kapanış' : slideIndex} render edildi.`, 'success');
    };

    try {
      let bgmSource, bgmNode, masterGain;
      let bgmInitialized = false;
      const loadBGM = async (musicId) => {
        if (bgmSource) { try { bgmSource.stop(); bgmSource.disconnect(); } catch(e) { ErrorHandler.silent(e); } }
        if (bgmNode) { try { bgmNode.disconnect(); } catch(e) { ErrorHandler.silent(e); } }
        if (masterGain) { try { masterGain.disconnect(); } catch(e) { ErrorHandler.silent(e); } }
        bgmSource = null; bgmNode = null; masterGain = null;
        if (!musicId || musicId === 'none') return;
        const ambientTypes = ['rain', 'wind', 'waves', 'fire'];
        if (ambientTypes.includes(musicId)) {
          const ambientObj = AmbientAudioService.getAmbientNode(audioCtx, musicId);
          if (ambientObj) {
            bgmSource = ambientObj.source;
            bgmNode = ambientObj.gainNode;
            masterGain = audioCtx.createGain();
            masterGain.gain.value = DEFAULT_BGM_VOLUME;
            bgmNode.connect(masterGain);
            masterGain.connect(audioDest);
          }
        } else {
          try {
            const track = await AssetManagerService.getMusicFromLib(musicId);
            if (track && track.data) {
              const blob = _base64ToBlob(track.data);
              const musicUrl = ObjectURLManager.create(blob);
              const res = await fetch(musicUrl);
              const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
              if (!bgmInitialized) { bgmSource = audioCtx.createBufferSource(); bgmSource.buffer = buf; bgmSource.loop = true; bgmInitialized = true; }
              masterGain = audioCtx.createGain();
              masterGain.gain.value = DEFAULT_BGM_VOLUME;
              bgmSource.connect(masterGain); masterGain.connect(audioDest); bgmSource.start(0);
            }
          } catch (e) { console.warn("Müzik okunamadı", e); }
        }
      };
      const initialBgmId = jobData.script._bgmId || preferences.ambientSound || 'none';
      addSystemLog(`Render BGM: ${initialBgmId} (script._bgmId: ${jobData.script._bgmId || 'yok'})`, 'info');
      await loadBGM(initialBgmId);
      const tImg = await NetworkUtils.loadImage(jobData.assets.thumbnail);
      const customOutroData = await AssetManagerService.loadMedia('CUSTOM_OUTRO');
      const outroImg = await NetworkUtils.loadImage(customOutroData || jobData.assets.outroImage);

      // 1) Önce gerçek clickbait kapağını canvas'a çiz.
      if (tImg) {
        RenderWorkerService.drawThumbnail(
          ctx,
          tImg,
          jobData.script.thumbnailText,
          w,
          h,
          fontFamily,
          jobData.config.sourceName,
          jobData.config
        );
      } else {
        // Thumbnail kaynağı beklenmedik şekilde yoksa bile siyah kare bırakma.
        ctx.fillStyle = '#f4f4f4';
        ctx.fillRect(0, 0, w, h);
      }

      // 2) Sosyal medya CFR kodlamasında kullanılmak üzere TAM RENDER edilmiş
      // clickbait karesini sakla; ham arka planı değil.
      try {
        jobData.assets._renderedClickbaitFrame = canvasElement.toDataURL('image/jpeg', 0.97);
      } catch (e) {
        jobData.assets._renderedClickbaitFrame = null;
        ErrorHandler.silent(e);
      }

      // 3) Stream'i ancak kapak çizildikten sonra oluştur.
      stream = canvasElement.captureStream(0);
      videoTrack = stream.getVideoTracks()[0];
      const audioTracks = audioDest ? audioDest.stream.getAudioTracks() : [];
      combinedStream = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);

      // 4) MediaRecorder başlamadan encoder track'ini clickbait karesiyle prime et.
      const preRecorderPrimeFrames = 4;
      for (let pf = 0; pf < preRecorderPrimeFrames; pf++) {
        if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
        await nextFrame();
      }

      addSystemLog(
        `✓ REGRESSION GUARD v1.27: captureStream clickbait kapağından başlatıldı; siyah 0. kare engellendi.`,
        'success'
      );

      let videoFileHandle = null;
      let videoWritable = null;
      let videoChunks = [];
      const useFileStreaming = async () => {
        try {
          if (!window.showSaveFilePicker) return false;
          videoFileHandle = await window.showSaveFilePicker({
            suggestedName: `otonom_${Date.now()}.webm`,
            types: [{ description: 'Video', accept: { 'video/webm': ['.webm'], 'video/mp4': ['.mp4'] } }]
          });
          videoWritable = await videoFileHandle.createWritable();
          return true;
        } catch (e) {
          addSystemLog('Dosya akışı başlatılamadı, bellek içinde kayıt kullanılacak: ' + e.message, 'warn');
          return false;
        }
      };
      const streamingEnabled = await useFileStreaming();
      const recorder = new MediaRecorder(combinedStream, { mimeType, audioBitsPerSecond: 192000, videoBitsPerSecond: 4000000 });
      if (streamingEnabled && videoWritable) {
        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0) {
            try { await videoWritable.write(e.data); } catch (err) { addSystemLog('Akış yazma hatası: ' + err.message, 'error'); }
          }
        };
      } else {
        recorder.ondataavailable = e => { if (e.data && e.data.size > 0) videoChunks.push(e.data); };
      }
      recorder.start(100);
      // Kapak kararması koruması: MediaRecorder başladıktan SONRA da ilk gerçek kareleri
      // clickbait kapağı olarak zorla kaydet. Böylece MP4/CFR dönüşümünde veya sosyal medya
      // thumbnail seçiminde ilk kare siyah olamaz.
      RenderWorkerService.drawThumbnail(ctx, tImg, jobData.script.thumbnailText, w, h, fontFamily, jobData.config.sourceName, jobData.config);
      const coverPrimerFrames = Math.max(12, Math.round(FPS * 0.60));
      for (let cf = 0; cf < coverPrimerFrames; cf++) {
        if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
        globalRenderedSec += 1 / FPS;
        await nextFrame();
      }
      sysEventBus.emit('PROGRESS', { step: 'RENDER', percent: 10, text: 'Clickbait Kapak Oluşturuluyor...' });
      const fixedKapakRenderDur = (jobData.config.tip === 'iddia_analizi' || jobData.script._muteNarration) ? (rawKapakDur / Math.max(scaleFactor, 0.01)) : rawKapakDur;
      // Açılış kapağında transition kullanma: thumbnail kareleri her zaman tam opak kalsın.
      await renderScene(tImg, jobData.script.thumbnailText, jobData.assets.thumbnailAudio, fixedKapakRenderDur, true, false, null, 0, null, 'none');
      const slideIsCustom = [];
      const blocks = jobData.script.imageBlocks || [];
      let gIdx = 0;
      for (const block of blocks) {
        if (block.imageType === 'custom') slideIsCustom[gIdx] = true;
        gIdx += block.videoSlides.length;
      }
      for (let i = 0; i < jobData.script.videoSlides.length; i++) {
        const slide = jobData.script.videoSlides[i];
        sysEventBus.emit('PROGRESS', { step: 'RENDER', percent: Math.min(80, 20 + ((i + 1) / jobData.script.videoSlides.length) * 60), text: `Sahne ${i + 1} Render Ediliyor...` });
        const isBasliklarScene = slide._isBasliklarList && slide._basliklar;
        const sImg = isBasliklarScene ? null : (slide._isRawMedia ? null : (await NetworkUtils.loadImage(jobData.assets.images[i]) || tImg));
        const isCustomImg = !!slideIsCustom[i];
        if (slide._isRawMedia && jobData.script._originalMedia) {
          const rawMedia = jobData.script._originalMedia[slide._rawMediaIndex || 0];
          if (!rawMedia) { addSystemLog('Raw medya bulunamadı, atlanıyor.', 'warn'); }
          else {
            const isVideo = rawMedia.type && rawMedia.type.startsWith('video');
            const isAudio = rawMedia.type && rawMedia.type.startsWith('audio');
            addSystemLog(`Raw medya oynatılıyor: ${isVideo ? 'video' : 'audio'} (kesiksiz, sesli)`, 'info');
            const rawBlob = _base64ToBlob(rawMedia.data);
            const rawUrl = ObjectURLManager.create(rawBlob);
            const rawEl = document.createElement(isVideo ? 'video' : 'audio');
            rawEl.src = rawUrl; rawEl.muted = false; rawEl.playsInline = true;
            rawEl.crossOrigin = 'anonymous';
            await new Promise((res) => { rawEl.onloadedmetadata = res; });
            const rawDur = isFinite(rawEl.duration) ? rawEl.duration : (rawMediaDurations[i] || 10.0);
            const rawTotalFrames = Math.max(1, Math.round(rawDur * FPS));
            let rawSourceNode = null; let rawGainNode = null;
            try {
              rawSourceNode = audioCtx.createMediaElementSource(rawEl);
              rawGainNode = audioCtx.createGain();
              rawGainNode.gain.value = preferences?.narratorVolume ?? 0.8;
              rawSourceNode.connect(rawGainNode);
              rawGainNode.connect(audioDest);
              rawGainNode.connect(audioCtx.destination);
            } catch(e) {
              addSystemLog('Raw ses route edilemedi (fallback: direct play): ' + e.message, 'warn');
            }
            rawEl.play().catch(e => { addSystemLog('Raw medya oynatılamadı: ' + e.message, 'warn'); });
            for (let frame = 0; frame < rawTotalFrames; frame++) {
              if (isVideo) {
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
                RenderWorkerService.drawImageCover(ctx, rawEl, w, h);
              } else {
                ctx.fillStyle = '#0B0F19'; ctx.fillRect(0, 0, w, h);
              }
              if (slide.topText) {
                ctx.font = `900 ${w > 800 ? 46 : 38}px ${fontFamily}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const grad = ctx.createLinearGradient(0, h * 0.03, 0, h * 0.12);
                grad.addColorStop(0, 'rgba(0,0,0,0.9)'); grad.addColorStop(1, 'rgba(0,0,0,0.6)');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h * 0.14);
                ctx.fillStyle = '#FFD700'; ctx.fillText(slide.topText, cx, h * 0.07);
              }
              ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
              ctx.fillRect(0, 0, w, h * 0.06);
              ctx.fillRect(0, h * 0.94, w, h * 0.06);
              globalRenderedSec += 1 / FPS;
              if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
              await nextFrame();
            }
            rawEl.pause();
            if (rawSourceNode) { try { rawSourceNode.disconnect(); } catch(e){} }
            if (rawGainNode) { try { rawGainNode.disconnect(); } catch(e){} }
            addSystemLog(`Raw ${isVideo ? 'video' : 'audio'} oynatımı tamamlandı (${rawDur.toFixed(1)}sn).`, 'success');
            ObjectURLManager.revoke(rawUrl);
          }
        } else if (slide._isBasliklarList && slide._basliklar) {
          const { exactDur, totalDur, audioEndPromise } = await playAudio(jobData.assets.audio[i], null, slide.spokenText);
          const totalFrames = Math.max(1, Math.round(totalDur * FPS));
          for (let frame = 0; frame < totalFrames; frame++) {
            const elapsedSec = frame / FPS;
            const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
            bgGrad.addColorStop(0, '#0a0015');
            bgGrad.addColorStop(0.4, '#1a0533');
            bgGrad.addColorStop(1, '#050010');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);
            const titleFontSize = w > 800 ? 60 : 45;
            ctx.font = `900 ${titleFontSize}px ${fontFamily}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = 'rgba(255, 165, 0, 0.6)'; ctx.shadowBlur = 20;
            ctx.fillText(slide.topText, cx, h * 0.08);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#E30A17'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.12); ctx.lineTo(w * 0.9, h * 0.12); ctx.stroke();
            const basliklar = slide._basliklar;
            let listFontSize = w > 800 ? 42 : 32;
            ctx.font = `700 ${listFontSize}px ${fontFamily}`;
            const availableH = h * 0.75;
            let totalLines = 0;
            basliklar.forEach(b => { totalLines += RenderWorkerService.wrapText(ctx, b.baslik, w * 0.85).length + 0.5; });
            while (totalLines * listFontSize * 1.6 > availableH && listFontSize > 18) {
              listFontSize -= 2; ctx.font = `700 ${listFontSize}px ${fontFamily}`;
              totalLines = 0; basliklar.forEach(b => { totalLines += RenderWorkerService.wrapText(ctx, b.baslik, w * 0.85).length + 0.5; });
            }
            const finalLineHeight = listFontSize * 1.6;
            let currentY = h * 0.16;
            basliklar.forEach((b, idx) => {
              ctx.font = `900 ${listFontSize}px ${fontFamily}`; ctx.fillStyle = '#E30A17'; ctx.textAlign = 'left';
              ctx.fillText(`${idx + 1}.`, w * 0.05, currentY);
              ctx.font = `700 ${listFontSize}px ${fontFamily}`; ctx.fillStyle = '#FFFFFF';
              const lines = RenderWorkerService.wrapText(ctx, b.baslik, w * 0.8);
              lines.forEach((line, lineIdx) => { ctx.fillText(line, w * 0.1, currentY + lineIdx * finalLineHeight); });
              currentY += lines.length * finalLineHeight + finalLineHeight * 0.5;
            });
            globalRenderedSec += 1 / FPS;
            if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
            await nextFrame();
          }
          if (audioEndPromise) await audioEndPromise;
          addSystemLog(`BAŞLIKLAR sahnesi render edildi.`, 'success');
        } else if (slide._isKaynaklar && slide._kaynaklar) {
          const { exactDur, totalDur, audioEndPromise } = await playAudio(jobData.assets.audio[i], null, slide.spokenText);
          const totalFrames = Math.max(1, Math.round(totalDur * FPS));
          for (let frame = 0; frame < totalFrames; frame++) {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, w, h);
            ctx.font = `900 ${w > 800 ? 50 : 38}px ${fontFamily}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#E30A17';
            ctx.fillText('KAYNAKLAR', cx, h * 0.06);
            ctx.strokeStyle = '#E30A17'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.09); ctx.lineTo(w * 0.9, h * 0.09); ctx.stroke();
            const kaynaklar = slide._kaynaklar;
            let listFontSize = w > 800 ? 28 : 22;
            ctx.font = `700 ${listFontSize}px ${fontFamily}`;
            let currentY = h * 0.13;
            kaynaklar.forEach((k, idx) => {
              ctx.fillStyle = '#FFD700';
              ctx.textAlign = 'left';
              ctx.font = `700 ${listFontSize}px ${fontFamily}`;
              ctx.fillText(`${idx + 1}. ${k.baslik}`, w * 0.05, currentY);
              currentY += listFontSize * 1.2;
              ctx.fillStyle = '#60A5FA';
              ctx.font = `400 ${listFontSize * 0.8}px ${fontFamily}`;
              ctx.fillText(k.url, w * 0.08, currentY);
              currentY += listFontSize * 1.0;
              if (k.tarih) {
                ctx.fillStyle = '#9CA3AF';
                ctx.font = `400 ${listFontSize * 0.7}px ${fontFamily}`;
                ctx.fillText(k.tarih, w * 0.08, currentY);
                currentY += listFontSize * 0.8;
              }
              currentY += listFontSize * 0.5;
            });
            globalRenderedSec += 1 / FPS;
            if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame();
            await nextFrame();
          }
          if (audioEndPromise) await audioEndPromise;
          addSystemLog('KAYNAKLAR sahnesi render edildi.', 'success');
        } else {
          const gazeteFullPage = !!(jobData.script._isGazeteOkuma || jobData.script._forceGazeteImageOnly);
          await renderScene(
            sImg,
            slide.spokenText,
            jobData.assets.audio[i],
            rawSlideSecs[i],
            false,
            false,
            slide.topText,
            i + 1,
            jobData.script.chartData,
            jobData.config.transition,
            gazeteFullPage ? true : isCustomImg,
            gazeteFullPage ? null : (slide._zoomCoords || null)
          );
        }
        if (i >= RENDER_CONFIG.WINDOW_SIZE) {
          const releaseIdx = i - RENDER_CONFIG.WINDOW_SIZE;
          jobData.assets.images[releaseIdx] = null;
          jobData.assets.audio[releaseIdx] = null;
        }
      }
      // v1.32 SON SÖZ KURALI:
      // - Güzel Söz akışında Son Söz YOK.
      // - Haber/Gazete/diğer haber tabanlı video akışlarında sonSoz varsa MUTLAKA render edilir.
      // Önceki "slide metnine benziyor" duplicate filtresi Son Söz sahnesini yanlışlıkla
      // tamamen kaldırabiliyordu; bu kontrol artık kapanış sahnesini engellemez.
      const shouldRenderSonSoz =
        jobData.config.tip !== 'guzel_soz' &&
        !!String(jobData.script.sonSoz || '').trim();

      if (shouldRenderSonSoz) {
        const fixedSonSozDur =
          (jobData.config.tip === 'iddia_analizi' || jobData.script._muteNarration)
            ? (rawSonSozDur / Math.max(scaleFactor, 0.01))
            : rawSonSozDur;

        sysEventBus.emit('PROGRESS', {
          step: 'RENDER',
          percent: 85,
          text: 'Son Söz Sahnesi Render Ediliyor...'
        });

        addSystemLog(
          `✓ FIX CHECKLIST v1.32: Son Söz Haber/Gazete kapanışında zorunlu render ediliyor.`,
          'success'
        );

        await renderSonSozScene(
          jobData.script.sonSoz,
          jobData.script.sonSozKaynak,
          jobData.assets.sonSozAudio,
          fixedSonSozDur
        );
      }
      { const fadeFrames = Math.round(0.5 * FPS); for (let fi = 0; fi < fadeFrames; fi++) { const fadeAlpha = fi / fadeFrames; ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`; ctx.fillRect(0, 0, w, h); globalRenderedSec += 1 / FPS; if (videoTrack && videoTrack.requestFrame) videoTrack.requestFrame(); await nextFrame(); } }
      { const fixedOutroDur = (jobData.config.tip === 'iddia_analizi' || jobData.script._muteNarration) ? (rawOutroDur / Math.max(scaleFactor, 0.01)) : rawOutroDur; sysEventBus.emit('PROGRESS', { step: 'RENDER', percent: 90, text: 'Kapanış Render Ediliyor...' }); await renderScene(outroImg, jobData.script.lastQuote, jobData.assets.outroAudio, fixedOutroDur, false, true, null, 99, null, jobData.config.transition); }
      if (bgmSource) { try { bgmSource.stop(); bgmSource.disconnect(); } catch(e) { ErrorHandler.silent(e); } } if (bgmNode) { try { bgmNode.disconnect(); } catch(e) { ErrorHandler.silent(e); } } if (masterGain) { try { masterGain.disconnect(); } catch(e) { ErrorHandler.silent(e); } }
      silentOsc.stop(); silentOsc.disconnect(); keepAliveOsc.stop(); keepAliveOsc.disconnect(); keepAliveGain.disconnect();
      try { const totalFrames = Math.floor(rawCushion * scaleFactor * FPS); for (let i = 0; i < totalFrames; i++) { if (useForceExact && globalRenderedSec >= limitSec) break; globalRenderedSec += 1 / FPS; await nextFrame(); } } catch (e) { console.warn("Kapanış bekleme hatası:", e); }
      timerWorker.postMessage('stop'); timerWorker.terminate();
      if (streamingEnabled && videoWritable) {
        return new Promise((resolve, reject) => {
          recorder.onstop = async () => {
            try {
              await videoWritable.close();
              addSystemLog('Video dosyaya akıtıldı: ' + videoFileHandle.name, 'success');
              const file = await videoFileHandle.getFile();
              resolve({ url: ObjectURLManager.create(file), blobType: file.type, fileHandle: videoFileHandle });
            } catch (err) {
              addSystemLog('Dosya kapatma hatası: ' + err.message, 'error');
              reject(new Error(`Video kaydetme hatası: ${err.message}`));
            }
          };
          if (recorder.state !== 'inactive') {
            try { recorder.requestData(); } catch(e) { ErrorHandler.silent(e); }
            setTimeout(() => recorder.stop(), 100);
          }
        });
      } else {
        return new Promise((resolve, reject) => {
          recorder.onstop = () => {
            const blob = new Blob(videoChunks, { type: mimeType });
            videoChunks = [];
            if (blob.size === 0) return reject(new Error("Video oluşturulamadı (0 Bayt)."));
            resolve({ url: ObjectURLManager.create(blob), blobType: blob.type });
          };
          if (recorder.state !== 'inactive') {
            try { recorder.requestData(); } catch(e) { ErrorHandler.silent(e); }
            setTimeout(() => recorder.stop(), 100);
          }
        });
      }
    } catch (e) { if (typeof timerWorker !== 'undefined') timerWorker.terminate(); throw new Error(`Render failed: ${e.message}`); }
  }
};

// ============================================================================
// M9: WORKFLOW COORDINATOR (Firebase içermez — orijinal korunur)
// ============================================================================
class WorkflowCoordinator {
  constructor() { this.jobId = null; this.state = {}; }

  async updateProgress(percent, text, step) {
    const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
    this.state.progress = safePercent;
    this.state.statusText = text;
    await AssetManagerService.saveJobState(this.state);
    sysEventBus.emit('PROGRESS', { step, percent: safePercent, text });
  }

  async startWorkflow(inputData, inputType, config, preferences, canvasRef) {
    this.jobId = "job_" + Date.now();
    const customImages = config._gazeteDirectClick
      ? [config._gazeteImageLock].filter(Boolean)
      : (config.customSceneImages || []);
    const uploadedMedia = (inputType === 'media' && Array.isArray(inputData))
      ? (config._gazeteDirectClick ? inputData.slice(0, 1) : inputData)
      : [];
    const allImages = [];

    if (config._gazeteDirectClick) {
      config.sourceName = config._gazeteSourceLock || config.sourceName || '';
      config.customSceneImages = [...customImages];
      addSystemLog(`Gazete job kilidi: kaynak="${config.sourceName}", medya=1, sabit görsel=1.`, 'success');
    }
    if (customImages.length > 0 && uploadedMedia.length > 0) {
      const pairCount = Math.min(customImages.length, uploadedMedia.length, 10);
      for (let i = 0; i < pairCount; i++) {
        allImages.push({ type: 'custom', data: customImages[i], mediaItem: uploadedMedia[i] });
      }
      addSystemLog(`Eşleştirme: ${pairCount} blok (S1+M1, S2+M2, ...)`, 'info');
    } else if (customImages.length > 0) {
      for (const img of customImages) allImages.push({ type: 'custom', data: img });
    } else {
      for (const m of uploadedMedia) allImages.push({ type: 'uploaded', data: m });
    }
    this.state = { jobId: this.jobId, status: 'INIT', inputData, inputType, config, preferences,
      script: { imageBlocks: [], thumbnailText: '', lastQuote: '', sonSoz: '', sonSozKaynak: '', thumbnailImagePrompt: '', _isGuzelSoz: false },
      assets: { images: [], audio: [], thumbnail: null, thumbnailAudio: null, sonSozAudio: null, yorumAudio: null, outroAudio: null, blackoutAudio: null },
      imageQueue: allImages, processedImageCount: 0, progress: 0 };
    await AssetManagerService.saveJobState(this.state);
    return this.resumeWorkflow(canvasRef);
  }

  async resumeWorkflow(canvasRef) {
    try {
      if (!this.state || !this.state.jobId) { const saved = await AssetManagerService.getPendingJob(); if (saved) this.state = saved; else throw new Error("Bekleyen işlem bulunamadı."); }
      if (this.state.config?._gazeteDirectClick) {
        this.state.config.sourceName = this.state.config._gazeteSourceLock || this.state.config.sourceName || '';
      }
      sysEventBus.emit('WORKFLOW_STATE', { status: 'RUNNING', job: this.state });
      if (this.state.status === 'INIT') {
        if (this.state.config.tip === 'guzel_soz' || this.state.config.tip === 'iddia_analizi') {
          let startT = performance.now();
          const tipLabel = this.state.config.tip === 'iddia_analizi' ? 'İddia Analizi' : 'Güzel Söz';
          await this.updateProgress(10, `${tipLabel} yapılıyor...`, 'LOGIC');
          const script = await LogicEngineService.analyzeContent(this.state.inputData, this.state.inputType, this.state.config);
          this.state.script = script;
          if (this.state.config.tip === 'iddia_analizi') {
            this.state.script._muteNarration = false;
            this.state.script._preferAiVisualExplainer = true;
            addSystemLog('İddia analizi modu: Clickbait kapak + yüklenen/yerel görsel + cümle-cümle doğrulama + ses ve altyazı aktif.', 'success');
          }
          this.state.status = 'GENERATING_ASSETS';
          await AssetManagerService.saveJobState(this.state);
          addSystemLog(`${tipLabel} tamamlandı (${((performance.now() - startT) / 1000).toFixed(1)}s).`, 'success');
        } else if (this.state.inputType === 'text' || this.state.inputType === 'url' || this.state.inputType === 'prompt') {
          let startT = performance.now();
          await this.updateProgress(10, 'İçerik analiz ediliyor...', 'LOGIC');
          const script = await LogicEngineService.analyzeContent(this.state.inputData, this.state.inputType, this.state.config);
          this.state.script = script;
          this.state.status = 'GENERATING_ASSETS';
          await AssetManagerService.saveJobState(this.state);
          addSystemLog(`İçerik analizi tamamlandı (${((performance.now() - startT) / 1000).toFixed(1)}s).`, 'success');
        } else {
          const queue = this.state.imageQueue || [];
          const totalImages = queue.length;
          if (totalImages === 0) throw new Error("İşlenecek görsel bulunamadı. Lütfen en az bir sabit görsel veya medya yükleyin.");
          addSystemLog(`Toplam ${totalImages} görsel işlenecek.`, 'info');
          let previousContext = "";
          for (let i = this.state.processedImageCount || 0; i < totalImages; i++) {
            const imgItem = queue[i];
            const blockNum = i + 1;
            await this.updateProgress(5 + (blockNum / totalImages) * 35, `Blok ${blockNum}/${totalImages} analiz ediliyor...`, 'LOGIC');
            let blockResult;
            try {
              if (imgItem.type === 'custom' && imgItem.mediaItem) {
                blockResult = await LogicEngineService.analyzeContentForImage([imgItem.mediaItem], 'media', this.state.config, i, totalImages, previousContext);
              } else if (imgItem.type === 'custom' && imgItem.data) {
                blockResult = await LogicEngineService.analyzeContentForImage([{ data: imgItem.data, type: 'image/png' }], 'media', this.state.config, i, totalImages, previousContext);
              } else if (imgItem.type === 'uploaded' && imgItem.data) {
                blockResult = await LogicEngineService.analyzeContentForImage([imgItem.data], 'media', this.state.config, i, totalImages, previousContext);
              } else {
                blockResult = await LogicEngineService.analyzeContentForImage(this.state.inputData, this.state.inputType, this.state.config, i, totalImages, previousContext);
              }
            } catch (e) { if (isFreeTierStop(e)) throw e;
              addSystemLog(`Blok ${blockNum} analiz hatası: ${e.message}`, 'error');
              blockResult = { videoSlides: [], thumbnailText: '', thumbnailImagePrompt: '' };
            }
            if (i === 0) {
              if (!this.state.script.thumbnailText) { this.state.script.thumbnailText = blockResult.thumbnailText || ''; }
              this.state.script.thumbnailImagePrompt = blockResult.thumbnailImagePrompt || '';
            }
            if (blockResult.sonSoz) { this.state.script.sonSoz = blockResult.sonSoz; this.state.script.sonSozKaynak = blockResult.sonSozKaynak || ''; }
            if (blockResult.kaynaklar && blockResult.kaynaklar.length > 0) {
              this.state.script._kaynaklar = blockResult.kaynaklar;
              addSystemLog(`${blockResult.kaynaklar.length} kaynak eklendi.`, 'success');
            }
            if (blockResult.lastQuote) this.state.script.lastQuote = blockResult.lastQuote;
            if (!blockResult.gazeteBasliklari || blockResult.gazeteBasliklari.length === 0) {
              this.state.script.imageBlocks.push({
                imageIndex: i, imageType: imgItem.type,
                customImage: imgItem.type === 'custom' ? imgItem.data : (imgItem.data?.type?.startsWith('image/') ? imgItem.data.data : null),
                videoSlides: blockResult.videoSlides || []
              });
            } else {
              addSystemLog(`Görsel ${blockNum}: gazete başlıkları var, normal sahneler atlandı.`, 'info');
            }
            if (blockResult.gazeteBasliklari && blockResult.gazeteBasliklari.length > 0) {
              if (!this.state.script._allBasliklar) this.state.script._allBasliklar = [];
              blockResult.gazeteBasliklari.forEach(b => { this.state.script._allBasliklar.push({ ...b, _imgIdx: i }); });
              addSystemLog(`Görsel ${blockNum}: ${blockResult.gazeteBasliklari.length} başlık çıkarıldı.`, 'success');
            }
            const slideTexts = (blockResult.videoSlides || []).map(s => s.spokenText).join(' ');
            previousContext = `Blok ${blockNum}: ${slideTexts.substring(0, 200)}...`;
            this.state.processedImageCount = i + 1;
            await AssetManagerService.saveJobState(this.state);
            addSystemLog(`Blok ${blockNum}/${totalImages} tamamlandı (${(blockResult.videoSlides || []).length} sahne).`, 'success');
          }
          const allBasliklar = this.state.script._allBasliklar || [];
          if (allBasliklar.length >= 1) {
            const allHeadlines = allBasliklar.map(b => b.baslik).join('. ');
            try {
              const clickbaitUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
              const clickbaitPayload = {
                contents: [{ parts: [{ text: `Bu haber başlıklarından en etkileyici, merak uyandıran ama yanıltıcı olmayan tek başlık oluştur (maksimum 4 kelime, büyük harfler). Gazete adını, kaynak adını veya yayın adını başlığa tekrar dahil etme. 'Şok', 'skandal', 'ifşa', 'gizliyorlar' gibi sansasyonel kalıpları kullanma; sadece doğrulanabilir haber başlığını yaz:\n${allHeadlines}\nSADECE başlığı yaz, başka bir şey yazma.` }] }],
                generationConfig: { temperature: 0.9, maxOutputTokens: 50 }
              };
              const cr = await NetworkUtils.fetchWithRetry(clickbaitUrl, { method: 'POST', body: JSON.stringify(clickbaitPayload) });
              if (cr) {
                const cd = await cr.json();
                const clickbaitText = cd.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                if (clickbaitText) {
                  this.state.script.thumbnailText = clickbaitText.toUpperCase();
                  addSystemLog(`Ortak clickbait başlık: "${clickbaitText}"`, 'success');
                }
              }
            } catch (e) { if (isFreeTierStop(e)) throw e; addSystemLog(`Clickbait API hatası: ${e.message}`, 'warn'); }
            if (!this.state.script.thumbnailText || this.state.script.thumbnailText.length < 5) {
              const headlines = allBasliklar.map(function(b) { return b.baslik; });
              const longest = headlines.reduce(function(a, b) { return a.length > b.length ? a : b; }, '');
              this.state.script.thumbnailText = longest.toUpperCase();
              addSystemLog('Fallback clickbait: ' + longest, 'info');
            }
            this.state.script._isGazeteOkuma = true;
            allBasliklar.forEach((baslik, idx) => {
              const imgIdx = baslik._imgIdx != null ? baslik._imgIdx : 0;
              const srcItem = queue[imgIdx] || queue[0];
              const srcImg =
                (typeof srcItem?.data === "string" ? srcItem.data : null) ||
                (typeof srcItem?.data?.data === "string" ? srcItem.data.data : null) ||
                (typeof srcItem?.customImage === "string" ? srcItem.customImage : null) ||
                (typeof srcItem?.mediaItem?.data === "string" ? srcItem.mediaItem.data : null);
              this.state.script.imageBlocks.push({
                imageIndex: imgIdx, imageType: 'custom', customImage: srcImg,
                videoSlides: [{ topText: baslik.baslik.toUpperCase(), spokenText: `${baslik.baslik}. ${baslik.aciklama || ''}`.trim(), imagePrompts: [] }]
              });
            });
            addSystemLog(`BAŞLIKLAR sayfası oluşturuldu: ${allBasliklar.length} başlık.`, 'success');
          } else {
            addSystemLog('Tek başlık, BAŞLIKLAR sayfası atlandı.', 'info');
          }
          if (this.state.config.tip !== 'haber' && this.state.script._kaynaklar && this.state.script._kaynaklar.length > 0) {
            const kaynaklarSpoken = "Kaynaklar ve referanslar. " + this.state.script._kaynaklar.map(k => k.baslik).join('. ') + ".";
            this.state.script.imageBlocks.push({
              imageIndex: 0, imageType: 'ai', customImage: null,
              videoSlides: [{ topText: 'KAYNAKLAR', spokenText: kaynaklarSpoken, imagePrompts: ['A clean list of official sources and references on dark background'], _isKaynaklar: true, _kaynaklar: this.state.script._kaynaklar }]
            });
            addSystemLog('Kaynaklar sahnesi eklendi.', 'success');
          }
          if (this.state.script && this.state.script.iddialar && this.state.script.iddialar.length > 0) {
            const allKaynaklar = [];
            const kaynakSet = new Set();
            this.state.script.iddialar.forEach(function(iddia) {
              if (iddia.kanitlar) {
                iddia.kanitlar.forEach(function(k) {
                  const key = (k.kaynak || '') + '|' + (k.veri || '');
                  if (k.kaynak && !kaynakSet.has(key)) {
                    kaynakSet.add(key);
                    allKaynaklar.push({ kaynak: k.kaynak, veri: k.veri || '', url: k.url || '' });
                  }
                });
              }
            });
            if (allKaynaklar.length > 0) {
              const kaynaklarSpoken = "Kaynaklar ve referanslar. " + allKaynaklar.map(function(k) { let s = k.kaynak; if (k.veri) s += ": " + k.veri; return s; }).join(". ") + ".";
              const kaynaklarTopText = allKaynaklar.length > 5 ? 'KAYNAKLAR VE REFERANSLAR' : 'KAYNAKLAR';
              this.state.script.imageBlocks.push({
                imageIndex: 0, imageType: 'ai', customImage: null,
                videoSlides: [{ topText: kaynaklarTopText, spokenText: kaynaklarSpoken, imagePrompts: ['Professional infographic showing official government sources and data references on dark background, clean typography'], _isKaynaklar: true, _kaynaklar: allKaynaklar }]
              });
              addSystemLog('Kaynaklar sahnesi eklendi: ' + allKaynaklar.length + ' kaynak (veri+URL dahil).', 'success');
            }
          }
          if (this.state.config.forceGazeteImageOnly) {
            const sourceQueueItem = (this.state.imageQueue || [])[0];
            const sourceImage =
              (typeof sourceQueueItem?.data === 'string' ? sourceQueueItem.data : null) ||
              (typeof sourceQueueItem?.data?.data === 'string' ? sourceQueueItem.data.data : null) ||
              (typeof sourceQueueItem?.customImage === 'string' ? sourceQueueItem.customImage : null) ||
              (typeof sourceQueueItem?.mediaItem?.data === 'string' ? sourceQueueItem.mediaItem.data : null);

            this.state.script._isGazeteOkuma = true;
            this.state.script._forceGazeteImageOnly = true;

            // Her mevcut blokta gazete kapağını sabit görsel yap.
            this.state.script.imageBlocks = (this.state.script.imageBlocks || []).map(block => ({
              ...block,
              imageType: 'custom',
              customImage: sourceImage || block.customImage || null,
              videoSlides: (block.videoSlides || []).map(slide => ({
                ...slide,
                imagePrompts: []
              }))
            }));

            // Analyzer gazete başlığı çıkaramadıysa bile AI görsel üretme:
            // mevcut videoSlides varsa tek sabit gazete bloğuna sar.
            if ((!this.state.script.imageBlocks || this.state.script.imageBlocks.length === 0) && Array.isArray(this.state.script.videoSlides) && this.state.script.videoSlides.length) {
              this.state.script.imageBlocks = [{
                imageIndex: 0,
                imageType: 'custom',
                customImage: sourceImage || null,
                videoSlides: this.state.script.videoSlides.map(slide => ({ ...slide, imagePrompts: [] }))
              }];
            }

            addSystemLog('Gazete kart modu kilitlendi: tüm sahneler yalnız gazete kapağını kullanacak, AI görsel kapalı.', 'success');
          }

          this.state.script.videoSlides = [];
          for (const block of this.state.script.imageBlocks) {
            this.state.script.videoSlides.push(...block.videoSlides);
          }
          if (this.state.config?._gazeteDirectClick) {
            const lockedName = this.state.config._gazeteSourceLock || this.state.config.sourceName || '';
            const lockedImage = this.state.config._gazeteImageLock || null;
            this.state.config.sourceName = lockedName;

            if (this.state.script._isGazeteOkuma && lockedImage) {
              this.state.script.imageBlocks = (this.state.script.imageBlocks || []).map(block => ({
                ...block,
                imageType: 'custom',
                customImage: lockedImage,
                videoSlides: (block.videoSlides || []).map(slide => ({ ...slide, imagePrompts: [] }))
              }));
              this.state.script.videoSlides = [];
              for (const block of this.state.script.imageBlocks) this.state.script.videoSlides.push(...block.videoSlides);
              addSystemLog(`REGRESSION GUARD OK: ${lockedName} — tüm sahneler aynı gazete kapağına kilitlendi.`, 'success');
            }
          }
          addSystemLog(`INIT tamamlandı: ${this.state.script.imageBlocks.length} blok, ${this.state.script.videoSlides.length} sahne.`, 'success');
          this.state.status = 'GENERATING_ASSETS';
          await AssetManagerService.saveJobState(this.state);
        }
      }
      // v1.33 SON SÖZ REGRESSION GUARD
      // Güzel Söz hariç video haber/gazete akışında Son Söz boş bırakılamaz.
      if (
        this.state.status === 'GENERATING_ASSETS' &&
        this.state.config.tip !== 'guzel_soz' &&
        this.state.config.outputType !== 'image'
      ) {
        const currentSonSoz = String(this.state.script?.sonSoz || '').trim();

        if (!currentSonSoz) {
          addSystemLog('Son Söz boş geldi — müzikten bağımsız otomatik onarım başlatılıyor...', 'warn');

          const repairContext = [
            this.state.config?.sourceName || '',
            this.state.script?.thumbnailText || '',
            ...(this.state.script?.videoSlides || []).map(s => s?.spokenText || '')
          ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .slice(0, 4500);

          try {
            const repairUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
            const repairPayload = {
              contents: [{
                parts: [{
                  text: `Aşağıdaki haber/gazete içeriğine uygun GERÇEK, doğrulanabilir ve kısa bir "Son Söz" alıntısı seç.

İÇERİK:
${repairContext}

KURALLAR:
- Uydurma alıntı yazma.
- Emin olmadığın sözü kullanma.
- Daha önce kullanılmış sözlerden kaçın:
${buildSonSozHistoryPrompt()}
- Kişi alıntısıysa sonSozKaynak yalnız kişinin adı olsun.
- Film alıntısıysa sonSozKaynak "X filminden" biçiminde olsun.
- SADECE JSON döndür:
{"sonSoz":"alıntı","sonSozKaynak":"kaynak"}`
                }]
              }],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: {
                    sonSoz: { type: "STRING" },
                    sonSozKaynak: { type: "STRING" }
                  },
                  required: ["sonSoz", "sonSozKaynak"]
                },
                temperature: 0.35,
                maxOutputTokens: 300
              }
            };

            const repairResponse = await NetworkUtils.fetchWithRetry(repairUrl, {
              method: 'POST',
              body: JSON.stringify(repairPayload)
            });

            if (repairResponse?.ok) {
              const repairData = await repairResponse.json();
              const repairRaw = repairData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              const repaired = JSON.parse(repairRaw);

              const repairedQuote = String(repaired?.sonSoz || '').trim();
              const repairedSource = String(repaired?.sonSozKaynak || '').trim();

              if (repairedQuote) {
                this.state.script.sonSoz = repairedQuote;
                this.state.script.sonSozKaynak = repairedSource;
                addSystemLog('✓ Son Söz otomatik onarıldı.', 'success');
              }
            }
          } catch (sonSozRepairError) {
            addSystemLog(`Son Söz otomatik onarım uyarısı: ${sonSozRepairError.message}`, 'warn');
          }

          // API onarımı da başarısızsa Haber/Gazete Son Söz sahnesini ASLA atlama.
          if (!String(this.state.script?.sonSoz || '').trim()) {
            this.state.script.sonSoz = 'Gerçekler inatçı şeylerdir.';
            this.state.script.sonSozKaynak = 'John Adams';
            addSystemLog('Son Söz güvenli fallback kullanıldı: John Adams.', 'warn');
          }

          await AssetManagerService.saveJobState(this.state);
        }

        addSystemLog(
          `✓ FIX CHECKLIST v1.33: Son Söz zorunlu alan doğrulandı (${this.state.script.sonSozKaynak || 'kaynak belirtilmedi'}).`,
          'success'
        );
      }

      if (this.state.status === 'GENERATING_ASSETS') {
        if (this.state.config.tip === 'iddia_analizi' && Array.isArray(this.state.script.videoSlides)) {
          const beforeRawCleanup = this.state.script.videoSlides.length;
          this.state.script.videoSlides = this.state.script.videoSlides.filter(slide => !slide?._isRawMedia);
          if (this.state.script.imageBlocks && Array.isArray(this.state.script.imageBlocks)) {
            this.state.script.imageBlocks = this.state.script.imageBlocks.map(block => ({ ...block, videoSlides: (block.videoSlides || []).filter(slide => !slide?._isRawMedia) })).filter(block => block.videoSlides.length > 0);
          }
          delete this.state.script._originalMedia;
          delete this.state.script._originalMediaType;
          if (beforeRawCleanup !== this.state.script.videoSlides.length) addSystemLog('Eski raw medya sahnesi kaldırıldı; İddia Analizi yerel görsel + altyazı akışında.', 'success');
        }
        await this.updateProgress(30, 'Medya ve Sesler Sentezleniyor...', 'ASSETS');
        assertFreeTierAvailable();
        const uploadedImages = sourceImages(this.state);
        const imgStyle = this.state.config.imageStyle || 'cinematic'; const imgRes = this.state.config.resolution || '4K';
        const emotionForImage = this.state.script._emotion || analyzeQuoteEmotion(this.state.script.videoSlides[0]?.spokenText || "");
        if (this.state.script._isGuzelSoz) {
          addSystemLog('Güzel söz modu: görseller ve ses üretiliyor...', 'info');
          const slideCount = this.state.script._sceneCount || 3;
          const quoteTextForImage = this.state.script.videoSlides[0]?.spokenText || "";
          const realUrls = uploadedImages.length ? Array.from({ length: slideCount }, (_, i) => uploadedImages[i % uploadedImages.length]) : (this.state.script._realImageUrls || []);
          for (let i = 0; i < slideCount; i++) {
            const slide = this.state.script.videoSlides[i];
            if (!this.state.assets.images[i]) {
              try {
                if (realUrls[i]) {
                  addSystemLog(`Görsel ${i + 1}: Gerçek görsel kullanılıyor...`, 'info');
                  this.state.assets.images[i] = realUrls[i];
                } else {
                  this.state.assets.images[i] = await MediaSynthesisService.generateImage(
                    slide.imagePrompts?.[0] || "Artistic background", imgStyle, imgRes, true, emotionForImage, quoteTextForImage
                  );
                }
                addSystemLog(`Görsel ${i + 1}/${slideCount} tamamlandı.`, 'success');
              } catch (e) { if (isFreeTierStop(e)) throw e;
                addSystemLog(`Görsel ${i + 1} hatası, fallback kullanılıyor.`, 'warn');
                this.state.assets.images[i] = this.state.assets.thumbnail;
              }
            }
          }
          if (!this.state.assets.audio[0]) {
            const firstLangLabel = String(this.state.script._multilangLabels?.[0] || this.state.config.language || 'auto').toLowerCase();
            this.state.assets.audio[0] = await MediaSynthesisService.generateAudio(
              this.state.script.videoSlides[0].spokenText,
              this.state.preferences.narratorVoice,
              firstLangLabel
            );
          }
          if (this.state.script._isMultilang) {
            for (let mi = 1; mi < slideCount; mi++) {
              const langLabel = this.state.script._multilangLabels?.[mi] || '';
              const spoken = String(this.state.script.videoSlides[mi]?.spokenText || '').trim();

              if (
                langLabel === 'EN' &&
                (!spoken || /^translation unavailable\b/i.test(spoken))
              ) {
                throw new Error('EN seslendirme koruması: İngilizce gerçek çeviri yok; yanlış ses üretimi durduruldu.');
              }

              if (!this.state.assets.audio[mi]) {
                addSystemLog(`Çok dilli ses ${mi + 1}/${slideCount} (${langLabel})...`, 'info');
                this.state.assets.audio[mi] = await MediaSynthesisService.generateAudio(
                  spoken,
                  this.state.preferences.narratorVoice,
                  String(langLabel || 'auto').toLowerCase()
                );

                if (langLabel === 'EN') {
                  addSystemLog('✓ EN gerçek İngilizce metin TTS seslendirmesine gönderildi.', 'success');
                }
              }
            }
          }
          if (!this.state.assets.thumbnail) this.state.assets.thumbnail = this.state.assets.images[0];
          await this.updateProgress(70, 'Güzel söz hazır...', 'ASSETS');
        } else {
          if (this.state.script._isGazeteOkuma) {
            const firstBlock = this.state.script.imageBlocks[0];
            this.state.assets.thumbnail = firstBlock?.customImage || this.state.assets.images[0] || null;
            if (this.state.assets.thumbnail) {
              addSystemLog('Gazete okuma modu: Thumbnail için gazete resmi kullanılıyor (AI görsel atlandı).', 'info');
            } else {
              addSystemLog('Gazete okuma modu: gazete resmi bulunamadı. AI görsel üretilmeyecek.', 'error');
              if (this.state.config.forceGazeteImageOnly) {
                throw new Error('Gazete okuma için gerçek gazete kapağı bulunamadı.');
              }
              this.state.assets.thumbnail = uploadedImages[0] || await MediaSynthesisService.generateImage(this.state.script.thumbnailImagePrompt || "Dramatic news event", imgStyle, imgRes);
            }
          } else {
            if (!this.state.assets.thumbnail) { addSystemLog('Kapak resmi çizimi...', 'info'); this.state.assets.thumbnail = uploadedImages[0] || await MediaSynthesisService.generateImage(this.state.script.thumbnailImagePrompt || "Dramatic news event", imgStyle, imgRes); addSystemLog('Kapak resmi tamamlandı.', 'success'); }
          }
          const customImages = this.state.config.customSceneImages || [];
          this.state.customImageCount = customImages.length;
          const blocks = this.state.script.imageBlocks || [];
          let globalIdx = 0;
          for (let b = 0; b < blocks.length; b++) {
            const block = blocks[b];
            const blockSlideCount = block.videoSlides.length;
            const blockCustomImg = imageForBlock(block, uploadedImages, b);
            if (blockCustomImg) {
              for (let si = 0; si < blockSlideCount; si++) this.state.assets.images[globalIdx + si] = blockCustomImg;
              addSystemLog(`Blok ${b + 1}: yüklenen görsel ${blockSlideCount} sahnede kullanılıyor.`, 'success');
            }
            globalIdx += blockSlideCount;
          }
          const CHUNK_SIZE = 3;
          addSystemLog(`ASSETS fase: ${this.state.script.videoSlides.length} sahne, ${CHUNK_SIZE}'lü chunk.`, 'info');
          const reusableIddiaVisuals = {};
          const reusableIddiaVisualPromises = {};
          for (let i = 0; i < this.state.script.videoSlides.length; i += CHUNK_SIZE) {
            const chunk = this.state.script.videoSlides.slice(i, i + CHUNK_SIZE);
            addSystemLog(`Sahneler ${i + 1}-${Math.min(i + CHUNK_SIZE, this.state.script.videoSlides.length)} işleniyor...`, 'info');
            const chunkPromises = chunk.map(async (slide, idx) => {
              const actualIndex = i + idx;
              if (slide._isRawMedia) {
                this.state.assets.images[actualIndex] = null;
                this.state.assets.audio[actualIndex] = null;
                return;
              }
              const computedPrompt = slide.imagePrompts?.[0] || slide.topText || slide.spokenText || "News event";
              let imgPromise;
              if (this.state.assets.images[actualIndex] || uploadedImages.length) {
                imgPromise = Promise.resolve(this.state.assets.images[actualIndex] || uploadedImages[actualIndex % uploadedImages.length]);
              } else if (this.state.config.tip === 'iddia_analizi' && slide._visualKey) {
                if (reusableIddiaVisuals[slide._visualKey]) imgPromise = Promise.resolve(reusableIddiaVisuals[slide._visualKey]);
                else if (reusableIddiaVisualPromises[slide._visualKey]) imgPromise = reusableIddiaVisualPromises[slide._visualKey];
                else {
                  reusableIddiaVisualPromises[slide._visualKey] = MediaSynthesisService.generateImage(computedPrompt, imgStyle, imgRes).then(res => {
                    reusableIddiaVisuals[slide._visualKey] = res || this.state.assets.thumbnail;
                    return reusableIddiaVisuals[slide._visualKey];
                  });
                  imgPromise = reusableIddiaVisualPromises[slide._visualKey];
                }
              } else if (this.state.script._isGazeteOkuma || this.state.config.forceGazeteImageOnly) {
                // GAZETE KİLİDİ: AI görsel üreticisine hiçbir koşulda girme.
                const fixedGazeteImage = this.state.assets.images[actualIndex] || this.state.assets.thumbnail;
                if (!fixedGazeteImage) throw new Error(`Gazete sahnesi ${actualIndex + 1} için sabit gazete resmi yok.`);
                imgPromise = Promise.resolve(fixedGazeteImage);
              } else {
                imgPromise = this.state.assets.images[actualIndex] ? Promise.resolve(this.state.assets.images[actualIndex]) : MediaSynthesisService.generateImage(computedPrompt, imgStyle, imgRes).then(res => res || this.state.assets.thumbnail);
              }
              const audPromise = this.state.assets.audio[actualIndex]
                ? Promise.resolve(this.state.assets.audio[actualIndex])
                : MediaSynthesisService.generateAudio(
                    slide.spokenText,
                    this.state.preferences.narratorVoice,
                    this.state.config.language || 'tr'
                  );
              const [imgResData, audResData] = await Promise.all([imgPromise, audPromise]);
              this.state.assets.images[actualIndex] = imgResData;
              this.state.assets.audio[actualIndex] = audResData;
            });
            await Promise.all(chunkPromises);
            const currentProgress = Math.min(i + CHUNK_SIZE, this.state.script.videoSlides.length);
            await this.updateProgress(40 + (currentProgress / this.state.script.videoSlides.length) * 30, `Sahneler ${currentProgress}/${this.state.script.videoSlides.length}...`, 'ASSETS');
          }
        }
        // v1.33: Son Söz TTS, müzik seçimi/kütüphanesi işleminden ÖNCE hazırlanır.
        // Böylece şarkı seçimi, şarkı olmaması veya müzik kütüphanesi Son Söz'ü etkileyemez.
        const sonSozNeedsAudio =
          !this.state.script._isGuzelSoz &&
          !this.state.script._muteNarration &&
          this.state.config.tip !== 'guzel_soz' &&
          this.state.config.outputType !== 'image' &&
          !!String(this.state.script.sonSoz || '').trim() &&
          !this.state.assets.sonSozAudio &&
          this.state.preferences.narratorVoice !== 'none';

        if (sonSozNeedsAudio) {
          const sonSozSpokenEarly = buildSonSozSpokenText(
            this.state.script.sonSoz,
            this.state.script.sonSozKaynak
          );

          addSystemLog('Son Söz seslendirmesi müzikten bağımsız hazırlanıyor...', 'info');

          this.state.assets.sonSozAudio = await MediaSynthesisService.generateAudio(
            sonSozSpokenEarly,
            this.state.preferences.narratorVoice,
            this.state.config.language || 'tr'
          );

          if (this.state.assets.sonSozAudio) {
            addSonSozToHistory(this.state.script.sonSoz, this.state.script.sonSozKaynak);
            addSystemLog('✓ Son Söz sesi hazır (müzik seçiminden bağımsız).', 'success');
          } else {
            addSystemLog('Son Söz ilk TTS denemesinde ses dönmedi; assets sonunda tekrar denenecek.', 'warn');
          }
        }

        const allMusic = await AssetManagerService.getAllMusicFromLib();
        if (allMusic.length > 0) {
          const userBgmId = this.state.preferences.ambientSound;
          const isAmbientType = ['rain','wind','waves','fire','none'].includes(userBgmId);
          if (userBgmId && !isAmbientType) {
            const userTrack = allMusic.find(m => m.id === userBgmId);
            if (userTrack) {
              addSystemLog(`Müzik: ${userTrack.name} (kullanıcı seçimi)`, 'success');
              this.state.script._bgmId = userTrack.id;
              this.state.script._bgmName = userTrack.name;
            } else {
              const matchedTrack = matchMusicToEmotion(emotionForImage, allMusic);
              const chosenTrack = matchedTrack || allMusic[Math.floor(Math.random() * allMusic.length)];
              addSystemLog(`Müzik: ${chosenTrack.name} (duygu: ${emotionForImage}, kullanıcı seçimi bulunamadı)`, 'success');
              this.state.script._bgmId = chosenTrack.id;
              this.state.script._bgmName = chosenTrack.name;
            }
          } else {
            const matchedTrack = matchMusicToEmotion(emotionForImage, allMusic);
            const chosenTrack = matchedTrack || allMusic[Math.floor(Math.random() * allMusic.length)];
            addSystemLog(`Müzik: ${chosenTrack.name} (duygu: ${emotionForImage})`, 'success');
            this.state.script._bgmId = chosenTrack.id;
            this.state.script._bgmName = chosenTrack.name;
          }
        } else {
          addSystemLog('Müzik kütüphanesi boş, müzik eklenmedi.', 'warn');
        }
        const extraAudioPromises = [];
        const muteNarration = !!this.state.script._muteNarration;
        if (!muteNarration && !this.state.assets.thumbnailAudio) {
          const now = new Date();
          const ttsLanguage = this.state.config?.language || 'tr';
          const dateLocale = ({ tr:'tr-TR', en:'en-US', fr:'fr-FR', de:'de-DE', es:'es-ES', ar:'ar-SA', ru:'ru-RU' })[ttsLanguage] || 'tr-TR';
          const dateStr = now.toLocaleDateString(dateLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            ...(ttsLanguage === 'tr' ? { timeZone: 'Europe/Istanbul' } : {})
          });
          const dayStr = now.toLocaleDateString(dateLocale, {
            weekday: 'long',
            ...(ttsLanguage === 'tr' ? { timeZone: 'Europe/Istanbul' } : {})
          });
          const sourceName = this.state.config?.sourceName || '';
          const headline = this.state.script.thumbnailText || '';
          const clickbaitText = [dateStr + " " + dayStr, sourceName, headline].filter(Boolean).join('. ') + '.';

          extraAudioPromises.push(
            MediaSynthesisService.generateAudio(
              clickbaitText,
              this.state.preferences.narratorVoice,
              ttsLanguage
            ).then(res => {
              this.state.assets.thumbnailAudio = res;
              addSystemLog('Clickbait seslendirme hazır.', 'success');
            })
          );
        }
        if (!muteNarration && !this.state.script._isGuzelSoz) {
          if (this.state.script.sonSoz && !this.state.assets.sonSozAudio) {
            // Son Söz artık kaynağıyla (kim söylediği) birlikte hem gösteriliyor hem
            // de seslendiriliyor; ve tekrar seçilmemesi için geçmişe kaydediliyor.
            addSonSozToHistory(this.state.script.sonSoz, this.state.script.sonSozKaynak);
            const sonSozSpoken = buildSonSozSpokenText(this.state.script.sonSoz, this.state.script.sonSozKaynak);
            extraAudioPromises.push(
              MediaSynthesisService.generateAudio(
                sonSozSpoken,
                this.state.preferences.narratorVoice,
                this.state.config.language || 'tr'
              ).then(res => {
                this.state.assets.sonSozAudio = res;
                if (res) addSystemLog('✓ Son Söz sesi assets retry ile hazırlandı.', 'success');
              })
            );
          }
          if (this.state.config.yorum && this.state.config.yorum.trim() && !this.state.assets.yorumAudio) extraAudioPromises.push(MediaSynthesisService.generateAudio(this.state.config.yorum, this.state.preferences.narratorVoice, this.state.config.language || 'tr').then(res => { this.state.assets.yorumAudio = res; }));
          if (!this.state.assets.outroAudio) {
            let defaultOutroText = "Gündem Notları. Abone olmayı, beğenmeyi, yorum yapmayı ve paylaşmayı unutmayın.";
            if (this.state.config.language === 'en') defaultOutroText = "Gündem Notes. Don't forget to subscribe, like, comment, and share.";
            else if (this.state.config.language === 'fr') defaultOutroText = "Gündem Notes. N'oubliez pas de vous abonner, d'aimer, de commenter et de partager.";
            else if (this.state.config.language === 'de') defaultOutroText = "Gündem Notes. Vergessen Sie nicht zu abonnieren, zu liken, zu kommentieren und zu teilen.";
            else if (this.state.config.language === 'es') defaultOutroText = "Gündem Notes. No olvides suscribirte, dar me gusta, comentar y compartir.";
            else if (this.state.config.language === 'ar') defaultOutroText = "ملاحظات الأجندة. لا تنس الاشتراك والإعجاب والتعليق والمشاركة.";
            else if (this.state.config.language === 'ru') defaultOutroText = "Gündem Notes. Не забудьте подписаться, поставить лайк, прокомментировать и поделиться.";
            extraAudioPromises.push(MediaSynthesisService.generateAudio(defaultOutroText, this.state.preferences.narratorVoice, this.state.config.language || 'tr').then(res => { this.state.assets.outroAudio = res; }));
          }
        }
        await Promise.all(extraAudioPromises);

        const sonSozMustHaveAudio =
          !this.state.script._isGuzelSoz &&
          !this.state.script._muteNarration &&
          this.state.config.tip !== 'guzel_soz' &&
          this.state.config.outputType !== 'image' &&
          !!String(this.state.script.sonSoz || '').trim() &&
          this.state.preferences.narratorVoice !== 'none';

        if (sonSozMustHaveAudio && !this.state.assets.sonSozAudio) {
          addSystemLog('Son Söz ses doğrulaması: ses eksik, son zorunlu TTS denemesi yapılıyor...', 'warn');

          const finalSonSozSpoken = buildSonSozSpokenText(
            this.state.script.sonSoz,
            this.state.script.sonSozKaynak
          );

          this.state.assets.sonSozAudio = await MediaSynthesisService.generateAudio(
            finalSonSozSpoken,
            this.state.preferences.narratorVoice,
            this.state.config.language || 'tr'
          );

          if (!this.state.assets.sonSozAudio) {
            throw new Error('Son Söz seslendirmesi üretilemedi. Son Söz sessizce atlanmadı; video render durduruldu.');
          }
        }

        if (
          this.state.config.tip !== 'guzel_soz' &&
          this.state.config.outputType !== 'image' &&
          String(this.state.script.sonSoz || '').trim()
        ) {
          addSystemLog(
            `✓ FIX CHECKLIST v1.33: Son Söz render garantisi aktif; müzik=${this.state.script._bgmId || this.state.preferences.ambientSound || 'none'}, ses=${this.state.assets.sonSozAudio ? 'hazır' : (this.state.preferences.narratorVoice === 'none' ? 'narrator kapalı' : 'eksik')}.`,
            'success'
          );
        }

        const imgCount = this.state.assets.images.filter(Boolean).length;
        const audCount = this.state.assets.audio.filter(Boolean).length;
        addSystemLog(`ASSETS tamamlandı: ${imgCount}/${this.state.script.videoSlides.length} görsel, ${audCount}/${this.state.script.videoSlides.length} ses.`, imgCount === this.state.script.videoSlides.length ? 'success' : 'warn');
        this.state.status = 'READY_TO_RENDER';
        await AssetManagerService.saveJobState(this.state);
      }
      if (this.state.status === 'READY_TO_RENDER') {
        await this.updateProgress(80, 'Video Paketleniyor...', 'RENDER');
        if (this.state.config?._gazeteDirectClick) {
          this.state.config.sourceName = this.state.config._gazeteSourceLock || this.state.config.sourceName || '';
          if (this.state.script?._isGazeteOkuma && this.state.config._gazeteImageLock) {
            for (let gi = 0; gi < (this.state.script.videoSlides || []).length; gi++) {
              if (!this.state.assets.images[gi]) this.state.assets.images[gi] = this.state.config._gazeteImageLock;
            }
          }
        }
        const renderResult = await RenderWorkerService.executeRender(this.state, canvasRef.current, this.state.preferences);
        this.state.status = 'COMPLETED'; this.state.videoUrl = typeof renderResult === 'string' ? renderResult : renderResult.url; this.state.videoBlobType = (typeof renderResult === 'object' && renderResult.blobType) ? renderResult.blobType : '';
        await AssetManagerService.saveJobState(this.state); await AssetManagerService.clearJob(this.jobId);
        sysEventBus.emit('WORKFLOW_STATE', { status: 'COMPLETED', job: this.state });
        return this.state.videoUrl;
      }
    } catch (e) { if (isFreeTierStop(e)) throw e; this.state.status = 'FAILED'; this.state.error = e.message; await AssetManagerService.saveJobState(this.state); sysEventBus.emit('WORKFLOW_STATE', { status: 'FAILED', job: this.state }); throw e; }
  }
}

// [DEVAM EDECEK - BÖLÜM 4/4: M10 App (Firebase'den temizlenmiş React UI)]

// ============================================================================
// M10: APP (REACT UI) — Firebase KALDIRILDI, Local-First
// ============================================================================
// ── ErrorBoundary: React component crash'lerinde beyaz ekranı önler ─────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('[ErrorBoundary]', error, errorInfo); this.setState({ errorInfo }); }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: '40px', textAlign: 'center', background: '#0B0F19', color: '#e2e8f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
      },
        React.createElement('h1', { style: { fontSize: '28px', fontWeight: '900', color: '#ef4444', marginBottom: '16px' } }, 'Bir Hata Oluştu'),
        React.createElement('p', { style: { color: '#94a3b8', marginBottom: '24px', fontSize: '14px' } }, this.state.error?.message || 'Bilinmeyen hata'),
        React.createElement('button', { onClick: () => window.location.reload(), style: { background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' } }, 'Sayfayı Yenile')
      );
    }
    return this.props.children;
  }
}

const VOICE_OPTIONS = [
  { id: 'Aoede', label: 'Aoede', gender: 'Female', age: 'Young', category: 'Corporate & Narration' },
  { id: 'Puck', label: 'Puck', gender: 'Male', age: 'Child', category: 'Anime & Animation' },
  { id: 'Kore', label: 'Kore', gender: 'Female', age: 'Middle-aged', category: 'Documentary' },
  { id: 'Charon', label: 'Charon', gender: 'Male', age: 'Elderly', category: 'Audiobooks & Novels' },
  { id: 'Zephyr', label: 'Zephyr', gender: 'Male', age: 'Young', category: 'Commercials & Trailers' },
  { id: 'Fenrir', label: 'Fenrir', gender: 'Male', age: 'Middle-aged', category: 'Games & RPG' },
  { id: 'Leda', label: 'Leda', gender: 'Female', age: 'Middle-aged', category: 'Corporate & Narration' },
  { id: 'Orus', label: 'Orus (Erkek - Resmi)', gender: 'Male', age: 'Middle-aged', category: 'Documentary' }
];

const CustomSelect = ({ value, onChange, options, icon: Icon, className }) => {
  const [isOpen, setIsOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
  const getSelectedLabel = () => { for (const opt of options) { if (opt.options) { const found = opt.options.find(o => o.value === value); if (found) return found.label; } else if (opt.value === value) return opt.label; } return value; };
  const getSelectedColor = () => { for (const opt of options) { if (opt.options) { const found = opt.options.find(o => o.value === value); if (found?.color) return found.color; } else if (opt.value === value && opt.color) return opt.color; } return 'text-white'; };
  return (
    <div ref={ref} className={`relative flex items-center w-full ${className || ''}`} onClick={() => setIsOpen(!isOpen)}>
      {Icon && <Icon size={18} className="text-indigo-400 shrink-0 mr-3" />}
      <div className={`flex-1 flex items-center justify-between text-sm font-bold cursor-pointer truncate ${getSelectedColor()}`}>
        <span className="truncate pr-2">{getSelectedLabel()}</span>
        <ChevronDown size={16} className={`transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''} text-slate-400`} />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[200] max-h-64 overflow-y-auto py-1">
          {options.map((opt, idx) => {
            if (opt.options) {
              return (<div key={idx}>{opt.label && <div className="px-3 py-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">{opt.label}</div>}{opt.options.map(subOpt => (<div key={subOpt.value} className={`px-3 py-2 text-sm cursor-pointer transition-colors ${value === subOpt.value ? 'bg-blue-600 text-white' : `hover:bg-blue-600 hover:text-white ${subOpt.color || 'text-slate-200'}`}`} onClick={(e) => { e.stopPropagation(); onChange(subOpt.value); setIsOpen(false); }}>{subOpt.label}</div>))}</div>);
            }
            return (<div key={opt.value} className={`px-3 py-2 text-sm cursor-pointer transition-colors ${value === opt.value ? 'bg-blue-600 text-white' : `hover:bg-blue-600 hover:text-white ${opt.color || 'text-slate-200'}`}`} onClick={(e) => { e.stopPropagation(); onChange(opt.value); setIsOpen(false); }}>{opt.label}</div>);
          })}
        </div>
      )}
    </div>
  );
};

// === GPU İMAJ ÖNBELLEKLEME YARDIMCISI (createImageBitmap) ===
const ImageBitmapCache = {
  cache: new Map(),
  async get(src) {
    if (!src) return null;
    if (this.cache.has(src)) return this.cache.get(src);
    try { const resp = await fetch(src); const blob = await resp.blob(); const bmp = await createImageBitmap(blob); this.cache.set(src, bmp); return bmp; } catch(e) { if (isFreeTierStop(e)) throw e; return null; }
  },
  clear() { for (const bmp of this.cache.values()) { if (bmp && typeof bmp.close === 'function') bmp.close(); } this.cache.clear(); }
};

// === CROP MODAL BİLEŞENİ (React.memo ile Sarılı 1:1 Kusursuz Fare Takibi) ===
const GazeteCropModal = React.memo(({ src, name, onClose, onCrop }) => {
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [selection, setSelection] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const getRelPos = (e) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    const clientX = e.touches ? (e.touches[0] || e.changedTouches[0]).clientX : e.clientX;
    const clientY = e.touches ? (e.touches[0] || e.changedTouches[0]).clientY : e.clientY;
    return { x: Math.max(0, Math.min(Math.round(clientX - rect.left), rect.width)), y: Math.max(0, Math.min(Math.round(clientY - rect.top), rect.height)) };
  };
  const handleMouseDown = (e) => { e.preventDefault(); const pos = getRelPos(e); setDragStart(pos); setSelection({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }); };
  useEffect(() => {
    if (!dragStart) return;
    const handleWindowMouseMove = (e) => { const pos = getRelPos(e); setSelection({ x1: Math.min(dragStart.x, pos.x), y1: Math.min(dragStart.y, pos.y), x2: Math.max(dragStart.x, pos.x), y2: Math.max(dragStart.y, pos.y) }); };
    const handleWindowMouseUp = () => { setDragStart(null); };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowMouseMove, { passive: false });
    window.addEventListener('touchend', handleWindowMouseUp);
    return () => { window.removeEventListener('mousemove', handleWindowMouseMove); window.removeEventListener('mouseup', handleWindowMouseUp); window.removeEventListener('touchmove', handleWindowMouseMove); window.removeEventListener('touchend', handleWindowMouseUp); };
  }, [dragStart]);
  const doCrop = () => {
    if (!selection || !imgRef.current) return;
    const img = imgRef.current;
    const dispW = img.offsetWidth; const dispH = img.offsetHeight;
    const natW = img.naturalWidth; const natH = img.naturalHeight;
    const w = selection.x2 - selection.x1; const h = selection.y2 - selection.y1;
    if (w < 10 || h < 10) return;
    const scaleX = natW / dispW; const scaleY = natH / dispH;
    const cropX = Math.round(selection.x1 * scaleX); const cropY = Math.round(selection.y1 * scaleY);
    const cropW = Math.round(w * scaleX); const cropH = Math.round(h * scaleY);
    const canvas = document.createElement('canvas');
    canvas.width = cropW; canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const dataUrl = canvas.toDataURL('image/png');
    onCrop(dataUrl, name);
  };
  const selW = selection ? (selection.x2 - selection.x1) : 0;
  const selH = selection ? (selection.y2 - selection.y1) : 0;
  return (
    <div className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Scissors size={18} className="text-indigo-400" /><span className="text-white font-bold text-sm">{name}</span></div>
          <div className="flex gap-2">
            {selection && selW > 10 && selH > 10 && (
              <button onClick={doCrop} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"><Check size={14} /> Crop'u Kullan</button>
            )}
            <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">✕ Kapat</button>
          </div>
        </div>
        <p className="text-slate-400 text-[11px] mb-2">🖱️ Fare ile gazete üzerinde kırpmak istediğiniz haberi sürükleyip seçin.</p>
        <div className="relative flex-1 overflow-auto rounded-xl bg-black/50 select-none flex justify-center items-start">
          <div className="relative inline-block" onMouseDown={handleMouseDown} style={{ cursor: 'crosshair', touchAction: 'none' }}>
            <img ref={imgRef} src={src} crossOrigin="anonymous" onLoad={() => setImgLoaded(true)} className="max-w-full h-auto block select-none" alt={name} draggable={false} />
            {selection && imgLoaded && selW > 0 && selH > 0 && (
              <>
                <div className="absolute bg-black/60 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: selection.y1 + 'px' }} />
                <div className="absolute bg-black/60 pointer-events-none" style={{ top: selection.y2 + 'px', left: 0, right: 0, bottom: 0 }} />
                <div className="absolute bg-black/60 pointer-events-none" style={{ top: selection.y1 + 'px', left: 0, width: selection.x1 + 'px', height: selH + 'px' }} />
                <div className="absolute bg-black/60 pointer-events-none" style={{ top: selection.y1 + 'px', left: selection.x2 + 'px', right: 0, height: selH + 'px' }} />
                <div className="absolute border-2 border-emerald-400 bg-emerald-400/20 pointer-events-none shadow-[0_0_15px_rgba(52,211,153,0.6)]" style={{ left: selection.x1 + 'px', top: selection.y1 + 'px', width: selW + 'px', height: selH + 'px' }}>
                  <div className="absolute -top-6 left-0 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">{Math.round(selW)} × {Math.round(selH)} px</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN APP — FIREBASE KALDIRILDI (user/authExpired/isLoadedRef yok)
// ============================================================================
export default function App() {
  // FIREBASE STATE'LERİ KALDIRILDI: user, authExpired, isLoadedRef
  const isVoiceFiltersInitRef = useRef(false);
  const logEndRef = useRef(null);
  const musicFileInputRef = useRef(null);
  const guzelSozIntroFileInputRef = useRef(null);
  const guzelSozIntroPendingStartRef = useRef(null);

  const loadSavedJSON = (key, fallback) => {
    try {
      const saved = SafeStorage.getItem(key);
      if (!saved) return fallback;
      const parsed = JSON.parse(saved);
      return (parsed && typeof parsed === 'object') ? { ...fallback, ...parsed } : fallback;
    } catch(e) { return fallback; }
  };

  const [activeTab, setActiveTab] = useState(() => { const saved = SafeStorage.getItem('ns_activeTab'); return saved === 'image' ? 'media' : (saved || 'media'); });
  const [textInput, setTextInput] = useState(() => SafeStorage.getItem('ns_textInput') || '');

  // v1.29: Güzel Söz intro saklama doğrulaması.
  // localStorage sadece senkron "hazır" işaretidir; gerçek video IndexedDB'dedir.
  useEffect(() => {
    let cancelled = false;
    const verifyGuzelSozIntro = async () => {
      if (SafeStorage.getItem(GUZEL_SOZ_INTRO_READY_KEY) !== '1') return;

      const stored = await AssetManagerService.loadMedia(GUZEL_SOZ_INTRO_MEDIA_ID);
      if (cancelled) return;

      const valid =
        (stored instanceof Blob && stored.size > 0) ||
        (stored instanceof ArrayBuffer && stored.byteLength > 0) ||
        (ArrayBuffer.isView(stored) && stored.byteLength > 0) ||
        (typeof stored === 'string' && stored.startsWith('data:video/'));

      if (!valid) {
        SafeStorage.removeItem(GUZEL_SOZ_INTRO_READY_KEY);
        addSystemLog('Güzel Söz sabit intro kaydı bulunamadı; ilk Güzel Söz videosunda dosya bir kez yeniden seçilecek.', 'warn');
      }
    };

    verifyGuzelSozIntro().catch((e) => ErrorHandler.silent(e));
    return () => { cancelled = true; };
  }, []);

  // === GAZETE TAKİP STATE ===
  useEffect(() => {
    const syncGazeteToday = () => {
      const todayTR = _getTurkeyDateISO();
      const previousToday = gazeteTodayRef.current;
      if (todayTR !== previousToday) {
        gazeteTodayRef.current = todayTR;
        setGazeteDate(current => current === previousToday ? todayTR : current);
        addSystemLog(`Gazete Takip tarihi Türkiye saatine göre yeni güne geçti: ${todayTR}`, 'info');
      }
    };
    syncGazeteToday();
    const timer = setInterval(syncGazeteToday, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Önceki sürümlerde bugünün anahtarına dünün kapağı yazılmış olabildi.
    // Yalnız eski gazete çözüm cache'lerini temizle; diğer ayarlara dokunma.
    try {
      const staleKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ns_gazeteResolved_') && key !== GAZETE_CACHE_KEY) staleKeys.push(key);
      }
      staleKeys.forEach(key => SafeStorage.removeItem(key));
      if (staleKeys.length) addSystemLog(`Eski gazete cache temizlendi: ${staleKeys.length} kayıt.`, 'info');
    } catch (e) {
      ErrorHandler.silent(e);
    }
  }, []);

  const [gazeteItems, setGazeteItems] = useState([]);
  const [gazeteLoading, setGazeteLoading] = useState(false);
  const [gazeteError, setGazeteError] = useState('');
  const [gazeteCropModal, setGazeteCropModal] = useState(null);
  const gazeteRequestIdRef = useRef(0);
  const gazeteAbortRef = useRef(null);
  const gazeteResolvedCacheRef = useRef(null);
  const gazeteRefreshNonceRef = useRef(`${_getTurkeyDateISO()}-${Date.now()}`);
  const gazeteExtensionAvailableRef = useRef(null);
  const gazeteExtensionWarnedRef = useRef(false);
  const gazeteCentralReadyRef = useRef(false);
  const gazeteAutoVideoRef = useRef({ active: false, name: '' });
  const gazeteStartLockRef = useRef({ locked: false, token: '', name: '' });
  const gazeteGridRef = useRef(null);
  const gazeteRescueInFlightRef = useRef(new Map());

  // v1.36 Sabah 07:00 gazete otonomu
  const [gazeteAuto0700Enabled, setGazeteAuto0700Enabled] = useState(
    () => SafeStorage.getItem(GAZETE_AUTO_0700_ENABLED_KEY) === '1'
  );
  const [gazeteAuto0700Ui, setGazeteAuto0700Ui] = useState({
    active: false,
    current: '',
    total: 0,
    completed: 0,
    failed: 0,
    message: '07:00 otonomu hazır'
  });
  const gazeteAuto0700Ref = useRef({
    active: false,
    date: '',
    queue: [],
    completed: [],
    failed: [],
    current: '',
    trigger: ''
  });
  const gazeteItemsRef = useRef([]);
  const gazeteLoadingRef = useRef(false);
  const uiProcessingRef = useRef(false);
  const [gazeteDate, setGazeteDate] = useState(() => _getTurkeyDateISO());
  const gazeteTodayRef = useRef(_getTurkeyDateISO());

  useEffect(() => { gazeteItemsRef.current = gazeteItems; }, [gazeteItems]);
  useEffect(() => { gazeteLoadingRef.current = gazeteLoading; }, [gazeteLoading]);
  useEffect(() => {
    SafeStorage.setItem(GAZETE_AUTO_0700_ENABLED_KEY, gazeteAuto0700Enabled ? '1' : '0');
  }, [gazeteAuto0700Enabled]);

  const [userApiKey, setUserApiKeyState] = useState(() => getGeminiApiKey());
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const handleSaveApiKey = (newKey) => {
    const trimmed = (newKey || '').trim();
    setGeminiApiKey(trimmed);
    setUserApiKeyState(trimmed);
    setShowApiKeyModal(false);
    if (trimmed) addSystemLog('Gemini API Key kaydedildi.', 'success');
    else addSystemLog('Gemini API Key temizlendi.', 'warn');
  };

  const [config, setConfig] = useState(() => loadSavedJSON('ns_config', {
    duration: '30', aspectRatio: '9:16', videoStyle: 'cinematic', fontStyle: 'modern', imageStyle: 'oil_painting', language: 'tr', subtitles: 'on', resolution: '4K', transition: 'none', outputType: 'video', analysisMode: 'yorumsuz', videoFormat: 'mp4', tip: 'haber', sourceName: '', yorum: ''
  }));
  const [prefs, setPrefs] = useState(() => {
    const saved = loadSavedJSON('ns_prefs', {
      narratorVoice: 'Aoede',
      narratorVolume: 0.8,
      backgroundMusicVolume: DEFAULT_BGM_VOLUME,
      ambientSound: 'none',
      customBgMusicName: '',
      customBgMusicId: ''
    });

    const normalized = {
      ...saved,
      backgroundMusicVolume: DEFAULT_BGM_VOLUME
    };

    SafeStorage.setItem('ns_prefs', JSON.stringify(normalized));
    return normalized;
  });
  const [voiceFilters, setVoiceFilters] = useState(() => loadSavedJSON('ns_voiceFilters', { gender: 'Any', age: 'Any', category: 'Any' }));
  const [showFilters, setShowFilters] = useState(false);
  const [sysLogs, setSysLogs] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingJob, setPendingJob] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const filteredVoices = VOICE_OPTIONS.filter(v => {
    if (voiceFilters.gender !== 'Any' && v.gender !== voiceFilters.gender) return false;
    if (voiceFilters.age !== 'Any' && v.age !== voiceFilters.age) return false;
    if (voiceFilters.category !== 'Any' && v.category !== voiceFilters.category) return false;
    return true;
  });

  useEffect(() => {
    if (!isVoiceFiltersInitRef.current) { isVoiceFiltersInitRef.current = true; return; }
    if (filteredVoices.length > 0 && !filteredVoices.find(v => v.id === prefs.narratorVoice)) {
      setPrefs(p => ({ ...p, narratorVoice: filteredVoices[0].id }));
    }
  }, [voiceFilters]);

  const [uiState, setUiState] = useState({ isProcessing: false, statusText: '', percent: 0, error: '', videoUrl: null, showDevMenu: false, selectedMediaFiles: [] });
  const [videoPreviewPoster, setVideoPreviewPoster] = useState('');

  // v1.38: uiState artık oluşturulduktan SONRA otonom ref'e senkronlanır.
  useEffect(() => {
    uiProcessingRef.current = !!uiState.isProcessing;
  }, [uiState.isProcessing]);

  // Üretilen videonun 1. saniyesini poster olarak çıkar. Bu kare clickbait kapağının
  // içindedir; tarayıcı autoplay'i engellese bile önizleme siyah görünmez.
  useEffect(() => {
    if (!uiState.videoUrl || config.outputType !== 'video') { setVideoPreviewPoster(''); return; }
    let cancelled = false;
    const previewVideo = document.createElement('video');
    previewVideo.muted = true;
    previewVideo.playsInline = true;
    previewVideo.preload = 'auto';
    previewVideo.src = uiState.videoUrl;
    const cleanup = () => {
      previewVideo.onloadedmetadata = null;
      previewVideo.onseeked = null;
      previewVideo.onerror = null;
      try { previewVideo.removeAttribute('src'); previewVideo.load(); } catch(e) {}
    };
    previewVideo.onloadedmetadata = () => {
      try {
        const duration = Number.isFinite(previewVideo.duration) ? previewVideo.duration : 0;
        previewVideo.currentTime = duration > 1.2 ? 1.0 : Math.max(0.05, duration * 0.25);
      } catch(e) { cleanup(); }
    };
    previewVideo.onseeked = () => {
      if (cancelled) return cleanup();
      try {
        const c = document.createElement('canvas');
        c.width = previewVideo.videoWidth || 720;
        c.height = previewVideo.videoHeight || 1280;
        const cctx = c.getContext('2d');
        cctx.drawImage(previewVideo, 0, 0, c.width, c.height);
        const poster = c.toDataURL('image/jpeg', 0.9);
        if (!cancelled) setVideoPreviewPoster(poster);
      } catch(e) { ErrorHandler.silent(e); }
      cleanup();
    };
    previewVideo.onerror = () => cleanup();
    return () => { cancelled = true; cleanup(); };
  }, [uiState.videoUrl, config.outputType]);

  useEffect(() => {
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); ObjectURLManager.revokeAll(); };
  }, []);

  // FIREBASE DEĞİŞİKLİĞİ: statusMsg 'Bulut Kontrol Ediliyor...' → 'Yerel Mod', isLoading false
  const [studioMedia, setStudioMedia] = useState({ outroUrl: null, musicLoaded: false, musicName: '', musicId: '', musicList: [], customSceneImages: [], isLoading: false, statusMsg: 'Yerel Mod', syncedFolderName: '' });
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const canvasRef = useRef(null);
  const workflowRef = useRef(new WorkflowCoordinator());
  const _previewAudioRef = useRef(null);
  const _previewTimeoutRef = useRef(null);

  const getTargetSeconds = (dur) => { if (dur === 'unlimited') return 0; if (dur === '15') return 30; if (dur === '30') return 60; if (dur === '60') return 90; if (dur === '90') return 120; return 60; };
  const targetSecUI = getTargetSeconds(config.duration);
  const maxWordsUI = config.duration === 'unlimited' ? 'Sınırsız' : Math.floor((targetSecUI - 1.5) * getWPS(config.language));

  const ambientOptions = [
    { value: 'none', label: '🔇 Arka Ses Yok', color: 'text-slate-300' },
    { label: 'Atmosfer', options: [
        { value: 'rain', label: '🌧️ Yağmur', color: 'text-blue-300' },
        { value: 'wind', label: '🌬️ Rüzgar', color: 'text-slate-300' },
        { value: 'waves', label: '🌊 Dalgalar', color: 'text-cyan-300' },
        { value: 'fire', label: '🔥 Şömine', color: 'text-orange-300' },
      ]}
  ];
  const filteredMusicList = studioMedia.musicList.filter(m => !musicSearchQuery || m.name.toLowerCase().includes(musicSearchQuery.toLowerCase()));
  if (filteredMusicList.length > 0) ambientOptions.push({ label: 'Müziklerim', options: filteredMusicList.map(m => ({ value: m.id, label: `🎵 ${m.name.replace(/\.[^.]+$/, '')}`, color: 'text-violet-400' })) });

  const voiceOptions = [
    { value: 'none', label: '🔇 Ses Yok', color: 'text-rose-400 font-bold' },
    ...filteredVoices.map(v => ({ value: v.id, label: v.label }))
  ];
  if (filteredVoices.length === 0) voiceOptions.push({ value: '', label: 'Kriter Uyumsuz', color: 'text-slate-500' });

  const SOCIAL_PLATFORMS = [
    { id: 'x', name: 'X (Twitter)', color: '#1DA1F2', loginUrl: 'https://x.com/login', shareUrl: 'https://x.com/intent/post' },
    { id: 'linkedin', name: 'LinkedIn', color: '#0A66B2', loginUrl: 'https://www.linkedin.com/login', shareUrl: 'https://www.linkedin.com/feed/compose/' },
    { id: 'facebook', name: 'Facebook', color: '#1877F2', loginUrl: 'https://www.facebook.com/login', shareUrl: 'https://www.facebook.com/sharer/sharer.php' },
    { id: 'instagram', name: 'Instagram', color: '#E4405F', loginUrl: 'https://www.instagram.com/accounts/login/', shareUrl: 'https://www.instagram.com/' },
    { id: 'tiktok', name: 'TikTok', color: '#000000', loginUrl: 'https://www.tiktok.com/login', shareUrl: 'https://www.tiktok.com/' },
    { id: 'pinterest', name: 'Pinterest', color: '#BD081C', loginUrl: 'https://pinterest.com/login/', shareUrl: 'https://pinterest.com/pin/create/button/' },
    { id: 'bluesky', name: 'Bluesky', color: '#0085FF', loginUrl: 'https://bsky.app/', shareUrl: 'https://bsky.app/' }
  ];

  const [connectedPlatforms, setConnectedPlatforms] = useState(() => { const saved = JSON.parse(SafeStorage.getItem('ns_connectedPlatforms')) || {}; return saved; });
  const [shareTargets, setShareTargets] = useState(() => { const saved = JSON.parse(SafeStorage.getItem('ns_shareTargets')) || {}; return saved; });
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [bufferShareReport, setBufferShareReport] = useState({ status: 'idle', results: [], message: '' });
  const bufferCfrGuardRef = useRef({ verified: false, fps: 0, sourceType: '', checkedAt: 0 });
  const bufferManualShareLockRef = useRef(false);

  // v1.37 Buffer Chrome Extension bridge
  const bufferExtensionAvailableRef = useRef(null);
  const BUFFER_AUTO_5MIN_ENABLED_KEY = 'ns_bufferAuto5MinEnabled_v1';
  const BUFFER_AUTO_NEXT_DUE_KEY = 'ns_bufferAutoNextDue_v1';
  const BUFFER_AUTO_INTERVAL_KEY = 'ns_bufferAutoIntervalMinutes_v1';
  const BUFFER_AUTO_LAST_DUE_KEY = 'ns_bufferAutoLastDue_v1';
  const [bufferAuto5MinEnabled, setBufferAuto5MinEnabled] = useState(
    () => SafeStorage.getItem(BUFFER_AUTO_5MIN_ENABLED_KEY) === '1'
  );
  const bufferAutoNextDueAtRef = useRef(Number(SafeStorage.getItem(BUFFER_AUTO_NEXT_DUE_KEY) || 0) || 0);
  const bufferAutoIntervalMinutesRef = useRef(10);
  const bufferAutoLastDueAtRef = useRef(
    Number(SafeStorage.getItem(BUFFER_AUTO_LAST_DUE_KEY) || 0) || 0
  );


  const togglePlatform = (platformId) => {
    setConnectedPlatforms(prev => {
      const next = { ...prev, [platformId]: !prev[platformId] };
      SafeStorage.setItem('ns_connectedPlatforms', JSON.stringify(next));
      if (!next[platformId]) setShareTargets(prev => { const n = { ...prev }; delete n[platformId]; SafeStorage.setItem('ns_shareTargets', JSON.stringify(n)); return n; });
      return next;
    });
  };
  const toggleShareTarget = (platformId) => {
    setShareTargets(prev => { const next = { ...prev, [platformId]: !prev[platformId] }; SafeStorage.setItem('ns_shareTargets', JSON.stringify(next)); return next; });
  };
  const openPlatformConnect = (platform) => {
    const popup = window.open(platform.loginUrl, platform.name, 'width=600,height=700,scrollbars=yes');
    addSystemLog(`${platform.name} giriş sayfası açıldı. Oturum açın, otomatik olarak bağlanacaksınız.`, 'info');
    const checker = setInterval(() => {
      try { if (popup.closed) { clearInterval(checker); togglePlatform(platform.id); addSystemLog(`${platform.name} bağlantısı tamamlandı!`, 'success'); } } catch (e) { clearInterval(checker); }
    }, 800);
  };

  // Otomatik video kaydetme (direk indirme, dosya adı = haber başlığı)
  const autoSaveVideo = async (videoUrl, title, videoFormat) => {
    if (!videoUrl || !videoUrl.startsWith('blob:')) { addSystemLog('Geçersiz video URL, kaydetme atlandı.', 'warn'); return; }
    addSystemLog('Video kaydediliyor...', 'info');
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const actualBlobType = workflowRef.current?.state?.videoBlobType || '';
      const isWebM = blob.type.includes('webm') || actualBlobType.includes('webm');
      const wantsMP4 = videoFormat === 'mp4';
      let finalBlob = blob;
      let ext = '.webm';
      if (wantsMP4 && isWebM) {
        addSystemLog('WebM → MP4 dönüştürülüyor...', 'info');
        try { finalBlob = await convertWebMtoMP4(blob, (pct) => { if (pct % 25 === 0) addSystemLog(`MP4 dönüştürme: %${pct}`, 'info'); }); ext = '.mp4'; addSystemLog('MP4 dönüştürme tamamlandı.', 'success'); }
        catch (convErr) { addSystemLog(`MP4 dönüştürme başarısız, WebM indiriliyor: ${convErr.message}`, 'warn'); ext = '.webm'; }
      } else if (wantsMP4 && (blob.type.includes('mp4') || actualBlobType.includes('mp4'))) { ext = '.mp4'; } else { ext = '.webm'; }
      const safeName = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").toLowerCase();
      const fileName = `${safeName}${ext}`;
      const a = document.createElement('a');
      a.href = ObjectURLManager.create(finalBlob);
      a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      ObjectURLManager.revoke(a.href);
      addSystemLog(`Video indirildi: ${fileName}`, 'success');
    } catch (e) { addSystemLog('Video indirme hatası: ' + e.message, 'error'); }
  };

  const copyShareLink = async () => {
    const title = workflowRef.current?.state?.script?.thumbnailText || 'Video';
    try { await navigator.clipboard.writeText(title); addSystemLog('Başlık panoya kopyalandı!', 'success'); }
    catch (e) { const textarea = document.createElement('textarea'); textarea.value = title; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); document.body.removeChild(textarea); addSystemLog('Başlık panoya kopyalandı!', 'success'); }
  };

  const nativeShare = async () => {
    const title = textInput || workflowRef.current?.state?.script?.thumbnailText || 'OTONOM Haber';
    try { if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title: title, text: title }); addSystemLog('Cihazda paylaşım yapıldı!', 'success'); } }
    catch (e) { if (e.name !== 'AbortError') addSystemLog('Paylaşım hatası: ' + e.message, 'error'); }
  };

  // Bulut yükleme (Buffer için) — orijinal korunur, Firebase içermez
  const bufferExtensionRequest = (type, payload = {}, timeoutMs = 20000) => new Promise((resolve) => {
    const requestId = `buffer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== 'OTONOM_BUFFER_EXTENSION' || data.id !== requestId) return;
      if (data.type !== 'BUFFER_RESULT') return;

      bufferExtensionAvailableRef.current = true;
      finish(data);
    };

    const timer = setTimeout(() => {
      bufferExtensionAvailableRef.current = false;
      finish(null);
    }, timeoutMs);

    window.addEventListener('message', onMessage);

    const request = {
      source: 'OTONOM_APP',
      type,
      id: requestId,
      payload
    };

    // v1.42 KRİTİK:
    // Buffer Bridge content-script'i uygulamanın bu frame'inde all_frames ile çalışıyor.
    // Aynı isteği parent/top frame'lere de yollamak createPost mutation'ını iki kez
    // çalıştırıp her sosyal ağda çift gönderi oluşturuyordu.
    // Buffer isteği artık TAM 1 kez ve yalnız bu frame'e gönderilir.
    try {
      window.postMessage(request, '*');
    } catch (e) {
      ErrorHandler.silent(e);
      finish(null);
    }
  });

  const probeBufferExtension = async () => {
    const reply = await bufferExtensionRequest('BUFFER_PING', {}, 5000);

    if (!reply) {
      throw new Error(
        'OTONOM Buffer Bridge eklentisi yanıt vermedi. Chrome eklentisini yükleyin/etkinleştirin ve Gemini sekmesini tamamen yenileyin.'
      );
    }

    if (!reply.ok) {
      throw new Error(reply.error || 'OTONOM Buffer Bridge bağlantı testi başarısız.');
    }

    if (!reply.configured) {
      throw new Error(
        'OTONOM Buffer Bridge bağlı fakat Buffer API anahtarı eklentiye kaydedilmemiş. chrome://extensions > OTONOM Buffer Bridge > Ayrıntılar > Uzantı seçenekleri bölümünden anahtarı bir kez kaydedin.'
      );
    }

    bufferExtensionAvailableRef.current = true;
    addSystemLog(`✓ OTONOM Buffer Bridge v${reply.version || '?'} hazır; API anahtarı eklenti storage alanında.`, 'success');
    return reply;
  };

  const probeBufferMediaHost = async (requireDurable = true) => {
    const reply = await bufferExtensionRequest(
      'BUFFER_UPLOAD_PREFLIGHT',
      { requireDurable: !!requireDurable },
      7000
    );

    if (!reply) {
      throw new Error('Buffer Bridge medya hostu ön kontrolüne yanıt vermedi.');
    }

    if (!reply.ok) {
      throw new Error(reply.error || 'Buffer Bridge medya hostu hazır değil.');
    }

    if (requireDurable && !reply.durableConfigured) {
      throw new Error(
        'Planlı/video paylaşımı için kalıcı public medya hostu ayarlı değil. ' +
        'OTONOM Buffer Bridge V3 > Uzantı seçenekleri içinde Cloudinary Cloud Name + Unsigned Upload Preset ' +
        'veya Catbox Userhash ayarlayın; sonra "Medya Hostunu Test Et" düğmesine basın.'
      );
    }

    addSystemLog(
      `✓ Buffer medya hostu ön kontrolü: ${reply.provider || 'hazır'}${reply.durableConfigured ? ' (kalıcı)' : ''}.`,
      'success'
    );

    return reply;
  };

  const bufferGraphQLViaExtension = async (query, variables = {}) => {
    const reply = await bufferExtensionRequest(
      'BUFFER_GRAPHQL',
      { query, variables },
      30000
    );

    if (!reply) {
      bufferExtensionAvailableRef.current = false;
      throw new Error('OTONOM Buffer Bridge yanıt zaman aşımı.');
    }

    if (!reply.ok) {
      const suffix = reply.status ? ` (HTTP ${reply.status})` : '';
      throw new Error(`${reply.error || 'Buffer API isteği başarısız'}${suffix}`);
    }

    const json = reply.response || {};

    if (Array.isArray(json.errors) && json.errors.length) {
      const err = json.errors[0] || {};
      const code = err?.extensions?.code ? ` (${err.extensions.code})` : '';
      throw new Error(`${err?.message || 'Buffer API hatası'}${code}`);
    }

    return json.data || {};
  };

  const formatGazeteDuration = (ms) => {
    const totalSec = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const reserveNextBufferAutoSlot = () => {
    const intervalMinutes = 10;
    const intervalMs = intervalMinutes * 60 * 1000;
    const now = Date.now();

    let nextDue = Number(bufferAutoNextDueAtRef.current || 0);
    const lastDue = Number(bufferAutoLastDueAtRef.current || 0);

    // Slot hem şu andan interval kadar ileride, hem de önceki planlı posttan
    // en az aynı interval kadar ileride olmak zorunda.
    const minFromNow = now + intervalMs;
    const minFromLast = lastDue > 0 ? lastDue + intervalMs : 0;

    if (!Number.isFinite(nextDue) || nextDue <= 0) {
      nextDue = Math.max(minFromNow, minFromLast);
    } else {
      nextDue = Math.max(nextDue, minFromNow, minFromLast);
    }

    bufferAutoLastDueAtRef.current = nextDue;
    bufferAutoNextDueAtRef.current = nextDue + intervalMs;

    SafeStorage.setItem(BUFFER_AUTO_LAST_DUE_KEY, String(bufferAutoLastDueAtRef.current));
    SafeStorage.setItem(BUFFER_AUTO_NEXT_DUE_KEY, String(bufferAutoNextDueAtRef.current));
    SafeStorage.setItem(BUFFER_AUTO_INTERVAL_KEY, String(intervalMinutes));

    return {
      dueAt: new Date(nextDue).toISOString(),
      intervalMinutes
    };
  };

  const bufferExtensionUploadMedia = (blob, fileName, uploadOptions = {}, timeoutMs = 240000) => new Promise((resolve, reject) => {
    if (!(blob instanceof Blob) || !blob.size) {
      reject(new Error('Eklentiye gönderilecek medya Blob değil veya boş.'));
      return;
    }

    const requestId = `buffer_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== 'OTONOM_BUFFER_EXTENSION' || data.id !== requestId) return;

      if (data.type === 'BUFFER_UPLOAD_PROGRESS') {
        if (Number.isFinite(data.percent)) {
          const pct = Math.max(0, Math.min(100, Math.round(data.percent)));
          if (pct === 25 || pct === 50 || pct === 75 || pct === 100) {
            addSystemLog(`Buffer medya eklenti aktarımı: %${pct}`, 'info');
          }
        }
        return;
      }

      if (data.type !== 'BUFFER_RESULT') return;

      bufferExtensionAvailableRef.current = true;

      if (!data.ok) {
        finishReject(new Error(data.error || 'Buffer Bridge medya yükleme hatası.'));
        return;
      }

      if (!data.url || !/^https:\/\//i.test(data.url)) {
        finishReject(new Error('Buffer Bridge public HTTPS medya URL’si döndürmedi.'));
        return;
      }

      finishResolve({
        url: data.url,
        provider: data.provider || 'Buffer Bridge',
        size: data.size || blob.size
      });
    };

    const timer = setTimeout(() => {
      bufferExtensionAvailableRef.current = false;
      finishReject(new Error('Buffer Bridge medya yükleme zaman aşımı.'));
    }, timeoutMs);

    window.addEventListener('message', onMessage);

    // Blob yalnız gerçek uygulama iframe'ine gönderilir.
    // Content script aynı frame'de all_frames ile yüklüdür; gereksiz büyük Blob kopyaları yok.
    try {
      window.postMessage({
        source: 'OTONOM_APP',
        type: 'BUFFER_MEDIA_UPLOAD',
        id: requestId,
        payload: {
          blob,
          fileName,
          mimeType: blob.type || 'application/octet-stream',
          size: blob.size,
          requireDurable: !!uploadOptions.requireDurable
        }
      }, '*');
    } catch (e) {
      finishReject(new Error(`Medya Buffer eklentisine aktarılamadı: ${e.message}`));
    }
  });

  const uploadMediaToCloud = async (blobOrUrl, fileName = 'video.mp4', uploadOptions = {}) => {
    try {
      const sourceString = typeof blobOrUrl === 'string' ? blobOrUrl : '';
      const intendedVideo =
        (blobOrUrl instanceof Blob && String(blobOrUrl.type || '').startsWith('video/')) ||
        /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(sourceString) ||
        sourceString.startsWith('blob:') ||
        sourceString.startsWith('data:video/') ||
        /\.(mp4|webm|mov)$/i.test(fileName) ||
        /video/i.test(fileName);

      if (intendedVideo) {
        bufferCfrGuardRef.current = {
          verified: false,
          fps: 0,
          sourceType: sourceString.startsWith('http')
            ? 'http'
            : sourceString.startsWith('blob:')
              ? 'blob-url'
              : sourceString.startsWith('data:')
                ? 'data-url'
                : (blobOrUrl instanceof Blob ? 'blob' : typeof blobOrUrl),
          checkedAt: Date.now()
        };
      }

      let blob = blobOrUrl;

      if (typeof blobOrUrl === 'string' && blobOrUrl.startsWith('blob:')) {
        const res = await fetch(blobOrUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Blob video okunamadı: HTTP ${res.status}`);
        blob = await res.blob();
      }
      else if (typeof blobOrUrl === 'string' && blobOrUrl.startsWith('data:')) {
        const parts = blobOrUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || (intendedVideo ? 'video/mp4' : 'application/octet-stream');
        const bstr = atob(parts[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        blob = new Blob([u8arr], { type: mime });
      }
      else if (typeof blobOrUrl === 'string' && /^https?:\/\//i.test(blobOrUrl)) {
        if (!intendedVideo) {
          // Görseller için mevcut public URL davranışı korunur.
          return blobOrUrl;
        }

        // v1.34 KRİTİK: public HTTPS video artık CFR'ı BYPASS EDEMEZ.
        addSystemLog('Instagram CFR guard: public video URL önce indiriliyor; doğrudan URL geçişi yasak.', 'info');

        let remoteResponse;
        try {
          remoteResponse = await fetch(blobOrUrl, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            mode: 'cors'
          });
        } catch (remoteFetchErr) {
          throw new Error(`Public video CFR için indirilemedi; doğrulanmadan paylaşım yasak: ${remoteFetchErr.message}`);
        }

        if (!remoteResponse.ok) {
          throw new Error(`Public video CFR için indirilemedi: HTTP ${remoteResponse.status}`);
        }

        blob = await remoteResponse.blob();
        if (!blob.size) throw new Error('Public video CFR için indirildi fakat dosya boş.');
      }

      if (!(blob instanceof Blob)) return null;

      // KRİTİK: Instagram/Meta Graph API (Buffer üzerinden paylaşılırken) videonun
      // SABİT (constant) kare hızının 23-60 fps aralığında olmasını zorunlu kılar.
      // Kayıt sırasında canvasElement.captureStream(0) + manuel requestFrame()
      // kullanıldığı için ham WebM/MP4'ün kare zamanlaması düzensizdir ve konteyner
      // meta verisi bu aralığın dışında kalabilir — Instagram videoyu bu yüzden
      // reddediyordu. Bu yüzden Instagram/Buffer'a giden HER video, yüklenmeden
      // önce mutlaka sabit 30 fps'e (23-60 aralığının ortası, güvenli) yeniden kodlanır.
      const isVideoFile = intendedVideo;
      if (isVideoFile) {
        try {
          addSystemLog('Instagram/Buffer uyumluluğu: Sabit 30 FPS (CFR) MP4 kodlanıyor...', 'info');
          let firstFrameCoverBlob = null;
          try {
            const renderedCover = workflowRef.current?.state?.assets?._renderedClickbaitFrame;
            if (typeof renderedCover === 'string' && renderedCover.startsWith('data:image/')) {
              const coverResponse = await fetch(renderedCover);
              firstFrameCoverBlob = await coverResponse.blob();
            }
          } catch (coverErr) {
            ErrorHandler.silent(coverErr);
          }

          let lastCfrProgressBucket = 0;
          blob = await convertWebMtoMP4(
            blob,
            (pct) => {
              const bucket =
                pct >= 100 ? 100 :
                pct >= 75 ? 75 :
                pct >= 50 ? 50 :
                pct >= 25 ? 25 : 0;

              if (bucket > lastCfrProgressBucket) {
                lastCfrProgressBucket = bucket;
                addSystemLog(`Instagram CFR kodlama: %${bucket}`, 'info');
              }
            },
            firstFrameCoverBlob
          );

          fileName = fileName.replace(/\.[^.]+$/, '') + '.mp4';

          // convertWebMtoMP4 zaten doğruluyor; burada Buffer kapısından hemen önce
          // ikinci bağımsız doğrulama yapılır. Bu guard false ise post oluşturulamaz.
          const finalCfrCheck = await _verifyInstagramCfrMp4(blob);
          if (
            !finalCfrCheck?.ok ||
            Math.abs(Number(finalCfrCheck.fps || 0) - 30) > 0.02
          ) {
            throw new Error(`Final Buffer CFR guard başarısız: ${Number(finalCfrCheck?.fps || 0).toFixed(3)} FPS`);
          }

          bufferCfrGuardRef.current = {
            verified: true,
            fps: Number(finalCfrCheck.fps),
            sourceType: bufferCfrGuardRef.current.sourceType || 'unknown',
            checkedAt: Date.now()
          };

          addSystemLog(
            firstFrameCoverBlob
              ? `✓ FIX CHECKLIST v1.34: Buffer video ${finalCfrCheck.fps.toFixed(3)} FPS CFR iki kez doğrulandı + ilk 0.80sn clickbait frame kilidi aktif.`
              : `✓ FIX CHECKLIST v1.34: Buffer video ${finalCfrCheck.fps.toFixed(3)} FPS CFR iki kez doğrulandı; CFR bypass kapalı.`,
            'success'
          );
        } catch (convErr) {
          addSystemLog(`Instagram CFR kodlama başarısız — ham/VFR video GÖNDERİLMEYECEK: ${convErr.message}`, 'error');
          throw new Error(`Instagram 23-60 FPS güvenlik kontrolü başarısız: ${convErr.message}`);
        }
      }
      addSystemLog('Video/Medya public HTTPS adrese Buffer eklentisi üzerinden yükleniyor...', 'info');

      // v1.39: upload işlemi sayfa/iframe içinden DEĞİL extension background worker'dan yapılır.
      // Böylece CORS / localhost / Gemini iframe kısıtları medya hosting yolunu etkileyemez.
      await probeBufferExtension();

      const uploadResult = await bufferExtensionUploadMedia(
        blob,
        fileName,
        { requireDurable: !!uploadOptions.requireDurable }
      );

      addSystemLog(
        `✓ Video/Medya public HTTPS adrese yüklendi (${uploadResult.provider}): ${uploadResult.url}`,
        'success'
      );

      return uploadResult.url;
    } catch (e) {
      addSystemLog('Buffer public medya yükleme hatası: ' + e.message, 'error');
    }
    return null;
  };

  // Buffer API ile paylaşım — güncel GraphQL API, 3 kanal ve gönderim doğrulaması.
  // Resmî endpoint: https://api.buffer.com . API anahtarı hiçbir üçüncü taraf CORS proxy'sine gönderilmez.
  // Buffer paylaşımı — v1.37 Chrome Extension bridge.
  // localhost/BAT/CORS yok. API key TSX'e hiç girmez.
  const shareToBufferAPI = async (text, mediaUrl = null, shareOptions = {}) => {
    bufferCfrGuardRef.current = { verified: false, fps: 0, sourceType: '', checkedAt: 0 };

    const scheduleAt = shareOptions?.scheduleAt
      ? new Date(shareOptions.scheduleAt).toISOString()
      : null;
    const isScheduled = !!scheduleAt;

    if (isScheduled && new Date(scheduleAt).getTime() <= Date.now() + 15_000) {
      throw new Error('Buffer planlama zamanı gelecekte olmalı.');
    }

    addSystemLog('OTONOM Buffer Bridge kontrol ediliyor...', 'info');
    await probeBufferExtension();

    const bufferGraphQL = bufferGraphQLViaExtension;

    const accountQuery = `query BufferAccount { account { organizations { id name } } }`;
    addSystemLog('Buffer hesabı eklenti üzerinden doğrulanıyor...', 'info');
    const accountData = await bufferGraphQL(accountQuery);
    const org = accountData?.account?.organizations?.[0];
    if (!org?.id) throw new Error('Buffer organizasyonu bulunamadı veya eklenti API anahtarı yetkisiz.');

    const channelsQuery = `query GetChannels($input: ChannelsInput!) {
      channels(input: $input) { id name displayName service isQueuePaused }
    }`;
    const channelsData = await bufferGraphQL(channelsQuery, { input: { organizationId: org.id } });
    const allChannels = Array.isArray(channelsData?.channels) ? channelsData.channels : [];
    if (!allChannels.length) throw new Error('Buffer hesabında bağlı sosyal medya kanalı bulunamadı.');

    // Öncelik: X/Twitter + Instagram + TikTok
    const priority = ['twitter', 'instagram', 'tiktok'];
    const targetChannels = [];

    for (const service of priority) {
      const found = allChannels.find(ch =>
        String(ch.service || '').toLowerCase() === service &&
        !targetChannels.some(t => t.id === ch.id)
      );
      if (found) targetChannels.push(found);
    }

    for (const ch of allChannels) {
      if (targetChannels.length >= 3) break;
      if (!targetChannels.some(t => t.id === ch.id)) targetChannels.push(ch);
    }

    const finalChannels = targetChannels.slice(0, 3);
    if (!finalChannels.length) throw new Error('Buffer hedef kanalı bulunamadı.');

    addSystemLog(
      `✓ Buffer hedefleri: ${finalChannels.map(ch => ch.displayName || ch.name || ch.service).join(', ')}`,
      'success'
    );

    setBufferShareReport({
      status: 'sharing',
      message: isScheduled
        ? `Video hazırlanıyor; ${new Date(scheduleAt).toLocaleString('tr-TR')} için planlanacak...`
        : 'Video hazırlanıyor ve Buffer kanalları doğrulanıyor...',
      results: finalChannels.map(ch => ({
        channelId: ch.id,
        name: ch.displayName || ch.name || ch.service,
        service: ch.service,
        state: 'waiting',
        detail: 'Bekliyor'
      }))
    });

    const scriptObj = workflowRef.current?.state?.script || {};
    const headline = textInput || scriptObj.thumbnailText || text || 'OTONOM Haber';
    const desc = scriptObj.tiktokDescription ? `\n\n${scriptObj.tiktokDescription}` : '';
    const tags = Array.isArray(scriptObj.tiktokHashtags) && scriptObj.tiktokHashtags.length > 0
      ? `\n\n${scriptObj.tiktokHashtags.join(' ')}`
      : '';

    const normalText =
      makeTikTokSafeText(`${headline}${desc}${tags}`.replace(/blob:https?:[^\s]+/gi, '').trim()) ||
      'OTONOM Haber';

    const tiktokText =
      `${makeTikTokSafeText(headline)}${desc ? `\n\n${makeTikTokSafeText(scriptObj.tiktokDescription || '')}` : ''}${tags}\n\nAI destekli içerik.`.trim();

    const targetMedia =
      mediaUrl ||
      uiState.videoUrl ||
      (studioMedia.customSceneImages && studioMedia.customSceneImages[0]);

    if (!targetMedia) throw new Error('Paylaşılacak video/görsel bulunamadı.');

    const isVideo =
      config.outputType === 'video' ||
      (typeof targetMedia === 'string' && (
        targetMedia.includes('.mp4') ||
        targetMedia.includes('.webm') ||
        targetMedia.startsWith('blob:')
      ));

    // v1.44: 3 dakikalık CFR işlemine girmeden önce kalıcı medya hostunu doğrula.
    // Video ve planlı gönderiler geçici anonim hostlara bırakılmaz.
    const requireDurableMediaHost = isVideo || isScheduled;
    await probeBufferMediaHost(requireDurableMediaHost);

    const directCloudUrl = await uploadMediaToCloud(
      targetMedia,
      `gundem_notlari_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
      { requireDurable: requireDurableMediaHost }
    );

    if (!directCloudUrl || !/^https:\/\//i.test(directCloudUrl)) {
      throw new Error(
        'Medya herkese açık HTTPS adrese yüklenemedi. Buffer medya dosyasını doğrudan alamadığı için paylaşım durduruldu.'
      );
    }

    addSystemLog('✓ Buffer için herkese açık medya URL’si hazır.', 'success');

    // v1.34 HARD GATE korunuyor.
    if (isVideo) {
      const guard = bufferCfrGuardRef.current;
      if (
        !guard?.verified ||
        !(Number(guard.fps) >= 23 && Number(guard.fps) <= 60) ||
        Math.abs(Number(guard.fps) - 30) > 0.02
      ) {
        throw new Error(
          `Buffer paylaşımı durduruldu: 30 FPS CFR doğrulama guard'ı geçilmedi ` +
          `(verified=${!!guard?.verified}, fps=${Number(guard?.fps || 0).toFixed(3)}, source=${guard?.sourceType || 'unknown'}).`
        );
      }

      addSystemLog(
        `✓ Buffer HARD GATE: ${guard.fps.toFixed(3)} FPS CFR doğrulandı.`,
        'success'
      );
    }

    const createMutation = `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess {
          post {
            id
            status
            dueAt
            channelId
            channelService
            externalLink
            error { message supportUrl }
          }
        }
        ... on MutationError { message }
      }
    }`;

    const results = [];

    for (let index = 0; index < finalChannels.length; index++) {
      const ch = finalChannels[index];
      const name = ch.displayName || ch.name || ch.service || `Kanal ${index + 1}`;
      const service = String(ch.service || '').toLowerCase();

      setBufferShareReport(prev => ({
        ...prev,
        message: isScheduled
          ? `${name} ${new Date(scheduleAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} için planlanıyor...`
          : `${name} Buffer'a gönderiliyor...`,
        results: prev.results.map(r =>
          r.channelId === ch.id
            ? {
                ...r,
                state: 'creating',
                detail: isScheduled ? 'Buffer’a planlanıyor' : 'Buffer’a gönderiliyor'
              }
            : r
        )
      }));

      try {
        const coverOffsetMs = 1000;
        const supportsVideoCoverOffset = ['instagram', 'tiktok', 'pinterest'].includes(service);

        const assetObj = isVideo
          ? {
              video: {
                url: directCloudUrl,
                ...(supportsVideoCoverOffset
                  ? { metadata: { thumbnailOffset: coverOffsetMs } }
                  : {})
              }
            }
          : { image: { url: directCloudUrl } };

        const input = {
          channelId: ch.id,
          text: service === 'tiktok' ? tiktokText : normalText,
          mode: isScheduled ? 'customScheduled' : 'shareNow',
          ...(isScheduled ? { dueAt: scheduleAt } : {}),
          schedulingType: 'automatic',
          needsApproval: false,
          saveToDraft: false,
          aiAssisted: true,
          assets: [assetObj]
        };

        if (service === 'instagram') {
          input.metadata = {
            instagram: {
              type: isVideo ? 'reel' : 'post',
              shouldShareToFeed: true,
              isAiGenerated: true
            }
          };
        } else if (service === 'tiktok') {
          input.metadata = { tiktok: { isAiGenerated: true } };
        } else if (service === 'twitter') {
          input.metadata = { twitter: { isAiGenerated: true } };
        }

        const createData = await bufferGraphQL(createMutation, { input });
        const payload = createData?.createPost;

        if (!payload?.post?.id) {
          const msg = payload?.message || 'Buffer post oluşturmadı.';
          results.push({
            channelId: ch.id,
            name,
            service,
            state: 'error',
            detail: msg
          });
          addSystemLog(`✗ ${name}: ${msg}`, 'error');
          continue;
        }

        const createdStatus = payload.post.status || (isScheduled ? 'scheduled' : 'sending');

        if (isScheduled) {
          const scheduledResult = {
            channelId: ch.id,
            name,
            service,
            postId: payload.post.id,
            state: 'scheduled',
            detail: `Planlandı: ${new Date(scheduleAt).toLocaleString('tr-TR')}`,
            dueAt: payload.post.dueAt || scheduleAt,
            externalLink: payload.post.externalLink || null
          };
          results.push(scheduledResult);

          addSystemLog(
            `✓ ${name}: Buffer planladı — ${new Date(scheduleAt).toLocaleString('tr-TR')}.`,
            'success'
          );

          setBufferShareReport(prev => ({
            ...prev,
            results: prev.results.map(r =>
              r.channelId === ch.id ? scheduledResult : r
            )
          }));
        } else {
          const createdResult = {
            channelId: ch.id,
            name,
            service,
            postId: payload.post.id,
            state: 'created',
            detail: createdStatus,
            externalLink: payload.post.externalLink || null
          };
          results.push(createdResult);

          addSystemLog(`✓ ${name}: Buffer gönderimi kabul etti (${createdStatus}).`, 'success');
          setBufferShareReport(prev => ({
            ...prev,
            results: prev.results.map(r =>
              r.channelId === ch.id
                ? {
                    ...r,
                    postId: payload.post.id,
                    state: 'verifying',
                    detail: `Doğrulanıyor: ${createdStatus}`
                  }
                : r
            )
          }));
        }
      } catch (e) {
        results.push({
          channelId: ch.id,
          name,
          service,
          state: 'error',
          detail: e.message
        });
        addSystemLog(`✗ ${name}: ${e.message}`, 'error');
      }
    }

    // Planlı gönderiler "sent" olana kadar beklenmez; Buffer kuyruğuna girmesi başarıdır.
    if (isScheduled) {
      const scheduledCount = results.filter(r => r.state === 'scheduled').length;
      const errorCount = results.filter(r => r.state === 'error').length;
      const finalMessage = `${scheduledCount} kanal planlandı, ${errorCount} hata.`;

      setBufferShareReport({
        status: errorCount > 0
          ? (scheduledCount > 0 ? 'partial' : 'error')
          : 'success',
        results,
        message: finalMessage
      });

      return {
        sentCount: 0,
        scheduledCount,
        errorCount,
        pendingCount: 0,
        results,
        scheduleAt
      };
    }

    const getPostQuery = `query GetPost($input: PostInput!) {
      post(input: $input) {
        id
        status
        dueAt
        channelId
        channelService
        externalLink
        error { message supportUrl }
      }
    }`;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const verifyOne = async (result) => {
      if (!result.postId || result.state === 'error') return result;

      let lastStatus = result.detail || 'sending';

      for (let attempt = 0; attempt < 15; attempt++) {
        try {
          const data = await bufferGraphQL(getPostQuery, { input: { id: result.postId } });
          const post = data?.post;
          if (!post) throw new Error('Post durumu alınamadı.');

          lastStatus = post.status || lastStatus;

          if (post.status === 'sent') {
            const verified = {
              ...result,
              state: 'sent',
              detail: 'Gönderildi ve Buffer tarafından doğrulandı',
              externalLink: post.externalLink || result.externalLink || null
            };
            addSystemLog(`✓ ${result.name}: GÖNDERİLDİ ve doğrulandı.`, 'success');
            return verified;
          }

          if (post.status === 'error') {
            const msg = post.error?.message || 'Sosyal ağ yayını hata aldı.';
            const failed = {
              ...result,
              state: 'error',
              detail: msg,
              supportUrl: post.error?.supportUrl || null
            };
            addSystemLog(`✗ ${result.name}: YAYIN HATASI — ${msg}`, 'error');
            return failed;
          }
        } catch (e) {
          lastStatus = `Doğrulama hatası: ${e.message}`;
        }

        await sleep(2000);
      }

      return {
        ...result,
        state: 'pending',
        detail: `Buffer kabul etti; son durum henüz kesinleşmedi (${lastStatus}).`
      };
    };

    setBufferShareReport(prev => ({
      ...prev,
      message: 'Kanalların yayın sonucu eklenti üzerinden doğrulanıyor...'
    }));

    const verifiedResults = await Promise.all(results.map(verifyOne));
    const sentCount = verifiedResults.filter(r => r.state === 'sent').length;
    const errorCount = verifiedResults.filter(r => r.state === 'error').length;
    const pendingCount = verifiedResults.filter(r =>
      r.state === 'pending' || r.state === 'created'
    ).length;

    const finalMessage =
      `${sentCount} gönderildi, ${errorCount} hata, ${pendingCount} beklemede.`;

    setBufferShareReport({
      status:
        errorCount > 0
          ? 'partial'
          : (sentCount === verifiedResults.length ? 'success' : 'pending'),
      results: verifiedResults,
      message: finalMessage
    });

    return {
      sentCount,
      scheduledCount: 0,
      errorCount,
      pendingCount,
      results: verifiedResults
    };
  };

  const shareToSelectedPlatforms = async () => {
    // v1.42 senkron kilit: React state güncellenmesini beklemeden ikinci tıklamayı kes.
    if (bufferManualShareLockRef.current || bufferShareReport.status === 'sharing') {
      addSystemLog('[PAYLAŞ] Aynı paylaşım zaten çalışıyor; ikinci tetikleme yok sayıldı.', 'warn');
      return;
    }

    bufferManualShareLockRef.current = true;

    const title = textInput || workflowRef.current?.state?.script?.thumbnailText || 'OTONOM Haber';
    setBufferShareReport({ status: 'sharing', results: [], message: 'Buffer paylaşımı başlatılıyor...' });
    addSystemLog('[PAYLAŞ] Buffer üzerinden 3 sosyal medya kanalına TEK paylaşım başlatıldı.', 'info');

    try {
      const report = await shareToBufferAPI(title, uiState.videoUrl);

      if (report.sentCount === report.results.length && report.results.length > 0) {
        addSystemLog(
          `✓ FIX CHECKLIST v1.42: Paylaşım tamamlandı — ${report.sentCount}/${report.results.length} kanal, kanal başına 1 post.`,
          'success'
        );
      } else {
        addSystemLog(
          `Paylaşım sonucu: ${report.sentCount} gönderildi, ${report.errorCount} hata, ${report.pendingCount} beklemede.`,
          report.errorCount ? 'warn' : 'info'
        );
      }
    } catch (e) {
      setBufferShareReport({ status: 'error', results: [], message: e.message });
      addSystemLog(`[PAYLAŞ] Buffer hatası: ${e.message}`, 'error');
    } finally {
      bufferManualShareLockRef.current = false;
    }
  };

  const shareToPlatform = async (platform, title, videoUrl) => {
    try {
      const report = await shareToBufferAPI(title || textInput || 'OTONOM Haber', videoUrl);
      addSystemLog(`Buffer sonucu: ${report.sentCount} gönderildi, ${report.errorCount} hata, ${report.pendingCount} beklemede.`, report.errorCount ? 'warn' : 'success');
    } catch(e) { addSystemLog('Buffer paylaşım hatası: ' + e.message, 'error'); }
  };

  // === AYARLAR YEREL'E KAYDEDİLİR (Firestore yerine SafeStorage) ===
  useEffect(() => { SafeStorage.setItem('ns_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { SafeStorage.setItem('ns_textInput', textInput); }, [textInput]);
  useEffect(() => { SafeStorage.setItem('ns_config', JSON.stringify(config)); }, [config]);
  useEffect(() => { SafeStorage.setItem('ns_prefs', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => { SafeStorage.setItem('ns_voiceFilters', JSON.stringify(voiceFilters)); }, [voiceFilters]);
  useEffect(() => {
    SafeStorage.setItem(BUFFER_AUTO_5MIN_ENABLED_KEY, bufferAuto5MinEnabled ? '1' : '0');
  }, [bufferAuto5MinEnabled]);

  useEffect(() => { let interval; if (uiState.isProcessing) { setElapsedSeconds(0); const start = performance.now(); interval = setInterval(() => { setElapsedSeconds(((performance.now() - start) / 1000).toFixed(1)); }, 100); } else clearInterval(interval); return () => clearInterval(interval); }, [uiState.isProcessing]);

  useEffect(() => {
    sysEventBus.on('SYS_LOG_ADD', (log) => setSysLogs(prev => [...prev, log]));
    sysEventBus.on('SYS_LOG_CLEAR', () => sysEventBus.emit('SYS_LOG_CLEAR_DONE'));
    sysEventBus.on('SYS_LOG_CLEAR_DONE', () => setSysLogs([]));
    sysEventBus.on('PROGRESS', (data) => { const p = Math.min(100, Math.max(0, Math.round(data.percent || 0))); setUiState(prev => ({ ...prev, percent: p, statusText: data.text || prev.statusText })); });
    sysEventBus.on('WORKFLOW_STATE', (data) => {
      const isGazeteDirectJob = !!(gazeteAutoVideoRef.current.active || data?.job?.config?._gazeteDirectClick);
      const gazeteJobName = gazeteAutoVideoRef.current.name || data?.job?.config?._gazeteSourceLock || data?.job?.config?.sourceName || 'Gazete';

      if (data.status === 'FAILED') {
        setUiState(prev => ({
          ...prev,
          isProcessing: false,
          error: data.job.error,
          ...(isGazeteDirectJob ? { selectedMediaFiles: [] } : {})
        }));

        if (isGazeteDirectJob) {
          gazeteAutoVideoRef.current = { active: false, name: '' };
          gazeteStartLockRef.current = { locked: false, token: '', name: '' };
          setActiveTab('gazete');
          setGazeteGalleryView('grid');
          setTimeout(() => gazeteGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        } else {
          gazeteStartLockRef.current = { locked: false, token: '', name: '' };
        }
      }

      if (data.status === 'COMPLETED') {
        setUiState(prev => ({
          ...prev,
          isProcessing: false,
          percent: 100,
          statusText: 'Tamamlandı!',
          videoUrl: data.job.videoUrl,
          ...(isGazeteDirectJob ? { selectedMediaFiles: [] } : {})
        }));

        // Kaydetme işlemi grid'e dönüşü engellemesin.
        void autoSaveVideo(data.job.videoUrl, data.job.script?.thumbnailText || 'video', data.job.config?.videoFormat);
        try { exportWorkflowLog(data.job); } catch (e) { console.warn('Log export hatası:', e); }

        if (isGazeteDirectJob) {
          gazeteAutoVideoRef.current = { active: false, name: '' };
          gazeteStartLockRef.current = { locked: false, token: '', name: '' };
          setActiveTab('gazete');
          setGazeteGalleryView('grid');
          setGazeteCurrentIdx(0);

          setTimeout(() => {
            gazeteGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);

          addSystemLog(`✓ ${gazeteJobName} videosu tamamlandı. Video hazır; 30 gazetelik seçim listesi yeniden gösteriliyor.`, 'success');
        }
      }
    });
    // FIREBASE KALDIRILDI: sysEventBus.on('AUTH_EXPIRED', ...) satırı silindi
  }, []);

  useEffect(() => { if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [sysLogs]);

  // === YEREL MÜZİK YÜKLEME — klasör bir kez seçildikten sonra her açılışta otomatik yükle/senkronla ===
  useEffect(() => {
    const loadLocalMusic = async () => {
      try {
        // Tarayıcıdan mümkünse kalıcı depolama iste; IndexedDB müzikleri yeniden açılışlarda korunur.
        try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch (e) { ErrorHandler.silent(e); }

        let allMusic = await AssetManagerService.getAllMusicFromLib();
        if (allMusic.length === 0) {
          const migratedCount = await AssetManagerService.migrateLegacyMusicLibraries();
          if (migratedCount > 0) {
            allMusic = await AssetManagerService.getAllMusicFromLib();
            addSystemLog(`🎵 Önceki sürümden ${migratedCount} müzik otomatik taşındı.`, 'success');
          }
        }
        let savedFolderName = SafeStorage.getItem('ns_syncedFolderName') || (allMusic.length > 0 ? 'Muzik' : '');

        // File System Access API ile seçilmiş klasör varsa ve izin hâlâ verilmişse açılışta otomatik senkronla.
        try {
          const savedDir = await AssetManagerService.getDirHandle();
          const dirHandle = savedDir?.handle;
          if (dirHandle) {
            savedFolderName = savedDir?.name || dirHandle.name || savedFolderName || 'Muzik';
            SafeStorage.setItem('ns_syncedFolderName', savedFolderName);
            let permission = 'granted';
            if (typeof dirHandle.queryPermission === 'function') permission = await dirHandle.queryPermission({ mode: 'read' });
            if (permission === 'granted') {
              const added = await syncMusicFromDir(dirHandle, allMusic);
              allMusic = await AssetManagerService.getAllMusicFromLib();
              addSystemLog(`🎵 ${savedFolderName} otomatik yüklendi${added > 0 ? `, ${added} yeni müzik eklendi` : ''}. Toplam ${allMusic.length} müzik.`, 'success');
            } else {
              addSystemLog(`🎵 ${savedFolderName} kayıtlı. Tarayıcı klasör iznini yeniden isterse sadece MÜZİK KLASÖRÜ SEÇ'e bir kez basın. Kayıtlı ${allMusic.length} müzik yine yüklendi.`, 'info');
            }
          }
        } catch (e) {
          addSystemLog(`Müzik klasörü otomatik senkronlanamadı; kayıtlı kütüphane kullanılacak.`, 'warn');
        }

        setStudioMedia(s => ({ ...s, musicList: [...allMusic], musicLoaded: allMusic.length > 0, isLoading: false, statusMsg: 'Yerel Mod', syncedFolderName: savedFolderName }));
        if (allMusic.length > 0) {
          if (!SafeStorage.getItem('ns_syncedFolderName') && savedFolderName) SafeStorage.setItem('ns_syncedFolderName', savedFolderName);
          addSystemLog(`🎵 Müzik kütüphanesi hazır: ${allMusic.length} müzik.`, 'success');
          const polyushkaTrack = findDefaultPolyushkaTrack(allMusic);

          let targetBgmId = polyushkaTrack?.id || SafeStorage.getItem('ns_selectedBgmId');

          if (!targetBgmId || targetBgmId === 'none') {
            const savedPrefs = JSON.parse(SafeStorage.getItem('ns_prefs')) || {};
            if (
              savedPrefs.ambientSound &&
              !['none', 'rain', 'wind', 'waves', 'fire'].includes(savedPrefs.ambientSound)
            ) {
              targetBgmId = savedPrefs.ambientSound;
            }
          }

          let activeTrack =
            polyushkaTrack ||
            allMusic.find(m => m.id === targetBgmId) ||
            allMusic[0];

          targetBgmId = activeTrack?.id || targetBgmId;

          if (activeTrack && activeTrack.data) {
            const blob = _base64ToBlob(activeTrack.data);
            const url = ObjectURLManager.create(blob);
            await AssetManagerService.saveMedia('CUSTOM_MUSIC', url);

            SafeStorage.setItem('ns_selectedBgmId', targetBgmId);
            SafeStorage.setItem('ns_selectedBgmName', activeTrack.name);

            setPrefs(p => {
              const np = {
                ...p,
                ambientSound: targetBgmId,
                customBgMusicName: activeTrack.name,
                customBgMusicId: targetBgmId,
                backgroundMusicVolume: DEFAULT_BGM_VOLUME
              };
              SafeStorage.setItem('ns_prefs', JSON.stringify(np));
              return np;
            });

            addSystemLog(
              polyushkaTrack
                ? `✓ FIX CHECKLIST v1.41: polyushka otomatik seçildi; arka plan sesi %20.`
                : `polyushka kütüphanede bulunamadı; mevcut müzik kullanılıyor: ${activeTrack.name} (%20).`,
              polyushkaTrack ? 'success' : 'warn'
            );
          }
        } else {
          addSystemLog("Müzik kütüphanesi boş. 'MÜZİK KLASÖRÜ SEÇ' butonundan bir kez ekleyin; sonraki açılışlarda otomatik gelir.", 'info');
        }
      } catch (e) { setStudioMedia(s => ({ ...s, isLoading: false, statusMsg: 'Yerel Mod' })); }
    };
    loadLocalMusic();
  }, []);

  // FIREBASE KALDIRILDI: saveToFirestore, uploadChunks, downloadChunks, auth init, settings sync, onSnapshot efekti — hepsi silindi.
  // Onun yerine aşağıdaki YEREL preload efekti kullanılır.

  // === YEREL VARLIK YÜKLEME (Firebase onSnapshot yerine tamamen yerel) ===
  useEffect(() => {
    const preloadLocal = async () => {
      try {
        const localOutro = await AssetManagerService.loadMedia('CUSTOM_OUTRO');
        const csi = [];
        for (let i = 0; i < RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES; i++) { const img = await AssetManagerService.loadMedia("CUSTOM_SCENE_IMG_" + i); if (img) csi.push(img); }
        const allMusics = await AssetManagerService.getAllMusicFromLib();
        const savedFolderName = SafeStorage.getItem('ns_syncedFolderName') || (allMusics.length > 0 ? 'Muzik' : '');
        setStudioMedia(s => ({ ...s, outroUrl: s.outroUrl || localOutro, musicList: s.musicList.length > 0 ? s.musicList : allMusics, musicLoaded: (s.musicList.length > 0 || allMusics.length > 0), customSceneImages: csi, isLoading: false, statusMsg: 'Yerel Mod', syncedFolderName: savedFolderName }));
      } catch (e) {
        setStudioMedia(s => ({ ...s, isLoading: false, statusMsg: 'Yerel Mod' }));
      }
    };
    preloadLocal();
  }, []);

  // FIREBASE DEĞİŞİKLİĞİ: uploadChunks/saveToFirestore kaldırıldı — sadece IndexedDB
  const handleOutroUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setStudioMedia(s => ({ ...s, isLoading: true, statusMsg: 'Kapak Yükleniyor...' }));
    const b64 = await NetworkUtils.compressImage(file);
    await AssetManagerService.saveMedia('CUSTOM_OUTRO', b64);
    setStudioMedia(s => ({ ...s, outroUrl: b64, isLoading: false, statusMsg: 'Yerel Bellek Aktif' }));
  }, []);

  // FIREBASE DEĞİŞİKLİĞİ: saveToFirestore kaldırıldı — sadece IndexedDB
  const handleOutroDelete = useCallback(async () => {
    await AssetManagerService.deleteMedia('CUSTOM_OUTRO');
    setStudioMedia(s => ({ ...s, outroUrl: null }));
  }, []);

  const handleCustomSceneImagesUpload = useCallback(async (e) => {
    const files = Array.from(e.target ? e.target.files : e); if (!files.length) return;
    const availableSlots = RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES - (studioMedia.customSceneImages?.length || 0);
    const filesToProcess = files.slice(0, availableSlots);
    const newB64s = [];
    for (let file of filesToProcess) { if (file.type.startsWith('image/')) { const b64 = await NetworkUtils.compressImage(file); newB64s.push(b64); } }
    const updatedImages = [...(studioMedia.customSceneImages || []), ...newB64s].slice(0, RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES);
    for (let i = 0; i < updatedImages.length; i++) await AssetManagerService.saveMedia("CUSTOM_SCENE_IMG_" + i, updatedImages[i]);
    setStudioMedia(s => ({ ...s, customSceneImages: updatedImages }));
    const newMediaFiles = newB64s.map((b64, i) => ({ name: `SabitGorsel_${Date.now()}_${i}.jpg`, type: 'image/jpeg', data: b64 }));
    if (newMediaFiles.length > 0) setUiState(prev => ({ ...prev, selectedMediaFiles: [...prev.selectedMediaFiles, ...newMediaFiles] }));
    if (e.target) e.target.value = null;
  }, [studioMedia]);

  const handleCustomSceneImageDelete = useCallback(async (idx) => {
    const updated = studioMedia.customSceneImages.filter((_, i) => i !== idx);
    for (let i = 0; i < RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES; i++) await AssetManagerService.deleteMedia("CUSTOM_SCENE_IMG_" + i);
    for (let i = 0; i < updated.length; i++) await AssetManagerService.saveMedia("CUSTOM_SCENE_IMG_" + i, updated[i]);
    setStudioMedia(s => ({ ...s, customSceneImages: updated }));
  }, [studioMedia]);

  // FIREBASE DEĞİŞİKLİĞİ: saveToFirestore satırı kaldırıldı
  const deleteMusic = async () => {
    try {
      const as = prefs.ambientSound;
      if (as && !['none', 'rain', 'wind', 'waves', 'fire'].includes(as)) {
        const oldUrl = await AssetManagerService.loadMedia('CUSTOM_MUSIC');
        if (oldUrl && oldUrl.startsWith('blob:')) ObjectURLManager.revoke(oldUrl);
        await AssetManagerService.deleteMedia('CUSTOM_MUSIC');
        await AssetManagerService.removeMusicFromLib(as);
        setPrefs(p => ({ ...p, ambientSound: 'none' }));
      }
    } catch(e) { ErrorHandler.silent(e); }
  };

  const handleFolderSelect = async () => {
    try {
      // Chrome/Edge destekliyorsa klasör handle'ını kalıcı sakla. Böylece program her açıldığında otomatik senkronlanabilir.
      if (typeof window.showDirectoryPicker === 'function') {
        let dirHandle = null;
        const savedDir = await AssetManagerService.getDirHandle();
        if (savedDir?.handle) {
          let permission = 'prompt';
          try {
            if (typeof savedDir.handle.queryPermission === 'function') permission = await savedDir.handle.queryPermission({ mode: 'read' });
            if (permission !== 'granted' && typeof savedDir.handle.requestPermission === 'function') permission = await savedDir.handle.requestPermission({ mode: 'read' });
          } catch (e) { ErrorHandler.silent(e); }
          if (permission === 'granted') dirHandle = savedDir.handle;
        }
        if (!dirHandle) dirHandle = await window.showDirectoryPicker({ mode: 'read', id: 'gundem-notlari-muzik' });
        if (!dirHandle) return;

        await AssetManagerService.saveDirHandle(dirHandle);
        try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch (e) { ErrorHandler.silent(e); }
        const folderName = dirHandle.name || 'Muzik';
        SafeStorage.setItem('ns_syncedFolderName', folderName);
        const before = await AssetManagerService.getAllMusicFromLib();
        const added = await syncMusicFromDir(dirHandle, before);
        const allMusic = await AssetManagerService.getAllMusicFromLib();
        setStudioMedia(s => ({ ...s, musicList: [...allMusic], musicLoaded: allMusic.length > 0, syncedFolderName: folderName }));
        addSystemLog(`✅ ${folderName} kalıcı klasör olarak kaydedildi. ${added} yeni müzik eklendi; toplam ${allMusic.length}. Bundan sonra program açılırken otomatik yüklenecek.`, 'success');

        if (allMusic.length > 0) {
          const polyushkaTrack = findDefaultPolyushkaTrack(allMusic);
          const rememberedId = SafeStorage.getItem('ns_selectedBgmId');
          const activeTrack =
            polyushkaTrack ||
            allMusic.find(m => m.id === rememberedId) ||
            allMusic[0];

          if (activeTrack?.data) {
            const blob = _base64ToBlob(activeTrack.data);
            const url = ObjectURLManager.create(blob);
            await AssetManagerService.saveMedia('CUSTOM_MUSIC', url);

            SafeStorage.setItem('ns_selectedBgmId', activeTrack.id);
            SafeStorage.setItem('ns_selectedBgmName', activeTrack.name);

            setPrefs(p => {
              const np = {
                ...p,
                ambientSound: activeTrack.id,
                customBgMusicName: activeTrack.name,
                customBgMusicId: activeTrack.id,
                backgroundMusicVolume: DEFAULT_BGM_VOLUME
              };
              SafeStorage.setItem('ns_prefs', JSON.stringify(np));
              return np;
            });

            if (polyushkaTrack) {
              addSystemLog('✓ Müzik klasörü yüklendi: polyushka otomatik seçildi (%20).', 'success');
            }
          }
        }
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      addSystemLog(`Kalıcı klasör seçimi kullanılamadı, klasik klasör seçici açılıyor: ${e.message || e}`, 'warn');
    }
    // Safari/Firefox veya API desteklenmeyen ortamlarda mevcut klasik klasör yükleme yöntemi.
    if (musicFileInputRef.current) musicFileInputRef.current.click();
  };

  const handleFolderSelectLegacy = async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'];
    const audioFiles = files.filter(f => audioExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (!audioFiles.length) { addSystemLog("Seçilen dosyalarda ses dosyası bulunamadı.", "warn"); return; }
    let folderName = 'Muzik';
    if (audioFiles[0]?.webkitRelativePath) { const parts = audioFiles[0].webkitRelativePath.split('/'); if (parts.length > 1) folderName = parts[0]; }
    SafeStorage.setItem('ns_syncedFolderName', folderName);
    addSystemLog(`${audioFiles.length} müzik dosyası bulundu (${folderName}), IndexedDB'ye kaydediliyor...`, 'info');
    let savedCount = 0;
    for (const file of audioFiles) {
      const id = "fm_" + file.name.replace(/[^a-zA-Z0-9]/g, '_') + "_" + file.size;
      const existing = await AssetManagerService.getMusicFromLib(id);
      if (existing) continue;
      const b64 = await NetworkUtils.fileToBase64(file);
      await AssetManagerService.saveMusicToLib({ id, name: file.name, data: b64 });
      savedCount++;
    }
    const allMusic = await AssetManagerService.getAllMusicFromLib();
    setStudioMedia(s => ({ ...s, musicList: [...allMusic], musicLoaded: allMusic.length > 0, syncedFolderName: folderName }));
    addSystemLog(`✅ ${folderName}: ${savedCount} yeni müzik yerel olarak kaydedildi. Toplam ${allMusic.length} müzik listelendi.`, 'success');
    e.target.value = null;
  };

  const clearSyncedFolder = async () => { await AssetManagerService.removeDirHandle(); setStudioMedia(s => ({ ...s, syncedFolderName: '' })); addSystemLog("Otomatik senkronizasyon kaldırıldı.", 'info'); };

  const playMusicPreview = (url) => {
    try {
      if (_previewAudioRef.current) { _previewAudioRef.current.pause(); _previewAudioRef.current = null; }
      const audio = new Audio(url); audio.volume = DEFAULT_BGM_VOLUME;
      _previewAudioRef.current = audio; audio.play().catch((e) => { ErrorHandler.silent(e); });
      if (_previewTimeoutRef.current) clearTimeout(_previewTimeoutRef.current);
      _previewTimeoutRef.current = setTimeout(() => { if (_previewAudioRef.current === audio) { audio.pause(); _previewAudioRef.current = null; } }, 10000);
    } catch(e) { ErrorHandler.silent(e); }
  };

  const handleMusicVolumeChange = useCallback(() => {
    const v = DEFAULT_BGM_VOLUME;

    setPrefs(p => {
      const np = { ...p, backgroundMusicVolume: v };
      SafeStorage.setItem('ns_prefs', JSON.stringify(np));
      return np;
    });

    if (_previewAudioRef.current) {
      _previewAudioRef.current.volume = v;
    }
  }, []);

  const replayMusicPreview = async () => {
    const url = await AssetManagerService.loadMedia('CUSTOM_MUSIC');
    if (url) { playMusicPreview(url); addSystemLog('Müzik 10 sn önizleme başlatıldı', 'info'); }
    else { addSystemLog('Önce müzik seçin', 'warn'); }
  };

  const handleFolderMusicSelect = useCallback(async (musicId) => {
    if (prefs.ambientSound === musicId) {
      SafeStorage.removeItem('ns_selectedBgmId'); SafeStorage.removeItem('ns_selectedBgmName');
      setPrefs(p => { const np = { ...p, ambientSound: 'none', customBgMusicName: '', customBgMusicId: '' }; SafeStorage.setItem('ns_prefs', JSON.stringify(np)); return np; });
      return;
    }
    const track = await AssetManagerService.getMusicFromLib(musicId);
    if (!track || !track.data) { addSystemLog("Müzik bulunamadı", 'error'); return; }
    addSystemLog(`Müzik hazırlanıyor: ${track.name}`, 'info');
    const oldUrl = await AssetManagerService.loadMedia('CUSTOM_MUSIC');
    if (oldUrl && oldUrl.startsWith('blob:')) ObjectURLManager.revoke(oldUrl);
    const blob = _base64ToBlob(track.data);
    const url = ObjectURLManager.create(blob);
    await AssetManagerService.saveMedia('CUSTOM_MUSIC', url);
    SafeStorage.setItem('ns_selectedBgmId', musicId); SafeStorage.setItem('ns_selectedBgmName', track.name);
    setPrefs(p => {
      const np = {
        ...p,
        ambientSound: musicId,
        customBgMusicName: track.name,
        customBgMusicId: musicId,
        backgroundMusicVolume: DEFAULT_BGM_VOLUME
      };
      SafeStorage.setItem('ns_prefs', JSON.stringify(np));
      return np;
    });
    playMusicPreview(url);
    addSystemLog(`✓ Müzik seçildi ve kalıcı saklandı: ${track.name}`, 'success');
  }, [prefs]);

  const processSelectedFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    if (files.length > 100) { setUiState(prev => ({ ...prev, error: "Maksimum 100 dosya seçebilirsiniz." })); return; }
    const validFiles = files.filter(f => f.size <= 50 * 1024 * 1024);
    try {
      setUiState(prev => ({ ...prev, isProcessing: true, statusText: "Dosyalar işleniyor..." }));
      const processedFiles = await Promise.all(validFiles.map(async (file) => { const base64 = await NetworkUtils.fileToBase64(file); return { name: file.name, type: file.type, data: base64 }; }));
      if (processedFiles[0]?.name) {
        const detected = matchOrFormatGazeteName(processedFiles[0].name);
        if (detected) { setConfig(prev => ({ ...prev, sourceName: detected })); addSystemLog(`✓ Otomatik gazete kaynağı algılandı: ${detected}`, 'info'); }
      }
      setUiState(prev => ({ ...prev, selectedMediaFiles: processedFiles, error: '', isProcessing: false, statusText: "" }));
    } catch (error) { setUiState(prev => ({ ...prev, error: "Dosya okuma hatası.", isProcessing: false, statusText: "" })); }
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); processSelectedFiles(Array.from(e.dataTransfer.files)); }, [processSelectedFiles]);

  const handleExecuteStart = async (files = null, forceOutputType = null, configOverrides = null) => {
    const outType = forceOutputType || config.outputType;
    const intendedTip = configOverrides?.tip || config.tip;
    if (!getGeminiApiKey()) {
      setShowApiKeyModal(true);
      setUiState(prev => ({ ...prev, error: 'Metin ve ses için faturalandırması kapalı Gemini projenizin API anahtarını ekleyin.' }));
      return;
    }

    // YALNIZCA ilk Güzel Söz VIDEO çalıştırmasında bir kez intro dosyasını seçtir.
    // Sonraki açılışlarda IndexedDB kaydı otomatik kullanılır.
    if (
      intendedTip === 'guzel_soz' &&
      outType === 'video' &&
      SafeStorage.getItem(GUZEL_SOZ_INTRO_READY_KEY) !== '1'
    ) {
      guzelSozIntroPendingStartRef.current = { files, forceOutputType, configOverrides };

      if (guzelSozIntroFileInputRef.current) {
        guzelSozIntroFileInputRef.current.value = '';
        guzelSozIntroFileInputRef.current.click();
        addSystemLog('Güzel Sözler.mp4 yalnız bu kez seçilecek; ardından IndexedDB’ye kalıcı kaydedilecek.', 'info');
        return;
      }

      throw new Error('Güzel Söz intro dosya seçicisi açılamadı.');
    }

    sysEventBus.emit('SYS_LOG_CLEAR');
    const aCtx = _getAudioCtx(); if (aCtx.state === 'suspended') aCtx.resume().catch((e) => { ErrorHandler.silent(e); });
    if (forceOutputType) setConfig(prev => ({ ...prev, outputType: forceOutputType }));
    setUiState(prev => ({ ...prev, isProcessing: true, percent: 0, statusText: 'Workflow Başlatılıyor...', error: '', videoUrl: null }));
    addSystemLog('İş akışı başlatıldı.', 'info');
    try {
      let inputData = textInput; let inputType = activeTab;
      const runConfig = {
        ...config,
        outputType: outType,
        customSceneImages: studioMedia.customSceneImages,
        ...(configOverrides || {})
      };
      if (runConfig.tip === 'guzel_soz') {
        const targetFiles = files || uiState.selectedMediaFiles;
        if (textInput.trim()) { inputData = textInput; inputType = 'text'; }
        else if (targetFiles && targetFiles.length > 0) { inputData = targetFiles; inputType = 'media'; }
        else { throw new Error("Güzel söz için metin veya resim girin."); }
      } else if (activeTab === 'media' || activeTab === 'gazete') {
        const targetFiles = files || uiState.selectedMediaFiles;
        if (targetFiles && targetFiles.length > 0) { inputData = targetFiles; inputType = 'media'; }
        else throw new Error("En az bir dosya seçin.");
      }
      await workflowRef.current.startWorkflow(inputData, inputType, runConfig, prefs, canvasRef);
    } catch (e) { addSystemLog(`Hata: ${e.message}`, 'error'); setUiState(prev => ({ ...prev, isProcessing: false, error: e.message })); }
  };

  const handleGuzelSozIntroFileSelected = async (event) => {
    const file = event.target.files?.[0] || null;
    const pending = guzelSozIntroPendingStartRef.current;

    if (!file) {
      guzelSozIntroPendingStartRef.current = null;
      addSystemLog('Güzel Söz intro seçimi iptal edildi.', 'warn');
      return;
    }

    const looksMp4 =
      file.type === 'video/mp4' ||
      /\.mp4$/i.test(file.name || '');

    if (!looksMp4) {
      addSystemLog('Güzel Söz intro için MP4 dosyası seçmelisiniz.', 'error');
      guzelSozIntroPendingStartRef.current = null;
      return;
    }

    try {
      // Base64 YOK: dosyanın Blob'u doğrudan IndexedDB'ye yazılır.
      const introBlob = file.slice(0, file.size, file.type || 'video/mp4');
      const saved = await AssetManagerService.saveMedia(GUZEL_SOZ_INTRO_MEDIA_ID, introBlob);

      if (!saved) throw new Error('IndexedDB kayıt işlemi başarısız.');

      SafeStorage.setItem(GUZEL_SOZ_INTRO_READY_KEY, '1');
      guzelSozIntroPendingStartRef.current = null;

      addSystemLog(
        `✓ FIX CHECKLIST v1.29: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) IndexedDB’ye bir kez kaydedildi. Sonraki açılışlarda otomatik kullanılacak.`,
        'success'
      );

      if (pending) {
        setTimeout(() => {
          handleExecuteStart(
            pending.files,
            pending.forceOutputType,
            pending.configOverrides
          );
        }, 0);
      }
    } catch (e) {
      SafeStorage.removeItem(GUZEL_SOZ_INTRO_READY_KEY);
      guzelSozIntroPendingStartRef.current = null;
      addSystemLog(`Güzel Söz intro kaydetme hatası: ${e.message}`, 'error');
      setUiState(prev => ({ ...prev, isProcessing: false, error: e.message }));
    }
  };

  const handleExecuteResume = async () => {
    const aCtx = _getAudioCtx(); if (aCtx.state === 'suspended') aCtx.resume().catch((e) => { ErrorHandler.silent(e); });
    setUiState({ isProcessing: true, percent: workflowRef.current.state.progress || 0, statusText: 'Sürdürülüyor...', error: '', videoUrl: null, showDevMenu: uiState.showDevMenu });
    addSystemLog('Workflow sürdürülüyor...', 'warn');
    try { await workflowRef.current.resumeWorkflow(canvasRef); } catch (e) { addSystemLog(`Kurtarma hatası: ${e.message}`, 'error'); setUiState(prev => ({ ...prev, isProcessing: false, error: e.message })); }
  };

  const handleQuickReRender = async () => {
    const activeJob = workflowRef.current.state;
    if (!activeJob || !activeJob.script || activeJob.status !== 'COMPLETED') { setUiState(prev => ({ ...prev, error: "Önce video oluşturun." })); return; }
    setUiState(prev => ({ ...prev, isProcessing: true, percent: 10, statusText: 'Yeniden Paketleniyor...' }));
    addSystemLog("Hızlı yeniden paketleme...", "info");
    try {
      const renderResult = await RenderWorkerService.executeRender(activeJob, canvasRef.current, prefs);
      const outputUrl = typeof renderResult === 'string' ? renderResult : renderResult.url;
      if (typeof renderResult === 'object' && renderResult.blobType) activeJob.videoBlobType = renderResult.blobType;
      setUiState(prev => ({ ...prev, isProcessing: false, percent: 100, videoUrl: outputUrl }));
      addSystemLog("Tamamlandı!", "success");
    } catch (err) { addSystemLog(`Hata: ${err.message}`, "error"); setUiState(prev => ({ ...prev, isProcessing: false, error: "Başarısız: " + err.message })); }
  };

  const handleDownloadVideo = async () => {
    const rawTitle = workflowRef.current?.state?.script?.thumbnailText || 'video';
    const safeName = rawTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_").toLowerCase();
    if (config.outputType === 'image') { const a = document.createElement('a'); a.href = uiState.videoUrl; a.download = safeName + '.png'; a.click(); return; }
    const actualBlobType = workflowRef.current?.state?.videoBlobType || '';
    const isWebM = actualBlobType.includes('webm');
    const wantsMP4 = config.videoFormat === 'mp4';
    if (wantsMP4 && isWebM) {
      addSystemLog('WebM → MP4 dönüştürülüyor...', 'info');
      setUiState(prev => ({ ...prev, statusText: 'MP4 dönüştürülüyor...' }));
      try {
        const resp = await fetch(uiState.videoUrl);
        const webmBlob = await resp.blob();
        const mp4Blob = await convertWebMtoMP4(webmBlob, (pct) => { if (pct % 25 === 0) addSystemLog('MP4 dönüştürme: %' + pct, 'info'); });
        const a = document.createElement('a'); a.href = ObjectURLManager.create(mp4Blob); a.download = safeName + '.mp4';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); ObjectURLManager.revoke(a.href);
        addSystemLog('MP4 indirildi: ' + safeName + '.mp4', 'success');
      } catch (convErr) { addSystemLog('MP4 dönüştürme başarısız, WebM indiriliyor: ' + convErr.message, 'warn'); const a = document.createElement('a'); a.href = uiState.videoUrl; a.download = safeName + '.webm'; a.click(); }
    } else {
      const ext = actualBlobType.includes('mp4') ? '.mp4' : '.webm';
      const a = document.createElement('a'); a.href = uiState.videoUrl; a.download = safeName + ext; a.click();
    }
  };

  // FIREBASE KALDIRILDI: handleSilentRecovery fonksiyonu tamamen silindi.

  // === GAZETE TAKİP FONKSİYONLARI ===
  const GAZETE_MASTER_LIST = [
    'Akşam', 'Analiz', 'Aydınlık', 'BirGün', 'Cumhuriyet', 'Diriliş Postası',
    'Dünya', 'Evrensel', 'Gazete Pencere', 'Fanatik', 'Fotomaç', 'Hürriyet', 'Karar', 'Korkusuz',
    'Milat', 'Milli Gazete', 'Milliyet', 'Nasıl Bir Ekonomi', 'Nefes', 'Posta',
    'Sabah', 'Sözcü', 'Takvim', 'Tavır Gazetesi', 'Türkiye', 'Yeniçağ',
    'Yeni Asya', 'Yeni Birlik', 'Yeni Mesaj', 'Yeni Şafak'
  ];
  const GAZETE_META = {
    'Akşam': { ayd: 'aksam', go: 'aksam-gazetesi-manseti', gzt: 'aksam-gazetesi' },
    'Analiz': { ayd: 'analiz', gzt: 'analiz-gazetesi' },
    'Aydınlık': { ayd: 'aydinlik-gazetesi', go: 'aydinlik-gazetesi-manseti', gzt: 'aydinlik-gazetesi' },
    'BirGün': { ayd: 'birgun', go: 'birgun-gazetesi-manseti', gzt: 'birgun-gazetesi' },
    'Cumhuriyet': { ayd: 'cumhuriyet', go: 'cumhuriyet-gazetesi-manseti', gzt: 'cumhuriyet-gazetesi' },
    'Diriliş Postası': { ayd: 'dirilis-postasi', go: 'dirilis-postasi-gazetesi-manseti', gzt: 'dirilis-postasi-gazetesi' },
    'Dünya': { ayd: 'dunya', go: 'dunya-gazetesi-manseti', gzt: 'dunya-gazetesi' },
    'Evrensel': { ayd: 'evrensel', go: 'evrensel-gazetesi-manseti', gzt: 'evrensel-gazetesi' },
    'Gazete Pencere': { ayd: 'gazete-pencere-online-gazete', gzt: 'gazetepencere-gazetesi' },
    'Fanatik': { ayd: 'fanatik', go: 'fanatik-gazetesi-manseti', gzt: 'fanatik-gazetesi' },
    'Fotomaç': { ayd: 'fotomac', go: 'fotomac-gazetesi-manseti', gzt: 'fotomac-gazetesi' },
    'Hürriyet': { go: 'hurriyet-gazetesi-manseti', gzt: 'hurriyet-gazetesi' },
    'Karar': { ayd: 'karar', go: 'karar-gazetesi-manseti', gzt: 'karar-gazetesi' },
    'Korkusuz': { ayd: 'korkusuz', go: 'korkusuz-gazetesi-manseti', gzt: 'korkusuz-gazetesi' },
    'Milat': { ayd: 'milat', go: 'milat-gazetesi-manseti', gzt: 'milat-gazetesi' },
    'Milli Gazete': { ayd: 'milli-gazete', go: 'milli-gazete-gazetesi-manseti', gzt: 'milli-gazete' },
    'Milliyet': { go: 'milliyet-gazetesi-manseti', gzt: 'milliyet-gazetesi' },
    'Nasıl Bir Ekonomi': { ayd: 'nb-ekonomi', gzt: 'nasil-bir-ekonomi-gazetesi' },
    'Nefes': { ayd: 'nefes', go: 'nefes-gazetesi-manseti', gzt: 'nefes-gazetesi' },
    'Posta': { ayd: 'posta', go: 'posta-gazetesi-manseti', gzt: 'posta-gazetesi' },
    'Sabah': { ayd: 'sabah', go: 'sabah-gazetesi-manseti', gzt: 'sabah-gazetesi' },
    'Sözcü': { ayd: 'sozcu', go: 'sozcu-gazetesi-manseti', gzt: 'sozcu-gazetesi' },
    'Takvim': { ayd: 'takvim', go: 'takvim-gazetesi-manseti', gzt: 'takvim-gazetesi' },
    'Tavır Gazetesi': { ayd: 'tavir', go: 'tavir-gazetesi-manseti', gzt: 'tavir-gazetesi' },
    'Türkiye': { ayd: 'turkiye-gazetesi', go: 'turkiye-gazetesi-manseti', gzt: 'turkiye-gazetesi' },
    'Yeniçağ': { ayd: 'yenicag', go: 'yenicag-gazetesi-manseti', gzt: 'turkiyede-yenicag-gazetesi' },
    'Yeni Asya': { ayd: 'yeni-asya', go: 'yeni-asya-gazetesi-manseti', gzt: 'yeni-asya-gazetesi' },
    'Yeni Birlik': { ayd: 'yenibirlik', go: 'yenibirlik-gazetesi-manseti', gzt: 'yenibirlik-gazetesi' },
    'Yeni Mesaj': { gzt: 'yenimesaj-gazetesi' },
    'Yeni Şafak': { ayd: 'yeni-safak', go: 'yeni-safak-gazetesi-manseti', gzt: 'yenisafak-gazetesi' }
  };
  const GAZETE_CACHE_KEY = `ns_gazeteResolved_${APP_VERSION.hotfix}_racefix`;
  const normalizeGazeteText = (value = '') => String(value).toLocaleLowerCase('tr-TR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const GAZETE_ALIAS_MAP = {
    'Türkiye’de Yeni Çağ': 'Yeniçağ', 'Türkiye de Yeni Çağ': 'Yeniçağ', 'Türkiye Yeni Çağ': 'Yeniçağ',
    'Yeni Çağ': 'Yeniçağ', 'YeniBirlik': 'Yeni Birlik', 'YeniMesaj': 'Yeni Mesaj',
    'NB Ekonomi': 'Nasıl Bir Ekonomi', 'NBEkonomi': 'Nasıl Bir Ekonomi',
    'Gazete Pencere Online Gazete': 'Gazete Pencere', 'Pencere': 'Gazete Pencere',
    'Türkiye Gazetesi': 'Türkiye', 'Tavır': 'Tavır Gazetesi', 'Birgün': 'BirGün',
    'MilliGazete': 'Milli Gazete', 'YeniSafak': 'Yeni Şafak', 'YeniAsya': 'Yeni Asya'
  };
  const GAZETE_ALIASES = [...Object.entries(GAZETE_ALIAS_MAP), ...GAZETE_MASTER_LIST.map(name => [name, name])].map(([alias, name]) => [normalizeGazeteText(alias), name]).sort((a, b) => b[0].length - a[0].length);
  const HABER7_GAZETE_SLUGS = {
    'Türkiye': 'turkiye', 'Akşam': 'aksam', 'Diriliş Postası': 'dirilis-postasi',
    'Milat': 'milat', 'Sabah': 'sabah', 'Milliyet': 'milliyet', 'Hürriyet': 'hurriyet',
    'Yeni Birlik': 'yeni-birlik', 'Milli Gazete': 'milli-gazete', 'Dünya': 'dunya',
    'Yeniçağ': 'yenicag', 'Yeni Şafak': 'yeni-safak', 'Aydınlık': 'aydinlik',
    'Takvim': 'takvim-gazetesi', 'Fotomaç': 'fotomac', 'Fanatik': 'fanatik'
  };
  const GAZETE_SPECIAL_SOURCES = {
    'Analiz': (date) => [
      'https://www.aydinlik.com.tr/gazete-mansetleri/analiz',
      `https://gazetemanset.gzt.com/analiz-gazetesi/${date.split('-').reverse().join('-')}`
    ],
    'Aydınlık': (date) => [
      `https://gazetemanset.gzt.com/aydinlik-gazetesi/${date.split('-').reverse().join('-')}`,
      'https://www.aydinlik.com.tr/gazete-mansetleri/aydinlik-gazetesi'
    ],
    'Gazete Pencere': (date) => [
      'https://www.aydinlik.com.tr/gazete-mansetleri/gazete-pencere-online-gazete',
      'https://www.gazetepencere.com/mansetler',
      `https://gazetemanset.gzt.com/gazetepencere-gazetesi/${date.split('-').reverse().join('-')}`
    ],
    'Hürriyet': (date) => [
      'https://www.haber7.com/gazete-mansetleri/hurriyet',
      `https://gazetemanset.gzt.com/hurriyet-gazetesi/${date.split('-').reverse().join('-')}`
    ],
    'Milliyet': (date) => [
      'https://www.haber7.com/gazete-mansetleri/milliyet',
      `https://gazetemanset.gzt.com/milliyet-gazetesi/${date.split('-').reverse().join('-')}`
    ],
    'Yeni Mesaj': (date) => [
      `https://gazetemanset.gzt.com/yenimesaj-gazetesi/${date.split('-').reverse().join('-')}`,
      'https://gazetemanset.gzt.com/'
    ]
  };
  const GAZETE_MONTHS_TR = ['ocak','şubat','mart','nisan','mayıs','haziran','temmuz','ağustos','eylül','ekim','kasım','aralık'];
  const gazetePayloadMatchesDate = (payload, selectedDate) => {
    if (!payload || !selectedDate) return false;
    const [year, month, day] = String(selectedDate).split('-');
    const monthName = GAZETE_MONTHS_TR[Math.max(0, Number(month) - 1)] || '';
    const dayNum = String(Number(day));
    const haystack = normalizeGazeteText(String(payload).slice(0, 250000));
    const variants = [
      selectedDate,
      `${day}.${month}.${year}`,
      `${day}/${month}/${year}`,
      `${dayNum} ${monthName} ${year}`,
      `${day} ${monthName} ${year}`
    ].map(normalizeGazeteText).filter(Boolean);
    return variants.some(v => haystack.includes(v));
  };
  const resolveGazeteNameFromText = (raw = '') => {
    const text = normalizeGazeteText(raw); if (!text) return null;
    for (const [alias, name] of GAZETE_ALIASES) { if (text === alias || (` ${text} `).includes(` ${alias} `)) return name; }
    return null;
  };
  const decodeGazeteUrl = (value = '') => String(value).replace(/\\u0026/gi, '&').replace(/&amp;/gi, '&').replace(/\\\//g, '/').replace(/^['"]|['"]$/g, '').trim();
  const cleanGazeteImageUrl = (url = '', pageUrl = '') => {
    let value = decodeGazeteUrl(url);
    if (!value || value.startsWith('data:') || value.startsWith('blob:')) return value;
    value = value.split(',')[0].trim().split(/\s+/)[0];
    if (/blank|placeholder|spacer|avatar|logo|favicon|footer|yandex|google|banner|reklam|advert/i.test(value)) return '';
    try { return new URL(value, pageUrl || window.location.href).href; } catch (e) { return ''; }
  };
  const isLikelyGazeteImage = (url = '') => {
    if (!url) return false;
    if (url.startsWith('data:image/')) return true;
    if (/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url)) return true;
    return /img\.aydinlik\.com\.tr|img\.piri\.net|[si]\d*\.gazeteoku\.com|i\d+\.haber7\.net|haber7\.net|gazetemanset\.gzt\.com|gzt\.com|storage\/newspapers|\/gazete(?:ler)?\/|\/manset(?:ler)?\/|newspaper|gazete.*(?:image|upload|manset|cover)/i.test(url);
  };
  const makeGazetePlaceholder = (name) => {
    const safe = String(name).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1340"><rect width="100%" height="100%" fill="#0f172a"/><rect x="35" y="35" width="730" height="1270" rx="28" fill="#111827" stroke="#334155" stroke-width="4"/><text x="400" y="590" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="34" font-weight="700">${safe}</text><text x="400" y="655" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="22">Manşet görseli bulunamadı</text></svg>`)}`;
  };
  const dateBackList = (date, count = 8) => {
    const [year, month, day] = String(date || _getTurkeyDateISO()).split('-').map(Number);
    const base = new Date(year, Math.max(0, month - 1), day, 12, 0, 0, 0);
    const result = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      result.push(`${y}-${m}-${dd}`);
    }
    return result;
  };
  const uniqueGazeteUrls = (urls = []) => urls.filter(Boolean).filter((url, index, list) => list.indexOf(url) === index);
  const weservGazeteUrl = (url, width = 900, quality = 90) => {
    if (!url || url.startsWith('data:')) return url;
    const cacheToken = gazeteRefreshNonceRef.current || `${_getTurkeyDateISO()}-${Date.now()}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${width}&fit=contain&output=jpg&q=${quality}&cb=${encodeURIComponent(cacheToken)}`;
  };
  const createGazeteVariants = (rawUrls = [], cached = null) => {
    const cleanedRaw = uniqueGazeteUrls(rawUrls.map(url => cleanGazeteImageUrl(url)).filter(isLikelyGazeteImage));

    // ÇALIŞAN KURAL:
    // Görseli boyut/aspect oranına göre REDDETME.
    // Önce orijinal kaynak, sonra yüksek kaliteli proxy yedekleri.
    const fullCandidates = uniqueGazeteUrls([
      cached?.full,
      ...cleanedRaw,
      ...cleanedRaw.map(url => weservGazeteUrl(url, 1400, 94)),
      ...cleanedRaw.map(url => weservGazeteUrl(url, 1100, 92))
    ]);
    const thumbCandidates = uniqueGazeteUrls([
      cached?.thumb,
      ...cleanedRaw,
      ...cleanedRaw.map(url => weservGazeteUrl(url, 720, 90)),
      ...cleanedRaw.map(url => weservGazeteUrl(url, 540, 88)),
      ...fullCandidates
    ]);
    return { rawCandidates: cleanedRaw, fullCandidates, thumbCandidates };
  };
  const getGazeteCache = () => {
    if (gazeteResolvedCacheRef.current) return gazeteResolvedCacheRef.current;
    try { gazeteResolvedCacheRef.current = JSON.parse(SafeStorage.getItem(GAZETE_CACHE_KEY) || '{}') || {}; } catch (e) { gazeteResolvedCacheRef.current = {}; }
    return gazeteResolvedCacheRef.current;
  };
  const persistGazeteResolution = (date, name, kind, url) => {
    if (!url || url.startsWith('data:image/')) return;
    if (date === _getTurkeyDateISO()) return;
    const cache = getGazeteCache(); const key = `${date}|${name}`;
    cache[key] = { ...(cache[key] || {}), [kind]: url, updatedAt: Date.now() };
    const entries = Object.entries(cache).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)).slice(0, 240);
    gazeteResolvedCacheRef.current = Object.fromEntries(entries);
    SafeStorage.setItem(GAZETE_CACHE_KEY, JSON.stringify(gazeteResolvedCacheRef.current));
  };
  const buildGazeteCards = (date) => {
    const cache = getGazeteCache();
    const isToday = date === _getTurkeyDateISO();
    return GAZETE_MASTER_LIST.map(name => {
      const meta = GAZETE_META[name] || {};
      const rawUrls = [];

      // KALICI KURAL: seçilen tarih neyse yalnız o tarihin kapağı.
      // Bugün bulunamadı diye dün/önceki gün gösterme.
      if (meta.ayd) {
        rawUrls.push(`https://img.aydinlik.com.tr/rcman/Cw1200h2010q95gc/storage/newspapers/${date}/${meta.ayd}.jpg`);
      }
      if (name === 'Gazete Pencere') {
        const [year, month, dayNum] = date.split('-');
        rawUrls.push(`https://cdn.gazetepencere.com/other/${year}/${month}/${dayNum}/dddd.jpg`);
      }

      // Bugünkü sayfa her yenilemede canlı çözülür; eski yanlış cache ekrana gelmez.
      const cached = isToday ? null : (cache[`${date}|${name}`] || null);
      const variants = createGazeteVariants(rawUrls, cached);
      const placeholder = makeGazetePlaceholder(name);
      return {
        name,
        requestedDate: date,
        ...variants,
        fullCandidates: [...variants.fullCandidates, placeholder],
        thumbCandidates: [...variants.thumbCandidates, placeholder],
        fullSrc: variants.fullCandidates[0] || placeholder,
        thumbSrc: variants.thumbCandidates[0] || placeholder,
        resolvedFull: cached?.full || '',
        resolvedThumb: cached?.thumb || '',
        sources: meta.ayd ? ['Aydınlık CDN'] : [],
        loaded: false,
        placeholder,
        revision: 0
      };
    });
  };
  const fetchWithGazeteTimeout = async (url, externalSignal, timeoutMs = 6500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromParent = () => controller.abort();
    if (externalSignal) { if (externalSignal.aborted) controller.abort(); else externalSignal.addEventListener('abort', abortFromParent, { once: true }); }
    try { return await fetch(url, { signal: controller.signal, cache: 'no-store' }); }
    finally { clearTimeout(timer); if (externalSignal) externalSignal.removeEventListener('abort', abortFromParent); }
  };
  const fetchViaGazeteExtension = (url, signal, timeoutMs = 9000) => new Promise((resolve, reject) => {
    const requestId = `gn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (signal) signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const onAbort = () => finish(reject, new DOMException('Aborted', 'AbortError'));

    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== 'OTONOM_GAZETE_EXTENSION' || data.id !== requestId) return;

      if (data.type === 'FETCH_RESULT') {
        gazeteExtensionAvailableRef.current = true;
        finish(resolve, data);
      }
    };

    const timer = setTimeout(() => {
      gazeteExtensionAvailableRef.current = false;
      finish(resolve, null);
    }, timeoutMs);

    window.addEventListener('message', onMessage);

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const request = {
      source: 'OTONOM_APP',
      type: 'GAZETE_FETCH',
      id: requestId,
      url
    };

    // Uygulama Gemini içinde nested/cross-origin iframe'de çalışabiliyor.
    // İsteği kendi frame'ine, parent'a ve top'a yollarız.
    const targets = [];
    try { targets.push(window); } catch (e) {}
    try { if (window.parent && window.parent !== window) targets.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window && window.top !== window.parent) targets.push(window.top); } catch (e) {}

    let sent = 0;
    targets.forEach(target => {
      try {
        target.postMessage(request, '*');
        sent++;
      } catch (e) {
        ErrorHandler.silent(e);
      }
    });

    if (!sent) {
      gazeteExtensionAvailableRef.current = false;
      finish(resolve, null);
    }
  });

  const fetchGazeteSourceTextsFast = async (pageUrl, signal) => {
    let cleanTargetUrl = pageUrl;
    try {
      const u = new URL(pageUrl);
      u.searchParams.delete('_gn_refresh');
      u.searchParams.delete('_gazete_refresh');
      cleanTargetUrl = u.href;
    } catch (e) {}

    // KALICI ÇÖZÜM:
    // Gemini/Canvas sayfası loopback'e erişemediği için localhost bridge kullanılmaz.
    // Chrome eklentisi cross-origin sayfayı background service worker'da okur.
    try {
      const extResult = await fetchViaGazeteExtension(cleanTargetUrl, signal, 10000);
      if (extResult?.ok && typeof extResult.body === 'string' && extResult.body.length >= 120) {
        gazeteExtensionWarnedRef.current = false;
        return [extResult.body];
      }
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      ErrorHandler.silent(e);
    }

    // Eklenti yoksa yalnız public Jina fallback.
    const targetNoScheme = cleanTargetUrl.replace(/^https?:\/\//i, '');
    for (const jinaUrl of [
      `https://r.jina.ai/https://${targetNoScheme}`,
      `https://r.jina.ai/http://${targetNoScheme}`
    ]) {
      if (signal?.aborted) break;
      try {
        const response = await fetchWithGazeteTimeout(jinaUrl, signal, 9000);
        if (!response.ok) continue;
        const body = await response.text();
        if (typeof body === 'string' && body.length >= 120) return [body];
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        ErrorHandler.silent(e);
      }
    }

    // Extension/Jina başarısızlığı burada sessizdir.
    // Kullanıcıya yalnız finalde gerçekten çözülemeyen gazete isimleri raporlanır.
    return [];
  };
  const gazeteCandidateMatchesForcedName = (src = '', forcedName = '', meta = {}) => {
    if (!forcedName) return true;

    const context = `${meta.alt || ''} ${meta.title || ''} ${meta.hint || ''}`;
    const contextName = resolveGazeteNameFromText(context);
    if (contextName) return contextName === forcedName;

    // Bağlam ad vermiyorsa URL'nin kendisinde gazetenin slug'ı bulunmalı.
    // Böylece Aydınlık sitesinin genel og:image/logo görseli başka gazete diye kabul edilmez.
    const targetMeta = GAZETE_META[forcedName] || {};
    const urlNorm = normalizeGazeteText(decodeGazeteUrl(src));
    const tokens = [
      forcedName,
      targetMeta.ayd,
      targetMeta.go,
      targetMeta.gzt,
      HABER7_GAZETE_SLUGS[forcedName]
    ]
      .filter(Boolean)
      .map(normalizeGazeteText)
      .filter(token => token.length >= 4);

    return tokens.some(token => urlNorm.includes(token));
  };

  const extractGazeteCandidates = (payload, pageUrl, sourceLabel, forcedName = '') => {
    const text = String(payload || ''); const out = []; const seen = new Set();
    const add = (url, meta = {}) => {
      const src = cleanGazeteImageUrl(url, pageUrl);
      if (!src || !isLikelyGazeteImage(src) || seen.has(src)) return;
      const contextName = resolveGazeteNameFromText(`${meta.alt || ''} ${meta.title || ''} ${meta.hint || ''}`);

      if (forcedName && !gazeteCandidateMatchesForcedName(src, forcedName, meta)) return;

      seen.add(src);
      const urlName = resolveGazeteNameFromText(decodeGazeteUrl(src));
      const resolvedName = forcedName || contextName || urlName || meta.name || '';
      const contextBoost = forcedName && (contextName === forcedName || urlName === forcedName) ? 60 : 0;
      const portraitHint = /manset|gazete|newspaper|cover|storage\/newspapers/i.test(src) ? 12 : 0;

      out.push({
        name: resolvedName,
        src,
        source: sourceLabel,
        alt: meta.alt || '',
        title: meta.title || '',
        hint: meta.hint || '',
        score: (meta.score || 10) + contextBoost + portraitHint
      });
    };
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // Detay sayfasında hedef gazetenin adını taşıyan görselleri önce ve yüksek puanla al.
      if (forcedName) {
        doc.querySelectorAll('img,source').forEach(el => {
          const alt = el.getAttribute('alt') || '';
          const title = el.getAttribute('title') || '';
          const aria = el.getAttribute('aria-label') || '';
          const nearby = `${alt} ${title} ${aria} ${el.parentElement?.innerText || ''}`.slice(0, 700);
          const detected = resolveGazeteNameFromText(nearby);
          if (detected === forcedName) {
            ['data-src', 'data-original', 'data-lazy-src', 'data-image', 'data-url', 'data-fallback-src', 'src'].forEach(attr => {
              const value = el.getAttribute(attr);
              if (value) add(value, { alt, title, hint: nearby, score: 180 });
            });
            const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || '';
            srcset.split(',').forEach(part => {
              const value = part.trim().split(/\s+/)[0];
              if (value) add(value, { alt, title, hint: nearby, score: 175 });
            });
          }
        });
      }

      // Site logosu / sosyal paylaşım görseli gazete kapağı sanılmasın.
      // OG image yalnız URL veya kendi metadata'sı gazete adını kanıtlıyorsa isim kazanır.
      doc.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"],meta[property="twitter:image"]').forEach(el =>
        add(el.getAttribute('content'), { hint: '', score: 25 })
      );
      doc.querySelectorAll('img,source').forEach(el => {
        const alt = el.getAttribute('alt') || ''; const title = el.getAttribute('title') || '';
        const hint = `${el.parentElement?.innerText || ''} ${el.closest('a')?.getAttribute('href') || ''}`.slice(0, 500);
        ['data-src', 'data-original', 'data-lazy-src', 'data-image', 'data-url', 'data-fallback-src', 'src'].forEach(attr => { const value = el.getAttribute(attr); if (value) add(value, { alt, title, hint, score: attr === 'src' ? 45 : 55 }); });
        const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || '';
        srcset.split(',').forEach(part => add(part.trim().split(/\s+/)[0], { alt, title, hint, score: 50 }));
      });
    } catch (e) { ErrorHandler.silent(e); }
    let match;
    const mdImage = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/gi;
    while ((match = mdImage.exec(text))) add(match[2], { alt: match[1], hint: text.slice(Math.max(0, match.index - 180), mdImage.lastIndex + 180), score: 65 });
    const metaRegex = /(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi;
    while ((match = metaRegex.exec(text))) add(match[1] || match[2], { score: 25 });
    const jsonImage = /["'](?:image|imageUrl|image_url|manset|cover|src)["']\s*:\s*["'](https?:\\?\/\\?\/[^"']+)["']/gi;
    while ((match = jsonImage.exec(text))) add(match[1], { hint: text.slice(Math.max(0, match.index - 120), match.index + 240), score: 60 });
    const directImage = /https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+?\.(?:jpe?g|png|webp|avif)(?:\?[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*)?/gi;
    while ((match = directImage.exec(text))) add(match[0], { hint: text.slice(Math.max(0, match.index - 200), directImage.lastIndex + 200), score: 50 });
    return out;
  };
  const fetchGazeteCentralCandidates = async (selectedDate, signal) => {
    const sources = [
      { url: 'https://gazetemanset.gzt.com/', label: 'GZT/Ana' },
      { url: 'https://www.aydinlik.com.tr/gazete-mansetleri', label: 'Aydınlık/Ana' },
      { url: 'https://www.gazeteoku.com/gazeteler', label: 'GazeteOku/Ana' },
      { url: 'https://e-manset.com/gazete', label: 'E-Manşet/Ana' },
      { url: 'https://www.sanattanyansimalar.com/gazete-mansetleri', label: 'SanattanYansımalar/Ana' },
      { url: 'https://www.duragan.com/gazete-mansetleri', label: 'Durağan/Ana' }
    ];
    const grouped = new Map();
    const sourceStatus = [];

    for (const source of sources) {
      if (signal?.aborted) break;
      const texts = await fetchGazeteSourceTextsFast(source.url, signal);
      let accepted = false;
      for (const body of texts) {
        if (!gazetePayloadMatchesDate(body, selectedDate)) continue;
        accepted = true;
        const candidates = extractGazeteCandidates(body, source.url, source.label);
        for (const candidate of candidates) {
          if (!candidate.name || !GAZETE_MASTER_LIST.includes(candidate.name)) continue;
          if (!grouped.has(candidate.name)) grouped.set(candidate.name, []);
          grouped.get(candidate.name).push(candidate);
        }
      }
      sourceStatus.push(`${source.label}:${accepted ? 'OK' : 'tarih/yayın yok'}`);
    }

    for (const [name, list] of grouped.entries()) {
      const seen = new Set();
      grouped.set(name, list
        .filter(item => item.src && !seen.has(item.src) && seen.add(item.src))
        .sort((a, b) => (b.score || 0) - (a.score || 0)));
    }
    return { grouped, sourceStatus };
  };

  const escapeGazeteRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const extractGztDetailUrls = (payload, slug, selectedDate) => {
    const text = decodeGazeteUrl(payload);
    const urls = [];
    const [year, month, dayNum] = selectedDate.split('-');
    const exactPath = `/${slug}/${dayNum}-${month}-${year}`;
    const exactUrl = `https://gazetemanset.gzt.com${exactPath}`;

    // Yalnız seçilen tarihle eşleşen linkleri kabul et.
    const escapedPath = escapeGazeteRegExp(exactPath);
    const absolute = new RegExp(`https?:\\/\\/gazetemanset\\.gzt\\.com${escapedPath}(?:[?#][^\\s"'<>]*)?`, 'gi');
    const relative = new RegExp(`${escapedPath}(?:[?#][^\\s"'<>]*)?`, 'gi');

    for (const found of text.match(absolute) || []) if (!urls.includes(found)) urls.push(found);
    for (const found of text.match(relative) || []) {
      const full = found.startsWith('http') ? found : `https://gazetemanset.gzt.com${found}`;
      if (!urls.includes(full)) urls.push(full);
    }
    if (!urls.includes(exactUrl)) urls.push(exactUrl);
    return urls.slice(0, 3);
  };
  const extractExactGazeteHeroCandidate = (payload, pageUrl, forcedName) => {
    if (!payload || !forcedName) return null;

    const text = String(payload);
    const targetMeta = GAZETE_META[forcedName] || {};
    const aliases = [
      forcedName,
      forcedName === 'Gazete Pencere' ? 'Gazete Pencere (Online Gazete)' : '',
      forcedName === 'Analiz' ? 'Analiz Gazetesi' : ''
    ].filter(Boolean);

    const isExactName = (value = '') => {
      const detected = resolveGazeteNameFromText(value);
      if (detected === forcedName) return true;
      const norm = normalizeGazeteText(value);
      return aliases.some(alias => {
        const a = normalizeGazeteText(alias);
        return a && (norm === a || norm.includes(a));
      });
    };

    const candidates = [];
    const addExact = (url, label = '') => {
      const src = cleanGazeteImageUrl(url, pageUrl);
      if (!src || !isLikelyGazeteImage(src)) return;
      if (candidates.some(c => c.src === src)) return;
      candidates.push({
        name: forcedName,
        src,
        source: label || 'ExactHero',
        alt: forcedName,
        title: forcedName,
        hint: forcedName,
        score: 1000
      });
    };

    // HTML: Aydınlık detail sayfasındaki gerçek hero image alt/title üzerinden.
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      doc.querySelectorAll('img,source').forEach(el => {
        const alt = el.getAttribute('alt') || '';
        const title = el.getAttribute('title') || '';
        const aria = el.getAttribute('aria-label') || '';
        if (!isExactName(`${alt} ${title} ${aria}`)) return;

        ['data-src', 'data-original', 'data-lazy-src', 'data-image', 'data-url', 'src'].forEach(attr => {
          const value = el.getAttribute(attr);
          if (value) addExact(value, 'ExactHero/HTML');
        });

        const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || '';
        srcset.split(',').forEach(part => {
          const value = part.trim().split(/\s+/)[0];
          if (value) addExact(value, 'ExactHero/HTML');
        });
      });
    } catch (e) {
      ErrorHandler.silent(e);
    }

    // Jina/Markdown: ![Analiz Gazetesi Manşeti](https://...)
    let match;
    const mdImage = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/gi;
    while ((match = mdImage.exec(text))) {
      if (isExactName(match[1])) addExact(match[2], 'ExactHero/Markdown');
    }

    // Last resort: storage/newspapers URL with exact newspaper slug.
    const slugTokens = [targetMeta.ayd, targetMeta.gzt, targetMeta.go]
      .filter(Boolean)
      .map(v => String(v).toLowerCase());

    const directImages = text.match(/https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+?\.(?:jpe?g|png|webp|avif)(?:\?[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*)?/gi) || [];
    for (const raw of directImages) {
      const decoded = decodeGazeteUrl(raw).toLowerCase();
      if (slugTokens.some(slug => decoded.includes(slug)) && /newspaper|gazete|manset|storage/i.test(decoded)) {
        addExact(raw, 'ExactHero/Slug');
      }
    }

    return candidates.sort((a, b) => b.score - a.score)[0] || null;
  };

  const fetchIndividualGazeteCandidates = async (name, selectedDate, signal) => {
    const meta = GAZETE_META[name] || {};
    const sources = [];
    const already = new Set();

    const pushSource = (url, label) => {
      if (!url || already.has(url)) return;
      already.add(url);
      sources.push({ url, label });
    };

    // Eksik gelme ihtimali yüksek gazeteler için doğrulanmış kaynakları ÖNCE dene.
    const specialBuilder = GAZETE_SPECIAL_SOURCES[name];
    if (specialBuilder) {
      specialBuilder(selectedDate).forEach((url, index) => {
        pushSource(url, index === 0 ? 'Özel/Kaynak-1' : 'Özel/Kaynak-2');
      });
    }

    if (meta.gzt) {
      pushSource(
        `https://gazetemanset.gzt.com/${meta.gzt}/${selectedDate.split('-').reverse().join('-')}`,
        'GZT/Detay'
      );
    }
    if (meta.ayd) {
      pushSource(`https://www.aydinlik.com.tr/gazete-mansetleri/${meta.ayd}`, 'Aydınlık/Detay');
    }
    if (meta.go) {
      pushSource(`https://www.gazeteoku.com/gazeteler/${meta.go}`, 'GazeteOku/Detay');
    }
    if (HABER7_GAZETE_SLUGS[name]) {
      pushSource(`https://www.haber7.com/gazete-mansetleri/${HABER7_GAZETE_SLUGS[name]}`, 'Haber7/Detay');
    }

    const candidates = [];
    for (const source of sources) {
      if (signal?.aborted) break;

      const texts = await fetchGazeteSourceTextsFast(source.url, signal);
      for (const body of texts) {
        // Tam tarihli GZT URL'lerinde URL zaten tarihi doğruluyor.
        const isExactDateUrl = source.url.includes(selectedDate.split('-').reverse().join('-'));
        if (!isExactDateUrl && !gazetePayloadMatchesDate(body, selectedDate)) continue;

        // Analiz / Pencere gibi özel sayfalarda hero image önce kesin eşleşir.
        const exactHero = extractExactGazeteHeroCandidate(body, source.url, name);
        if (exactHero) {
          candidates.unshift(exactHero);
          addSystemLog(`✓ ${name}: gerçek kapak ${exactHero.source} ile kesin eşleşti.`, 'success');
          break;
        }

        const extracted = extractGazeteCandidates(body, source.url, source.label, name);
        candidates.push(...extracted);
      }

      if (candidates.length) {
        addSystemLog(`✓ ${name}: ${source.label} üzerinden kapak bulundu.`, 'success');
        break;
      }
    }

    const seen = new Set();
    return candidates
      .filter(candidate => candidate.src && !seen.has(candidate.src) && seen.add(candidate.src))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  };
  const prependLiveGazeteCandidates = (item, candidates) => {
    const rawUrls = candidates.map(candidate => candidate.src).filter(Boolean);
    if (!rawUrls.length) return item;

    const variants = createGazeteVariants([...rawUrls, ...(item.rawCandidates || [])]);
    const sources = uniqueGazeteUrls([...(item.sources || []), ...candidates.map(candidate => candidate.source)]);

    // KRİTİK:
    // Eski kartta yüklenmiş beyaz "Aydınlık" fallback'i resolvedThumb/resolvedFull
    // olarak kalmış olabilir. Yeni DOĞRULANMIŞ kapak geldiğinde onu kesin temizle.
    // JSX resolvedThumb || thumbSrc kullandığı için temizlenmezse gerçek kapak
    // bulunmasına rağmen ekranda eski yanlış görsel kalıyordu.
    return {
      ...item,
      ...variants,
      resolvedFull: '',
      resolvedThumb: '',
      fullCandidates: [...variants.fullCandidates, item.placeholder],
      thumbCandidates: [...variants.thumbCandidates, item.placeholder],
      fullSrc: variants.fullCandidates[0] || item.fullSrc,
      thumbSrc: variants.thumbCandidates[0] || item.thumbSrc,
      sources,
      loaded: false,
      revision: (item.revision || 0) + 1
    };
  };
  const rescueGazeteItem = async (name) => {
    const key = `${gazeteDate}|${name}`;
    if (gazeteRescueInFlightRef.current.has(key)) return gazeteRescueInFlightRef.current.get(key);
    const requestId = gazeteRequestIdRef.current;
    const signal = gazeteAbortRef.current?.signal;
    const promise = (async () => {
      try {
        const candidates = await fetchIndividualGazeteCandidates(name, gazeteDate, signal);
        if (!candidates.length || requestId !== gazeteRequestIdRef.current || signal?.aborted) return false;
        setGazeteItems(prev => prev.map(item => item.name === name ? prependLiveGazeteCandidates(item, candidates) : item));
        addSystemLog(`✓ ${name}: alternatif kaynak bulundu.`, 'success');
        return true;
      } catch (e) { if (e?.name !== 'AbortError') ErrorHandler.silent(e); return false; }
      finally { gazeteRescueInFlightRef.current.delete(key); }
    })();
    gazeteRescueInFlightRef.current.set(key, promise);
    return promise;
  };
  const fetchGazeteManşetleri = async (forcedDate = null) => {
    const requestId = ++gazeteRequestIdRef.current;
    gazeteRefreshNonceRef.current = `${_getTurkeyDateISO()}-${Date.now()}-${requestId}`;
    gazeteResolvedCacheRef.current = null;
    gazeteCentralReadyRef.current = false;

    if (gazeteAbortRef.current) gazeteAbortRef.current.abort();
    const controller = new AbortController();
    gazeteAbortRef.current = controller;
    gazeteRescueInFlightRef.current.clear();

    setGazeteLoading(true);
    setGazeteError('');
    setGazeteCurrentIdx(0);

    const selectedDate = forcedDate || gazeteDate || _getTurkeyDateISO();

    try {
      const cards = buildGazeteCards(selectedDate);
      setGazeteItems(cards);
      addSystemLog(`✓ ${cards.length}/30 gazete kartı hazırlandı — kesin tarih: ${selectedDate}. Gazete canlı okuma: Chrome eklentisi / Jina fallback.`, 'success');

      // Önce tek merkez sayfalarından bütün gazeteleri çöz.
      const central = await fetchGazeteCentralCandidates(selectedDate, controller.signal);
      if (requestId !== gazeteRequestIdRef.current || controller.signal.aborted) return;

      if (central.grouped.size) {
        setGazeteItems(prev => prev.map(item =>
          central.grouped.has(item.name)
            ? prependLiveGazeteCandidates(item, central.grouped.get(item.name))
            : item
        ));

        addSystemLog(
          `✓ Merkez kaynaklardan ${central.grouped.size} gazetenin adı doğrulanmış kapağı bulundu ve geçici CDN/placeholder adaylarının önüne alındı.`,
          'success'
        );
      } else {
        addSystemLog(`Merkez kaynaklarda ${selectedDate} için kapak çözülemedi. ${central.sourceStatus.join(' | ')}`, 'warn');
      }

      // Merkez tarama tamamlandı. Bundan sonra yalnız GERÇEKTEN eksik kalan
      // gazeteler detay kaynaklarına gider. 30 kartın ayrı ayrı rescue başlatması yok.
      gazeteCentralReadyRef.current = true;
      const forcedSpecialVerify = ['Analiz', 'Gazete Pencere'];
      const stillMissing = [...new Set([
        ...GAZETE_MASTER_LIST.filter(name => !central.grouped.has(name)),
        ...forcedSpecialVerify
      ])];

      const results = await Promise.allSettled(stillMissing.map(async name => ({
        name,
        candidates: await fetchIndividualGazeteCandidates(name, selectedDate, controller.signal)
      })));

      if (requestId !== gazeteRequestIdRef.current || controller.signal.aborted) return;

      const found = new Map();
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.candidates.length) {
          found.set(result.value.name, result.value.candidates);
        }
      }
      if (found.size) {
        setGazeteItems(prev => prev.map(item =>
          found.has(item.name) ? prependLiveGazeteCandidates(item, found.get(item.name)) : item
        ));

        const forcedDone = ['Analiz', 'Gazete Pencere'].filter(name => found.has(name));
        if (forcedDone.length) {
          addSystemLog(`✓ Özel kapak kilidi düzeltildi: ${forcedDone.join(', ')} gerçek kapakları stale fallback'in önüne alındı.`, 'success');
        }
        addSystemLog(`✓ Detay kaynaklarından tamamlananlar: ${[...found.keys()].join(', ')}`, 'success');
      }

      const unresolved = stillMissing.filter(name => !found.has(name));
      const resolvedTotal = GAZETE_MASTER_LIST.length - unresolved.length;

      if (unresolved.length) {
        addSystemLog(
          `Gazete sonucu: ${resolvedTotal}/${GAZETE_MASTER_LIST.length} gerçek kapak çözüldü. Eksik: ${unresolved.join(', ')}. Placeholder/eski tarih gerçek kapak sayılmayacak.`,
          'warn'
        );
      } else {
        addSystemLog(
          `✓ Gazete sonucu: ${GAZETE_MASTER_LIST.length}/${GAZETE_MASTER_LIST.length} gerçek kapak çözüldü.`,
          'success'
        );
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setGazeteError('Gazete manşetleri hazırlanırken hata oluştu.');
        addSystemLog('Gazete yükleme hatası: ' + (e?.message || e), 'error');
      }
    } finally {
      if (requestId === gazeteRequestIdRef.current) setGazeteLoading(false);
    }
  };
  const handleGazeteImageError = (event, item, kind = 'thumb') => {
    const image = event.currentTarget;
    const list = kind === 'full' ? (item?.fullCandidates || []) : (item?.thumbCandidates || []);
    const indexKey = kind === 'full' ? 'gazeteFullIndex' : 'gazeteThumbIndex';
    const nextIndex = Number(image.dataset[indexKey] || 0) + 1;
    if (nextIndex < list.length) { image.dataset[indexKey] = String(nextIndex); image.src = list[nextIndex]; return; }
    image.src = item?.placeholder || makeGazetePlaceholder(item?.name || 'Gazete');
    image.style.opacity = '0.65';
    if (gazeteCentralReadyRef.current && image.dataset.gazeteRescue !== '1') {
      image.dataset.gazeteRescue = '1';
      rescueGazeteItem(item?.name);
    }
  };
  const handleGazeteImageLoad = (event, item, kind = 'thumb') => {
    const image = event.currentTarget;
    const current = image.currentSrc || image.src;
    if (!item || !current) return;

    // Placeholder HTTP 200 gibi "başarıyla" yüklenebilir.
    // Gerçek kapak sayma; yalnız bu gazeteyi hedefli kurtar.
    if (current.startsWith('data:image/') || current === item.placeholder) {
      image.style.opacity = '0.62';

      // İlk merkez taraması devam ederken rescue başlatma.
      // Merkez tarama zaten bütün gazeteleri tek seferde çözmeye çalışıyor.
      if (gazeteCentralReadyRef.current && image.dataset.gazeteRescue !== '1') {
        image.dataset.gazeteRescue = '1';
        rescueGazeteItem(item.name);
      }
      return;
    }

    // 1.14 regresyonundaki gibi boyut/aspect kontrolü YOK.
    // Görüntü yüklendiyse çalışana dokunma.
    image.style.opacity = '1';
    const cacheField = kind === 'full' ? 'full' : 'thumb';
    persistGazeteResolution(gazeteDate, item.name, cacheField, current);

    // React state nesnesini burada doğrudan MUTATE ETME.
    // Önceki sürümde bu, sonradan gelen gerçek kapağın stale resolvedThumb
    // tarafından ezilmesine yol açıyordu.
  };
  const addGazeteToCustomSceneImages = async (dataUrl, gazeteName) => {
    try {
      const updatedImages = [...(studioMedia.customSceneImages || []), dataUrl].slice(0, RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES);
      for (let i = 0; i < updatedImages.length; i++) await AssetManagerService.saveMedia("CUSTOM_SCENE_IMG_" + i, updatedImages[i]);
      setStudioMedia(s => ({ ...s, customSceneImages: updatedImages }));
      addSystemLog(`✓ Sabit Görsel'e yüklendi: ${gazeteName}`, 'success');
    } catch (e) { addSystemLog('Sabit Görsel ekleme uyarısı: ' + e.message, 'warn'); }
  };
  const matchOrFormatGazeteName = (rawName) => {
    if (!rawName) return '';
    const GAZETE_LIST = GAZETE_MASTER_LIST;
    const lower = rawName.toLowerCase();
    for (const g of GAZETE_LIST) { if (lower.includes(g.toLowerCase()) || g.toLowerCase().includes(lower)) return g; }
    const cleaned = rawName.replace(/(_crop|\.png|\.jpg|\.jpeg|gazetesi|manşet|[0-9_-])/gi, ' ').trim();
    if (!cleaned) return rawName;
    return cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };
  const openCropModal = useCallback((src, name) => {
    const finalName = matchOrFormatGazeteName(name) || name;
    setConfig(prev => ({ ...prev, sourceName: finalName }));
    setGazeteCropModal({ src, name: finalName });
  }, []);
  const applyCrop = useCallback(async (cropDataUrl, gazeteName) => {
    const finalName = matchOrFormatGazeteName(gazeteName) || gazeteName;
    const newFile = { name: finalName + '_crop.png', type: 'image/png', data: cropDataUrl };
    setUiState(prev => ({ ...prev, selectedMediaFiles: [...(prev.selectedMediaFiles || []), newFile] }));
    setConfig(prev => ({ ...prev, sourceName: finalName }));
    await addGazeteToCustomSceneImages(cropDataUrl, finalName);
    setGazeteCropModal(null);
    setActiveTab('media');
    addSystemLog(`✓ Gazete crop eklendi, Kaynak otomatik seçildi: ${finalName}`, 'success');
  }, [studioMedia]);
  const gazeteBlobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Gazete görseli DataURL dönüşümü başarısız.'));
    reader.readAsDataURL(blob);
  });

  const gazeteLoadBitmap = async (blob) => {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob);
        return {
          image: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => { try { bitmap.close(); } catch (e) {} }
        };
      } catch (e) { ErrorHandler.silent(e); }
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Gazete görsel ölçüsü okunamadı.'));
        el.src = objectUrl;
      });
      return {
        image: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        close: () => {}
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const gazeteIsPortraitPage = (width, height) => {
    if (!width || !height) return false;
    const ratio = width / height;
    // Türkiye gazete kapaklarında güvenli portre aralığı.
    return height > width && ratio >= 0.38 && ratio <= 0.88;
  };

  const gazeteAutoCropPortrait = async (blob, gazeteName = 'Gazete') => {
    let loaded = null;
    try {
      loaded = await gazeteLoadBitmap(blob);
      const sw = loaded.width;
      const sh = loaded.height;
      if (!sw || !sh) return null;

      const analysisMax = 420;
      const scale = Math.min(1, analysisMax / Math.max(sw, sh));
      const aw = Math.max(40, Math.round(sw * scale));
      const ah = Math.max(40, Math.round(sh * scale));

      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = aw;
      analysisCanvas.height = ah;
      const actx = analysisCanvas.getContext('2d', { willReadFrequently: true });
      actx.drawImage(loaded.image, 0, 0, aw, ah);

      const pixels = actx.getImageData(0, 0, aw, ah).data;
      const sampleSize = Math.max(3, Math.round(Math.min(aw, ah) * 0.035));

      const sampleCorner = (sx, sy) => {
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = sy; y < Math.min(ah, sy + sampleSize); y++) {
          for (let x = sx; x < Math.min(aw, sx + sampleSize); x++) {
            const i = (y * aw + x) * 4;
            r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++;
          }
        }
        return n ? [r / n, g / n, b / n] : [0, 0, 0];
      };

      const corners = [
        sampleCorner(0, 0),
        sampleCorner(Math.max(0, aw - sampleSize), 0),
        sampleCorner(0, Math.max(0, ah - sampleSize)),
        sampleCorner(Math.max(0, aw - sampleSize), Math.max(0, ah - sampleSize))
      ];

      const bg = [
        corners.reduce((s, c) => s + c[0], 0) / corners.length,
        corners.reduce((s, c) => s + c[1], 0) / corners.length,
        corners.reduce((s, c) => s + c[2], 0) / corners.length
      ];

      const bgLum = (bg[0] + bg[1] + bg[2]) / 3;
      const colorThreshold = bgLum < 75 ? 48 : (bgLum > 185 ? 56 : 64);

      const colHits = new Uint32Array(aw);
      const rowHits = new Uint32Array(ah);

      for (let y = 0; y < ah; y++) {
        for (let x = 0; x < aw; x++) {
          const i = (y * aw + x) * 4;
          if (pixels[i + 3] < 40) continue;

          const dr = pixels[i] - bg[0];
          const dg = pixels[i + 1] - bg[1];
          const db = pixels[i + 2] - bg[2];
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);

          if (dist > colorThreshold) {
            colHits[x]++;
            rowHits[y]++;
          }
        }
      }

      const minColHits = Math.max(2, Math.round(ah * 0.018));
      const minRowHits = Math.max(2, Math.round(aw * 0.018));

      let left = 0, right = aw - 1, top = 0, bottom = ah - 1;

      while (left < right && colHits[left] < minColHits) left++;
      while (right > left && colHits[right] < minColHits) right--;
      while (top < bottom && rowHits[top] < minRowHits) top++;
      while (bottom > top && rowHits[bottom] < minRowHits) bottom--;

      let bw = right - left + 1;
      let bh = bottom - top + 1;

      if (bw < aw * 0.05 || bh < ah * 0.12) return null;

      // Biraz güvenli pay bırak.
      const padX = Math.round(bw * 0.04);
      const padY = Math.round(bh * 0.025);
      left = Math.max(0, left - padX);
      right = Math.min(aw - 1, right + padX);
      top = Math.max(0, top - padY);
      bottom = Math.min(ah - 1, bottom + padY);

      bw = right - left + 1;
      bh = bottom - top + 1;

      // Otomatik bulunan alan gazete gibi portre değilse kırpma yapma.
      if (!gazeteIsPortraitPage(bw, bh)) return null;

      const sx = Math.max(0, Math.round((left / aw) * sw));
      const sy = Math.max(0, Math.round((top / ah) * sh));
      const cropW = Math.min(sw - sx, Math.max(1, Math.round((bw / aw) * sw)));
      const cropH = Math.min(sh - sy, Math.max(1, Math.round((bh / ah) * sh)));

      const outCanvas = document.createElement('canvas');
      // Orijinal çözünürlüğü koru; aşırı büyükse 1800 yüksekliğe sınırla.
      const maxH = 1800;
      const outScale = Math.min(1, maxH / cropH);
      outCanvas.width = Math.max(1, Math.round(cropW * outScale));
      outCanvas.height = Math.max(1, Math.round(cropH * outScale));

      const octx = outCanvas.getContext('2d');
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(
        loaded.image,
        sx, sy, cropW, cropH,
        0, 0, outCanvas.width, outCanvas.height
      );

      const result = outCanvas.toDataURL('image/jpeg', 0.97);
      addSystemLog(
        `✓ ${gazeteName}: yatay/boşluklu kaynak içinden gazete sayfası otomatik kırpıldı (${cropW}x${cropH} → ${outCanvas.width}x${outCanvas.height}).`,
        'success'
      );
      return result;
    } catch (e) {
      ErrorHandler.silent(e);
      return null;
    } finally {
      try { loaded?.close?.(); } catch (e) {}
    }
  };

  const gazeteCorsSafeImageUrl = (src, width = 1800, quality = 96) => {
    if (!src) return '';
    if (String(src).startsWith('data:image/') || String(src).startsWith('blob:')) return src;

    // Zaten weserv ise tekrar proxy içine sarma.
    try {
      const u = new URL(src);
      if (u.hostname === 'images.weserv.nl') return src;
    } catch (e) {}

    const clean = decodeGazeteUrl(src);
    return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${width}&fit=contain&we=1&output=jpg&q=${quality}&sharp=1`;
  };

  const gazeteImageToDataUrl = async (srcOrList, gazeteName = 'Gazete') => {
    const inputList = Array.isArray(srcOrList) ? srcOrList : [srcOrList];
    const rawList = uniqueGazeteUrls(inputList.filter(Boolean));

    if (!rawList.length) throw new Error(`Gerçek gazete kapağı bulunamadı: ${gazeteName}`);

    const candidates = [];
    for (const raw of rawList) {
      if (!raw) continue;

      if (String(raw).startsWith('data:image/')) {
        candidates.push({ url: raw, kind: 'data' });
        continue;
      }

      if (String(raw).startsWith('blob:')) {
        candidates.push({ url: raw, kind: 'blob' });
        continue;
      }

      candidates.push({ url: gazeteCorsSafeImageUrl(raw, 1800, 96), kind: 'weserv-1800' });
      candidates.push({ url: gazeteCorsSafeImageUrl(raw, 1400, 94), kind: 'weserv-1400' });
      candidates.push({ url: raw, kind: 'raw' });
    }

    const deduped = [];
    const seen = new Set();
    for (const c of candidates) {
      if (!c.url || seen.has(c.url)) continue;
      seen.add(c.url);
      deduped.push(c);
    }

    let lastError = null;
    let bestFallback = null;

    for (const candidate of deduped) {
      const url = candidate.url;

      try {
        let blob;

        if (String(url).startsWith('data:image/')) {
          const response = await fetch(url);
          blob = await response.blob();
        } else if (String(url).startsWith('blob:')) {
          const response = await fetch(url);
          blob = await response.blob();
        } else {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15000);
          let response;
          try {
            response = await fetch(url, {
              method: 'GET',
              cache: 'no-store',
              mode: 'cors',
              credentials: 'omit',
              signal: controller.signal
            });
          } finally {
            clearTimeout(timer);
          }

          if (!response.ok) {
            lastError = new Error(`${candidate.kind}: HTTP ${response.status}`);
            continue;
          }

          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          blob = await response.blob();

          if (!(contentType.startsWith('image/') || String(blob.type || '').startsWith('image/'))) {
            lastError = new Error(`${candidate.kind}: görsel olmayan yanıt (${contentType || blob.type || 'bilinmiyor'})`);
            continue;
          }
        }

        if (!blob || !blob.size) {
          lastError = new Error(`${candidate.kind}: boş görsel`);
          continue;
        }

        let loaded = null;
        try {
          loaded = await gazeteLoadBitmap(blob);
          const iw = loaded.width;
          const ih = loaded.height;
          const ratio = iw && ih ? (iw / ih) : 0;

          addSystemLog(
            `${gazeteName}: video kapak adayı ${candidate.kind} ${iw}x${ih}${ratio ? ` (oran ${ratio.toFixed(2)})` : ''}.`,
            'info'
          );

          // GERÇEK gazete sayfası: portre aday doğrudan kabul edilir.
          if (gazeteIsPortraitPage(iw, ih)) {
            const dataUrl = await gazeteBlobToDataUrl(blob);
            addSystemLog(
              `✓ ${gazeteName}: gerçek portre gazete kapağı videoya seçildi (${candidate.kind}, ${iw}x${ih}, ${(blob.size / 1024).toFixed(0)}KB).`,
              'success'
            );
            return dataUrl;
          }

          // Yatay/preview görseli doğrudan kabul ETME.
          // Daha iyi portre aday olabilir; yedek olarak sakla.
          const area = iw * ih;
          const closeness = ratio > 0 ? Math.abs(ratio - 0.62) : 99;
          const score = (area / 1000000) - (closeness * 2.5);

          if (!bestFallback || score > bestFallback.score) {
            bestFallback = { blob, kind: candidate.kind, width: iw, height: ih, score };
          }
        } finally {
          try { loaded?.close?.(); } catch (e) {}
        }
      } catch (e) {
        lastError = e;
        ErrorHandler.silent(e);
      }
    }

    // Hiç portre kaynak bulunamazsa, en iyi yatay kaynaktaki gazete sayfasını
    // otomatik bulup kırp. Böylece videoda küçücük gazete kalmaz.
    if (bestFallback?.blob) {
      const cropped = await gazeteAutoCropPortrait(bestFallback.blob, gazeteName);
      if (cropped) return cropped;

      addSystemLog(
        `${gazeteName}: portre kapak bulunamadı; son yatay aday (${bestFallback.width}x${bestFallback.height}) video için reddedildi.`,
        'warn'
      );
    }

    throw new Error(
      `Gazete kapağı videoya aktarılamadı: ${gazeteName}. Portre/tam-boy gerçek kapak bulunamadı.` +
      (lastError?.message ? ` (${lastError.message})` : '')
    );
  };

  const startGazeteVideoFromCard = async (item, idx, visibleImageSrc = '') => {
    if (!item) return false;

    if (gazeteStartLockRef.current.locked || gazeteAutoVideoRef.current.active || uiState.isProcessing) {
      const runningName = gazeteStartLockRef.current.name || gazeteAutoVideoRef.current.name || 'başka bir gazete';
      addSystemLog(`Gazete video zaten başlatıldı (${runningName}). İkinci tıklama yok sayıldı.`, 'warn');
      return false;
    }

    const finalName = matchOrFormatGazeteName(item.name) || item.name || 'Gazete';
    const token = `gazete_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Lock immediately, BEFORE any await/fetch/rescue.
    gazeteStartLockRef.current = { locked: true, token, name: finalName };
    gazeteAutoVideoRef.current = { active: true, name: finalName };

    const releaseIfMine = () => {
      if (gazeteStartLockRef.current.token === token) {
        gazeteStartLockRef.current = { locked: false, token: '', name: '' };
      }
    };

    try {
      setGazeteCurrentIdx(idx);
      setActiveTab('gazete');
      setGazeteGalleryView('grid');
      setConfig(prev => ({
        ...prev,
        tip: 'haber',
        outputType: 'video',
        sourceName: finalName
      }));
      setUiState(prev => ({
        ...prev,
        error: '',
        isProcessing: true,
        statusText: `${finalName} gazete okuma videosu hazırlanıyor...`
      }));

      let workingItem = item;
      const collectCandidates = (target) => {
        // EN ÖNEMLİ KURAL:
        // Kullanıcının tıkladığı anda DOM'da gerçekten görünen <img>.currentSrc
        // videoya giden 1 numaralı kaynaktır. React item içindeki eski/stale URL
        // artık bunun önüne geçemez.
        const actualVisibleCover = visibleImageSrc || null;

        return uniqueGazeteUrls([
          actualVisibleCover,
          target?.resolvedThumb,
          target?.thumbSrc,
          ...(target?.thumbCandidates || []),
          target?.resolvedFull,
          target?.fullSrc,
          ...(target?.fullCandidates || [])
        ]).filter(url =>
          url &&
          url !== target?.placeholder &&
          !String(url).startsWith('data:image/svg+xml')
        );
      };

      let videoImageCandidates = collectCandidates(workingItem);

      if (!videoImageCandidates.length) {
        addSystemLog(`${finalName}: gerçek kapak hazır değil, kaynak bir kez tekrar aranıyor...`, 'warn');
        const rescued = await rescueGazeteItem(finalName);

        if (gazeteStartLockRef.current.token !== token) {
          throw new Error('Gazete başlangıç kilidi değişti; karışık işlem engellendi.');
        }

        if (rescued) {
          await new Promise(r => setTimeout(r, 280));
          workingItem = gazeteItems.find(g => g.name === finalName) || workingItem;
          videoImageCandidates = collectCandidates(workingItem);
        }
      }

      if (!videoImageCandidates.length) throw new Error(`${finalName} için gerçek kapak bulunamadı.`);

      addSystemLog(`▶ ${finalName}: tek-job kilidi aktif; eski gazete okuma modu korunuyor.`, 'success');

      addSystemLog(`📰 ${finalName}: video başlamadan önce gerçek PORTRE gazete kapağı doğrulanacak; yatay preview kabul edilmeyecek.`, 'info');
      const dataUrl = await gazeteImageToDataUrl(videoImageCandidates, finalName);

      if (gazeteStartLockRef.current.token !== token) {
        throw new Error('Gazete başlangıç kilidi değişti; karışık işlem engellendi.');
      }

      const newFile = { name: `${finalName}.jpg`, type: 'image/jpeg', data: dataUrl };
      setUiState(prev => ({ ...prev, selectedMediaFiles: [newFile] }));

      await handleExecuteStart(
        [newFile],
        'video',
        {
          tip: 'haber',
          sourceName: finalName,
          customSceneImages: [dataUrl],
          forceGazeteImageOnly: true,
          _gazeteDirectClick: true,
          _gazeteSourceLock: finalName,
          _gazeteImageLock: dataUrl,
          _gazeteStartToken: token
        }
      );

      return workflowRef.current?.state?.status === 'COMPLETED';
    } catch (e) {
      gazeteAutoVideoRef.current = { active: false, name: '' };
      releaseIfMine();
      addSystemLog(`${finalName} otomatik video hatası: ${e.message}`, 'error');
      setUiState(prev => ({ ...prev, isProcessing: false, error: e.message }));
      return false;
    }
  };

  const _gazeteAutoVisibleSource = (item) => {
    if (!item) return '';
    const values = [
      item.resolvedThumb,
      item.thumbSrc,
      item.resolvedFull,
      item.fullSrc,
      ...(item.thumbCandidates || []),
      ...(item.fullCandidates || [])
    ];

    return values.find(src =>
      src &&
      src !== item.placeholder &&
      !String(src).startsWith('data:image/svg+xml')
    ) || '';
  };

  const _persistGazeteAutoRun = () => {
    const batch = gazeteAuto0700Ref.current;
    _saveGazeteAuto0700State({
      date: batch.date,
      status: batch.active ? 'running' : 'completed',
      trigger: batch.trigger,
      queue: batch.queue,
      completed: batch.completed,
      failed: batch.failed,
      bufferScheduled: batch.bufferScheduled || [],
      bufferFailed: batch.bufferFailed || [],
      timings: batch.timings || [],
      bufferIntervalMinutes: bufferAutoIntervalMinutesRef.current === 10 ? 10 : 5,
      current: batch.current,
      updatedAt: Date.now()
    });
  };

  const startGazeteMorningBatch = async (trigger = 'manual', forceRestart = false) => {
    const todayTR = _getTurkeyDateISO();

    if (gazeteAuto0700Ref.current.active) {
      addSystemLog('07:00 Gazete Otonomu zaten çalışıyor; ikinci başlangıç yok sayıldı.', 'warn');
      return false;
    }

    if (uiProcessingRef.current || gazeteStartLockRef.current.locked || gazeteAutoVideoRef.current.active) {
      addSystemLog('07:00 Gazete Otonomu: başka bir video işi devam ediyor; 60 saniye sonra tekrar denenecek.', 'warn');
      setTimeout(() => {
        if (gazeteAuto0700Enabled && !gazeteAuto0700Ref.current.active) {
          startGazeteMorningBatch(trigger, forceRestart);
        }
      }, 60_000);
      return false;
    }

    const saved = _loadGazeteAuto0700State();
    if (
      !forceRestart &&
      saved?.date === todayTR &&
      saved?.status === 'completed'
    ) {
      addSystemLog(`07:00 Gazete Otonomu bugün zaten tamamlandı (${todayTR}).`, 'info');
      return true;
    }

    const batch = {
      active: true,
      date: todayTR,
      queue: [],
      completed:
        !forceRestart && saved?.date === todayTR && Array.isArray(saved?.completed)
          ? [...saved.completed]
          : [],
      failed: [],
      bufferScheduled: [],
      bufferFailed: [],
      timings:
        !forceRestart && saved?.date === todayTR && Array.isArray(saved?.timings)
          ? [...saved.timings]
          : [],
      current: '',
      trigger
    };

    // v1.44: Gerçek ölçümde uçtan uca süre 5 dakikayı aştı.
    // Her yeni günlük seri artık doğrudan 10dk aralıkla başlar.
    if (forceRestart || saved?.date !== todayTR) {
      bufferAutoIntervalMinutesRef.current = 10;
      bufferAutoLastDueAtRef.current = 0;
      bufferAutoNextDueAtRef.current = 0;

      SafeStorage.setItem(BUFFER_AUTO_INTERVAL_KEY, '10');
      SafeStorage.setItem(BUFFER_AUTO_LAST_DUE_KEY, '0');
      SafeStorage.setItem(BUFFER_AUTO_NEXT_DUE_KEY, '0');
    } else {
      bufferAutoIntervalMinutesRef.current = 10;
      SafeStorage.setItem(BUFFER_AUTO_INTERVAL_KEY, '10');
    }
    gazeteAuto0700Ref.current = batch;

    setGazeteAuto0700Ui({
      active: true,
      current: '',
      total: 0,
      completed: batch.completed.length,
      failed: 0,
      message: 'Bugünün gazeteleri hazırlanıyor...'
    });

    setActiveTab('gazete');
    setGazeteGalleryView('grid');
    setGazeteDate(todayTR);

    addSystemLog(
      `☀️ FIX CHECKLIST v1.36: 07:00 Gazete Otonomu başladı (${trigger}, ${todayTR}).`,
      'success'
    );

    try {
      // Kaynaklar sabah geç yanıt verirse kısa aralıklarla en fazla 3 kez yenile.
      let items = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        await fetchGazeteManşetleri(todayTR);

        // React state/ref'in yerleşmesi için kısa bekleme.
        for (let waitStep = 0; waitStep < 12; waitStep++) {
          await new Promise(r => setTimeout(r, 250));
          if (!gazeteLoadingRef.current && gazeteItemsRef.current.length > 0) break;
        }

        items = [...gazeteItemsRef.current];

        const usableCount = items.filter(item => !!_gazeteAutoVisibleSource(item)).length;
        addSystemLog(
          `07:00 Gazete Otonomu: manşet taraması ${attempt}/3 → ${usableCount}/${items.length || 30} işlenebilir kart.`,
          usableCount ? 'info' : 'warn'
        );

        if (usableCount > 0) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, 60_000));
      }

      if (!items.length) {
        throw new Error('Gazete listesi yüklenemedi; otomatik seri başlatılmadı.');
      }

      const completedSet = new Set(batch.completed);
      batch.queue = items
        .map(item => item.name)
        .filter(Boolean)
        .filter(name => forceRestart || !completedSet.has(name));

      _persistGazeteAutoRun();

      setGazeteAuto0700Ui(prev => ({
        ...prev,
        total: batch.queue.length + batch.completed.length,
        completed: batch.completed.length,
        message: `${batch.queue.length} gazete sıraya alındı.`
      }));

      for (let qIndex = 0; qIndex < batch.queue.length; qIndex++) {
        if (!gazeteAuto0700Ref.current.active) break;

        const name = batch.queue[qIndex];
        batch.current = name;
        _persistGazeteAutoRun();

        const currentItems = gazeteItemsRef.current;
        const itemIndex = currentItems.findIndex(item => item.name === name);
        const item = itemIndex >= 0 ? currentItems[itemIndex] : null;

        setGazeteAuto0700Ui(prev => ({
          ...prev,
          current: name,
          message: `${qIndex + 1}/${batch.queue.length}: ${name} videosu hazırlanıyor...`
        }));

        if (!item) {
          batch.failed.push({ name, reason: 'Kart bulunamadı' });
          _persistGazeteAutoRun();
          setGazeteAuto0700Ui(prev => ({ ...prev, failed: batch.failed.length }));
          continue;
        }

        const visibleSrc = _gazeteAutoVisibleSource(item);

        const gazeteStartedAt = Date.now();
        const videoStartedAt = gazeteStartedAt;
        let videoFinishedAt = 0;
        let bufferStartedAt = 0;
        let bufferFinishedAt = 0;
        let scheduledDueAt = null;
        let intervalMinutesUsed = bufferAutoIntervalMinutesRef.current === 10 ? 10 : 5;

        addSystemLog(
          `☀️ 07:00 Otonom ${qIndex + 1}/${batch.queue.length}: ${name} seçiliyor... (ölçüm başladı)`,
          'info'
        );

        let ok = false;
        try {
          ok = await startGazeteVideoFromCard(item, itemIndex, visibleSrc);
          videoFinishedAt = Date.now();
        } catch (e) {
          ok = false;
          videoFinishedAt = Date.now();
          ErrorHandler.silent(e);
        }

        if (!videoFinishedAt) videoFinishedAt = Date.now();

        if (ok) {
          if (!batch.completed.includes(name)) batch.completed.push(name);
          addSystemLog(`✓ 07:00 Otonom: ${name} videosu tamamlandı ve otomatik kaydedildi.`, 'success');

          if (bufferAuto5MinEnabled) {
            const completedVideoUrl = workflowRef.current?.state?.videoUrl || '';
            const completedTitle =
              workflowRef.current?.state?.script?.thumbnailText ||
              name ||
              'OTONOM Gazete';

            if (completedVideoUrl) {
              const slot = reserveNextBufferAutoSlot();
              const dueAt = slot.dueAt;
              intervalMinutesUsed = slot.intervalMinutes;
              scheduledDueAt = dueAt;
              bufferStartedAt = Date.now();

              try {
                addSystemLog(
                  `Buffer +${intervalMinutesUsed}dk: ${name} → ${new Date(dueAt).toLocaleString('tr-TR')} için planlanıyor...`,
                  'info'
                );

                const bufferReport = await shareToBufferAPI(
                  completedTitle,
                  completedVideoUrl,
                  {
                    scheduleAt: dueAt,
                    source: 'gazete-0700'
                  }
                );

                bufferFinishedAt = Date.now();

                if (bufferReport.scheduledCount > 0) {
                  batch.bufferScheduled.push({
                    name,
                    dueAt,
                    intervalMinutes: intervalMinutesUsed,
                    channels: bufferReport.scheduledCount
                  });

                  addSystemLog(
                    `✓ Buffer +${intervalMinutesUsed}dk: ${name} ${bufferReport.scheduledCount} kanalda planlandı.`,
                    'success'
                  );
                } else {
                  throw new Error('Hiçbir Buffer kanalı planlanamadı.');
                }
              } catch (bufferError) {
                bufferFinishedAt = Date.now();

                batch.bufferFailed.push({
                  name,
                  reason: bufferError.message
                });

                addSystemLog(
                  `Buffer planlama hatası (${name}): ${bufferError.message}. Video serisi durmayacak.`,
                  'warn'
                );
              }
            } else {
              bufferStartedAt = Date.now();
              bufferFinishedAt = bufferStartedAt;

              batch.bufferFailed.push({
                name,
                reason: 'Tamamlanan video URL bulunamadı'
              });
              addSystemLog(`Buffer planlama atlandı (${name}): video URL bulunamadı.`, 'warn');
            }
          }
        } else {
          batch.failed.push({
            name,
            reason: workflowRef.current?.state?.error || 'Video üretimi başarısız'
          });
          addSystemLog(`07:00 Otonom: ${name} başarısız; sıradaki gazeteye geçiliyor.`, 'warn');
        }

        const gazeteFinishedAt = Date.now();
        const videoMs = Math.max(0, videoFinishedAt - videoStartedAt);
        const bufferMs =
          bufferStartedAt > 0
            ? Math.max(0, (bufferFinishedAt || gazeteFinishedAt) - bufferStartedAt)
            : 0;
        const totalMs = Math.max(0, gazeteFinishedAt - gazeteStartedAt);

        const timingRecord = {
          name,
          startedAt: gazeteStartedAt,
          finishedAt: gazeteFinishedAt,
          videoMs,
          bufferMs,
          totalMs,
          intervalMinutesUsed,
          dueAt: scheduledDueAt,
          videoOk: !!ok,
          bufferOk: batch.bufferScheduled.some(x => x.name === name)
        };

        batch.timings.push(timingRecord);

        addSystemLog(
          `⏱ ${name}: toplam ${formatGazeteDuration(totalMs)} | video ${formatGazeteDuration(videoMs)} | Buffer ${formatGazeteDuration(bufferMs)} | paylaşım aralığı ${intervalMinutesUsed}dk.`,
          'info'
        );

        // Bir gazetenin gerçek uçtan uca süresi 5 dakikayı aşarsa kalan gün 10dk.
        if (
          totalMs > (5 * 60 * 1000) &&
          bufferAutoIntervalMinutesRef.current !== 10
        ) {
          bufferAutoIntervalMinutesRef.current = 10;
          SafeStorage.setItem(BUFFER_AUTO_INTERVAL_KEY, '10');

          addSystemLog(
            `⏱ ADAPTİF BUFFER: ${name} toplam ${formatGazeteDuration(totalMs)} sürdü (>05:00). Sonraki gazeteler 10dk arayla planlanacak.`,
            'warn'
          );
        }

        _persistGazeteAutoRun();

        setGazeteAuto0700Ui(prev => ({
          ...prev,
          completed: batch.completed.length,
          failed: batch.failed.length
        }));

        // Dosya indirme/UI dönüşü yerleşsin; sonra sonraki gazete.
        await new Promise(r => setTimeout(r, 900));
      }

      batch.active = false;
      batch.current = '';
      _persistGazeteAutoRun();

      setGazeteAuto0700Ui({
        active: false,
        current: '',
        total: batch.queue.length + batch.completed.length,
        completed: batch.completed.length,
        failed: batch.failed.length,
        message: `Tamamlandı: ${batch.completed.length} başarılı, ${batch.failed.length} hata.`
      });

      setActiveTab('gazete');
      setGazeteGalleryView('grid');

      const timingRows = batch.timings || [];
      const avgTotalMs = timingRows.length
        ? timingRows.reduce((sum, x) => sum + Number(x.totalMs || 0), 0) / timingRows.length
        : 0;
      const maxTiming = timingRows.reduce(
        (best, x) => !best || Number(x.totalMs || 0) > Number(best.totalMs || 0) ? x : best,
        null
      );

      addSystemLog(
        `☀️ 07:00 GAZETE OTONOMU TAMAMLANDI — video başarılı=${batch.completed.length}, video hata=${batch.failed.length}` +
        ` | Buffer planlanan=${batch.bufferScheduled.length}, Buffer hata=${batch.bufferFailed.length}` +
        ` | ortalama uçtan uca=${formatGazeteDuration(avgTotalMs)}` +
        ` | en uzun=${maxTiming ? `${maxTiming.name} ${formatGazeteDuration(maxTiming.totalMs)}` : 'yok'}` +
        ` | final paylaşım aralığı=10dk` +
        (batch.failed.length ? ` | Video hatalı: ${batch.failed.map(x => x.name).join(', ')}` : '') +
        (batch.bufferFailed.length ? ` | Buffer hatalı: ${batch.bufferFailed.map(x => x.name).join(', ')}` : ''),
        (batch.failed.length || batch.bufferFailed.length) ? 'warn' : 'success'
      );

      for (const row of timingRows) {
        addSystemLog(
          `⏱ SÜRE RAPORU | ${row.name} | toplam=${formatGazeteDuration(row.totalMs)} | video=${formatGazeteDuration(row.videoMs)} | Buffer=${formatGazeteDuration(row.bufferMs)} | aralık=${row.intervalMinutesUsed}dk`,
          'info'
        );
      }

      return true;
    } catch (e) {
      batch.active = false;
      batch.current = '';
      _saveGazeteAuto0700State({
        date: todayTR,
        status: 'failed',
        trigger,
        queue: batch.queue,
        completed: batch.completed,
        failed: [...batch.failed, { name: 'OTONOM', reason: e.message }],
        bufferScheduled: batch.bufferScheduled || [],
        bufferFailed: batch.bufferFailed || [],
        timings: batch.timings || [],
        bufferIntervalMinutes: bufferAutoIntervalMinutesRef.current === 10 ? 10 : 5,
        current: '',
        updatedAt: Date.now()
      });

      setGazeteAuto0700Ui(prev => ({
        ...prev,
        active: false,
        current: '',
        failed: prev.failed + 1,
        message: `Otonom hata: ${e.message}`
      }));

      addSystemLog(`07:00 Gazete Otonomu hata: ${e.message}`, 'error');
      return false;
    }
  };

  // Türkiye saati 07:00-08:30 aralığında sekme açıksa günlük otonomu bir kez başlat.
  useEffect(() => {
    if (!gazeteAuto0700Enabled) return;

    let cancelled = false;

    const checkSchedule = () => {
      if (cancelled || gazeteAuto0700Ref.current.active) return;

      const tr = _getTurkeyClockParts();
      if (
        tr.minutesOfDay < GAZETE_AUTO_0700_START_MINUTE ||
        tr.minutesOfDay > GAZETE_AUTO_0700_CATCHUP_END
      ) {
        return;
      }

      const saved = _loadGazeteAuto0700State();
      if (saved?.date === tr.date && saved?.status === 'completed') return;

      startGazeteMorningBatch('schedule', false);
    };

    const initialTimer = setTimeout(checkSchedule, 1500);
    const interval = setInterval(checkSchedule, 30_000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [gazeteAuto0700Enabled]);

  const addFullImageToMedia = async (src, name) => {
    try {
      setGazeteLoading(true);
      const finalName = matchOrFormatGazeteName(name) || name;
      const dataUrl = await gazeteImageToDataUrl(src, finalName);
      const newFile = { name: finalName + '.jpg', type: 'image/jpeg', data: dataUrl };

      setUiState(prev => ({ ...prev, selectedMediaFiles: [...(prev.selectedMediaFiles || []), newFile] }));
      setConfig(prev => ({ ...prev, sourceName: finalName }));
      await addGazeteToCustomSceneImages(dataUrl, finalName);
      setActiveTab('media');
      addSystemLog(`✓ Tam gazete görseli eklendi, Kaynak otomatik seçildi: ${finalName}`, 'success');
    } catch (e) {
      addSystemLog('Aktarma hatası: ' + e.message, 'error');
    } finally {
      setGazeteLoading(false);
    }
  };
  const [gazeteGalleryView, setGazeteGalleryView] = useState('grid');
  const [gazeteCurrentIdx, setGazeteCurrentIdx] = useState(0);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans p-3 md:p-4 relative overflow-hidden">
        <input
          ref={guzelSozIntroFileInputRef}
          type="file"
          accept="video/mp4,.mp4"
          className="hidden"
          onChange={handleGuzelSozIntroFileSelected}
        />
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4 flex items-center justify-center gap-3 flex-wrap">
                        <div className="bg-indigo-900/40 border-2 border-indigo-500/50 px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <p className="text-indigo-300 text-[10px] md:text-xs font-black tracking-widest uppercase">{APP_VERSION.toBadge()}</p>
            </div>
            <button onClick={() => setShowApiKeyModal(!showApiKeyModal)} className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${userApiKey ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
              {userApiKey ? `🔑 Key: ••••${userApiKey.slice(-4)}` : '🔑 Metin ve ses anahtarı'}
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs leading-relaxed text-slate-300">
            <p><strong className="text-emerald-300">Ücretsiz yayın · kendi görselleriniz.</strong> Metin ve ses için faturalandırması kapalı bir Gemini projesi kullanın. Kota dolunca işlem durur.</p>
            <p className="mt-1 text-slate-400">Anahtar yalnız bu sekmede saklanır. Hesabınızın ücretli olup olmadığı anahtardan anlaşılamaz. <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer" className="underline text-indigo-300">Ücretsiz kota koşulları</a></p>
          </div>

          {showApiKeyModal && (
            <div className="mb-4 bg-slate-900/90 border border-indigo-500/30 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-3 backdrop-blur-md">
              <div className="flex-1 w-full">
                <label htmlFor="gemini-api-key" className="text-xs font-bold text-indigo-300 block mb-1">Google Gemini API anahtarı</label>
                <input id="gemini-api-key" autoComplete="off" spellCheck={false} type="password" value={userApiKey} onChange={(e) => setUserApiKeyState(e.target.value)} placeholder="AI Studio Gemini API Key yapıştırın (AIzaSy...)" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono" />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => handleSaveApiKey(userApiKey)} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition">Kaydet</button>
                <button onClick={() => setShowApiKeyModal(false)} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition">Kapat</button>
              </div>
            </div>
          )}

          {pendingJob && (
            <div className="mb-6 bg-amber-500/10 border-2 border-amber-500/30 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertCircle size={20} className="shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">Yarım Kalan İşlem</p>
                  <p className="text-xs text-slate-300">Son render kurtarılabilir.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => { await AssetManagerService.clearJob(pendingJob.jobId); setPendingJob(null); }} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition">Yoksay</button>
                <button onClick={() => { workflowRef.current.state = pendingJob; setPendingJob(null); handleExecuteResume(); }} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition">Devam Et</button>
              </div>
            </div>
          )}

          {/* ARKA PLAN SESİ */}
          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-3 mb-4 shadow-lg">
            <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative">
              <div className="flex items-center gap-3 w-full">
                <div className={`w-10 h-10 rounded border ${(prefs.ambientSound && prefs.ambientSound !== 'none') ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'} flex items-center justify-center shrink-0`}><CloudRain size={18} /></div>
                <div className="w-full flex-1 pr-2">
                  <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Arka Plan Sesi</p>
                  <CustomSelect value={prefs.ambientSound || "none"} onChange={(val) => { if (['rain', 'wind', 'waves', 'fire', 'none'].includes(val)) { setPrefs({ ...prefs, ambientSound: val }); if (val === 'none') { AssetManagerService.loadMedia('CUSTOM_MUSIC').then(u => { if (u && u.startsWith('blob:')) ObjectURLManager.revoke(u); }); AssetManagerService.deleteMedia('CUSTOM_MUSIC'); } } else { handleFolderMusicSelect(val); } }} options={ambientOptions} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 relative z-10">
                {(prefs.ambientSound && !['none', 'rain', 'wind', 'waves', 'fire'].includes(prefs.ambientSound)) && <button onClick={deleteMusic} className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 p-2 rounded-lg transition"><Trash2 size={16} /></button>}
                {studioMedia.musicList.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 md:px-4 py-2 rounded-lg text-xs font-black whitespace-nowrap">MÜZİKLER HAZIR</span>
                    <button onClick={handleFolderSelect} className="text-[10px] text-slate-400 hover:text-violet-300 transition whitespace-nowrap">Değiştir</button>
                  </div>
                ) : (
                  <button onClick={handleFolderSelect} className="bg-violet-600 hover:bg-violet-500 text-white px-3 md:px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition whitespace-nowrap">MÜZİK KLASÖRÜ SEÇ</button>
                )}
                <input ref={musicFileInputRef} type="file" webkitdirectory="true" directory="true" multiple accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.wma" className="hidden" onChange={handleFolderSelectLegacy} />
              </div>
            </div>
            {studioMedia.musicList.length > 0 && (
              <div className="mt-2">
                <input type="text" placeholder="Müzik ara..." value={musicSearchQuery} onChange={e => setMusicSearchQuery(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500 transition" />
              </div>
            )}
            {studioMedia.syncedFolderName && (
              <div className="mt-2 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <RefreshCw size={12} className="text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <span className="text-[10px] text-emerald-400 font-bold">Otomatik: {studioMedia.syncedFolderName}</span>
                </div>
                <button onClick={clearSyncedFolder} className="text-[10px] text-slate-400 hover:text-rose-400 transition">Kaldır</button>
              </div>
            )}
            {studioMedia.musicList.length === 0 && (
              <p className="text-[9px] text-slate-500 mt-1.5 text-center">Müzik klasörünü bir kez seçin — sonraki açılışlarda otomatik yüklenir</p>
            )}
            {prefs.ambientSound && !['none', 'rain', 'wind', 'waves', 'fire'].includes(prefs.ambientSound) && (
              <div className="mt-2 flex items-center gap-2 bg-slate-900/60 border border-violet-500/30 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-400 font-bold shrink-0">🔊 Ses</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={DEFAULT_BGM_VOLUME}
                  disabled
                  className="flex-1 accent-violet-500 opacity-70 cursor-not-allowed"
                  title="Arka plan müzik seviyesi v1.41 ile %20 sabitlendi"
                />
                <span className="text-[10px] text-violet-400 font-bold shrink-0 w-8 text-right">20%</span>
                <button onClick={replayMusicPreview} className="bg-violet-600 hover:bg-violet-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0">10sn Dinle</button>
              </div>
            )}
          </div>

          {/* ANA İÇERİK */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 md:p-4 shadow-2xl relative z-10 mb-4">
            <div className="flex flex-col sm:flex-row gap-2 bg-black/30 p-1.5 rounded-xl mb-4 flex-wrap">
              <button onClick={() => setActiveTab('text')} className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Metin / Haber</button>
              <button onClick={() => setActiveTab('url')} className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Haber Linki</button>
              <button onClick={() => setActiveTab('media')} className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'media' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Medya Analizi</button>
              <button onClick={() => setActiveTab('prompt')} className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${activeTab === 'prompt' ? 'bg-fuchsia-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Serbest Prompt</button>
              <button onClick={() => { setActiveTab('gazete'); if (gazeteItems.length === 0) fetchGazeteManşetleri(); }} className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'gazete' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Newspaper size={14} /> Gazete Takip</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 font-bold">
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Clock} value={config.duration} onChange={(val) => setConfig({ ...config, duration: val })} options={[{ value: 'unlimited', label: '∞ Sınırsız', color: 'text-emerald-400 font-bold' }, { value: '15', label: '15-30s' }, { value: '30', label: '30-60s' }, { value: '60', label: '60-90s' }, { value: '90', label: '90-120s' }]} />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Smartphone} value={config.aspectRatio || '9:16'} onChange={(val) => setConfig({ ...config, aspectRatio: val })} options={[{ value: '9:16', label: 'Dikey (9:16)' }, { value: '16:9', label: 'Yatay (16:9)' }, { value: '1:1', label: 'Kare (1:1)' }]} />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Clapperboard} value={config.videoStyle || 'explainer'} onChange={(val) => setConfig({ ...config, videoStyle: val })} options={[{ value: 'news_flash', label: 'Haber Bülteni' }, { value: 'cinematic', label: 'Sinematik' }, { value: 'explainer', label: 'Açıklayıcı' }, { value: 'weekly_roundup', label: 'Haftalık Özet' }, { value: 'prompt_output', label: 'Custom Prompt', color: 'text-fuchsia-400 font-bold' }]} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <p className="text-xs text-slate-400 flex items-center gap-2"><Palette size={14} /> Görsel: yüklediğiniz medya; yoksa yerel arka plan</p>
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
                <Monitor size={16} className="text-indigo-400 shrink-0" />
                <div className="flex gap-2 w-full">{['1K', '2K', '4K'].map(res => (<button key={res} onClick={() => setConfig({ ...config, resolution: res })} className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${config.resolution === res ? 'bg-slate-200 text-slate-900' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'}`}>{res}</button>))}</div>
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Activity} value={config.transition || 'none'} onChange={(val) => setConfig({ ...config, transition: val })} options={[{ value: 'none', label: 'Yok' }, { value: 'crossfade', label: 'Karışır' }, { value: 'fadeIn', label: 'Yavaşça Belirme' }, { value: 'fadeOut', label: 'Yavaşça Kaybolma' }, { value: 'slideIn', label: 'Kayarak Giriş' }, { value: 'slideOut', label: 'Kayarak Çıkış' }]} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Clapperboard} value={config.tip || 'haber'} onChange={(val) => setConfig({ ...config, tip: val })} options={[{ value: 'haber', label: 'Haber', color: 'text-emerald-400 font-bold' }, { value: 'guzel_soz', label: 'Güzel Söz', color: 'text-amber-400 font-bold' }, { value: 'iddia_analizi', label: 'İddia Analizi', color: 'text-cyan-400 font-bold' }]} />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Globe} value={config.language || 'tr'} onChange={(val) => setConfig({ ...config, language: val })} options={[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }, { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' }, { value: 'ar', label: 'العربية' }, { value: 'ru', label: 'Русский' }]} />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={MessageSquare} value={config.subtitles || 'on'} onChange={(val) => setConfig({ ...config, subtitles: val })} options={[{ value: 'on', label: 'Altyazı: Açık' }, { value: 'off', label: 'Altyazı: Kapalı' }]} />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Type} value={config.analysisMode || 'yorumsuz'} onChange={(val) => setConfig({ ...config, analysisMode: val })} options={[{ value: 'yorumsuz', label: 'Yorumsuz' }, { value: 'visibility', label: 'Görünürlük' }, { value: 'deep_analysis', label: 'Derin Analiz', color: 'text-fuchsia-400 font-bold' }]} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center">
                <CustomSelect icon={Film} value={config.videoFormat || 'webm'} onChange={(val) => setConfig({ ...config, videoFormat: val })} options={[{ value: 'webm', label: 'WebM' }, { value: 'mp4', label: 'MP4' }]} />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-slate-800 flex items-center relative">
                <div className="flex items-center gap-2 w-full">
                  <CustomSelect icon={Volume2} value={prefs.narratorVoice} onChange={(val) => setPrefs({ ...prefs, narratorVoice: val })} options={voiceOptions} />
                  <button onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters); }} className="text-slate-400 hover:text-indigo-400 flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider transition-colors shrink-0"><Filter size={12} /> Filtreler</button>
                </div>
                {showFilters && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[200] p-3 space-y-3">
                    <div><div className="text-[9px] text-slate-500 mb-1.5 uppercase font-bold tracking-wider">Gender</div><div className="flex gap-1.5">{['Any', 'Male', 'Female'].map(g => (<button key={g} onClick={() => setVoiceFilters({ ...voiceFilters, gender: g })} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${voiceFilters.gender === g ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>{g}</button>))}</div></div>
                    <div><div className="text-[9px] text-slate-500 mb-1.5 uppercase font-bold tracking-wider">Age</div><div className="flex flex-wrap gap-1.5">{['Any', 'Child', 'Young', 'Middle-aged', 'Elderly'].map(a => (<button key={a} onClick={() => setVoiceFilters({ ...voiceFilters, age: a })} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${voiceFilters.age === a ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>{a}</button>))}</div></div>
                    <div><div className="text-[9px] text-slate-500 mb-1.5 uppercase font-bold tracking-wider">Category</div><div className="flex flex-wrap gap-1.5">{['Any', 'Games & RPG', 'Audiobooks & Novels', 'Anime & Animation', 'Documentary', 'Commercials & Trailers', 'Corporate & Narration'].map(c => (<button key={c} onClick={() => setVoiceFilters({ ...voiceFilters, category: c })} className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all border ${voiceFilters.category === c ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>{c}</button>))}</div></div>
                  </div>
                )}
              </div>
            </div>

            <p className="mb-3 px-1 text-xs leading-relaxed text-slate-400">
              Sosyal paylaşım: videoyu indirip hesabınıza yükleyebilirsiniz. Buffer ve LinkedIn otomasyonu ayrıca yerel köprü/eklenti gerektirir; GitHub Pages bu servisi çalıştırmaz.
            </p>

            {/* KAYNAK ADI + SABİT GÖRSEL + YORUM */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="bg-black/30 p-2 rounded-xl border border-slate-800 flex items-center justify-center">
                {studioMedia.customSceneImages && studioMedia.customSceneImages[0] ? (
                  <img src={studioMedia.customSceneImages[0]} className="w-full h-10 object-cover rounded-lg" alt="Sabit" />
                ) : (
                  <div className="text-[8px] text-slate-600 font-bold uppercase">Görsel Yok</div>
                )}
              </div>
              <div className="bg-black/30 p-1.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <CustomSelect icon={null} value={config.sourceName || ''} onChange={(val) => setConfig({ ...config, sourceName: val })} options={[
                    { value: '', label: 'Kaynak Yok', color: 'text-slate-500' },
                    { label: 'Sosyal Medya', options: [ { value: 'X', label: 'X (Twitter)' }, { value: 'TikTok', label: 'TikTok' }, { value: 'Instagram', label: 'Instagram' }, { value: 'Facebook', label: 'Facebook' } ]},
                    { label: 'Gazeteler', options: GAZETE_MASTER_LIST.map(g => ({ value: g, label: g })) }
                  ]} className="flex-1" />
                </div>
                <input type="text" value={config.sourceName || ''} onChange={(e) => setConfig({ ...config, sourceName: e.target.value })} placeholder="Manuel kaynak adı yaz..." className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 font-bold mt-1.5 px-1 py-1 border-t border-slate-700/50" />
              </div>
              <div className="bg-black/30 p-2 rounded-xl border border-slate-800">
                <textarea value={config.yorum || ''} onChange={(e) => setConfig({ ...config, yorum: e.target.value })} placeholder="Yorum (2-3 satır)" className="w-full bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600 font-bold resize-none h-8 leading-tight" rows={2} />
              </div>
            </div>

            {/* SABİT GÖRSELLER + MEDYA — yan yana */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-2.5 shadow-lg transition-colors"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-cyan-400', 'bg-cyan-500/20'); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-cyan-400', 'bg-cyan-500/20'); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('border-cyan-400', 'bg-cyan-500/20'); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-cyan-400', 'bg-cyan-500/20'); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image')); if (files.length > 0) handleCustomSceneImagesUpload(files); }}>
                <h2 className="text-[10px] font-black text-cyan-400 mb-1 flex items-center gap-1.5"><Layers size={12} /> SABİT GÖRSELLER (MAKS {RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES})</h2>
                <div className="flex flex-wrap gap-2">
                  {studioMedia.customSceneImages && studioMedia.customSceneImages.map((img, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700 shadow-md group">
                      <img src={img} className="w-full h-full object-cover" alt={`Sabit ${idx}`} />
                      <button onClick={() => handleCustomSceneImageDelete(idx)} className="absolute top-0.5 right-0.5 bg-rose-500/80 group-hover:opacity-100 hover:bg-rose-500 text-white p-0.5 rounded transition opacity-0 shadow-lg"><Trash2 size={10} /></button>
                      <div className="absolute bottom-0 left-0 bg-black/70 w-full text-center text-[7px] font-bold py-0.5 text-cyan-400 backdrop-blur-sm tracking-wider">S{idx + 1}</div>
                    </div>
                  ))}
                  {(!studioMedia.customSceneImages || studioMedia.customSceneImages.length < RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES) && (
                    <label className="w-14 h-14 rounded-lg border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-500/10 flex flex-col items-center justify-center cursor-pointer transition text-cyan-400"
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image')); if (files.length > 0) handleCustomSceneImagesUpload(files); }}>
                      <UploadCloud size={16} className="mb-0.5 opacity-80" /><span className="text-[7px] font-bold uppercase tracking-wider opacity-80">Ekle</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleCustomSceneImagesUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div className="bg-black/30 border border-slate-800 rounded-xl p-2.5 shadow-lg transition-colors"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-500/20'); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-500/20'); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-500/20'); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-500/20'); processSelectedFiles(Array.from(e.dataTransfer.files)); }}>
                <h2 className="text-[10px] font-black text-indigo-400 mb-1 flex items-center gap-1.5"><FileText size={12} /> MEDYA YÜKLE</h2>
                <div className="flex flex-wrap gap-2">
                  {uiState.selectedMediaFiles && uiState.selectedMediaFiles.slice(0, 5).map((file, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700 shadow-md group">
                      {file.type.startsWith('image') ? <img src={file.data} className="w-full h-full object-cover" alt={`Medya ${idx}`} /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-bold text-indigo-400 bg-slate-900">{file.name.split('.').pop().toUpperCase()}</div>}
                      <button onClick={() => setUiState(prev => ({ ...prev, selectedMediaFiles: prev.selectedMediaFiles.filter((_, i) => i !== idx) }))} className="absolute top-0.5 right-0.5 bg-rose-500/80 group-hover:opacity-100 hover:bg-rose-500 text-white p-0.5 rounded transition opacity-0 shadow-lg"><Trash2 size={10} /></button>
                      <div className="absolute bottom-0 left-0 bg-black/70 w-full text-center text-[7px] font-bold py-0.5 text-indigo-400 backdrop-blur-sm tracking-wider">M{idx + 1}</div>
                    </div>
                  ))}
                  <label className="w-14 h-14 rounded-lg border-2 border-dashed border-indigo-500/50 hover:border-indigo-400 hover:bg-indigo-500/10 flex flex-col items-center justify-center cursor-pointer transition text-indigo-400"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); processSelectedFiles(Array.from(e.dataTransfer.files)); }}>
                    <UploadCloud size={16} className="mb-0.5 opacity-80" /><span className="text-[7px] font-bold uppercase tracking-wider opacity-80">Ekle</span>
                    <input type="file" multiple accept="*/*" className="hidden" onChange={(e) => { processSelectedFiles(Array.from(e.target.files)); e.target.value = null; }} />
                  </label>
                  {uiState.selectedMediaFiles.length > 5 && <div className="w-14 h-14 rounded-lg bg-slate-800/50 flex items-center justify-center text-[9px] text-slate-400 font-bold border border-slate-700">+{uiState.selectedMediaFiles.length - 5}</div>}
                </div>
              </div>
            </div>

            {/* === GAZETE TAKİP GALERİSİ === */}
            {activeTab === 'gazete' && (
              <div ref={gazeteGridRef} className="mb-3">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Newspaper size={18} className="text-emerald-400" />
                    <span className="text-xs md:text-sm font-black text-white tracking-wide">Ulusal Gazete Manşetleri (30 Gazete)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1">
                      <Clock size={12} className="text-slate-400" />
                      <input type="date" value={gazeteDate} max={_getTurkeyDateISO()} onChange={(e) => { setGazeteDate(e.target.value); }} className="bg-transparent text-slate-200 text-[10px] font-bold border-none outline-none cursor-pointer" />
                    </div>
                    <button onClick={() => fetchGazeteManşetleri()} disabled={gazeteLoading} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-emerald-500 transition-all shadow-md">
                      {gazeteLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Manşetleri Yenile
                    </button>
                    <button
                      onClick={() => setGazeteAuto0700Enabled(v => !v)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                        gazeteAuto0700Enabled
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}
                      title="Sekme açıkken Türkiye saati 07:00'de gazeteleri sırayla otomatik videoya çevirir"
                    >
                      ☀ 07:00 {gazeteAuto0700Enabled ? 'AÇIK' : 'KAPALI'}
                    </button>
                    <button
                      onClick={() => setBufferAuto5MinEnabled(v => !v)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                        bufferAuto5MinEnabled
                          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}
                      title="07:00 gazete videolarını önce 5dk arayla planlar; uçtan uca süre 5dk'yı aşarsa otomatik 10dk'ya çıkar"
                    >
                      BUFFER +10DK {bufferAuto5MinEnabled ? 'AÇIK' : 'KAPALI'}
                    </button>
                    <button
                      onClick={() => startGazeteMorningBatch('manual', true)}
                      disabled={gazeteAuto0700Ui.active || uiState.isProcessing}
                      className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-900 disabled:text-slate-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold border border-amber-500/60 transition-all"
                      title="07:00 otomasyonunu şimdi test et"
                    >
                      {gazeteAuto0700Ui.active ? 'OTONOM ÇALIŞIYOR' : 'OTONOM ŞİMDİ'}
                    </button>
                  </div>
                </div>
                <div className={`mb-3 px-3 py-2 rounded-xl border text-[10px] font-bold ${
                  gazeteAuto0700Ui.active
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}>
                  ☀ Sabah 07:00 Otonomu: {gazeteAuto0700Enabled ? 'AÇIK' : 'KAPALI'}
                  {' • '}Buffer +10dk: {bufferAuto5MinEnabled ? 'AÇIK' : 'KAPALI'}
                  {' • '}{gazeteAuto0700Ui.message}
                  {gazeteAuto0700Ui.current ? ` • Şimdi: ${gazeteAuto0700Ui.current}` : ''}
                  {(gazeteAuto0700Ui.completed || gazeteAuto0700Ui.failed)
                    ? ` • Başarılı ${gazeteAuto0700Ui.completed} / Hata ${gazeteAuto0700Ui.failed}`
                    : ''}
                  <span className="text-slate-500"> • Program sekmesi açık olmalı.</span>
                </div>
                {gazeteError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-400 text-xs font-bold mb-3 flex items-center gap-2">
                    <AlertCircle size={14} /> {gazeteError}
                  </div>
                )}
                {gazeteLoading && (
                  <div className="text-center py-12">
                    <Loader2 size={32} className="text-emerald-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-bold">Gazete manşetleri yükleniyor...</p>
                  </div>
                )}
                {!gazeteLoading && gazeteItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">{gazeteItems.length} gazete listelendi</span>
                      <div className="flex gap-1">
                        <button onClick={() => setGazeteGalleryView('grid')} className={`p-1.5 rounded-lg text-[10px] ${gazeteGalleryView === 'grid' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>▦</button>
                        <button onClick={() => setGazeteGalleryView('single')} className={`p-1.5 rounded-lg text-[10px] ${gazeteGalleryView === 'single' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>☐</button>
                      </div>
                    </div>
                    {gazeteGalleryView === 'grid' ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[50vh] overflow-y-auto p-1">
                        {gazeteItems.map((item, idx) => (
                          <div key={`${item.name}-${item.revision || 0}`} className="group relative bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50 hover:border-emerald-500/50 transition-all cursor-pointer"
                            onClick={(e) => {
                              const img = e.currentTarget.querySelector('img');
                              const actualSrc = img?.currentSrc || img?.src || '';
                              startGazeteVideoFromCard(item, idx, actualSrc);
                            }}>
                            <img src={item.resolvedThumb || item.thumbSrc} className="w-full aspect-[800/1340] object-contain block bg-slate-950" alt={item.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable="false" onLoad={(e) => handleGazeteImageLoad(e, item, 'thumb')} onError={(e) => handleGazeteImageError(e, item, 'thumb')} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-1.5">
                              <span className="text-white text-[8px] font-bold text-center leading-tight">{item.name}<br/><span className="text-emerald-300">▶ VİDEO ÜRET</span></span>
                            </div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                              <button onClick={(e) => { e.stopPropagation(); openCropModal(item.resolvedFull || item.resolvedThumb || item.fullSrc || item.thumbSrc, item.name); }} className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded-md shadow-lg" title="Crop yap"><Scissors size={10} /></button>
                              <button onClick={(e) => { e.stopPropagation(); addFullImageToMedia(item.resolvedFull || item.resolvedThumb || item.fullSrc || item.thumbSrc, item.name); }} className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded-md shadow-lg" title="Tam sayfa ekle"><Check size={10} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="flex items-center justify-between gap-2 mb-3 bg-slate-900/90 border border-slate-700/80 p-2.5 rounded-2xl flex-wrap shadow-lg">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setGazeteCurrentIdx(Math.max(0, gazeteCurrentIdx - 1))} disabled={gazeteCurrentIdx === 0} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all">← Önceki</button>
                            <span className="text-white text-sm font-bold bg-slate-950/60 px-3 py-1 rounded-xl border border-slate-800">{gazeteItems[gazeteCurrentIdx]?.name} <span className="text-slate-400 font-normal">({gazeteCurrentIdx + 1}/{gazeteItems.length})</span></span>
                            <button onClick={() => setGazeteCurrentIdx(Math.min(gazeteItems.length - 1, gazeteCurrentIdx + 1))} disabled={gazeteCurrentIdx >= gazeteItems.length - 1} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all">Sonraki →</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openCropModal(gazeteItems[gazeteCurrentIdx]?.resolvedFull || gazeteItems[gazeteCurrentIdx]?.resolvedThumb || gazeteItems[gazeteCurrentIdx]?.fullSrc || gazeteItems[gazeteCurrentIdx]?.thumbSrc, gazeteItems[gazeteCurrentIdx]?.name)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"><Scissors size={14} /> Crop Yap</button>
                            <button onClick={() => addFullImageToMedia(gazeteItems[gazeteCurrentIdx]?.resolvedFull || gazeteItems[gazeteCurrentIdx]?.resolvedThumb || gazeteItems[gazeteCurrentIdx]?.fullSrc || gazeteItems[gazeteCurrentIdx]?.thumbSrc, gazeteItems[gazeteCurrentIdx]?.name)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"><Check size={14} /> Tam Sayfa Ekle</button>
                          </div>
                        </div>
                        <div className="relative bg-black/50 rounded-xl overflow-hidden border border-slate-700/50">
                          <img key={`${gazeteItems[gazeteCurrentIdx]?.name}-${gazeteItems[gazeteCurrentIdx]?.revision || 0}`} src={gazeteItems[gazeteCurrentIdx]?.resolvedFull || gazeteItems[gazeteCurrentIdx]?.fullSrc} className="w-full h-auto block bg-slate-950 cursor-pointer" title="Bu gazeteden doğrudan video üret" alt={gazeteItems[gazeteCurrentIdx]?.name} decoding="async" referrerPolicy="no-referrer" draggable="false" onClick={(e) => startGazeteVideoFromCard(gazeteItems[gazeteCurrentIdx], gazeteCurrentIdx, e.currentTarget.currentSrc || e.currentTarget.src || '')} onLoad={(e) => handleGazeteImageLoad(e, gazeteItems[gazeteCurrentIdx], 'full')} onError={(e) => handleGazeteImageError(e, gazeteItems[gazeteCurrentIdx], 'full')} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!gazeteLoading && gazeteItems.length === 0 && !gazeteError && (
                  <div className="text-center py-12">
                    <Newspaper size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-bold">Gazete manşetleri yüklenmedi</p>
                    <p className="text-slate-600 text-xs mt-1">Yukarıdaki "Yenile" butonuna tıklayın</p>
                  </div>
                )}
              </div>
            )}

            {/* CROP MODAL */}
            {gazeteCropModal && (
              <GazeteCropModal src={gazeteCropModal.src} name={gazeteCropModal.name} onClose={() => setGazeteCropModal(null)} onCrop={applyCrop} />
            )}

            {/* METİN GİRİŞİ */}
            {activeTab !== 'media' && activeTab !== 'gazete' && (
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={(config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? (activeTab === 'url' ? "Söz linkini yapıştırın..." : "Güzel sözü veya alıntıyı yazın...") : (activeTab === 'url' ? "Haber linkini yapıştırın..." : "Haberi yazın veya araştırılacak gündemi verin...")} className={`w-full h-20 bg-black/30 border rounded-xl p-3 text-sm outline-none mb-3 text-slate-200 resize-none transition-all relative z-0 ${activeTab === 'prompt' ? 'border-fuchsia-500/50 focus:border-fuchsia-500' : 'border-slate-800 focus:border-indigo-500'}`} />
            )}

            <div className="flex justify-between items-center mb-3 px-2">
              {config.tip === 'iddia_analizi' ? (
                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/20">İddia Analizi — Fact Check + Video Üretimi</span>
              ) : config.tip === 'guzel_soz' ? (
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">Güzel Söz — Metin veya Resim + Arka Plan Müziği</span>
              ) : (<><span className="text-xs text-slate-500 flex items-center gap-1"><Type size={12} /> Dil: {getWPS(config.language)} kelime/sn</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">Hedef: ~{maxWordsUI} kelime</span></>)}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 relative z-0">
              <button onClick={() => handleExecuteStart(uiState.selectedMediaFiles, 'image')} disabled={uiState.isProcessing || ((config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? (!textInput.trim() && uiState.selectedMediaFiles.length === 0) : ((activeTab === 'media' || activeTab === 'gazete') ? uiState.selectedMediaFiles.length === 0 : !textInput.trim()))} className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-200 py-2.5 md:py-3 rounded-full font-medium text-xs transition-all border border-slate-700 flex items-center justify-center gap-2">
                {uiState.isProcessing && config.outputType === 'image' ? <><Loader2 size={16} className="animate-spin" /> İŞLENİYOR...</> : <><ImagePlus size={16} /> {config.tip === 'iddia_analizi' ? 'İddia Analizi Yap' : (config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? 'Kart Oluştur' : 'Görsel oluştur'}</>}
              </button>
              <button onClick={() => handleExecuteStart(uiState.selectedMediaFiles, 'video')} disabled={uiState.isProcessing || ((config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? (!textInput.trim() && uiState.selectedMediaFiles.length === 0) : ((activeTab === 'media' || activeTab === 'gazete') ? uiState.selectedMediaFiles.length === 0 : !textInput.trim()))} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-indigo-400 text-white py-2.5 md:py-3 rounded-full font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                {uiState.isProcessing && config.outputType === 'video' ? <><Loader2 size={16} className="animate-spin" /> İŞLENİYOR...</> : <>{config.tip === 'iddia_analizi' ? <><Eye size={16} /> İddia Analizi</> : (config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? <><Wand2 size={16} /> Güzel Söz Oluştur</> : <><Clapperboard size={16} /> Video oluştur</>}</>}
              </button>
            </div>
          </div>

          {/* HATA */}
          {uiState.error && (
            <div className="mt-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex gap-3 text-rose-400 text-sm font-medium items-start">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div><strong className="block mb-1">Hata</strong>{String(uiState.error)}</div>
            </div>
          )}

          {/* ÇIKTI */}
          {uiState.videoUrl && (
            <div className="mt-8 bg-slate-900 border border-emerald-900/50 p-6 rounded-3xl shadow-2xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                <ShieldCheck size={14} /> {(config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? 'GÜZEL SÖZ OLUŞTURULDU' : (config.outputType === 'image' ? 'GÖRSEL OLUŞTURULDU' : 'VIDEO OLUŞTURULDU')}
              </div>
              {config.outputType === 'image' ? <img src={uiState.videoUrl} className="w-full max-w-md mx-auto rounded-2xl shadow-lg ring-1 ring-white/10 object-cover" alt="Output" /> : <video src={uiState.videoUrl} poster={videoPreviewPoster || undefined} controls autoPlay preload="auto" playsInline className="w-full max-w-md mx-auto rounded-2xl shadow-lg ring-1 ring-white/10" />}
              <div className="mt-4 flex justify-center gap-3 flex-wrap">
                <button onClick={handleDownloadVideo} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95"><Download size={14} /> İNDİR</button>
                <button onClick={shareToSelectedPlatforms} disabled={bufferShareReport.status === 'sharing'} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/60 disabled:text-indigo-300 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">{bufferShareReport.status === 'sharing' ? <><Loader2 size={14} className="animate-spin" /> PAYLAŞILIYOR</> : <><Share2 size={14} /> PAYLAŞ</>}</button>
                <button onClick={async () => { setUiState(prev => ({ ...prev, videoUrl: null, selectedMediaFiles: [], percent: 0, statusText: '', error: '' })); setConfig(prev => ({ ...prev, yorum: '', sourceName: '' })); for (let i = 0; i < RENDER_CONFIG.MAX_CUSTOM_SCENE_IMAGES; i++) await AssetManagerService.deleteMedia("CUSTOM_SCENE_IMG_" + i); setStudioMedia(s => ({ ...s, customSceneImages: [] })); }} className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95"><RotateCcw size={14} /> {(config.tip === 'guzel_soz' || config.tip === 'iddia_analizi') ? 'YENİ SÖZ' : 'YENİ HABER'}</button>
              </div>
              {bufferShareReport.status !== 'idle' && (
                <div className="mt-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    {bufferShareReport.status === 'sharing' ? <Loader2 size={15} className="animate-spin text-indigo-400" /> : bufferShareReport.status === 'success' ? <Check size={15} className="text-emerald-400" /> : <AlertCircle size={15} className={bufferShareReport.status === 'error' ? 'text-rose-400' : 'text-amber-400'} />}
                    <span className="text-xs font-bold text-slate-200">Buffer: {bufferShareReport.message}</span>
                  </div>
                  {bufferShareReport.results?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {bufferShareReport.results.map((r, idx) => {
                        const sent = r.state === 'sent';
                        const failed = r.state === 'error';
                        const waiting = ['waiting','creating','verifying','pending','created'].includes(r.state);
                        return (
                          <div key={r.channelId || idx} className={`rounded-xl border p-3 ${sent ? 'bg-emerald-500/10 border-emerald-500/30' : failed ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {sent ? <Check size={13} className="text-emerald-400" /> : failed ? <AlertCircle size={13} className="text-rose-400" /> : <Loader2 size={13} className={waiting && r.state !== 'pending' ? 'animate-spin text-amber-400' : 'text-amber-400'} />}
                              <span className="text-[11px] font-black text-slate-100 truncate">{r.name}</span>
                            </div>
                            <div className={`text-[10px] font-bold ${sent ? 'text-emerald-400' : failed ? 'text-rose-400' : 'text-amber-400'}`}>{sent ? 'GÖNDERİLDİ' : failed ? 'HATA' : r.state === 'pending' ? 'BEKLEMEDE' : 'İŞLENİYOR'}</div>
                            <div className="text-[9px] text-slate-400 mt-1 break-words">{r.detail}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {sysLogs && sysLogs.length > 0 && (
                <div className="mt-6 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-left font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto space-y-1.5 relative">
                  <div className="flex items-center justify-between mb-2 sticky top-0 bg-slate-950/95 py-1 z-10">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Paylasim Loglari ({sysLogs.length})</span>
                    <button onClick={() => { const txt = sysLogs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.text}`).join('\n'); navigator.clipboard?.writeText(txt).then(() => addSystemLog('Log panoya kopyalandi', 'success')).catch(() => { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); addSystemLog('Log panoya kopyalandi (fallback)', 'success'); }); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-700 transition-all active:scale-95">KOPYALA</button>
                  </div>
                  {sysLogs.map((log, idx) => { let c = "text-slate-400"; if (log.type === "success") c = "text-emerald-400 font-bold"; if (log.type === "warn") c = "text-amber-400 font-bold"; if (log.type === "error") c = "text-rose-400 font-bold animate-pulse"; return (<div key={idx} className={`flex items-start gap-2 ${c}`}><span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span><span className="break-all">{log.text}</span></div>); })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* İŞLEM EKRANI */}
        {uiState.isProcessing && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/30 w-full max-w-lg p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 h-1 bg-indigo-600 transition-all duration-300 animate-pulse" style={{ width: `${uiState.percent}%` }}></div>
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4"><Loader2 size={28} className="text-indigo-400 animate-spin" /></div>
              <h2 className="text-5xl font-black text-white mb-2">{Math.round(uiState.percent)}%</h2>
              <p className="text-indigo-400 font-bold text-sm mb-3 uppercase tracking-widest">{uiState.statusText}</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-mono mb-4 border border-slate-700/50"><Clock size={12} /> Geçen: {elapsedSeconds}sn</div>
              {sysLogs && sysLogs.length > 0 && (
                <div className="mt-4 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-left font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto space-y-1.5 relative">
                  <button onClick={() => { const txt = sysLogs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.text}`).join('\n'); navigator.clipboard?.writeText(txt).then(() => addSystemLog('Log panoya kopyalandi', 'success')).catch(() => { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); addSystemLog('Log panoya kopyalandi (fallback)', 'success'); }); }} className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg text-[10px] font-bold border border-slate-700 transition-all active:scale-95 z-10">KOPYALA</button>
                  {sysLogs.map((log, idx) => { let c = "text-slate-400"; if (log.type === "success") c = "text-emerald-400 font-bold"; if (log.type === "warn") c = "text-amber-400 font-bold"; if (log.type === "error") c = "text-rose-400 font-bold animate-pulse"; return (<div key={idx} className={`flex items-start gap-2 ${c}`}><span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span><span className="break-all">{log.text}</span></div>); })}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* FIREBASE KALDIRILDI: OTURUM HATASI (authExpired) modalı tamamen silindi. */}

        <canvas ref={canvasRef} style={{ position: 'fixed', top: '-10000px', left: '-10000px', zIndex: -50 }} />
      </div>
    </ErrorBoundary>
  );
}
// OTONOM black_3.14 — Gemini Canvas uyumlu local-first versiyon (Firebase KALDIRILDI)
// Tüm fonksiyonlar tek dosyada. Kalıcılık: SafeStorage (localStorage) + IndexedDB.
// Named exports support browser media regression tests; no test UI is shipped.
export { NetworkUtils, MediaSynthesisService, WorkflowCoordinator, convertWebMtoMP4, _verifyInstagramCfrMp4 };
