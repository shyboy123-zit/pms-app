// Vercel Serverless Function - 기업마당 API 프록시
// CORS 문제를 서버사이드에서 해결
// 환경변수 BIZINFO_API_KEY에 인증키 설정 필요

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { hashtags, searchCnt = '50', pageUnit = '50', pageIndex = '1' } = req.query;

    // 인증키 확인
    const apiKey = process.env.BIZINFO_API_KEY;
    if (!apiKey) {
        return res.status(200).json({
            error: 'API_KEY_MISSING',
            message: '기업마당 API 인증키가 설정되지 않았습니다. Vercel 환경변수에 BIZINFO_API_KEY를 추가해주세요.'
        });
    }

    try {
        const params = new URLSearchParams({
            dataType: 'json',
            crtfcKey: apiKey,
            searchCnt,
            pageUnit,
            pageIndex
        });

        if (hashtags) {
            params.append('hashtags', hashtags);
        }

        const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params.toString()}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ko-KR,ko;q=0.9'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`기업마당 API 응답 오류: ${response.status}`);
        }

        const text = await response.text();

        try {
            const data = JSON.parse(text);
            return res.status(200).json(data);
        } catch {
            return res.status(200).json({ error: 'PARSE_ERROR', rawText: text.substring(0, 500) });
        }
    } catch (error) {
        console.error('기업마당 API 프록시 오류:', error);
        return res.status(500).json({
            error: error.name === 'AbortError' ? 'TIMEOUT' : 'SERVER_ERROR',
            message: error.message || '서버 오류',
            timestamp: new Date().toISOString()
        });
    }
}
