import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const feedUrl = 'https://wechat2rss.xlab.app/feed/1a5aec98e71c707c8ca092bc2c255b9d4bac477d.xml';
const siteUrl = 'https://wechat2rss.xlab.app/';

export const route: Route = {
    path: '/geekpark',
    categories: ['blog'],
    example: '/wechat2rss/geekpark',
    name: '极客公园（封面增强）',
    maintainers: ['JBC-JJM'],
    handler,
    description: '封装 WeChat2RSS feed，并为文章图片添加 enclosure 和 Media RSS 封面字段。',
};

async function handler() {
    const xml = await ofetch(feedUrl, { responseType: 'text' });
    const $ = load(xml, { xmlMode: true });
    const channel = $('rss > channel');

    const items: DataItem[] = channel
        .children('item')
        .toArray()
        .map((element) => {
            const item = $(element);
            const encodedContent = item
                .children()
                .filter((_, child) => child.name?.endsWith(':encoded'))
                .text();
            const content = encodedContent || item.children('description').text();
            const $content = load(content);
            const imageElement = $content('img').first();
            const imageSrc = imageElement.attr('src') || imageElement.attr('data-src') || imageElement.attr('data-original');
            const image = imageSrc ? new URL(imageSrc, siteUrl).href : undefined;
            const link = item.children('link').text().trim();
            const pubDate = item.children('pubDate').text();
            const imageType = image ? getImageMimeType(image) : undefined;

            return {
                title: item.children('title').text(),
                link,
                guid: link || undefined,
                description: content,
                pubDate: pubDate ? parseDate(pubDate) : undefined,
                image,
                enclosure_type: imageType,
                enclosure_url: image,
                media: image
                    ? {
                          content: { url: image, type: imageType ?? 'image/jpeg', medium: 'image' },
                          thumbnail: { url: image },
                      }
                    : undefined,
            };
        });

    return {
        title: channel.children('title').text() || 'WeChat2RSS Feed',
        link: channel.children('link').text() || siteUrl,
        description: channel.children('description').text(),
        item: items,
    };
}

function getImageMimeType(image: string) {
    const imageUrl = new URL(image);
    const originalUrl = imageUrl.searchParams.get('u');
    const sourceUrl = originalUrl ? new URL(originalUrl) : imageUrl;
    const format = sourceUrl.searchParams.get('wx_fmt') || sourceUrl.pathname.split('.').pop()?.toLowerCase();

    if (format === 'jpg' || format === 'jpeg') {
        return 'image/jpeg';
    }
    if (format && ['png', 'webp', 'gif', 'avif'].includes(format)) {
        return `image/${format}`;
    }
    return 'image/jpeg';
}
