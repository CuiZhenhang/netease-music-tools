const config = require('./config');
const fs = require('fs/promises');
const path = require('path');
const { stringSimilarity } = require('string-similarity-js');
const colors = require('colors/safe');
const { sleep, hashFile, isMusicFile } = require('./utils');
const { matchAudio, standardize, cleanTitle, parseArtists } = require('./audio_match')

/**
 * @typedef { {
 *     title: string,
 *     artist: string,
 *     artists: string[],
 *     album: string,
 *     duration: number,
 *     bitrate: number,
 * } } AudioInfo
 */

/**
 * @typedef { {
 *     fileName: string,
 *     hashCode: string,
 *     neteaseId: number,
 *     audioInfo: AudioInfo, // current file info, not matched info
 *     neteaseDetail: import('NeteaseCloudMusicApi').SongDetail, // netease song detail
 * } } MatchInfo
 */

/**
 * @param { string } headline
 * @param { AudioInfo } audioInfo
 * @param { AudioInfo } targetInfo
 */
function logMatchingInfo(headline, audioInfo, targetInfo) {
    const isWarning = headline.includes('[警告]')
    const prefix = isWarning ? colors.yellow(headline) : colors.bold(headline)
    console.log(prefix)
    console.log(`\t| 当前音频：${colors.cyan(audioInfo.title)} - ${colors.cyan(parseArtists(audioInfo.artists, audioInfo.artist))} (${colors.gray(audioInfo.duration.toFixed(2) + 'ms')})`)
    console.log(`\t| 目标音频：${colors.cyan(targetInfo.title)} - ${colors.cyan(parseArtists(targetInfo.artists, targetInfo.artist))} (${colors.gray(targetInfo.duration.toFixed(2) + 'ms')})`)
}

class CacheMatchFile {
    dirPath = ''
    filePath = ''
    trashbinFilePath = ''
    data = {
        /** @type { Array<MatchInfo> } */
        files: [],
        /** @type { Array<MatchInfo> } */
        manualMatch: []
    }
    trashbinData = {
        /** @type { Array<MatchInfo> } */
        files: []
    }

    constructor(dirPath) {
        this.dirPath = dirPath
        this.filePath = path.join(dirPath, '.matched.json')
        this.trashbinFilePath = path.join(dirPath, '.matched-trashbin.json')
    }

    async load() {
        try {
            this.data = JSON.parse(await fs.readFile(this.filePath))
            if (!Array.isArray(this.data.files)) this.data.files = []
            if (!Array.isArray(this.data.manualMatch)) this.data.manualMatch = []
            this.data.files = this.data.files.filter(file => file?.fileName)
            this.data.manualMatch = this.data.manualMatch.filter(file => file?.fileName)
        } catch (error) {
            this.data = {
                files: [],
                manualMatch: []
            }
        }
        try {
            this.trashbinData = JSON.parse(await fs.readFile(this.trashbinFilePath))
            if (!Array.isArray(this.trashbinData.files)) this.trashbinData.files = []
            this.trashbinData.files = this.trashbinData.files.filter(file => file?.fileName)
        } catch (error) {
            this.trashbinData = {
                files: []
            }
        }
    }

    async saveFinal() {
        await fs.writeFile(this.filePath, JSON.stringify(this.data))
        await fs.writeFile(this.trashbinFilePath, JSON.stringify(this.trashbinData))
    }

    /**
     * @param { string[] } fileNames 
     */
    async matchFileList(fileNames) {
        /** @type { MatchInfo[] } */
        const matchedFiles = []

        // move files, and update fileNames
        const fileList = fileNames.map(fileName => ({
            fileName, hashCode: '', muti: false, matched: false
        }))

        const manualMatchMap = new Map(this.data.manualMatch.map(file => [file.fileName, file]))
        for (const obj of fileList) {
            const manualMatch = manualMatchMap.get(obj.fileName)
            if (manualMatch) {
                obj.matched = true
            }
        }
        manualMatchMap.clear() // release memory

        const cachedMapByFileName = new Map(this.data.files.map((file, index) => [file.fileName, { index, file }]))
        for (const obj of fileList) {
            const { index, file } = cachedMapByFileName.get(obj.fileName) || {}
            if (index !== undefined) {
                obj.matched = true
                matchedFiles.push(file)
                this.data.files[index] = null
            }
        }
        cachedMapByFileName.clear() // release memory
        this.data.files = this.data.files.filter(file => file !== null)

        const cachedMap = new Map(this.data.files.map((file, index) => [file.hashCode, { index, file }]))
        const cachedMapOld = new Map(this.trashbinData.files.map((file, index) => [file.hashCode, { index, file }]))
        
        const hashCodeSet = new Set()
        const fileListToHashCount = fileList.filter(obj => !obj.matched).length
        let fileHashedCount = 0
        for (const obj of fileList) {
            if (obj.matched) continue
            console.log(colors.cyan(`[匹配] `) + `正在计算文件哈希值 (${colors.yellow(`${++fileHashedCount}/${fileListToHashCount}`)}): ${colors.gray(obj.fileName)}`)
            obj.hashCode = await hashFile(path.join(this.dirPath, obj.fileName))
            if (hashCodeSet.has(obj.hashCode)) obj.muti = true
            else hashCodeSet.add(obj.hashCode)
        }
        hashCodeSet.clear() // release memory

        for (const obj of fileList) {
            const { fileName, hashCode, muti, matched } = obj
            if (muti || matched) continue
            if (cachedMap.has(hashCode)) {
                obj.matched = true
                const { index, file } = cachedMap.get(hashCode)
                file.fileName = fileName
                matchedFiles.push(file)
                this.data.files[index] = null
            } else if (cachedMapOld.has(hashCode)) {
                obj.matched = true
                const { index, file } = cachedMapOld.get(hashCode)
                file.fileName = fileName
                matchedFiles.push(file)
                this.trashbinData.files[index] = null
            }
        }
        cachedMap.clear() // release memory
        cachedMapOld.clear() // release memory

        this.data.files = this.data.files.filter(file => file !== null)
        this.trashbinData.files = this.trashbinData.files.filter(file => file !== null)

        const trashbinNewHashCodeSet = new Set(this.data.files.map(file => file.hashCode))
        this.trashbinData.files = this.trashbinData.files.filter(file => !trashbinNewHashCodeSet.has(file.hashCode))
        this.trashbinData.files.push(...this.data.files)
        this.data.files = matchedFiles

        const result = fileList
            .filter(obj => obj.matched === false && obj.muti === false)
            .map(obj => ({ fileName: obj.fileName, hashCode: obj.hashCode }))
        return result
    }

    /**
     * @param { MatchInfo[] } matchInfoList
     */
    async addMatchedFile(matchInfoList) {
        const fileNameSet = new Set(matchInfoList.map(file => file.fileName))
        this.data.files = this.data.files.filter(file => !fileNameSet.has(file.fileName))
        // const hashCodeSet = new Set(this.data.files.map(file => file.hashCode))
        for (const file of matchInfoList) {
            // if (hashCodeSet.has(file.hashCode)) continue
            this.data.files.push(file)
        }
    }

    /**
     * @param { string } fileName
     * @param { number } neteaseId
     * @param { import('NeteaseCloudMusicApi').SongDetail } neteaseDetail
     */
    async manualMatch(fileName, neteaseId, neteaseDetail) {
        const audioPath = path.join(this.dirPath, fileName)
        const audioInfo = await readAudioInfo(audioPath)
        const hashCode = await hashFile(audioPath)
        const matchInfo = {
            fileName,
            hashCode,
            neteaseId,
            audioInfo,
            neteaseDetail
        }
        let flag = false
        for (let i = 0; i < this.data.manualMatch.length; i++) {
            if (this.data.manualMatch[i].fileName === fileName) {
                this.data.manualMatch[i] = matchInfo
                flag = true
                break
            }
        }
        if (!flag) this.data.manualMatch.push(matchInfo)
        logMatchingInfo(
            `[手动匹配] 已匹配到网易云音乐 ${ fileName } <=> [ID: ${ neteaseId }]`,
            audioInfo,
            {
                title: neteaseDetail.name,
                artist: neteaseDetail.ar[0].name,
                artists: neteaseDetail.ar.map(artist => artist.name),
                album: neteaseDetail.al.name,
                duration: neteaseDetail.dt,
                bitrate: -1,
            }
        )
    }

    async isEmpty() {
        return this.data.files.length === 0
            && this.trashbinData.files.length === 0
            && this.data.manualMatch.length === 0
    }

    async updateAllAudioInfo() {
        const files = this.data.files.concat(this.data.manualMatch)
        const count = files.length
        let index = 0
        for (const file of files) {
            const audioPath = path.join(this.dirPath, file.fileName)
            try {
                console.log(colors.cyan(`[更新] `) + `正在读取音频信息 (${colors.yellow(`${++index}/${count}`)})：${colors.gray(file.fileName)}`)
                file.audioInfo = await readAudioInfo(audioPath)
                file.hashCode = await hashFile(audioPath)
            } catch (error) {
                console.error(colors.red(`[错误] `) + `读取音频信息失败：${colors.gray(file.fileName)}，原因：${colors.red(error.message || '未知')}`)
            }
        }
    }

    async clearCache() {
        this.data.files = []
        this.trashbinData.files = []
    }

    async clearManualMatch() {
        this.data.manualMatch = []
    }
}


class DB_NeteaseSongDetail {
    /**
     * @typedef { {
     *    audioInfo: AudioInfo,
     *    id: number,
     * } } NeteaseSongInfo
     */
    /** @type { NeteaseSongInfo[] } */
    neteaseSongInfoList = []
    /** @type { Map<number, import('NeteaseCloudMusicApi').SongDetail> } */
    neteaseSongDetailMap = new Map()

    /**
     * @param { import('NeteaseCloudMusicApi').SongDetail[] } songDetailList
     */
    constructor(songDetailList) {
        this.neteaseSongInfoList = songDetailList.map(detail => ({
            audioInfo: {
                title: detail.name,
                artist: detail.ar[0].name,
                artists: detail.ar.map(artist => artist.name),
                album: detail.al.name,
                duration: detail.dt,
                bitrate: -1
            },
            id: detail.id
        }))
        this.neteaseSongDetailMap = new Map(songDetailList.map(detail => [detail.id, detail]))
    }

    /**
     * @param { string[] } fileNameList 
     * @param { string } pathDir 
     */
    async matchFileList(fileNameList, pathDir) {
        const audioList = fileNameList.map(fileName => ({
            fileName,
            /** @type { AudioInfo } */
            audioInfo: null
        }))
        for (const obj of audioList) {
            const audioPath = path.join(pathDir, obj.fileName)
            obj.audioInfo = await readAudioInfo(audioPath)
        }

        /** @type { Map<string, [neteaseId: number, current: AudioInfo, target: AudioInfo]> } fileName as key */
        const matchedFiles = new Map()

        await matchAudioInfo(audioList.map(({ fileName, audioInfo }) => {
            return {
                fileName,
                audioInfo,
                match: (id, targetAudioInfo) => {
                    matchedFiles.set(fileName, [id, audioInfo, targetAudioInfo])
                    logMatchingInfo(
                        `[新匹配] 已匹配到网易云音乐 ${ fileName } <=> [ID: ${ id }]`,
                        audioInfo,
                        targetAudioInfo
                    )
                }
            }
        }), this.neteaseSongInfoList)

        return {
            matched: Array.from(matchedFiles).map(([fileName, [id, audioInfo, targetAudioInfo]]) => ({
                fileName,
                neteaseId: id,
                audioInfo,
                targetInfo: targetAudioInfo,
                neteaseDetail: this.neteaseSongDetailMap.get(id),
            })),
            unmatched: audioList.filter(obj => !matchedFiles.has(obj.fileName))
        }
    }
}

async function readAudioInfo(filePath) {
    const { parseFile } = await import('music-metadata')
    /** @type { import('music-metadata').IAudioMetadata } */
    const tags = await parseFile(filePath, { skipCovers: true })
    /** @type { AudioInfo } */
    const audioInfo = {
        title: tags.common.title || '',
        artist: tags.common.artist || '',
        artists: tags.common.artists || [],
        album: tags.common.album || '',
        duration: tags.format.duration || -1,
        bitrate: tags.format.bitrate || -1
    }
    if (audioInfo.duration !== -1 && audioInfo.duration < 3000) {
        audioInfo.duration *= 1000
    }
    return audioInfo
}

/**
 * @param { AudioInfo } audioInfo
 * @param { AudioInfo } targetInfo
 * @param { { fileName?: string, clearTitle?: string, clearTitleTarget?: string } } options
 */
async function matchSingleAudioInfo(audioInfo, targetInfo, { fileName, clearTitle, clearTitleTarget } = {}) {
    if (clearTitle === undefined) clearTitle = cleanTitle(await standardize(audioInfo.title))
    if (clearTitleTarget === undefined) clearTitleTarget = cleanTitle(await standardize(targetInfo.title))

    if (clearTitle === clearTitleTarget && audioInfo.artist === targetInfo.artist) {
        return true
    }

    const miniInfo = [
        { title: clearTitle, artist: audioInfo.artist, artists: audioInfo.artists },
    ]

    const re = /^([^-]+?)\s*-\s*([^-]+)\.[^.]{3,4}$/.exec(fileName || '')
    if (re) {
        const str1 = re[1].trim()
        const str2 = re[2].trim()
        const clearStr1 = cleanTitle(await standardize(str1))
        const clearStr2 = cleanTitle(await standardize(str2))
        if (clearTitleTarget === clearStr1 && targetInfo.artist === str2) return true
        if (clearTitleTarget === clearStr2 && targetInfo.artist === str1) return true
        miniInfo.push({ title: clearStr1, artist: str2, artists: [] })
        miniInfo.push({ title: clearStr2, artist: str1, artists: [] })
    }

    if (!re) {
        const artistsStr = parseArtists(targetInfo.artists, targetInfo.artist)
        const currentFileName = await standardize(fileName.replace(/\.[^.]{3,4}$/, ''))
        const targetFileName1 = await standardize(`${ targetInfo.title } - ${ artistsStr }`)
        const targetFileName2 = await standardize(`${ artistsStr } - ${ targetInfo.title }`)
        
        const score = Math.max(
            stringSimilarity(currentFileName, targetFileName1),
            stringSimilarity(currentFileName, targetFileName2),
        )
        if (score >= 0.9) return true
    }

    const deltaDuration = Math.abs(audioInfo.duration - targetInfo.duration)

    for (const info of miniInfo) {
        // if (deltaDuration <= 2) console.log([info, targetInfo, clearTitle, clearTitleTarget])
        const { titleScore, artists } = await matchAudio({
            title: info.title,
            artist: info.artist,
            artists: info.artists,
        }, {
            title: clearTitleTarget,
            artist: targetInfo.artist,
            artists: targetInfo.artists,
        }, {
            titleCleaned: true
        })

        if (deltaDuration < 2 && titleScore >= 0.5) return true
        if (titleScore >= 0.7 && artists.length > 0) return true
    }

    return false
}

/**
 * @param { { fileName: string, audioInfo: AudioInfo, match: (id: number, audioInfo: AudioInfo) => void }[] } _audioFileInfo 
 * @param { { id: number, audioInfo: AudioInfo }[] } _targetInfo 
 */
async function matchAudioInfo(_audioFileInfo, _targetInfo) {
    const audioFileInfo = _audioFileInfo.map(info => ({
        fileName: info.fileName,
        audioInfo: info.audioInfo,
        match: info.match,
        clearTitle: '',
    })).sort((a, b) => { return a.audioInfo.duration - b.audioInfo.duration })

    for (const info of audioFileInfo) {
        info.clearTitle = cleanTitle(await standardize(info.audioInfo.title))
    }

    const targetInfo = _targetInfo.map(info => ({
        id: info.id,
        audioInfo: info.audioInfo,
        clearTitle: '',
    })).sort((a, b) => {
        param = [a, b]
        return a.audioInfo.duration - b.audioInfo.duration
    })

    for (const info of targetInfo) {
        info.clearTitle = cleanTitle(await standardize(info.audioInfo.title))
    }

    const timeOffset = 3000 // 3000ms
    const time = [-timeOffset, 0, timeOffset]
    let indexCur = 0, rangeTar = [0, 0, 0]
    const durationCur = () => audioFileInfo[indexCur].audioInfo.duration
    const durationTar = (i) => targetInfo[rangeTar[i]].audioInfo.duration
    
    const unmatched = []
    // const unknownDuration = {
    //     audio: [],
    //     target: []
    // }

    while (rangeTar[2] < targetInfo.length && durationTar(2) < time[2]) {
        // unknownDuration.target.push(targetInfo[rangeTar[2]])
        rangeTar[2]++
    }
    rangeTar[0] = rangeTar[1] = rangeTar[2]

    while (indexCur < audioFileInfo.length && durationCur() < time[1]) {
        // unknownDuration.audio.push(audioFileInfo[indexCur])
        unmatched.push(audioFileInfo[indexCur])
        console.log(colors.yellow(`[警告] `) + `发现未知时长音频：${colors.gray(audioFileInfo[indexCur].fileName)}`)
        indexCur++
    }

    while (indexCur < audioFileInfo.length) {
        console.log(colors.cyan(`[开始匹配] `) + colors.gray(audioFileInfo[indexCur].fileName))
        
        time[0] = durationCur() - timeOffset
        time[1] = durationCur()
        time[2] = durationCur() + timeOffset
        while (rangeTar[2] < targetInfo.length && durationTar(2) < time[2]) rangeTar[2]++
        while (rangeTar[1] < rangeTar[2] && durationTar(1) < time[1]) rangeTar[1]++
        while (rangeTar[0] < rangeTar[1] && durationTar(0) < time[0]) rangeTar[0]++

        if (rangeTar[0] === rangeTar[2] && config.warnAll) {
            console.log(colors.yellow(`[警告] `) + `无时间近似音频：${colors.gray(audioFileInfo[indexCur].fileName)}`)
        }

        let l = rangeTar[1], r = rangeTar[1]
        while (true) {
            let i = -1
            if (l <= rangeTar[0] && rangeTar[2] <= r) {
                unmatched.push(audioFileInfo[indexCur])
                break
            } else if (l <= rangeTar[0]) i = r++
            else if (rangeTar[2] <= r) i = --l
            else if (targetInfo[r].audioInfo.duration - time[1] < time[1] - targetInfo[l-1].audioInfo.duration) i = r++
            else i = --l

            const audio = audioFileInfo[indexCur]
            const target = targetInfo[i]
            if (await matchSingleAudioInfo(audio.audioInfo, target.audioInfo, {
                fileName: audio.fileName,
                clearTitle: audio.clearTitle,
                clearTitleTarget: target.clearTitle
            })) {
                audio.match(target.id, target.audioInfo)
                break
            } else if (config.warnAll) {
                logMatchingInfo(
                    `[警告] 尝试匹配音频失败：${ audio.fileName }`,
                    audio.audioInfo,
                    target.audioInfo
                )
            }
        }
        indexCur++
        await sleep(5)
    }

    const targetByTitle = new Map(targetInfo.map(info => [info.clearTitle, info]))
    for (const audio of unmatched) {
        console.log(colors.cyan(`[再匹配] `) + colors.gray(audio.fileName))
        
        const target = targetByTitle.get(audio.clearTitle)
        if (target && await matchSingleAudioInfo(audio.audioInfo, target.audioInfo, {
            fileName: audio.fileName,
            clearTitle: audio.clearTitle,
            clearTitleTarget: target.clearTitle
        })) {
            audio.match(target.id, target.audioInfo)
        }
    }
}

/**
 * @param { string } pathDir 
 * @param { import('NeteaseCloudMusicApi').SongDetail[] } songDetailList 
 */
async function music_match(pathDir, songDetailList) {
    const db_netease = new DB_NeteaseSongDetail(songDetailList)
    const cacheMatch = new CacheMatchFile(pathDir)
    await cacheMatch.load()

    const files = await fs.readdir(pathDir)
    const newAudioList = await cacheMatch.matchFileList(files.filter(isMusicFile))
    const cacheMatchCount = cacheMatch.data.files.length

    const { matched, unmatched } = await db_netease.matchFileList(newAudioList.map(obj => obj.fileName), pathDir)

    const hashCodeMap = new Map(newAudioList.map(obj => [obj.fileName, obj.hashCode]))
    cacheMatch.addMatchedFile(matched.map(({ fileName, neteaseId, audioInfo, neteaseDetail }) => ({
        fileName,
        hashCode: hashCodeMap.get(fileName),
        neteaseId,
        audioInfo,
        neteaseDetail
    })))

    console.log(colors.bold('\n[匹配结果]'))
    console.log(`共计: ${colors.gray(
        cacheMatch.data.manualMatch.length
        + cacheMatchCount
        + matched.length
        + unmatched.length
    )} 个`)
    console.log(`手动匹配: ${colors.green(cacheMatch.data.manualMatch.length)} 个`)
    console.log(`缓存自动匹配: ${colors.green(cacheMatchCount)} 个`)
    console.log(`新匹配成功: ${colors.green(matched.length)} 个`)
    console.log(`匹配失败: ${colors.red(unmatched.length)} 个`)
    
    if (unmatched.length > 0) {
        console.log(colors.yellow('\n[未匹配文件]'))
        unmatched.forEach(obj => console.log(colors.gray(`- ${obj.fileName}`)))
    }

    await cacheMatch.saveFinal()
}

module.exports = {
    music_match,
    CacheMatchFile,
}
