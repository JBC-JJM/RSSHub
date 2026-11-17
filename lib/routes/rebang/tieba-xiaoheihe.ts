import type { Route } from '@/types';
import cache from '@/utils/cache';

import { fetchRebangItems, REBANG_CACHE_SECONDS, sortByPublishedAt } from './utils';

const tiebaPageUrl = 'https://rebang.today/?tab=baidu-tieba';
const xiaoheihePageUrl = 'https://rebang.today/ent?tab=xiaoheihe';

export const route: Route = {
    path: '/tieba-xiaoheihe',
    categories: ['new-media'],
    example: '/rebang/tieba-xiaoheihe',
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
            target: '/tieba-xiaoheihe',
        },
        {
            source: ['rebang.today/ent?tab=xiaoheihe'],
            target: '/tieba-xiaoheihe',
        },
    ],
    name: '贴吧与小黑盒热榜',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '合并贴吧和小黑盒热榜，按发布时间排列，贴吧最多 30 条、小黑盒最多 20 条。',
};

async function handler() {
    const item = await cache.tryGet(
        'rebang:tieba-xiaoheihe',
        async () => {
            const [tiebaItems, xiaoheiheItems] = await Promise.all([
                fetchRebangItems({
                    tab: 'baidu-tieba',
                    subTab: 'topic',
                    pageUrl: tiebaPageUrl,
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
                fetchRebangItems({
                    tab: 'xiaoheihe',
                    subTab: 'hot-rank',
                    pageUrl: xiaoheihePageUrl,
                    maxItems: 20,
                    maxPages: 5,
                    pageSize: 20,
                    category: '小黑盒热榜',
                    defaultSource: {
                        tab_key: 'xiaoheihe',
                        name: '小黑盒',
                        avatar: 'forever/tab_icon/xiaoheihe.png',
                    },
                }),
            ]);

            return sortByPublishedAt([...tiebaItems, ...xiaoheiheItems]);
        },
        REBANG_CACHE_SECONDS,
        false
    );

    return {
        title: '今日热榜 - 贴吧与小黑盒热榜',
        description: '贴吧和小黑盒热榜合并订阅，贴吧最多收录 30 条、小黑盒最多 20 条。',
        link: 'https://rebang.today/',
        language: 'zh-CN' as const,
        item,
    };
}
