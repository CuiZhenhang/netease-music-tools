const colors = require('colors/safe');
const fs = require('fs/promises');
const path = require('path');
const NeteaseApi = require('NeteaseCloudMusicApi');

const { sleep, isMusicFile } = require('./utils');
const { login } = require('./login');
const { CacheMatchFile } = require('./music_match');

/**
 * @param { string } pathDir 
 */
async function downloadLyric(pathDir, { lazy = true, noTran = false, noRoma = false, useLogin = false, wait = 100 } = {}) {
    const { cookie } = useLogin ? await login() : {}

    const cacheMatch = new CacheMatchFile(pathDir)
    await cacheMatch.load()
    if (await cacheMatch.isEmpty()) {
        console.error(colors.red('[错误] 无歌曲匹配信息'))
        return
    }
    const mapFileName2MatchInfo = await cacheMatch.getMapFileName2MatchInfo()
    
    const fileListAll = await fs.readdir(pathDir)
    const fileNameSet = new Set(fileListAll)
    let audioList = fileListAll.filter(fileName => isMusicFile(fileName))
    const audioCount = audioList.length
    let skip = 0

    if (lazy) {
        console.log(colors.gray('正在使用懒加载模式获取歌词，将自动跳过已有本地歌词的歌曲'))
        audioList = audioList.filter(fileName => {
            const name = path.basename(fileName).replace(/\.[^.]{3,4}$/, '')
            if (fileNameSet.has(`${ name }.lrc`)) return false
            if (!noTran && fileNameSet.has(`${ name }.tran.lrc`)) return false
            if (!noRoma && fileNameSet.has(`${ name }.roma.lrc`)) return false
            return true
        })
        skip = audioCount - audioList.length
    }
    if (isNaN(wait = Number(wait))) wait = 100
    if (wait < 0) wait = 0
    if (wait < 50) {
        console.log(colors.yellow(`[警告] 你正在使用一个较快的匹配速率，这可能更容易触发网易云的风控 (当前间隔 ${ wait }ms)`))
    }

    let succ = 0
    let fail = 0
    let index = 0
    for (const fileName of audioList) {
        const progressStr = '(' + colors.yellow(`${ ++index }/${ audioList.length }`) + ')'

        /** @type { import('./music_match').MatchInfo } */
        const matchInfo = mapFileName2MatchInfo.get(fileName)
        if (!matchInfo) {
            console.log(colors.yellow('[警告] ') + `${progressStr} 未发现该文件的匹配信息：${ colors.gray(fileName) }`)
            fail += 1
            continue
        }

        await sleep(wait * (0.8 + 0.2 * (Math.random() + Math.random())))
        const lyricRes = await NeteaseApi.lyric({
            id: matchInfo.neteaseId,
            cookie
        })

        if (lyricRes?.body?.code !== 200) {
            console.log(colors.yellow('[警告] ') + `${progressStr} 未找到该文件的歌词：${ colors.gray(fileName) } (code=${ lyricRes?.body?.code })`)
            fail += 1
            continue
        }

        const data = lyricRes.body || {}
        const lrc = String(data.lrc?.lyric || '')
        const lrcTran = noTran ? '' : String(data.tlyric?.lyric || '')
        const lrcRoma = noRoma ? '' : String(data.romalrc?.lyric || '')

        if (lrc.trim().length === 0) {
            console.log(colors.yellow('[警告] ') + `${progressStr} 该文件暂无歌词：${ colors.gray(fileName) }`)
            fail += 1
            continue
        }

        const name = path.basename(fileName).replace(/\.[^.]{3,4}$/, '')
        await Promise.all([
            fs.writeFile(path.join(pathDir, `${ name }.lrc`), lrc, 'utf-8'),
            lrcTran.trim().length && fs.writeFile(path.join(pathDir, `${ name }.tran.lrc`), lrcTran, 'utf-8'),
            lrcRoma.trim().length && fs.writeFile(path.join(pathDir, `${ name }.roma.lrc`), lrcRoma, 'utf-8'),
        ])
        
        const foundLyric = ['lrc']
        if (lrcTran.trim().length) foundLyric.push('tran.lrc')
        if (lrcRoma.trim().length) foundLyric.push('roma.lrc')

        console.log(colors.cyan('[歌词] ') + `${progressStr} 成功为文件 ${ colors.gray(fileName) } 找到歌词：${ foundLyric.join(', ') }`)
        succ += 1
    }

    console.log(colors.bold('\n[歌词下载结果]'))
    console.log(`共计: ${colors.gray(audioCount)} 个`)
    console.log(`跳过: ${colors.green(skip)} 个`)
    console.log(`下载成功: ${colors.green(succ)} 个`)
    console.log(`下载失败: ${colors.red(fail)} 个`)
}

module.exports = {
    downloadLyric
}
