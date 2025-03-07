const { stringSimilarity } = require('string-similarity-js');
const OpenCC = require('opencc-js');
const Kuroshiro = require('kuroshiro');
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

const { CacheMap } = require('./utils');

const converterZH = OpenCC.Converter({ from: 'tw', to: 'cn' })
const converterJA = (() => {
    const kuromoji = new Kuroshiro.default();
    let inited = false
    return async (text) => {
        if (!inited) {
            await kuromoji.init(new KuromojiAnalyzer())
            inited = true
        }
        return kuromoji.convert(text, { to: 'hiragana' })
    }
})()

const full2half = (() => {
    // 统一转换方向建议：全角 → 半角
    const full2halfMap = new Map([
        ['　', ' '],   // 全角空格
        ['！', '!'],  ['＂', '"'],  ['＃', '#'],  ['＄', '$'],  ['％', '%'],
        ['＆', '&'],  ['＇', "'"],  ['（', '('],  ['）', ')'],  ['＊', '*'],
        ['＋', '+'],  ['，', ','],  ['－', '-'],  ['．', '.'],  ['／', '/'],
        ['：', ':'],  ['；', ';'],  ['＜', '<'],  ['＝', '='],  ['＞', '>'],
        ['？', '?'],  ['＠', '@'],  ['［', '['],  ['＼', '\\'], ['］', ']'],
        ['＾', '^'],  ['＿', '_'],  ['｀', '`'],  ['｛', '{'],  ['｜', '|'], 
        ['｝', '}'],  ['～', '~']
    ]);
    
    // 字母数字扩展
    for (let c = 0xFF00; c <= 0xFF5E; c++) {
        const half = String.fromCharCode(c - 0xFEE0)
        full2halfMap.set(String.fromCharCode(c), half)
    }
    
    // 全角转半角
    return (text) => {
        return text.split('').map(c => full2halfMap.get(c) || c).join('')
    }
})()

function unifyWhitespace(text) {
    return text
        .replace(/[\u00A0\u2000-\u200F\u2028-\u202F\u3000]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function detectLanguage(text) {
    const patterns = {
        chinese: /[\u4e00-\u9fa5]/, // 中文字符范围
        japanese: /[\u3040-\u30ff\u31f0-\u31ff]/, // 日文假名范围
        korean: /[\uac00-\ud7af]/, // 韩文字符范围
        english: /[a-zA-Z]/, // 英文字母
    };
    if (patterns.japanese.test(text)) return 'ja'
    if (patterns.korean.test(text)) return 'ko'
    if (patterns.chinese.test(text)) return 'zh'
    return 'en'
}

// 缓存标准化结果
// This cache will delete oldest cache automatically
const cacheStandardize = new CacheMap(1000);

async function standardize(name) {
    if (cacheStandardize.has(name)) return cacheStandardize.get(name)
    let processed = unifyWhitespace(full2half(name)).toLowerCase().trim()
    const lang = detectLanguage(processed)
    if (lang === 'zh') {
        processed = converterZH(processed)
    } else if (lang === 'ja') {
        processed = await converterJA(processed)
    }
    cacheStandardize.set(name, processed)
    return processed
}

function cleanTitle(title) {
    return title
        .replace(/(\(.*?\)|\[.*?\]|feat\.?|vs\.?|with|[\uFF08-\uFF09])/gi, '') // 移除括号和修饰词
        .replace(/\s+/g, ' ') // 合并多余空格
        .trim()
}

async function matchTitleSimilarity(title, target, titleCleaned = false) {
    if (!titleCleaned) {
        title = cleanTitle(await standardize(title))
        target = cleanTitle(await standardize(target))
    }
    return stringSimilarity(title, target)
}

/**
 * @param { string | string[] } artists 
 * @param { string | string[] } target 
 */
async function matchArtists(artists, target) {
    const normalizeArtistStr = (artistStr) => artistStr.split(/[、/＆&,;]+/).map(a => a.trim())

    if (typeof artists === 'string') {
        artists = await standardize(artists)
        artists = normalizeArtistStr(artists)
    } else {
        artists = await Promise.all(artists.map(a => standardize(a)))
    }
    if (typeof target === 'string') {
        target = await standardize(target)
        target = normalizeArtistStr(target)
    } else {
        target = await Promise.all(target.map(a => standardize(a)))
    }
    return artists.filter(a => target.includes(a))
}

/**
 * @param { { title: string, artist: string, artists: string[] } } audio
 * @param { { title: string, artist: string, artists: string[] } } target 
 * @param { { titleCleaned: boolean } } options
 */
async function matchAudio(audio, target, options = { titleCleaned: false }) {
    const reduceArtists = (artists, artist) => {
        if (artists.includes(artist)) return artists.join(';')
        return artists.join(';') + ';' + artist
    }

    const titleScore = await matchTitleSimilarity(audio.title, target.title, options.titleCleaned)
    const artists = await matchArtists(
        reduceArtists(audio.artists, audio.artist),
        reduceArtists(target.artists, target.artist)
    )
    return { titleScore, artists }
}

module.exports = {
    standardize,
    cleanTitle,
    matchTitleSimilarity,
    matchArtists,
    matchAudio,
}
