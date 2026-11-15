import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

const siteUrl = 'https://rebang.today';
const imageBaseUrl = 'https://img.rebang.today';
const pageUrl = `${siteUrl}/home?tab=top`;
const apiPath = '/api/latest-list';
const maxItems = 200;
const maxPages = 15;
const pageSize = 20;

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
        requirePuppeteer: false,
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
    const pages = new Map<number, LatestListPage>();
    let snapshotId: string | undefined;

    for (let pageNumber = 1; pageNumber <= maxPages && collectItems(pages).length < maxItems; pageNumber++) {
        const response = await ofetch<LatestListResponse>(`${siteUrl}${apiPath}`, {
            query: {
                tab: 'top',
                sub_tab: 'today',
                page: pageNumber,
                page_size: pageSize,
                list_mode: 1,
                ...(snapshotId ? { snapshot_id: snapshotId } : {}),
            },
            headers: { referer: pageUrl },
        });

        if (response.code !== 200 || !response.data?.list) {
            throw new Error(`今日热榜第 ${pageNumber} 页没有返回有效数据`);
        }

        pages.set(pageNumber, response.data);
        snapshotId ??= response.data.snapshot_id;

        if (!response.data.has_more) {
            break;
        }
    }

    return collectItems(pages).slice(0, maxItems).map((entry, index) => toDataItem(entry, index));
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
    const imageUrl = item.img && !item.img.includes('/tab_icon/') ? new URL(item.img, imageBaseUrl) : undefined;
    if (imageUrl?.hostname === 'rebang.today') {
        imageUrl.hostname = 'img.rebang.today';
    }
    const image = imageUrl?.href;
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
