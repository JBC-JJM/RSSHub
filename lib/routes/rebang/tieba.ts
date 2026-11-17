import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import { fetchRebangItems } from './utils';

const pageUrl = 'https://rebang.today/?tab=baidu-tieba';

export const route: Route = {
    path: '/tieba',
    categories: ['new-media'],
    example: '/rebang/tieba',
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
            source: ['rebang.today/?tab=baidu-tieba'],
            target: '/tieba',
        },
    ],
    name: '贴吧热榜',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '贴吧热榜，最多返回前 30 条；无榜单图片时使用贴吧图标。',
};

async function handler() {
    const item = await cache.tryGet(
        'rebang:tieba',
        () =>
            fetchRebangItems({
                tab: 'baidu-tieba',
                subTab: 'topic',
                pageUrl,
                maxItems: 30,
                maxPages: 1,
                pageSize: 30,
                category: '贴吧热榜',
                defaultSource: {
                    tab_key: 'baidu-tieba',
                    name: '贴吧',
                    avatar: 'forever/tab_icon/baidu-tieba.png',
                },
            }),
        config.cache.routeExpire,
        false
    );

    return {
        title: '今日热榜 - 贴吧热榜',
        description: '今日热榜贴吧榜单，最多收录前 30 条。',
        link: pageUrl,
        language: 'zh-CN' as const,
        item,
    };
}
