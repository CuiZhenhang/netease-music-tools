#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const colors = require('colors/safe');
const readline = require('readline');

const path = require('path');
const NeteaseApi = require('NeteaseCloudMusicApi');

const config = require('./config');
const { initCache } = require('./cache');
const { login, logout } = require('./login');
const { music_match, CacheMatchFile } = require('./music_match');

async function confirm(msg) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise((resolve) => {
        rl.question(colors.yellow(`${msg} (y/N) `), (answer) => {
            rl.close();
            resolve(answer[0]?.toLowerCase() === 'y');
        })
    })
}

async function main() {
    const beginTime = Date.now()
    try {
        await initCache()

        const argv = yargs(hideBin(process.argv))
            .usage(colors.green('用法: $0 <命令> [选项]'))
            .example([
                [colors.green('$0 match-playlist ../audio 123456'), colors.cyan('匹配网易云音乐歌单')],
                [colors.green('$0 match-like ../audio'), colors.cyan('匹配网易云音乐我喜欢的音乐')],
                [colors.green('$0 match-manual ../audio/song.mp3 233560'), colors.cyan('手动匹配音频到网易云音乐ID')],
                [colors.green('$0 update-info ../audio'), colors.cyan('更新已匹配音频的信息')],
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
                        .example([
                            [colors.green('$0 mp ../audio 123456'), colors.cyan('匹配网易云音乐歌单')],
                            [colors.green('$0 mp ../audio 123456 -l'), colors.cyan('使用登录状态获取完整歌单')],
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
                        .option('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .example([
                            [colors.green('$0 ml ../audio'), colors.cyan('匹配网易云音乐我喜欢的音乐')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'match-like'
                }
            })
            .command({
                command: 'match-manual <song> <neteaseId> [login]',
                aliases: ['m-manual', 'mm'],
                desc: colors.cyan('手动匹配音频到网易云音乐ID'),
                builder: (yargs) => {
                    return yargs
                        .positional('song', {
                            describe: colors.yellow('音频文件路径（不是文件夹）'),
                            type: 'string'
                        })
                        .positional('neteaseId', {
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
                            [colors.green('$0 mm ../audio/song.mp3 233560'), colors.cyan('手动匹配音频到网易云音乐ID')]
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'match-manual'
                }
            })
            .command({
                command: 'update-info <path>',
                aliases: ['u-info'],
                desc: colors.cyan('更新已匹配音频的信息'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string',
                        })
                        .example([
                            [colors.green('$0 u-info ../audio'), colors.cyan('更新已匹配音频的信息')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'update-info'
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
                command: 'clear-cache <path>',
                desc: colors.gray('清除匹配缓存'),
                builder: (yargs) => {
                    return yargs
                        .positional('path', {
                            describe: colors.yellow('音频文件夹路径'),
                            type: 'string'
                        })
                        .example([
                            [colors.green('$0 clear-cache ../audio'), colors.cyan('清除匹配缓存')],
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
                            [colors.green('$0 clear-manual ../audio'), colors.cyan('清除手动匹配数据')],
                        ])
                },
                handler: (argv) => {
                    argv.operation = 'clear-manual'
                }
            })
            .option('warn', {
                describe: colors.yellow('显示额外警告信息'),
                type: 'boolean',
                default: false,
                hidden: true,
            })
            .recommendCommands()
            .demandCommand(1, colors.red('请指定要执行的命令'))
            .wrap(yargs.terminalWidth())
            .help('help', colors.yellow('显示帮助信息'))
            .alias('help', 'h')
            .version('version', colors.yellow('显示版本信息'), require('../package.json').version)
            .alias('version', 'v')
            .epilogue(colors.gray('更多信息请参考 README.MD'))
            .argv;
        
        if (argv.warn) {
            config.warnAll = true
            console.log(colors.gray('已启用额外警告信息'))
        }
        if (argv.path) {
            if (!await confirm(`请检查歌曲目录是否正确：${ path.resolve(argv.path) }`)) {
                console.log(colors.gray('已取消操作'))
                return
            }
        }
        
        switch (argv.operation) {
            case 'match-playlist':
                await matchPlaylist(path.resolve(argv.path), argv.id, argv.login)
            break
            case 'match-like':
                await matchLikeList(path.resolve(argv.path))
            break
            case 'match-manual':
                await matchManual(path.dirname(argv.song), path.basename(argv.song), argv.neteaseId, argv.login)
            break
            case 'update-info':
                await updateAllAudioInfo(path.resolve(argv.path))
            break
            case 'logout':
                if (await confirm('确认要退出登录吗？')) {
                    await logout()
                    console.log(colors.green('已成功退出登录'));
                } else {
                    console.log(colors.gray('已取消退出登录'));
                }
            break
            case 'clear-cache':
                await clearCache(path.resolve(argv.path))
            break
            case 'clear-manual':
                await clearManualMatch(path.resolve(argv.path))
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
        console.log(`\n[程序结束] 耗时 ${ ((endTime - beginTime) / 1000).toFixed(3) }s`)
    }
}

main();

async function matchPlaylist(path, playlistId, useLogin = false) {
    if (typeof playlistId !== 'number' || isNaN(playlistId)) {
        console.error(colors.red('[错误] 请提供正确的歌单ID'))
        return
    }

    const playlistRes = await NeteaseApi.playlist_track_all({
        id: playlistId,
        cookie: useLogin ? (await login()).cookie : undefined
    })
    const playlist = playlistRes?.body?.songs
    if (!Array.isArray(playlist)) {
        console.error(colors.red('[错误] 获取歌单失败'))
        return
    }

    await music_match(path, playlist)
}

async function matchLikeList(path) {
    const { cookie, userId } = await login()
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

    await music_match(path, songDetailRes.body.songs)
}

async function matchManual(path, song, neteaseId, useLogin = false) {
    if (typeof neteaseId !== 'number' || isNaN(neteaseId)) {
        console.error(colors.red('[错误] 请提供正确的网易云音乐ID'))
        return
    }
    
    const songDetailRes = await NeteaseApi.song_detail({
        ids: String(neteaseId),
        cookie: useLogin ? (await login()).cookie : undefined
    })
    if (!Array.isArray(songDetailRes?.body?.songs) || songDetailRes.body.songs.length === 0) {
        console.error(colors.red('[错误] 获取歌曲详情失败'))
        return
    }

    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    await cacheMatchFile.manualMatch(song, neteaseId, songDetailRes.body.songs[0])
    await cacheMatchFile.saveFinal()
}

async function updateAllAudioInfo(path) {
    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    if (cacheMatchFile.isEmpty()) {
        console.error(colors.yellow('[警告] 该目录下没有匹配数据'))
        return
    }
    await cacheMatchFile.updateAllAudioInfo()
    await cacheMatchFile.saveFinal()
}

async function clearCache(path) {
    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    if (cacheMatchFile.isEmpty()) {
        console.error(colors.yellow('[警告] 该目录下没有匹配数据'))
        return
    }
    await cacheMatchFile.clearCache()
    await cacheMatchFile.saveFinal()
}

async function clearManualMatch(path) {
    const cacheMatchFile = new CacheMatchFile(path)
    await cacheMatchFile.load()
    if (cacheMatchFile.isEmpty()) {
        console.error(colors.yellow('[警告] 该目录下没有匹配数据'))
        return
    }
    await cacheMatchFile.clearManualMatch()
    await cacheMatchFile.saveFinal()
}
