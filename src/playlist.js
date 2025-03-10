const colors = require('colors/safe');
const fs = require('fs/promises');
const path = require('path');
const NeteaseApi = require('NeteaseCloudMusicApi');

const config = require('./config');
const { isMusicFile, ExpireCacheDict, getTimeString } = require('./utils');
const { login } = require('./login');
const { CacheMatchFile } = require('./music_match');

/**
 * @param { string } name 
 * @param { string } str 
 * @param { string } prefix 
 */
function resolveMutilines(name, str, prefix = '#') {
    if (!str.includes('\n')) return [`${ prefix } ${ name } ${ str }`]
    return [`${ prefix } ${ name }`].concat(
        str.trimEnd().split('\n').map(line => `${ prefix } | ${ line }`)
    )
}

// for Windows, 相对于程序执行目录
function isSameDrive(path1, path2) {
    if (process.platform !== 'win32') return true
    const drive1 = path.resolve(path1).slice(0, 2).toUpperCase()
    const drive2 = path.resolve(path2).slice(0, 2).toUpperCase()
    return drive1 === drive2
}

/**
 * @param {string} pathDir 
 * @param {string} playlistId 
 */
async function exportPlaylist(pathDir, playlistId, { outputFileDir = '', type = 'm3u8', existAllFile = false, useLogin = false, allowCache = true } = {}) {
    if (typeof playlistId !== 'number' || isNaN(playlistId)) {
        console.error(colors.red('[错误] 请提供正确的歌单ID'))
        return
    }
    if (outputFileDir && !isSameDrive(pathDir, outputFileDir)) {
        console.error(colors.red(`[错误] 文件硬盘符不同，找不到相对路径`))
        return
    }
    if (!outputFileDir) outputFileDir = path.join(pathDir, 'playlist')
    if (type !== 'm3u8') {
        console.error(colors.red(`[错误] 不受支持的导出格式：${ type }`))
        return
    }

    const { cookie } = useLogin ? await login() : {}

    const cacheMatch = new CacheMatchFile(pathDir)
    await cacheMatch.load()
    if (await cacheMatch.isEmpty()) {
        console.error(colors.red('[错误] 无歌曲匹配信息'))
        return
    }
    const mapNeteaseId2MatchInfo = new Map(cacheMatch.data.files.map(obj => [obj.neteaseId, obj]))
    const audioSet = new Set(existAllFile ? [] : (await fs.readdir(pathDir)).filter(isMusicFile))

    console.log(colors.yellow('请确保文件信息最新，否则 m3u8 文件的歌曲描述信息可能不准确'))

    let useCache = false
    /** @type { { name: string, description: string, coverImgUrl: string, ids: number[] } } */
    let playlistDetail = {}
    const cachePlaylistDetail = new ExpireCacheDict('playlistDetail-minForExport')
    if (allowCache && cachePlaylistDetail.getCache(playlistId)) {
        console.log(colors.gray('已使用缓存的歌单数据'))
        playlistDetail = cachePlaylistDetail.getCache(playlistId)
        useCache = true
    }

    if (!useCache) {
        const playlistDetailRes = await NeteaseApi.playlist_detail({
            id: playlistId,
            cookie
        })
        const playlist = playlistDetailRes?.body?.playlist
        if (playlistDetailRes?.body?.code !== 200 || !Array.isArray(playlist?.trackIds)) {
            console.error(colors.red(`[错误] 获取歌单失败 (code: ${ playlistDetailRes?.body?.code })`))
            return
        }
        playlistDetail = {
            name: String(playlist.name || ''),
            description: String(playlist.description || ''),
            coverImgUrl: String(playlist.coverImgUrl || ''),
            ids: playlist.trackIds.map(track => Number(track?.id)).filter(id => !isNaN(id))
        }
        await cachePlaylistDetail.setCache(playlistId, playlistDetail)
    }

    if (type === 'm3u8') {
        const timeString = getTimeString()
        const lines = [
            '#EXTM3U',
            `# 网易云歌单 ID：${ playlistId }`,
            ...resolveMutilines('歌单名称：', playlistDetail.name),
            ...resolveMutilines('歌单描述：', playlistDetail.description),
            `# 歌单封面：${ playlistDetail.coverImgUrl }`,
            `# 快照时间：${ timeString.date } / ${ timeString.time }`,
            `# 由 Netease Music Tools 生成 (https://github.com/CuiZhenhang/netease-music-tools)`
        ]
        for (const id of playlistDetail.ids) {
            const headerLines = ['', `# 歌曲 ID：${ id }`]
            const info = mapNeteaseId2MatchInfo.get(id)
            if (!info) {
                lines.push(...headerLines, `# [错误]：本地匹配信息找不到对应 ID`)
                console.log(colors.yellow(`[警告] `) + `本地匹配信息找不到对应 ID (ID: ${ colors.gray(String(id)) })`)
                continue
            }
            const fileName = info.fileName
            if (!existAllFile && !audioSet.has(fileName)) {
                lines.push(...headerLines, `# [错误]：找不到文件 ${ fileName }`)
                console.log(colors.yellow(`[警告] `) + `找不到文件 ${ colors.gray(fileName) }`)
                continue
            }
            const { duration, title, artist, artists /* not to use */ } = info.audioInfo || {}
            const clean = (str) => String(str || '').replaceAll(/,/g, ';').replaceAll(/\n/g, '___').trim()
            lines.push(
                ...headerLines,
                `#EXTINF:${ (duration || 10).toFixed(3) },${ clean(title) } - ${ clean(artist) }`,
                path.join(path.relative(outputFileDir, pathDir), fileName).replaceAll(/\\/g, '/')
            )
        }

        const result = lines.join('\n') // 不可以用 `\r\n`，幸好 nodejs 帮我们扛住了一切
        const safeName = String(playlistDetail.name)
            .replaceAll(/[\\/:*?"<>|]/g, '_')
            .trim()
            .replace(/^\.*|\.*$/g, '')
            || String(playlistId)
        const outputPath = path.join(outputFileDir, `${ safeName }.m3u8`)

        // 确保输出目录存在
        try {
            await fs.mkdir(outputFileDir, { recursive: true })
        } catch (error) {
            console.error(colors.red(`[错误] 创建目录失败: ${ colors.gray(error.message) }`))
            if (config.warnAll) console.error(error)
            return
        }
        await fs.writeFile(outputPath, result)

        console.log(`已创建 m3u8 文件：${ colors.gray(`${ safeName }.m3u8`) }`)
        console.log(`完整路径：${ colors.gray(path.resolve(outputPath)) }`)
    }
}

module.exports = {
    exportPlaylist
}
