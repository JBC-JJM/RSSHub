import { load } from 'cheerio';
import type { Context } from 'hono';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const feedUrl = 'https://www.chiphell.com/forum.php?mod=rss&auth=0';
const siteUrl = 'https://www.chiphell.com';

// chiphell's WAF rejects some image-proxy user agents with a 567, which leaves feed reader
// thumbnails blank. Routing covers through this deployment avoids that check.
const coverHost = 'static.chiphell.com';

export const route: Route = {
    path: '/rss',
    categories: ['bbs'],
    example: '/chiphell/rss',
    name: '论坛 RSS（封面增强）',
    maintainers: ['tylinux'],
    handler,
};

async function handler(ctx: Context) {
    const origin = new URL(ctx.req.url).origin;
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
                // Point every image reference at this deployment so readers that cannot reach
                // chiphell directly still get a cover.
                const proxiedImage = image ? proxyImage(origin, image) : undefined;

                return {
                    title,
                    link,
                    description: proxiedImage && !/<img\b/i.test(description) ? `${description}<p><img src="${proxiedImage}"></p>` : description,
                    pubDate: pubDate ? parseDate(pubDate) : undefined,
                    author: author || undefined,
                    category: item.children('category').toArray().map((category) => $(category).text()),
                    image: proxiedImage,
                    enclosure_url: proxiedImage,
                    enclosure_type: enclosureType,
                    media: proxiedImage
                        ? {
                              content: {
                                  url: proxiedImage,
                                  type: enclosureType ?? 'image/jpeg',
                                  medium: 'image',
                              },
                              thumbnail: { url: proxiedImage },
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

/** Rewrites a chiphell cover URL to go through this deployment; leaves other hosts untouched. */
function proxyImage(origin: string, image: string) {
    let parsed: URL;
    try {
        parsed = new URL(image);
    } catch {
        return image;
    }
    if (parsed.hostname !== coverHost) {
        return image;
    }
    return `${origin}/chiphell/img?url=${encodeURIComponent(parsed.href)}`;
}
