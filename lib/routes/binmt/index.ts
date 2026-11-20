import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { getAcwScV2ByArg1 } from '../5eplay/utils';

const baseUrl = 'https://bbs.binmt.cc';
const cookieCacheKey = 'binmt:acw_sc__v2';

// The forum sits behind Aliyun WAF: a request without the `acw_sc__v2` cookie gets a
// JavaScript challenge instead of the feed. Solve it once and reuse the cookie.
const solveChallenge = (body: string) => {
    const arg1 = body.match(/\bvar\s+arg1\s*=\s*['"](.*?)['"];?/)?.[1];
    return arg1 ? getAcwScV2ByArg1(arg1) : undefined;
};

const fetchPage = async (url: string) => {
    const get = (cookie?: string | null) =>
        ofetch<string>(url, {
            responseType: 'text',
            headers: cookie ? { cookie: `acw_sc__v2=${cookie}` } : {},
        });

    const cachedCookie = await cache.get(cookieCacheKey);
    const body = await get(cachedCookie);

    // A solved page is either the RSS feed or the full guide HTML; a challenge page is
    // a bare <html><script> block with `var arg1=`. Keying on `var arg1` avoids mistaking
    // real HTML for a challenge.
    if (!/\bvar\s+arg1\s*=/.test(body)) {
        return body;
    }

    const cookie = solveChallenge(body);
    if (!cookie) {
        throw new Error('MT论坛 returned a WAF challenge page whose arg1 could not be parsed.');
    }
    await cache.set(cookieCacheKey, cookie, 60 * 60);

    return await get(cookie);
};

export const route: Route = {
    path: '/:category?',
    categories: ['bbs'],
    example: '/binmt/hot',
    name: '导读列表',
    maintainers: ['tylinux'],
    handler,
    description: `站点自带 RSS 入口，本路由在其基础上补齐封面与作者字段，并自动处理阿里云 WAF 的 acw_sc__v2 挑战。

| 参数 | 说明 | 可选值 | 默认值 |
| :--: | :--: | :----: | :----: |
| category | 导读类型 | \`hot\`(最新热门) / \`newthread\`(最新发表) / \`digest\`(最新精华) / \`new\`(最新回复) | \`hot\` |`,
    parameters: {
        category: '导读类型，见上表，默认 hot',
    },
};

// Mapping verified against the site: `new` serves 最新回复 and `newthread` serves 最新发表
// (the site's own titles say so), which is the reverse of what the query names suggest.
const categoryMap = {
    hot: '最新热门',
    newthread: '最新发表',
    digest: '最新精华',
    new: '最新回复',
} as const;

type Category = keyof typeof categoryMap;

// The site's own RSS for `view=hot` only ever carries 5 items, so scrape the guide page
// when more are wanted. Other views return a full page from RSS already.
const RSS_ITEM_SHORTFALL = 10;

async function handler(ctx) {
    const category = (ctx.req.param('category') || 'hot').toLowerCase();
    if (!Object.hasOwn(categoryMap, category)) {
        throw new Error(`Unknown category: ${category}. Supported: ${Object.keys(categoryMap).join(', ')}`);
    }
    const view = category as Category;

    const xml = await fetchPage(`${baseUrl}/forum.php?mod=guide&view=${view}&rss=1`);
    const $ = load(xml, { xmlMode: true });
    let items = parseRssItems($);

    if (items.length < RSS_ITEM_SHORTFALL) {
        const html = await fetchPage(`${baseUrl}/forum.php?mod=guide&view=${view}`);
        const scraped = parseGuidePage(load(html), baseUrl);
        if (scraped.length > items.length) {
            items = scraped;
        }
    }

    return {
        title: `MT论坛 - 导读 - ${categoryMap[view]}`,
        link: `${baseUrl}/forum.php?mod=guide&view=${view}`,
        description: 'MT论坛 - 导读',
        image: `${baseUrl}/static/image/common/logo.png`,
        item: items,
    };
}

function parseRssItems($: ReturnType<typeof load>): DataItem[] {
    return $('item')
        .toArray()
        .map((element): DataItem => {
            const item = $(element);
            const title = item.children('title').text().trim();
            const link = item.children('link').text().trim();
            const description = item.children('description').text();
            const author = item.children('author').text().trim();
            const enclosure = item.children('enclosure').attr('url');
            const pubDate = item.children('pubDate').text().trim();
            const itemCategory = item.children('category').text().trim();

            // The site only sets an enclosure when the thread has an image attachment.
            const image = enclosure && /^https?:\/\//.test(enclosure) ? enclosure : undefined;
            const mimeType = image ? getImageMimeType(image) : undefined;

            return {
                title,
                link,
                description: image && !/<img\b/i.test(description) ? `${description}<p><img src="${image}"></p>` : description,
                author: author || undefined,
                category: itemCategory ? [itemCategory] : undefined,
                pubDate: pubDate ? parseDate(pubDate) : undefined,
                image,
                enclosure_url: image,
                enclosure_type: mimeType,
                media: image
                    ? {
                          content: { url: image, type: mimeType, medium: 'image' },
                          thumbnail: { url: image },
                      }
                    : undefined,
            };
        });
}

/** Scrapes the guide page for title/link/author/time/attachment when RSS returns too few. */
function parseGuidePage($: ReturnType<typeof load>, siteUrl: string): DataItem[] {
    return $('tbody[id^="normalthread_"]')
        .toArray()
        .map((element): DataItem | undefined => {
            const row = $(element);
            const titleAnchor = row.find('a.xst').first();
            const title = titleAnchor.text().trim();
            const href = titleAnchor.attr('href');
            if (!title || !href) {
                return undefined;
            }

            const link = new URL(href, siteUrl).href;
            // Columns: [icon] [title] [forum] [author] [replies/views] [last poster]
            const authorAnchor = row.find('td.by cite a').first();
            const author = authorAnchor.text().trim();
            const timeSpan = row.find('td.by em span[title], td.by em a span[title]').first();
            const pubDate = timeSpan.attr('title');

            // A real image attachment shows up as the filetype icon next to the title.
            const hasAttachment = row.find('img[alt="attach_img"]').length > 0;

            return {
                title,
                link,
                author: author || undefined,
                pubDate: pubDate ? parseDate(pubDate) : undefined,
                description: hasAttachment ? `<p>${title}</p>` : title,
            };
        })
        .filter((item): item is DataItem => item !== undefined);
}

function getImageMimeType(image: string) {
    const extension = image.split('?')[0].split('.').pop()?.toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') {
        return 'image/jpeg';
    }
    if (extension === 'png') {
        return 'image/png';
    }
    if (extension === 'gif') {
        return 'image/gif';
    }
    if (extension === 'webp') {
        return 'image/webp';
    }
    return 'image/jpeg';
}
