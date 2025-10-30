const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const { Buffer } = require('buffer');
const FileType = require('file-type');

// Instagram Scraper Module
class InstagramScraper {
    static async getContentType(url) {
        try {
            if (url.includes('token=')) {
                try {
                    const tokenMatch = url.match(/token=([^&]+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        const token = tokenMatch[1];
                        const parts = token.split('.');
                        if (parts.length === 3) {
                            const payload = parts[1];
                            const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
                            try {
                                const decodedPayload = Buffer.from(paddedPayload, 'base64').toString('utf-8');
                                const payloadData = JSON.parse(decodedPayload);

                                if (payloadData.url) {
                                    if (payloadData.url.includes('.mp4') || payloadData.url.includes('video')) {
                                        return 'video';
                                    } else if (payloadData.url.includes('.jpg') || payloadData.url.includes('.png') || payloadData.url.includes('image')) {
                                        return 'image';
                                    }
                                }

                                if (payloadData.filename) {
                                    if (payloadData.filename.includes('.mp4') || payloadData.filename.includes('.webm') || payloadData.filename.includes('.mov')) {
                                        return 'video';
                                    } else if (payloadData.filename.includes('.jpg') || payloadData.filename.includes('.jpeg') || payloadData.filename.includes('.png') || payloadData.filename.includes('.gif')) {
                                        return 'image';
                                    }
                                }
                            } catch (decodeError) {
                                console.log('Failed to decode JWT payload:', decodeError.message);
                            }
                        }
                    }
                } catch (jwtError) {
                    console.log('Failed to parse JWT token:', jwtError.message);
                }
            }

            if (url.includes('.mp4') || url.includes('video') || url.includes('.webm') || url.includes('.mov')) {
                return 'video';
            }
            if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp') || url.includes('.gif') || url.includes('image')) {
                return 'image';
            }

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
                }
            });

            try {
                const fileType = await FileType.fromBuffer(response.data);
                if (fileType) {
                    if (fileType.ext === 'jpg' || fileType.ext === 'png' || fileType.ext === 'webp' || fileType.ext === 'gif') {
                        return 'image';
                    } else if (fileType.ext === 'mp4' || fileType.ext === 'webm' || fileType.ext === 'mov') {
                        return 'video';
                    }
                }
            } catch (fileTypeError) {
                console.log('FileType not available, using content-type header');
            }

            const contentType = response.headers['content-type'];
            if (contentType) {
                if (contentType.includes('image')) return 'image';
                if (contentType.includes('video')) return 'video';
            }

            return 'unknown';
        } catch (error) {
            console.error('Error fetching URL:', error);
            return 'unknown';
        }
    }

    static extractProfileInfo(html) {
        try {
            if (!html || typeof html !== 'string') {
                return {
                    username: '',
                    fullName: '',
                    avatar: '',
                    description: '',
                    likes: 0,
                    comments: 0,
                    views: 0
                };
            }

            const $ = cheerio.load(html);

            const profileInfo = {
                username: '',
                fullName: '',
                avatar: '',
                description: '',
                likes: 0,
                comments: 0,
                views: 0
            };

            const usernameSelectors = [
                '.download-items__user',
                '.download-items__author',
                'a[href*="instagram.com/"]',
                'span[data-username]'
            ];

            for (const selector of usernameSelectors) {
                const element = $(selector);
                if (element.length) {
                    let username = element.text().trim();

                    if (selector.includes('href') && element.attr('href')) {
                        const match = element.attr('href').match(/instagram\.com\/([^\/\?]+)/);
                        if (match && match[1]) {
                            username = match[1];
                        }
                    }

                    if (selector.includes('data-username') && element.attr('data-username')) {
                        username = element.attr('data-username');
                    }

                    username = username.replace('@', '').trim();

                    if (username) {
                        profileInfo.username = username;
                        break;
                    }
                }
            }

            const avatarSelectors = [
                '.download-items__thumb img',
                '.download-items__avatar img',
                'img[alt*="profile"]',
                'img[alt*="avatar"]',
                '.avatar img'
            ];

            for (const selector of avatarSelectors) {
                const element = $(selector);
                if (element.length && element.attr('src')) {
                    profileInfo.avatar = element.attr('src');
                    break;
                }
            }

            const descriptionSelectors = [
                '.download-items__caption',
                '.download-items__text',
                '.post-caption',
                'p.caption'
            ];

            for (const selector of descriptionSelectors) {
                const element = $(selector);
                if (element.length) {
                    const text = element.text().trim();
                    if (text) {
                        profileInfo.description = text;
                        break;
                    }
                }
            }

            const statsSelectors = [
                '.download-items__meta span',
                '.post-stats span',
                '.engagement-count'
            ];

            let statsFound = false;

            for (const selector of statsSelectors) {
                const elements = $(selector);
                if (elements.length) {
                    elements.each((i, el) => {
                        const text = $(el).text().trim();

                        if (text.includes('like') || text.includes('❤') || text.includes('♥')) {
                            profileInfo.likes = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                            statsFound = true;
                        }
                        else if (text.includes('comment') || text.includes('💬')) {
                            profileInfo.comments = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                            statsFound = true;
                        }
                        else if (text.includes('view') || text.includes('👁') || text.includes('plays')) {
                            profileInfo.views = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                            statsFound = true;
                        }
                    });

                    if (statsFound) break;
                }
            }

            if (!statsFound) {
                const dataElements = $('[data-likes], [data-comments], [data-views]');
                if (dataElements.length) {
                    dataElements.each((i, el) => {
                        const $el = $(el);
                        if ($el.attr('data-likes')) {
                            profileInfo.likes = parseInt($el.attr('data-likes')) || 0;
                            statsFound = true;
                        }
                        if ($el.attr('data-comments')) {
                            profileInfo.comments = parseInt($el.attr('data-comments')) || 0;
                            statsFound = true;
                        }
                        if ($el.attr('data-views')) {
                            profileInfo.views = parseInt($el.attr('data-views')) || 0;
                            statsFound = true;
                        }
                    });
                }
            }

            if (!statsFound) {
                const textNodes = $('body').find('*').contents().filter(function () {
                    return this.nodeType === 3 &&
                        /\d+\s*(likes|comments|views|❤|💬|👁)/i.test(this.nodeValue);
                });

                textNodes.each((i, node) => {
                    const text = $(node).text().trim();

                    if (/\d+\s*(likes|❤)/i.test(text)) {
                        const match = text.match(/(\d+)\s*(likes|❤)/i);
                        if (match && match[1]) {
                            profileInfo.likes = parseInt(match[1]) || 0;
                            statsFound = true;
                        }
                    }

                    if (/\d+\s*(comments|💬)/i.test(text)) {
                        const match = text.match(/(\d+)\s*(comments|💬)/i);
                        if (match && match[1]) {
                            profileInfo.comments = parseInt(match[1]) || 0;
                            statsFound = true;
                        }
                    }

                    if (/\d+\s*(views|plays|👁)/i.test(text)) {
                        const match = text.match(/(\d+)\s*(views|plays|👁)/i);
                        if (match && match[1]) {
                            profileInfo.views = parseInt(match[1]) || 0;
                            statsFound = true;
                        }
                    }
                });
            }

            return profileInfo;
        } catch (error) {
            console.error('Error extracting profile info:', error);
            return {
                username: '',
                fullName: '',
                avatar: '',
                description: '',
                likes: 0,
                comments: 0,
                views: 0
            };
        }
    }

    static async saveInsta(url, logger = console) {
        return new Promise(async (resolve) => {
            try {
                if (!url.match(/(https|http):\/\/www.instagram.com\/(p|reel|tv)/gi)) {
                    return resolve({ status: false, msg: 'Invalid Instagram URL' });
                }

                function decodeSnapApp(args) {
                    if (!args || args.length < 5) {
                        return '';
                    }

                    let [a, l, i, c, e] = args;

                    if (!a || !i || c === '') {
                        return '';
                    }

                    function decode(d, e, f) {
                        const g = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
                        let h = g.slice(0, e);
                        let i = g.slice(0, f);
                        let j = d.split('').reverse().reduce(function (a, b, c) {
                            if (h.indexOf(b) !== -1)
                                return a += h.indexOf(b) * (Math.pow(e, c));
                            return a;
                        }, 0);
                        let k = '';
                        while (j > 0) {
                            k = i[j % f] + k;
                            j = (j - (j % f)) / f;
                        }
                        return k || '0';
                    }

                    try {
                        let result = '';

                        const cValue = typeof c === 'string' ? parseInt(c) : c;

                        if (isNaN(cValue) || cValue < 0) {
                            return '';
                        }

                        for (let j = 0, len = a.length; j < len; j++) {
                            let s = '';

                            if (!i || !i[cValue]) {
                                break;
                            }

                            while (j < a.length && a[j] !== i[cValue]) {
                                s += a[j];
                                j++;
                            }

                            if (s) {
                                if (typeof i === 'string') {
                                    for (let k = 0; k < i.length; k++) {
                                        s = s.replace(new RegExp(i[k], "g"), k.toString());
                                    }

                                    const decoded = decode(s, cValue, 10);

                                    if (!isNaN(decoded)) {
                                        const charCode = decoded - cValue;
                                        result += String.fromCharCode(charCode);
                                    }
                                }
                            }
                        }

                        try {
                            return decodeURIComponent(encodeURIComponent(result));
                        } catch (error) {
                            return result;
                        }
                    } catch (error) {
                        return '';
                    }
                }

                function getEncodedSnapApp(data) {
                    try {
                        if (!data || typeof data !== 'string') {
                            return ['', '', '', '', '', ''];
                        }

                        if (!data.includes('decodeURIComponent(escape(r))}(')) {
                            if (data.includes('getElementById("download-section")')) {
                                return ['', '', '', '', '', ''];
                            }
                            return ['', '', '', '', '', ''];
                        }

                        const parts = data.split('decodeURIComponent(escape(r))}(');
                        if (parts.length < 2) {
                            return ['', '', '', '', '', ''];
                        }

                        const secondPart = parts[1];
                        const closingParts = secondPart.split('))');
                        if (closingParts.length < 1) {
                            return ['', '', '', '', '', ''];
                        }

                        const argString = closingParts[0];
                        const args = argString.split(',').map(v => v.replace(/"/g, '').trim());

                        if (args.length >= 6) {
                            return args.slice(0, 6);
                        }

                        while (args.length < 6) {
                            args.push('');
                        }

                        return args;
                    } catch (error) {
                        return ['', '', '', '', '', ''];
                    }
                }

                function getDecodedSnapSave(data) {
                    try {
                        if (!data || typeof data !== 'string') {
                            return '';
                        }

                        const patterns = [
                            /getElementById\("download-section"\)\.innerHTML = "(.*?)";/,
                            /getElementById\('download-section'\)\.innerHTML = '(.*?)';/,
                            /<div class="download-items">(.*?)<\/div>/s
                        ];

                        for (const pattern of patterns) {
                            const match = data.match(pattern);
                            if (match && match[1]) {
                                return match[1].replace(/\\(\\)?/g, '');
                            }
                        }

                        return data;
                    } catch (error) {
                        return data;
                    }
                }

                function decryptSnapSave(data) {
                    try {
                        if (data.includes('<div class="download-items">')) {
                            return data;
                        }

                        const encodedArgs = getEncodedSnapApp(data);

                        if (encodedArgs.length >= 6 && encodedArgs.some(arg => arg !== '')) {
                            try {
                                function originalDecodeSnapApp(args) {
                                    let [h, u, n, t, e, r] = args;

                                    function decode(d, e, f) {
                                        const g = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
                                        let h = g.slice(0, e);
                                        let i = g.slice(0, f);
                                        let j = d.split('').reverse().reduce(function (a, b, c) {
                                            if (h.indexOf(b) !== -1)
                                                return a += h.indexOf(b) * (Math.pow(e, c));
                                            return a;
                                        }, 0);
                                        let k = '';
                                        while (j > 0) {
                                            k = i[j % f] + k;
                                            j = (j - (j % f)) / f;
                                        }
                                        return k || '0';
                                    }

                                    let result = '';
                                    for (let i = 0, len = h.length; i < len; i++) {
                                        let s = '';
                                        while (h[i] !== n[e]) {
                                            s += h[i];
                                            i++;
                                            if (i >= h.length) break;
                                        }
                                        for (let j = 0; j < n.length; j++) {
                                            s = s.replace(new RegExp(n[j], "g"), j.toString());
                                        }
                                        result += String.fromCharCode(decode(s, e, 10) - t);
                                    }
                                    return decodeURIComponent(encodeURIComponent(result));
                                }

                                const decoded = originalDecodeSnapApp(encodedArgs);
                                const decodedHtml = getDecodedSnapSave(decoded);

                                if (decodedHtml && decodedHtml.includes('<')) {
                                    return decodedHtml;
                                }

                                const modifiedDecoded = decodeSnapApp(encodedArgs.slice(0, 5));
                                return getDecodedSnapSave(modifiedDecoded);
                            } catch (error) {
                                try {
                                    const modifiedDecoded = decodeSnapApp(encodedArgs.slice(0, 5));
                                    return getDecodedSnapSave(modifiedDecoded);
                                } catch (innerError) {
                                    return data;
                                }
                            }
                        } else {
                            return getDecodedSnapSave(data);
                        }
                    } catch (error) {
                        return data;
                    }
                }

                try {
                    let html = '';
                    let success = false;

                    try {
                        const response = await axios.post('https://snapsave.app/action.php?lang=id',
                            new URLSearchParams({ url }),
                            {
                                headers: {
                                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                                    'content-type': 'application/x-www-form-urlencoded',
                                    'origin': 'https://snapsave.app',
                                    'referer': 'https://snapsave.app/id',
                                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
                                },
                                timeout: 15000
                            }
                        );

                        html = response.data;
                        success = true;
                    } catch (error) {
                        // Silent fail, try alternative approach
                    }

                    if (!success || !html) {
                        try {
                            const response = await axios.get(url, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
                                },
                                timeout: 15000
                            });

                            const instagramHtml = response.data;

                            const jsonMatch = instagramHtml.match(/<script type="application\/json"[^>]*>(.*?)<\/script>/);
                            if (jsonMatch && jsonMatch[1]) {
                                try {
                                    const jsonData = JSON.parse(jsonMatch[1]);
                                    // Could implement direct extraction here in the future
                                } catch (jsonError) {
                                    // Silent fail
                                }
                            }
                        } catch (directError) {
                            // Silent fail
                        }
                    }

                    if (!html) {
                        return resolve({ status: false, msg: 'Failed to fetch Instagram content' });
                    }

                    const decode = decryptSnapSave(html);
                    const $ = cheerio.load(decode);
                    const results = [];
                    const profileInfo = InstagramScraper.extractProfileInfo(decode);

                    const selectors = [
                        '.download-items__btn a',
                        'a.download-button',
                        'a[href*="cdninstagram"]',
                        'a[href*=".jpg"]',
                        'a[href*=".mp4"]',
                        'a[download]',
                        '.media-container a'
                    ];

                    let foundLinks = false;

                    for (const selector of selectors) {
                        const elements = $(selector);

                        if (elements.length > 0) {
                            elements.each((i, element) => {
                                const href = $(element).attr('href');

                                if (href && href.startsWith('http')) {
                                    let contentType = 'unknown';

                                    if (href.includes('.mp4') || href.includes('video')) {
                                        contentType = 'video';
                                    } else if (href.includes('.jpg') || href.includes('.png') || href.includes('image')) {
                                        contentType = 'image';
                                    } else {
                                        contentType = 'unknown';
                                    }

                                    results.push({ url: href, type: contentType });
                                    foundLinks = true;
                                }
                            });

                            if (foundLinks) {
                                break;
                            }
                        }
                    }

                    if (!foundLinks) {
                        const mediaSelectors = [
                            'video source',
                            'img[src*="cdninstagram"]',
                            'img.instagram-media'
                        ];

                        for (const selector of mediaSelectors) {
                            const elements = $(selector);

                            if (elements.length > 0) {
                                elements.each((i, element) => {
                                    const src = $(element).attr('src');

                                    if (src && src.startsWith('http')) {
                                        const isVideo = selector.includes('video') || src.includes('.mp4');
                                        const contentType = isVideo ? 'video' : 'image';

                                        results.push({ url: src, type: contentType });
                                        foundLinks = true;
                                    }
                                });

                                if (foundLinks) break;
                            }
                        }
                    }

                    for (let i = 0; i < results.length; i++) {
                        if (results[i].type === 'unknown') {
                            try {
                                const contentType = await InstagramScraper.getContentType(results[i].url);
                                if (contentType !== 'unknown') {
                                    results[i].type = contentType;
                                } else {
                                    results[i].type = 'image';
                                }
                            } catch (error) {
                                results[i].type = 'image';
                            }
                        }
                    }

                    if (results.length === 0) {
                        const urlRegex = /(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|mp4|webp))/g;
                        let match;

                        while ((match = urlRegex.exec(html)) !== null) {
                            const url = match[1];
                            const extension = match[2];

                            const contentType = (extension === 'mp4') ? 'video' : 'image';

                            results.push({ url, type: contentType });
                            foundLinks = true;
                        }
                    }

                    const uniqueUrls = new Set();
                    const uniqueResults = [];

                    for (const item of results) {
                        if (!uniqueUrls.has(item.url)) {
                            uniqueUrls.add(item.url);
                            uniqueResults.push(item);
                        }
                    }

                    if (uniqueResults.length > 0) {
                        return resolve({
                            status: true,
                            data: uniqueResults,
                            profileInfo: profileInfo,
                            postUrl: url
                        });
                    } else {
                        return resolve({ status: false, msg: 'No downloadable content found', url: url });
                    }

                } catch (error) {
                    return resolve({ status: false, msg: `Error downloading Instagram content: ${error.message}` });
                }
            } catch (e) {
                return resolve({ status: false, msg: e.message });
            }
        });
    }
}

module.exports = {
    name: "responder",
    aliases: [],
    description: 'Download content when "adore" is mentioned with links',
    syntax: 'adore (link)',
    example: 'adore https://instagram.com/p/example',
    run: async (client, message, args) => {
        // This function is called from message listener, not as a command
        // The actual logic is in the message event handler
    }
};

async function handleAdoreMention(client, message) {
    const content = message.content.toLowerCase();

    if (!content.startsWith('adore ')) {
        return;
    }

    const args = message.content.split(' ');
    const url = args[1];

    if (!url || !url.match(/^https?:\/\/.+/)) {
        return message.react('❤️');
    }

    // Start typing indicator
    await message.channel.sendTyping();

    try {
        if (url.match(/instagram\.com\/(p|reel|tv)/)) {
            return await handleInstagram(message, url, client);
        } else if (url.match(/tiktok\.com/)) {
            return await handleTikTok(message, url, client);
        } else {
            return message.react('❤️');
        }
    } catch (error) {
        if (client.errorLogger) {
            client.errorLogger.log(error, 'Adore Downloader', {
                command: 'adore',
                args: url,
                user: message.author,
                guild: message.guild,
                channel: message.channel
            });
        }
        return message.react('❤️');
    }
}

async function handleInstagram(message, url, client) {
    try {
        const result = await InstagramScraper.saveInsta(url, console);

        if (!result.status) {
            if (client.errorLogger) {
                client.errorLogger.log(`Instagram download failed: ${result.msg}`, 'Instagram Downloader', {
                    command: 'adore (Instagram)',
                    args: url,
                    user: message.author,
                    guild: message.guild,
                    channel: message.channel
                });
            }
            return message.react('❤️');
        }

        const { data } = result;
        const filesToSend = data.slice(0, 3);
        const attachments = [];

        for (let i = 0; i < filesToSend.length; i++) {
            const item = filesToSend[i];
            try {
                const response = await axios.get(item.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const buffer = Buffer.from(response.data);
                const extension = item.type === 'video' ? 'mp4' : 'jpg';
                const filename = `instagram_${Date.now()}_${i + 1}.${extension}`;

                attachments.push(new AttachmentBuilder(buffer, { name: filename }));
            } catch (downloadError) {
                if (client.errorLogger) {
                    client.errorLogger.log(`Instagram file download error: ${downloadError.message}`, 'Instagram File Download', {
                        command: 'adore (Instagram File)',
                        args: `${url} - File ${i + 1}`,
                        user: message.author,
                        guild: message.guild,
                        channel: message.channel
                    });
                }
            }
        }

        if (attachments.length > 0) {
            return message.reply({ files: attachments });
        } else {
            return message.react('❤️');
        }

    } catch (error) {
        if (client.errorLogger) {
            client.errorLogger.log(`Instagram download error: ${error.message}`, 'Instagram Download', {
                command: 'adore (Instagram)',
                args: url,
                user: message.author,
                guild: message.guild,
                channel: message.channel
            });
        }
        return message.react('❤️');
    }
}

async function handleTikTok(message, url, client) {
    try {
        let cleanUrl = url;

        if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
            try {
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                cleanUrl = response.request.res.responseUrl || url;
            } catch (redirectError) {
                // Silent fail for URL expansion
            }
        }

        const response = await axios.post('https://www.tikwm.com/api/',
            new URLSearchParams({
                url: cleanUrl,
                count: 12,
                cursor: 0,
                web: 1,
                hd: 1
            }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        if (!response.data || response.data.code !== 0) {
            try {
                const altResponse = await axios.get(`https://tikwm.com/api/feed/search?keywords=${encodeURIComponent(cleanUrl)}&count=1&cursor=0&web=1&hd=1`);

                if (altResponse.data && altResponse.data.code === 0 && altResponse.data.data && altResponse.data.data.videos && altResponse.data.data.videos.length > 0) {
                    const videoData = altResponse.data.data.videos[0];
                    return await processTikTokVideo(message, videoData, client);
                }
            } catch (altError) {
                // Silent fail for alternative API
            }

            return message.react('❤️');
        }

        const videoData = response.data.data;
        return await processTikTokVideo(message, videoData, client);

    } catch (error) {
        if (client.errorLogger) {
            client.errorLogger.log(`TikTok download error: ${error.message}`, 'TikTok Download', {
                command: 'adore (TikTok)',
                args: url,
                user: message.author,
                guild: message.guild,
                channel: message.channel
            });
        }
        return message.react('❤️');
    }
}

async function processTikTokVideo(message, videoData, client) {
    try {
        let videoUrl = videoData.play || videoData.download_addr || videoData.video?.downloadAddr;

        if (!videoUrl) {
            return message.react('❤️');
        }

        if (videoUrl.startsWith('/')) {
            videoUrl = 'https://www.tikwm.com' + videoUrl;
        }

        try {
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.tikwm.com/'
                }
            });

            const buffer = Buffer.from(videoResponse.data);
            const fileSizeMB = buffer.length / (1024 * 1024);

            if (fileSizeMB > 25) {
                return message.react('❤️');
            }

            const filename = `tiktok_${Date.now()}.mp4`;
            const attachment = new AttachmentBuilder(buffer, { name: filename });

            return message.reply({ files: [attachment] });

        } catch (downloadError) {
            if (client.errorLogger) {
                client.errorLogger.log(`TikTok video download error: ${downloadError.message}`, 'TikTok Video Download', {
                    command: 'adore (TikTok Video)',
                    args: videoUrl,
                    user: message.author,
                    guild: message.guild,
                    channel: message.channel
                });
            }
            return message.react('❤️');
        }

    } catch (error) {
        if (client.errorLogger) {
            client.errorLogger.log(`TikTok processing error: ${error.message}`, 'TikTok Processing', {
                command: 'adore (TikTok Processing)',
                args: 'Video data processing',
                user: message.author,
                guild: message.guild,
                channel: message.channel
            });
        }
        return message.react('❤️');
    }
}

module.exports.handleAdoreMention = handleAdoreMention;
