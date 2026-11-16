import { FetchError } from 'ofetch';

import ofetch from '@/utils/ofetch';

import { getAcwScV2ByArg1 } from '../5eplay/utils';

// Retry the supported Aliyun WAF challenge only when its required arg1 is present.
export async function fetchWithAcwChallenge(url, options) {
    try {
        return await ofetch(url, options);
    } catch (error) {
        const challengeBody = error instanceof FetchError ? String(error.data) : '';
        const arg1 = challengeBody.match(/\bvar\s+arg1\s*=\s*['"](.*?)['"];?/)?.[1];
        if (!arg1) {
            if (error instanceof FetchError && error.response?.status === 405) {
                throw new Error('FreeBuf returned HTTP 405 without the arg1 required by its supported WAF challenge. The public API is currently unavailable from this RSSHub instance.', { cause: error });
            }
            throw error;
        }
        return await ofetch(url, {
            ...options,
            headers: {
                ...options.headers,
                cookie: `acw_sc__v2=${getAcwScV2ByArg1(arg1)}`,
            },
        });
    }
}
