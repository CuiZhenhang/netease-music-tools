#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const colors = require('colors/safe');

const path = require('path');
const NeteaseApi = require('NeteaseCloudMusicApi');

const config = require('./config');
const cache = require('./cache');
const { login, logout } = require('./login');
const { confirm, ExpireCacheDict } = require('./utils');
const { music_match, CacheMatchFile } = require('./music_match');
const { downloadLyric } = require('./lyric');
const { exportPlaylist } = require('./playlist');

async function main() {
    const beginTime = Date.now()
    try {
        const argv = yargs(hideBin(process.argv))
            .usage(colors.green('用法: $0 <命令> [选项]'))
            .example([
                [colors.green('$0 match-playlist ../audio 123456'), colors.cyan('匹配 ../audio 文件夹到网易云歌单 (ID: 123456)')],
                [colors.green('$0 match-like ../audio'), colors.cyan('匹配 ../audio 文件夹到网易云我喜欢的音乐')],
                [colors.green('$0 match-manual ../audio/song.mp3 233560'), colors.cyan('手动匹配音频 ../audio/song.mp3 到网易云歌曲 (ID: 233560)')],
                [colors.green('$0 update-info ../audio'), colors.cyan('更新 ../audio 文件夹中已匹配音频的缓存信息')],
                [colors.green('$0 update-file-meta ../audio'), colors.cyan('更新 ../audio 文件夹中音频文件的元数据')],
                [colors.green('$0 download-lyric ../audio'), colors.cyan('对 ../audio 文件夹中已匹配的音频下载歌词')],
                [colors.green('$0 export-playlist ../audio 123456'), colors.cyan('利用 ../audio 文件夹的匹配信息，导出网易云歌单 (ID: 123456) 的数据为 m3u8 文件')],
            ])
            .command({
                command: 'match-playlist <path> <id> [login]',
                aliases: ['m-playlist', 'mp'],
                desc: colors.cyan('匹配网易云音乐歌单'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string'
                        })
                        .positional('id', {
                            describe: colors.yellow('歌单ID'),
                            type: 'number'
                        })
                        .option('login', {
                            alias: 'l',
                            describe: colors.yellow('使用登录状态获取完整歌单'),
                            type: 'boolean',
                            default: false
                        })
                        .option('cache', {
                            describe: colors.yellow('允许使用缓存的网络数据'),
                            type: 'boolean',
                            default: true
                        })
                        .example([
                            [colors.green('$0 mp ../audio 123456'), colors.cyan('匹配 ../audio 文件夹到网易云歌单 (ID: 123456)')],
                            [colors.green('$0 mp ../audio 123456 -l'), colors.cyan('区别：使用登录状态')],
                            [colors.green('$0 mp ../audio 123456 --no-cache'), colors.cyan('区别：不使用缓存的网络数据')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'match-playlist'
                }
            })
            .command({
                command: 'match-like <path>',
                aliases: ['m-like', 'ml'],
                desc: colors.cyan('匹配网易云音乐我喜欢的音乐'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .option('cache', {
                            describe: colors.yellow('允许使用缓存的网络数据'),
                            type: 'boolean',
                            default: true
                        })
                        .example([
                            [colors.green('$0 ml ../audio'), colors.cyan('匹配 ../audio 文件夹到网易云我喜欢的音乐')],
                            [colors.green('$0 ml ../audio --no-cache'), colors.cyan('区别：不使用缓存的网络数据')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'match-like'
                }
            })
            .command({
                command: 'match-manual <song> <id> [login]',
                aliases: ['m-manual', 'mm'],
                desc: colors.cyan('手动匹配音频到网易云音乐'),
                builder: (yargs) => {
                    return yargs
                        .positional('song', {
                            describe: colors.yellow('音频文件路径（不是文件夹）'),
                            type: 'string'
                        })
                        .positional('id', {
                            describe: colors.yellow('网易云音乐ID'),
                            type: 'number'
                        })
                        .option('login', {
                            alias: 'l',
                            describe: colors.yellow('使用登录状态获取完整歌曲信息'),
                            type: 'boolean',
                            default: false
                        })
                        .example([
                            [colors.green('$0 mm ../audio/song.mp3 233560'), colors.cyan('手动匹配音频 ../audio/song.mp3 到网易云歌曲 (ID: 233560)')]
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'match-manual'
                }
            })
            .command({
                command: 'update-info <path>',
                aliases: ['u-info'],
                desc: colors.cyan('更新已匹配音频的缓存信息'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .example([
                            [colors.green('$0 u-info ../audio'), colors.cyan('更新 ../audio 文件夹中已匹配音频的缓存信息')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'update-info'
                }
            })
            .command({
                command: 'update-file-meta <path>',
                aliases: ['u-meta'],
                desc: colors.cyan('更新音频文件元数据'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .example([
                            [colors.green('$0 u-meta ../audio'), colors.cyan('更新 ../audio 文件夹中音频文件的元数据')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'update-file-meta'
                }
            })
            .command({
                command: 'download-lyric <path> [login]',
                aliases: ['d-lyric', 'dl'],
                desc: colors.cyan('从网易云下载歌词'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .option('login', {
                            alias: 'l',
                            describe: colors.yellow('使用登录状态以应对速率检测'),
                            type: 'boolean',
                            default: false
                        })
                        .option('lazy', {
                            alias: 'z',
                            describe: colors.yellow('懒加载模式，跳过已有的歌词'),
                            type: 'boolean',
                            default: true
                        })
                        .option('tran', {
                            alias: 't',
                            describe: colors.yellow('是否加载翻译歌词，以 .tran.lrc 为文件后缀'),
                            type: 'boolean',
                            default: true
                        })
                        .option('roma', {
                            alias: 'r',
                            describe: colors.yellow('是否加载罗马音歌词，以 .roma.lrc 为文件后缀'),
                            type: 'boolean',
                            default: true
                        })
                        .option('wait', {
                            describe: colors.yellow('匹配时间间隔 (ms)'),
                            type: 'number',
                            default: 100
                        })
                        .example([
                            [colors.green('$0 dl ../audio'), colors.cyan('对 ../audio 文件夹中已匹配的音频下载歌词')],
                            [colors.green('$0 dl ../audio -l'), colors.cyan('区别：使用登录状态')],
                            [colors.green('$0 dl ../audio -z=0'), colors.cyan('区别：更新所有歌词')],
                            [colors.green('$0 dl ../audio -t=0 -r=0'), colors.cyan('区别：不加载翻译和罗马音歌词')],
                            [colors.green('$0 dl ../audio --wait=500'), colors.cyan('区别：调整时间间隔为 500ms 以避免风控')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'download-lyric'
                }
            })
            .command({
                command: 'export-playlist <path> <id> [output] [login]',
                aliases: ['e-playlist', 'ep'],
                desc: colors.cyan('导出网易云歌单到本地'),
                builder: (argv) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .positional('id', {
                            describe: colors.yellow('歌单ID'),
                            type: 'number'
                        })
                        .option('output', {
                            alias: 'o',
                            describe: colors.yellow('导出到的目标文件夹，默认为 <path> 文件夹下的 playlist 文件夹'),
                            type: 'string',
                        })
                        .option('login', {
                            alias: 'l',
                            describe: colors.yellow('使用登录状态获取完整歌曲信息'),
                            type: 'boolean',
                            default: false
                        })
                        .option('exist', {
                            alias: 'e',
                            describe: colors.yellow('不检查本地歌曲文件是否存在'),
                            type: 'boolean',
                            default: false
                        })
                        .option('cache', {
                            describe: colors.yellow('允许使用缓存的网络数据'),
                            type: 'boolean',
                            default: true
                        })
                        .example([
                            [colors.green('$0 ep ../audio 123456'), colors.cyan('利用 ../audio 文件夹的匹配信息，导出网易云歌单 (ID: 123456) 的数据为 m3u8 文件')],
                            [colors.green('$0 ep ../audio 123456 --output=../my-playlist'), colors.cyan('区别：m3u8 文件导出在 ../my-playlist 文件夹下')],
                            [colors.green('$0 ep ../audio 123456 -o ../my-playlist'), colors.cyan('区别：m3u8 文件导出在 ../my-playlist 文件夹下')],
                            [colors.green('$0 ep ../audio 123456 -l'), colors.cyan('区别：使用登录状态')],
                            [colors.green('$0 ep ../audio 123456 -e'), colors.cyan('区别：不检查本地歌曲文件是否存在')],
                            [colors.green('$0 ep ../audio 123456 --no-cache'), colors.cyan('区别：不使用缓存的网络数据')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'export-playlist'
                }
            })
            .command({
                command: 'clear-cache <path>',
                desc: colors.gray('清除自动匹配缓存'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string'
                        })
                        .example([
                            [colors.green('$0 clear-cache ../audio'), colors.cyan('清除 ../audio 文件夹中的自动匹配缓存')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'clear-cache'
                }
            })
            .command({
                command: 'clear-manual <path>',
                desc: colors.gray('清除手动匹配数据'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string'
                        })
                        .example([
                            [colors.green('$0 clear-manual ../audio'), colors.cyan('清除 ../audio 文件夹中的手动匹配数据')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'clear-manual'
                }
            })
            .command({
                command: 'logout',
                desc: colors.gray('清除网易云登录状态'),
                handler: (argv) => {
                    argv.operation = 'logout'
                }
            })
            .command({
                command: 'test',
                desc: false,
                handler: (argv) => {
                    argv.operation = 'test'
                }
            })
            .option('warn', {
                alias: 'w',
                describe: colors.yellow('显示额外警告信息'),
                type: 'boolean',
                default: false,
                hidden: true,
            })
            .option('yes', {
                alias: 'y',
                describe: colors.gray('自动回答所有问题为是'),
                type: 'boolean',
                default: false,
            })
            .recommendCommands()
            .demandCommand(1, colors.red('请指定要执行的命令'))
            .wrap(yargs.terminalWidth())
            .help('help', colors.gray('显示帮助信息'))
            .alias('help', 'h')
            .version('version', colors.gray('显示版本信息'), require('../package.json').version)
            .alias('version', 'v')
            .epilogue(colors.gray('更多信息请参考 README.md'))
            .locale('zh_CN')
            .argv;
        
        if (argv.warn) {
            config.warnAll = true
            console.log(colors.gray('已启用额外警告信息'))
        }
        if (argv.yes) {
            config.yesAll = true
            console.log(colors.gray('已启用自动回答所有问题为是'))
        }
        if (argv.path) {
            if (!await confirm(`请检查歌曲目录是否正确：${ colors.gray(path.resolve(argv.path)) }`)) {
                console.log(colors.gray('已取消操作'))
                return
            }
        }

        await cache.initCache()

        switch (argv.operation) {
            case 'match-playlist':
                await matchPlaylist(path.resolve(argv.path), argv.id, argv.login, argv.cache)
            break
            case 'match-like':
                await matchLikeList(path.resolve(argv.path), argv.cache)
            break
            case 'match-manual':
                await matchManual(path.dirname(argv.song), path.basename(argv.song), argv.id, argv.login)
            break
            case 'update-info':
                await updateAllAudioInfo(path.resolve(argv.path))
            break
            case 'clear-cache':
                await clearCacheMatch(path.resolve(argv.path))
            break
            case 'clear-manual':
                await clearManualMatch(path.resolve(argv.path))
            break
            case 'logout':
                if (await confirm('确认要退出登录吗？')) await logout()
                else console.log(colors.gray('已取消操作'));
            break
            case 'update-file-meta':
                if (await confirm('确认要更新音频文件元数据吗？这将覆盖大部分原有的元数据')) {
                    await updateFileMeta(path.resolve(argv.path))
                } else {
                    console.log(colors.gray('已取消操作'))
                }
            break
            case 'download-lyric':
                await downloadLyric(path.resolve(argv.path), {
                    lazy: argv.lazy,
                    noTran: !argv.tran,
                    noRoma: !argv.roma,
                    useLogin: argv.login,
                    wait: argv.wait
                })
            break
            case 'export-playlist':
                const outputFileDir = argv.output ? path.resolve(argv.output) : undefined
                if (outputFileDir && !await confirm(`请检查导出目录是否正确：${colors.gray(outputFileDir) }`)) {
                    console.log(colors.gray('已取消操作'))
                    return
                }
                await exportPlaylist(path.resolve(argv.path), argv.id, {
                    outputFileDir,
                    useLogin: argv.login,
                    existAllFile: argv.exist,
                    allowCache: argv.cache
                })
            break
            case 'test':
                console.log(colors.gray('于是什么都没有发生'))
                // const playlistDetailRes = await NeteaseApi.playlist_detail({
                //     id: 123456,
                //     // cookie: useLogin ? (await login()).cookie : undefined
                // })
                // await require('fs/promises').writeFile(path.join(config.dirTest, 'playlist_detail.json'), JSON.stringify(playlistDetailRes.body))
            break
        }
    } catch (error) {
        console.error(colors.red(error.name ? `[错误 (${ error.name })]` : '[错误]'), error.message)
        if (error.response) {
            console.error('[详细信息]', error.response.body || error.response)
        }
        if (config.warnAll) console.error(error.stack)
        process.exit(1)
    } finally {
        const endTime = Date.now()
        console.log(`\n[程序结束] 耗时 ${ ((endTime - beginTime) / 1000).toFixed(3) }s (含用户交互时间)`)
    }
}

main();

async function matchPlaylist(path, playlistId, useLogin = false, allowCache = true) {
    if (typeof playlistId !== 'number' || isNaN(playlistId)) {
        console.error(colors.red('[错误] 请提供正确的歌单ID'))
        return
    }

    let useCache = false
    let playlist = []
    const cachePlaylist = new ExpireCacheDict('playlist')
    if (allowCache && cachePlaylist.getCache(playlistId)) {
        console.log(colors.gray('已使用缓存的歌单数据'))
        playlist = cachePlaylist.getCache(playlistId)
        useCache = true
    }

    if (!useCache) {
        const playlistRes = await NeteaseApi.playlist_track_all({
            id: playlistId,
            cookie: useLogin ? (await login()).cookie : undefined
        })
        playlist = playlistRes?.body?.songs
        if (!Array.isArray(playlist)) {
            console.error(colors.red('[错误] 获取歌单失败'))
            return
        }
        await cachePlaylist.setCache(playlistId, playlist)
    }

    await music_match(path, playlist)
}

async function matchLikeList(path, allowCache = true) {
    const { cookie, userId } = await login()

    let useCache = false
    let likesDetail = []
    const cacheLikesDetail = new ExpireCacheDict('likesDetail')
    if (allowCache && cacheLikesDetail.getCache(userId)) {
        console.log(colors.gray('已使用缓存的喜欢的音乐数据'))
        likesDetail = cacheLikesDetail.getCache(userId)
        useCache = true
    }

    if (!useCache) {
        const likesRes = (await NeteaseApi.likelist({
            uid: userId,
            cookie
        }))
        if (!likesRes?.body?.ids) {
            console.error(colors.red('[错误] 获取喜欢的音乐失败'))
            return
        }

        const songDetailRes = await NeteaseApi.song_detail({
            ids: likesRes.body.ids.join(','),
            cookie
        })
        if (!Array.isArray(songDetailRes?.body?.songs)) {
            console.error(colors.red('[错误] 获取喜欢的音乐详情失败'))
            return
        }
        likesDetail = songDetailRes.body.songs
        await cacheLikesDetail.setCache(userId, likesDetail)
    }

    await music_match(path, likesDetail)
}

async function matchManual(path, song, songId, useLogin = false) {
    if (typeof songId !== 'number' || isNaN(songId)) {
        console.error(colors.red('[错误] 请提供正确的网易云音乐ID'))
        return
    }
    
    const songDetailRes = await NeteaseApi.song_detail({
        ids: String(songId),
        cookie: useLogin ? (await login()).cookie : undefined
    })
    if (!Array.isArray(songDetailRes?.body?.songs) || songDetailRes.body.songs.length === 0) {
        console.error(colors.red('[错误] 获取歌曲详情失败'))
        return
    }

    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    await cacheMatchFile.manualMatch(song, songId, songDetailRes.body.songs[0])
    await cacheMatchFile.saveFinal()
}

async function updateAllAudioInfo(path) {
    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    if (await cacheMatchFile.isEmpty()) {
        console.error(colors.yellow('[警告] 该目录下没有匹配数据'))
        return
    }
    await cacheMatchFile.updateAllAudioInfo()
    await cacheMatchFile.saveFinal()
}

async function clearCacheMatch(path) {
    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    if (await cacheMatchFile.isEmpty()) {
        console.error(colors.yellow('[警告] 该目录下没有匹配数据'))
        return
    }
    await cacheMatchFile.clearCache()
    await cacheMatchFile.saveFinal()
}

async function clearManualMatch(path) {
    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    if (await cacheMatchFile.isEmpty()) {
        console.error(colors.yellow('[警告] 该目录下没有匹配数据'))
        return
    }
    await cacheMatchFile.clearManualMatch()
    await cacheMatchFile.saveFinal()
}

async function updateFileMeta(pathAudio) {
    const { spawn } = require('child_process');
    const pythonPath = path.join(config.repoDir, process.platform === 'win32' ? 'python/venv/Scripts/python' : 'python/venv/bin/python')
    const pythonProcess = spawn(pythonPath, [
        '-X', 'utf8',
        path.join(config.repoDir, 'python/scripts/update_meta.py'),
        pathAudio
    ], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })

    /** @type { (mutiline: string) => string } */
    const pyFormat = (mutiline, prefix) => {
        return prefix + mutiline.replaceAll(/\n/g, '\n' + prefix)
    }

    pythonProcess.stdout.on('data', (data) => {
        console.log(pyFormat(data.toString(), colors.gray('python| ')))
    })
    pythonProcess.stderr.on('data', (data) => {
        console.log(pyFormat(data.toString(), colors.red('python| ')))
    })

    await new Promise((resolve, reject) => {
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`Python脚本执行失败，退出码: ${code}`))
            }
        })
    })

    // console.log(colors.yellow('已修改歌曲元数据，建议执行 update-info 以同步本地匹配信息'))
    if (await confirm('已修改歌曲元数据，是否执行 update-info 以同步本地匹配信息？')) {
        await updateAllAudioInfo(pathAudio)
    }
    console.log(colors.gray('已完成操作'))
}
