import { FetchError } from 'ofetch';

import ofetch from '@/utils/ofetch';

import { getAcwScV2ByArg1 } from '../5eplay/utils';

// Retry the supported Aliyun WAF challenge only when its required arg1 is present.
export async function fetchWithAcwChallenge(url, options) {
    try {
        return await ofetch(url, options);
    } catch (error) {
        const challengeBody = error instanceof FetchError ? getResponseBody(error.data) : '';
        const arg1 = challengeBody.match(/\bvar\s+arg1\s*=\s*['"](.*?)['"];?/)?.[1];
        if (!arg1) {
            if (error instanceof FetchError && error.response?.status === 405) {
                const contentType = error.response.headers.get('content-type') ?? 'unknown';
                const bodyPreview = challengeBody.replace(/\s+/g, ' ').slice(0, 300) || '<empty>';
                throw new Error(`FreeBuf returned HTTP 405 without the arg1 required by its supported WAF challenge (content-type: ${contentType}; body: ${bodyPreview}). The public API is currently unavailable from this RSSHub instance.`, { cause: error });
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

function getResponseBody(data) {
    if (typeof data === 'string') {
        return data;
    }
    if (data === undefined || data === null) {
        return '';
    }
    return JSON.stringify(data);
}
