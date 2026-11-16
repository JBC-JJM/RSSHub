import { load } from 'cheerio';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

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
    const xml = await ofetch(feedUrl, { responseType: 'text' });
    const $ = load(xml, { xmlMode: true });
    const channel = $('rss > channel');
    const items = await Promise.all(
        channel
            .children('item')
            .toArray()
            .map(async (element): Promise<DataItem> => {
                const item = $(element);
                const link = item.children('link').text().trim();
                let image = item.children('enclosure').attr('url');

                if (!image && link) {
                    image = await cache.tryGet(`chiphell:rss:image:${link}`, async () => {
                        const html = await ofetch(link);
                        const $page = load(html);
                        const src = $page('.pcb .t_f img, .pcb img')
                            .toArray()
                            .map((element) => $page(element).attr('zoomfile') ?? $page(element).attr('file') ?? $page(element).attr('src'))
                            .find((src) => src && !/emoji|smilies|smiley|avatar|static\/image\/(?:common|smiley)/i.test(src));

                        return src ? new URL(src, siteUrl).href : undefined;
                    });
                }

                const description = item.children('description').text();
                const title = item.children('title').text();
                const author = item.children('author').text() || item.children().filter((_, element) => element.name.endsWith(':creator')).text();
                const enclosureType = image ? getImageMimeType(image) : item.children('enclosure').attr('type');
                const pubDate = item.children('pubDate').text();

                return {
                    title,
                    link,
                    description: image && !/<img\b/i.test(description) ? `${description}<p><img src="${image}"></p>` : description,
                    pubDate: pubDate ? parseDate(pubDate) : undefined,
                    author: author || undefined,
                    category: item.children('category').toArray().map((category) => $(category).text()),
                    image,
                    enclosure_url: image,
                    enclosure_type: enclosureType,
                    media: image
                        ? {
                              content: {
                                  url: image,
                                  type: enclosureType ?? 'image/jpeg',
                                  medium: 'image',
                              },
                              thumbnail: { url: image },
                          }
                        : undefined,
                };
            })
    );

    return {
        title: channel.children('title').text() || 'Chiphell 最新主题',
        link: siteUrl,
        description: channel.children('description').text(),
        item: items,
    };
}

function getImageMimeType(image: string) {
    const extension = new URL(image).pathname.split('.').pop()?.toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') {
        return 'image/jpeg';
    }
    return extension ? `image/${extension}` : 'image/jpeg';
}
