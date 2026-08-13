import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Env Vars missing!');
}

// ============================================================
// 1000행 잘림 감지 가드
// ------------------------------------------------------------
// Supabase(PostgREST)는 요청 1건당 최대 1000행만 반환한다. 페이지네이션
// 없이 .select('*') 하면 에러 없이 조용히 잘려서, 오래된 데이터가 통째로
// 빠진 채 재고·매출이 계산된다. (2026-08-13 재고현황 오류의 원인)
//
// PostgREST는 응답에 항상 Content-Range(예: 0-999/*)를 실어준다.
// → 행 수를 지정하지 않고 보낸 요청이 정확히 상한선만큼 돌려받았다면
//   잘렸다는 뜻이므로 콘솔에 경고를 띄운다.
//
// 검사 제외 대상 = 행 수를 스스로 지정한 요청(의도된 것):
//   - postgrest-js 의 .range(a, b) → URL 에 offset/limit 쿼리파라미터를 붙인다
//     (Range 헤더가 아님에 주의). fetchAllRows 가 이 경로라 제외된다.
//   - .limit(n) → 역시 URL 의 limit 파라미터
//   - Range 헤더는 다른 버전/직접 호출 대비 함께 확인
// ============================================================
const MAX_ROWS = 1000;

const truncationGuardFetch = async (input, init = {}) => {
    const res = await fetch(input, init);
    try {
        const reqHeaders = new Headers(init.headers || {});
        const url = typeof input === 'string' ? input : input?.url || '';
        if (!reqHeaders.has('Range') && !/[?&](limit|offset)=/.test(url)) {
            const cr = res.headers.get('content-range');
            const m = cr && /^(\d+)-(\d+)\//.exec(cr);
            if (m && Number(m[2]) - Number(m[1]) + 1 >= MAX_ROWS) {
                console.error(
                    `[Supabase 잘림 경고] 페이지네이션 없는 조회가 ${MAX_ROWS}행에서 잘렸습니다.\n` +
                    `이 데이터로 재고·합계를 계산하면 틀린 값이 나옵니다. DataContext 의 fetchAllRows() 를 쓰세요.\n` +
                    `요청: ${decodeURIComponent(url)}`
                );
            }
        }
    } catch {
        // 감지 로직 실패가 실제 요청을 막으면 안 됨
    }
    return res;
};

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        auth: {
            persistSession: true,
            storageKey: 'pms-app-auth',
            storage: window.localStorage,
            autoRefreshToken: true,
            detectSessionInUrl: true
        },
        global: { fetch: truncationGuardFetch }
    }
)
