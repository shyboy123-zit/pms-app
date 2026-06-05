// Web Push 구독 헬퍼
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function notifPermission() {
  return pushSupported() ? Notification.permission : 'unsupported';
}

// 알림 권한 요청 + 구독 + Supabase 저장
export async function enablePush(userId) {
  if (!pushSupported()) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'no-vapid-key' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const reg = await navigator.serviceWorker.ready;

  // 기존 구독 재사용 또는 신규 생성
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const row = {
    user_id: userId || null,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
  };

  // endpoint 유니크 → upsert
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push] save failed:', error.message);
    return { ok: false, reason: 'save-failed', error };
  }
  return { ok: true };
}

// 새 메시지 발생 시 서버리스 호출 → 전 직원 폰 푸시
export async function triggerPush({ senderId, senderName, content }) {
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId, senderName, content }),
    });
  } catch (e) {
    console.warn('[push] trigger failed:', e?.message);
  }
}
