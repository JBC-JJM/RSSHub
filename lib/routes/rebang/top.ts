import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import { getPlaywrightPage } from '@/utils/playwright';

const siteUrl = 'https://rebang.today';
const pageUrl = `${siteUrl}/home?tab=top`;
const apiPath = '/api/latest-list';
const itemSelector = 'article[data-latest-list-item-key]';
const maxItems = 200;

type RebangItem = {
    item_key?: string;
    title: string;
    www_url?: string;
    mobile_url?: string;
    desc?: string;
    img?: string;
    label?: string;
    publish_time?: number;
    extra_info?: Record<string, unknown>;
    is_ad?: boolean;
    isAd?: boolean;
    advertisement?: boolean;
};

type LatestListPage = {
    snapshot_id: string;
    list: RebangItem[];
    has_more: boolean;
};

type LatestListResponse = {
    code: number;
    data?: LatestListPage;
};

export const route: Route = {
    path: '/top',
    categories: ['new-media'],
    example: '/rebang/top',
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['rebang.today/home?tab=top'],
            target: '/top',
        },
    ],
    name: '全站综合热榜',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '全站综合热榜，按当前热度排序，最多返回前 200 条；广告位会自动排除。',
};

async function handler() {
    const item = await cache.tryGet('rebang:top', fetchTopItems, config.cache.routeExpire, false);

    return {
        title: '今日热榜 - 全站综合热榜',
        description: '今日热榜全站综合榜单，最多收录前 200 条。',
        link: pageUrl,
        language: 'zh-CN' as const,
        item,
    };
}

async function fetchTopItems(): Promise<DataItem[]> {
    const { page, destroy } = await getPlaywrightPage(pageUrl, { closeTimeout: 0 });
    const pages = new Map<number, LatestListPage>();
    const pendingResponses: Promise<void>[] = [];

    page.on('response', (response) => {
        const responseUrl = new URL(response.url());
        if (responseUrl.pathname !== apiPath) {
            return;
        }

        const pageNumber = Number(responseUrl.searchParams.get('page') ?? 1);
        pendingResponses.push(
            response
                .json()
                .then((result: LatestListResponse) => {
                    // The page inserts its ad blocks outside this API list.
                    if (result.code === 200 && result.data?.list) {
                        pages.set(pageNumber, result.data);
                    }
                })
                .catch(() => undefined)
        );
    });

    try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.locator(itemSelector).first().waitFor({ state: 'visible', timeout: 20_000 });
        await Promise.all(pendingResponses);

        if (pages.size === 0) {
            throw new Error('今日热榜没有返回可读取的榜单数据');
        }

        for (let scrolls = 0; scrolls < 15 && collectItems(pages).length < maxItems; scrolls++) {
            const latestPageNumber = Math.max(...pages.keys());
            if (!pages.get(latestPageNumber)?.has_more) {
                break;
            }

            const previousCount = await page.locator(itemSelector).count();
            const previousPageCount = pages.size;
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

            try {
                await page.waitForFunction(
                    ({ selector, count }) => document.querySelectorAll(selector).length > count,
                    { selector: itemSelector, count: previousCount },
                    { timeout: 10_000 }
                );
            } catch {
                // A full list or a failed next-page request leaves the visible count unchanged.
            }

            await Promise.all(pendingResponses.splice(0));
            if (pages.size === previousPageCount && (await page.locator(itemSelector).count()) <= previousCount) {
                if (pages.get(Math.max(...pages.keys()))?.has_more) {
                    throw new Error('今日热榜还有后续分页，但加载下一页失败');
                }
                break;
            }
        }

        return collectItems(pages).slice(0, maxItems).map((entry, index) => toDataItem(entry, index));
    } finally {
        await destroy();
    }
}

function collectItems(pages: Map<number, LatestListPage>) {
    const seen = new Set<string>();
    const items: RebangItem[] = [];

    for (const [pageNumber, page] of [...pages.entries()].sort(([left], [right]) => left - right)) {
        for (const item of page.list) {
            const key = item.item_key || item.www_url || item.mobile_url || `${pageNumber}:${item.title}`;
            if (!item.title || isAdvertisement(item) || seen.has(key)) {
                continue;
            }

            seen.add(key);
            items.push(item);
        }
    }

    return items;
}

function isAdvertisement(item: RebangItem) {
    const extra = item.extra_info ?? {};
    return (
        item.is_ad === true ||
        item.isAd === true ||
        item.advertisement === true ||
        extra.is_ad === true ||
        extra.isAd === true ||
        extra.advertisement === true ||
        /^(广告|推广|赞助|广告推广)$/.test(item.label ?? '')
    );
}

function toDataItem(item: RebangItem, index: number): DataItem {
    const link = item.www_url || item.mobile_url;
    const image = item.img && !item.img.includes('/tab_icon/') ? new URL(item.img, siteUrl).href : undefined;
    const source = typeof item.extra_info?.source_name === 'string' ? item.extra_info.source_name : undefined;
    const metadata = [source, item.label, `排名 ${index + 1}`]
        .filter(Boolean)
        .map((value) => `<p>${escapeHtml(value!)}</p>`)
        .join('');
    const description = [
        metadata,
        item.desc ? `<p>${escapeHtml(item.desc).replace(/\r?\n/g, '<br>')}</p>` : '',
        image ? `<p><img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}"></p>` : '',
    ].join('');
    const publishTime = item.publish_time;

    return {
        title: item.title,
        link: link ? new URL(link, siteUrl).href : undefined,
        guid: item.item_key || link || item.title,
        description,
        image,
        pubDate: publishTime
            ? new Date(publishTime < 1_000_000_000_000 ? publishTime * 1000 : publishTime)
            : undefined,
        category: source ? ['全站热榜', source] : ['全站热榜'],
    };
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
