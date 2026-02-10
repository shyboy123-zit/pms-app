// Vercel Serverless Function - 기업마당 API 프록시
// CORS 문제를 서버사이드에서 해결

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { hashtags, searchCnt = '50', pageUnit = '50', pageIndex = '1' } = req.query;

    try {
        const params = new URLSearchParams({
            dataType: 'json',
            searchCnt,
            pageUnit,
            pageIndex
        });

        if (hashtags) {
            params.append('hashtags', hashtags);
        }

        const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ko-KR,ko;q=0.9'
            }
        });

        if (!response.ok) {
            throw new Error(`기업마당 API 응답 오류: ${response.status}`);
        }

        const text = await response.text();

        // JSON 파싱 시도
        try {
            const data = JSON.parse(text);
            return res.status(200).json(data);
        } catch {
            // XML/HTML 응답인 경우 텍스트 그대로 반환
            return res.status(200).json({ error: 'JSON 파싱 실패', rawText: text.substring(0, 500) });
        }
    } catch (error) {
        console.error('기업마당 API 프록시 오류:', error);
        return res.status(500).json({
            error: error.message || '서버 오류',
            timestamp: new Date().toISOString()
        });
    }
}
