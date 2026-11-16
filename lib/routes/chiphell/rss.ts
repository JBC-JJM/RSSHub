import { load } from 'cheerio';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import parser from '@/utils/rss-parser';

const feedUrl = 'https://www.chiphell.com/forum.php?mod=rss&auth=0';
const siteUrl = 'https://www.chiphell.com';

export const route: Route = {
    path: '/rss',
    categories: ['bbs'],
    example: '/chiphell/rss',
    name: '论坛 RSS（封面增强）',
    maintainers: ['tylinux'],
    handler,
};

async function handler() {
    const feed = await parser.parseURL(feedUrl);
    const items = await Promise.all(
        feed.items.map(async (item): Promise<DataItem> => {
            const link = item.link;
            let image = item.enclosure_url;

            if (!image && link) {
                image = await cache.tryGet(`chiphell:rss:image:${link}`, async () => {
                    const html = await ofetch(link);
                    const $ = load(html);
                    const src = $('.pcb .t_f img, .pcb img')
                        .toArray()
                        .map((element) => $(element).attr('zoomfile') ?? $(element).attr('file') ?? $(element).attr('src'))
                        .find((src) => src && !/emoji|smilies|avatar|static\/image\/common/i.test(src));

                    return src ? new URL(src, siteUrl).href : undefined;
                });
            }

            const description = item.description ?? '';
            const enclosure = image
                ? {
                      image,
                      enclosure_url: image,
                      enclosure_type: `image/${image.split('.').pop()?.split(/[?#]/)[0] === 'jpg' ? 'jpeg' : image.split('.').pop()?.split(/[?#]/)[0] ?? 'jpeg'}`,
                  }
                : {};

            return {
                title: item.title ?? '',
                link,
                description: image && !/<img\b/i.test(description) ? `${description}<p><img src="${image}"></p>` : description,
                pubDate: item.pubDate,
                author: item.author,
                category: item.categories,
                ...enclosure,
            };
        })
    );

    return {
        title: feed.title ?? 'Chiphell 最新主题',
        link: siteUrl,
        description: feed.description,
        item: items,
    };
}
