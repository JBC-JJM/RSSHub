import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

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
    const pages = await Promise.all(
        [1, 2, 3].map((page) =>
            ofetch(`${baseUrl}/fapi/frontend/home/article`, {
                query: {
                    page,
                    limit: pageSize,
                    type: '1',
                    day: 7,
                    category: '精选',
                },
                headers: {
                    referer: `${baseUrl}/`,
                    'x-client-type': 'web',
                },
            })
        )
    );

    const articles = pages.flatMap((response) => response.data?.data_list ?? response.data?.list ?? []).slice(0, 50);
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
