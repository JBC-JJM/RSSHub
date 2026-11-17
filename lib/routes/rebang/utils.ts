import type { DataItem } from '@/types';
import ofetch from '@/utils/ofetch';

const siteUrl = 'https://rebang.today';
const apiPath = '/api/latest-list';
const imageBaseUrl = 'https://img.rebang.today';
const iconBaseUrl = 'https://cdn.rebang.today';

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

type SourceTab = {
    tab_key: string;
    name: string;
    avatar?: string;
    avatar_dark?: string;
};

type LatestListPage = {
    snapshot_id: string;
    list: RebangItem[];
    has_more: boolean;
    source_tabs?: SourceTab[];
};

type LatestListResponse = {
    code: number;
    data?: LatestListPage;
};

type FeedOptions = {
    tab: string;
    subTab?: string;
    pageUrl: string;
    maxItems: number;
    maxPages: number;
    pageSize: number;
    category: string;
    defaultSource?: SourceTab;
    /** Append the board's own metadata (rating, category/author line) to `description`. */
    includeExtraInfo?: boolean;
};

export async function fetchRebangItems(options: FeedOptions): Promise<DataItem[]> {
    const pages = new Map<number, LatestListPage>();
    let snapshotId: string | undefined;

    for (let pageNumber = 1; pageNumber <= options.maxPages && collectItems(pages).length < options.maxItems; pageNumber++) {
        const response = await ofetch<LatestListResponse>(`${siteUrl}${apiPath}`, {
            query: {
                tab: options.tab,
                sub_tab: options.subTab,
                page: pageNumber,
                page_size: options.pageSize,
                list_mode: 1,
                ...(snapshotId ? { snapshot_id: snapshotId } : {}),
            },
            headers: { referer: options.pageUrl },
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

    const sourceTabs = new Map<string, SourceTab>();
    for (const page of pages.values()) {
        for (const sourceTab of page.source_tabs ?? []) {
            sourceTabs.set(sourceTab.tab_key, sourceTab);
        }
    }

    return collectItems(pages)
        .slice(0, options.maxItems)
        .map((item) => toDataItem(item, sourceTabs, options));
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

function toDataItem(item: RebangItem, sourceTabs: Map<string, SourceTab>, options: FeedOptions): DataItem {
    const link = item.www_url || item.mobile_url;
    const extra = item.extra_info ?? {};
    const sourceKey = typeof extra.tab_key === 'string' ? extra.tab_key : options.defaultSource?.tab_key;
    const sourceTab = sourceKey ? sourceTabs.get(sourceKey) : undefined;
    const source = options.defaultSource?.name || sourceTab?.name || (typeof extra.source_name === 'string' ? extra.source_name : undefined);
    const iconPath = sourceTab?.avatar || sourceTab?.avatar_dark || (sourceKey === options.defaultSource?.tab_key ? options.defaultSource?.avatar : undefined);
    const iconUrl = iconPath || (sourceKey ? `forever/tab_icon/${sourceKey}.png` : undefined);
    const mainImage = item.img && !item.img.includes('/tab_icon/') ? item.img : undefined;
    const image = mainImage ? resolveImageUrl(mainImage, imageBaseUrl) : resolveIconImageUrl(iconUrl);
    const extraLines = options.includeExtraInfo ? formatExtraInfo(extra) : [];
    const description = [
        item.desc ? `<p>${escapeHtml(item.desc).replace(/\r?\n/g, '<br>')}</p>` : '',
        extraLines.length > 0 ? `<p>${extraLines.map((line) => escapeHtml(line)).join('<br>')}</p>` : '',
        image ? `<p><img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}"></p>` : '',
    ].join('');
    const publishTime = item.publish_time ?? readTimestamp(extra);

    return {
        title: source ? `${source}：${item.title}` : item.title,
        link: link ? new URL(link, siteUrl).href : undefined,
        guid: item.item_key || link || item.title,
        description,
        image,
        enclosure_type: !mainImage && image ? 'image/jpeg' : undefined,
        pubDate: publishTime
            ? new Date(publishTime < 1_000_000_000_000 ? publishTime * 1000 : publishTime)
            : undefined,
        category: source ? [options.category, source] : [options.category],
    };
}

function resolveIconImageUrl(iconPath: string | undefined) {
    const iconUrl = resolveImageUrl(iconPath, iconBaseUrl);
    if (!iconUrl) {
        return undefined;
    }

    const params = new URLSearchParams({
        url: iconUrl,
        w: '256',
        h: '256',
        fit: 'contain',
        bg: 'ffffff',
        cbg: 'ffffff',
        output: 'jpg',
    });

    return `https://images.weserv.nl/?${params}`;
}

function resolveImageUrl(imagePath: string | undefined, baseUrl: string) {
    if (!imagePath) {
        return undefined;
    }

    const imageUrl = new URL(imagePath, baseUrl);
    if (imageUrl.hostname === 'rebang.today') {
        imageUrl.hostname = 'img.rebang.today';
    }

    return imageUrl.href;
}

/**
 * Sort merged feeds newest first. Entries without a publish date (ranking-only boards
 * such as tieba) keep their relative order and end up after the dated ones.
 */
export function sortByPublishedAt(items: DataItem[]): DataItem[] {
    return [...items].sort((left, right) => publishedAt(right) - publishedAt(left));
}

function publishedAt(item: DataItem): number {
    if (item.pubDate instanceof Date) {
        return item.pubDate.getTime();
    }
    return item.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function readTimestamp(extra: Record<string, unknown>): number | undefined {
    for (const value of [extra.publish_timestamp, extra.publish_time]) {
        if (typeof value === 'number') {
            return value;
        }
    }
    return undefined;
}

function formatExtraInfo(extra: Record<string, unknown>): string[] {
    const lines: string[] = [];

    const rating = extra.display_rating as { text?: string; evaluation_count?: string } | undefined;
    if (rating?.text) {
        lines.push(rating.evaluation_count ? `评分：${rating.text}（${rating.evaluation_count} 人评价）` : `评分：${rating.text}`);
    }

    const textItems = extra.display_text_items;
    if (Array.isArray(textItems)) {
        for (const entry of textItems) {
            const text = (entry as { text?: unknown } | undefined)?.text;
            if (typeof text === 'string' && text.length > 0) {
                lines.push(text);
            }
        }
    }

    return lines;
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
