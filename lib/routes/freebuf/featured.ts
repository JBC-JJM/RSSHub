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
    const pageSize = 20;
    const articles = [];

    // Avoid triggering FreeBuf's WAF with concurrent requests from the RSSHub server.
    for (const page of [1, 2, 3]) {
        const response = await fetchWithAcwChallenge(`${baseUrl}/fapi/frontend/home/article`, {
            query: {
                page,
                limit: page === 3 ? 10 : pageSize,
                type: '1',
                day: 7,
                category: '精选',
            },
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                referer: `${baseUrl}/`,
                'x-client-type': 'web',
            },
        });

        articles.push(...(response.data?.list ?? response.data?.data_list ?? []));
    }

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
