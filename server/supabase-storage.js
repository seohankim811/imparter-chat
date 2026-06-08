// Supabase KV 저장소 헬퍼
// rooms, profiles, passwords 등을 키-값 쌍으로 단순 저장 (JSONB 컬럼)
// 환경변수가 설정 안 되어 있으면 자동으로 비활성화 (로컬은 JSON 파일 사용)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

let supabase = null;
let enabled = false;

if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false }
    });
    enabled = true;
    console.log('☁️ Supabase 저장소 활성화 (URL: ' + SUPABASE_URL.slice(0, 30) + '...)');
  } catch (e) {
    console.error('Supabase 초기화 실패:', e.message);
  }
} else {
  console.log('💾 Supabase 비활성화 — 로컬 JSON 파일만 사용');
}

export function isSupabaseEnabled() {
  return enabled;
}

// KV 저장 — 키별로 JSONB 값 저장 (upsert)
export async function kvSet(key, value) {
  if (!enabled) return false;
  try {
    const { error } = await supabase
      .from('kv_store')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      console.error(`Supabase kvSet(${key}) 오류:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Supabase kvSet(${key}) 예외:`, e.message);
    return false;
  }
}

// KV 읽기 — null이면 키 없음
export async function kvGet(key) {
  if (!enabled) return null;
  try {
    const { data, error } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) {
      console.error(`Supabase kvGet(${key}) 오류:`, error.message);
      return null;
    }
    return data?.value ?? null;
  } catch (e) {
    console.error(`Supabase kvGet(${key}) 예외:`, e.message);
    return null;
  }
}
