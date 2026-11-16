import type { DataItem, Route } from '@/types';
import { parseDate } from '@/utils/parse-date';

import { fetchWithAcwChallenge } from './utils';

const baseUrl = 'https://www.freebuf.com';

export const route: Route = {
    path: '/featured',
    categories: ['blog'],
    example: '/freebuf/featured',
    name: '精选内容',
    maintainers: ['trganda'],
    handler,
};

async function handler() {
    const response = await fetchWithAcwChallenge(`${baseUrl}/fapi/frontend/home/article`, {
        query: {
            page: 1,
            limit: 20,
            type: '1',
            day: 7,
            category: '精选',
        },
        headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            origin: baseUrl,
            referer: `${baseUrl}/`,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'x-client-type': 'web',
            'x-requested-with': 'XMLHttpRequest',
        },
    });

    const articles = (response.data?.list ?? response.data?.data_list ?? []).filter((article) => !isAdvertisement(article));

    const items: DataItem[] = articles.map((article) => {
        const image = article.post_image ?? article.post_img ?? article.post_thumb ?? article.post_cover ?? article.cover ?? article.image;
        const link = article.url?.startsWith('http') ? article.url : new URL(article.url ?? '', baseUrl).href;

        return {
            title: article.post_title ?? article.title ?? '',
            link,
            description: article.content ?? article.post_description ?? article.description,
            pubDate: article.post_date ? parseDate(article.post_date) : undefined,
            author: article.nickname ?? article.author,
            image: image ? new URL(image, baseUrl).href : undefined,
        };
    });

    return {
        title: 'FreeBuf - 精选内容',
        link: baseUrl,
        item: items,
    };
}

function isAdvertisement(article) {
    const flagged = [article.is_ad, article.isAd, article.advertisement, article.is_job];
    const type = String(article.source_type ?? article.type ?? '').toLowerCase();

    return flagged.some((value) => value === true || value === 1 || value === '1') || ['ad', 'advertisement', 'job'].includes(type);
}
