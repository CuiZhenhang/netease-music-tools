#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const colors = require('colors/safe');

const path = require('path');
const NeteaseApi = require('NeteaseCloudMusicApi');

const config = require('./config');
const cache = require('./cache');
const { login, logout } = require('./login');
const { confirm } = require('./utils');
const { music_match, CacheMatchFile } = require('./music_match');

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
                            [colors.green('$0 mp ../audio 123456 -l'), colors.cyan('匹配 ../audio 文件夹到网易云歌单 (ID: 123456) 使用登录状态')],
                            [colors.green('$0 mp ../audio 123456 --no-cache'), colors.cyan('匹配 ../audio 文件夹到网易云歌单 (ID: 123456) 不使用缓存的网络数据')],
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
                            [colors.green('$0 ml ../audio --no-cache'), colors.cyan('匹配 ../audio 文件夹到网易云我喜欢的音乐、不使用缓存的网络数据')],
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
            if (!await confirm(`请检查歌曲目录是否正确：${ path.resolve(argv.path) }`)) {
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
    const cachePlaylist = cache.getCache('playlist') || {}
    if (allowCache && cachePlaylist[playlistId]) {
        const { data, time } = cachePlaylist[playlistId]
        if (!Array.isArray(data) || data.length === 0 || Date.now() - time >= 1000 * 60 * 60 /* 1 hour */) {
            delete cachePlaylist[playlistId]
        }
        console.log(colors.gray('已使用缓存的歌单数据'))
        playlist = data
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
    }

    await music_match(path, playlist)

    if (!useCache) {
        cachePlaylist[playlistId] = {
            data: playlist,
            time: Date.now()
        }
        for (const id in cachePlaylist) {
            if (Date.now() - cachePlaylist[id].time >= 1000 * 60 * 60 /* 1 hour */) {
                delete cachePlaylist[id]
            }
        }
        await cache.setCache('playlist', cachePlaylist)
    }
}

async function matchLikeList(path, allowCache = true) {
    const { cookie, userId } = await login()

    let useCache = false
    let likesDetail = []
    const cacheLikesDetail = cache.getCache('likesDetail') || {}
    if (allowCache && cacheLikesDetail[userId]) {
        const { data, time } = cacheLikesDetail[userId]
        if (!Array.isArray(data) || data.length === 0 || Date.now() - time >= 1000 * 60 * 60 /* 1 hour */) {
            delete cacheLikesDetail[userId]
        }
        console.log(colors.gray('已使用缓存的喜欢的音乐数据'))
        likesDetail = data
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
    }

    await music_match(path, likesDetail)

    if (!useCache) {
        cacheLikesDetail[userId] = {
            data: likesDetail,
            time: Date.now()
        }
        for (const id in cacheLikesDetail) {
            if (Date.now() - cacheLikesDetail[id].time >= 1000 * 60 * 60 /* 1 hour */) {
                delete cacheLikesDetail[id]
            }
        }
        await cache.setCache('likesDetail', cacheLikesDetail)
    }
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

async function updateFileMeta(path) {
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python/venv/Scripts/python', [
        '-X', 'utf8',
        'python/scripts/update_meta.py',
        path
    ], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })

    /** @type { (mutiline: string) => string } */
    const pyFormat = (mutiline, pyMark) => {
        return pyMark + mutiline.replaceAll(/\n/g, '\n' + pyMark)
    }

    pythonProcess.stdout.on('data', (data) => {
        console.log(pyFormat(data.toString(), colors.gray('python|')))
    })
    pythonProcess.stderr.on('data', (data) => {
        console.log(pyFormat(data.toString(), colors.red('python|')))
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

    console.log(colors.yellow('已修改歌曲元数据，建议执行 update-info 以同步本地匹配信息'))
}
