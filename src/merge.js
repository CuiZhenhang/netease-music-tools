const colors = require('colors/safe');
const fs = require('fs/promises');
const path = require('path');

const { sleep, isMusicFile } = require('./utils');
const { CacheMatchFile } = require('./music_match');
const config = require('./config');

/**
 * @param { string } targetDir 
 * @param { string } sourceDir 
 * @param { object } options
 * @param { boolean } options.copy 是否复制文件
 * @param { boolean } options.overwrite 对于相同的文件，是否覆盖
 * @param { boolean } options.musicFileOnly 是否只处理音乐文件
 * @returns { Promise<void> }
 */
async function mergeMatch(targetDir, sourceDir, { copy = false, overwrite = false, musicFileOnly = false } = {}) {
    if (targetDir === sourceDir) {
        console.error(colors.red('[错误] 目标目录和源目录相同，请检查参数'))
        return
    }

    const targetMatch = new CacheMatchFile(targetDir)
    const sourceMatch = new CacheMatchFile(sourceDir)
    await targetMatch.load()
    await sourceMatch.load()

    const targetFileNameSet = new Set(await fs.readdir(targetDir))

    const fileListAll = await fs.readdir(sourceDir)
    const fileNameSet = new Set(fileListAll)
    const fileListSorted = fileListAll.slice().sort()

    /** @type { (fileName: string, baseName: string) => boolean } */
    const matchBaseName = (fileName, baseName) => {
        if (!fileName.startsWith(baseName)) return false
        const ext = fileName.slice(baseName.length).trim()
        if (ext.length === 0) return true
        return /^(?:\.[0-9a-zA-Z]+)+$/.test(ext)
    }
    /** @type { (baseName: string) => string[] } */
    const getFileListByBaseName = (baseName) => {
        let l = 0, r = fileListSorted.length - 1
        while (r - l + 1 > 4) {
            const mid = Math.floor((l + r) / 2)
            if (fileListSorted[mid] < baseName) l = mid + 1
            else r = mid
        }
        while (l <= r && !matchBaseName(fileListSorted[l], baseName)) l++
        while (l <= r && !matchBaseName(fileListSorted[r], baseName)) r--
        if (l > r) return []
        while (0 <= l - 1 && matchBaseName(fileListSorted[l - 1], baseName)) l--
        while (r + 1 < fileListSorted.length && matchBaseName(fileListSorted[r + 1], baseName)) r++
        return fileListSorted.slice(l, r + 1)
    }

    /**
     * @param { Array<import('./music_match').MatchInfo> } targetData 
     * @param { Array<import('./music_match').MatchInfo> } sourceData 
     */
    const merge = async (targetData, sourceData) => {
        const mapTargetFileName2Index = new Map(targetData.map((obj, index) => [obj.fileName, index]))
        const mapSourceFileName2Index = new Map(sourceData.map((obj, index) => [obj.fileName, index]))
        for (const info of sourceData) {
            const fileName = info.fileName
            if (!fileNameSet.has(fileName)) {
                console.log(colors.yellow(`[警告] ${ colors.gray(fileName) } 不存在于目录 ${ colors.gray(` (${sourceDir})`) }`))
                continue
            }
            console.log(colors.cyan(`[匹配] ${ fileName }`))
            const ext = path.extname(fileName)
            const baseName = path.basename(fileName, ext)
            const fileList = getFileListByBaseName(baseName)
            try {
                for (const file of fileList) {
                    const musicFileCheck = isMusicFile(file)
                    if (musicFileOnly && !musicFileCheck) continue
                    const sourcePath = path.join(sourceDir, file)
                    const targetPath = path.join(targetDir, file)
                    if (!overwrite && targetFileNameSet.has(file)) {
                        console.log(colors.yellow(`\t| [跳过] ${file} 已存在`))
                        continue
                    }
                    
                    targetFileNameSet.add(file)
                    if (musicFileCheck) {
                        const index = mapTargetFileName2Index.get(fileName)
                        if (typeof index === 'number') {
                            targetData[index] = JSON.parse(JSON.stringify(info))
                        } else {
                            targetData.push(JSON.parse(JSON.stringify(info)))
                        }
                    }
                    if (copy) {
                        await fs.copyFile(sourcePath, targetPath)
                        console.log(colors.cyan(`\t| [复制] ${file}`))
                    } else {
                        await fs.rename(sourcePath, targetPath)
                        fileNameSet.delete(file)
                        if (musicFileCheck) {
                            const index = mapSourceFileName2Index.get(fileName)
                            if (typeof index === 'number') {
                                sourceData[index] = null
                            }
                        }
                        console.log(colors.cyan(`\t| [移动] ${file}`))
                    }
                }
            } catch (error) {
                console.error(colors.red(`\t| [错误] ${fileName} 发生错误：${error.message}`))
                if (config.warnAll) console.error(error.stack)
            }
            await sleep(10)
        }
    }

    await merge(targetMatch.data.files, sourceMatch.data.files)
    await merge(targetMatch.data.manualMatch, sourceMatch.data.manualMatch)
    sourceMatch.data.files = sourceMatch.data.files.filter(obj => obj !== null)
    sourceMatch.data.manualMatch = sourceMatch.data.manualMatch.filter(obj => obj !== null)

    await targetMatch.saveFinal()
    await sourceMatch.saveFinal()

    console.log(colors.green(`[成功] 合并完成`))
}

module.exports = {
    mergeMatch
}
