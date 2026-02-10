// Vercel Serverless Function - 뉴스 RSS 프록시
// 공개 RSS 피드 사용 (API 키 불필요)

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // 5분 캐시

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { category = 'economy' } = req.query;

    // 연합뉴스 RSS 피드 (무료, 인증키 불필요)
    const feeds = {
        economy: 'https://www.yna.co.kr/rss/economy.xml',       // 경제
        industry: 'https://www.yna.co.kr/rss/industry.xml',      // 산업
        all: 'https://www.yna.co.kr/rss/news.xml',               // 전체뉴스
        politics: 'https://www.yna.co.kr/rss/politics.xml',      // 정치
    };

    const feedUrl = feeds[category] || feeds.economy;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(feedUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/xml, text/xml, */*'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`RSS 응답 오류: ${response.status}`);
        }

        const xml = await response.text();

        // 간단한 XML 파싱 (item 추출)
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
            const itemXml = match[1];

            const getTag = (tag) => {
                const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
                return m ? (m[1] || m[2] || '').trim() : '';
            };

            const title = getTag('title');
            const link = getTag('link');
            const pubDate = getTag('pubDate');
            const description = getTag('description')
                .replace(/<[^>]*>/g, '')
                .substring(0, 150);

            if (title) {
                items.push({ title, link, pubDate, description });
            }
        }

        return res.status(200).json({
            success: true,
            category,
            count: items.length,
            items
        });

    } catch (error) {
        console.error('뉴스 RSS 프록시 오류:', error);
        return res.status(500).json({
            success: false,
            error: error.name === 'AbortError' ? 'TIMEOUT' : 'SERVER_ERROR',
            message: error.message
        });
    }
}
