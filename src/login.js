const cache = require('./cache');
const { sleep } = require('./utils')
const NeteaseApi = require('NeteaseCloudMusicApi');
const qrcode = require('qrcode');

async function login() {
    let cookie = String(cache.getCache('cookie') || '')
    if ((await NeteaseApi.user_account({ cookie })).body?.account?.anonimousUser === false) {
        console.log('旧登录状态有效，登录成功')
        return cookie
    }

    console.log('请使用网易云音乐APP扫码登录')
    await sleep(1000)

    const qrKey = (await NeteaseApi.login_qr_key()).body?.data?.unikey
    const qrImg = (await NeteaseApi.login_qr_create({
        key: qrKey
    })).body?.data
    // console.log(qrKey, qrImg.qrurl)
    await new Promise((resolve, reject) => {
        qrcode.toString(qrImg.qrurl, { type: 'terminal' }, (err, url) => {
            if (err) return reject(err);
            console.log(url) // 打印二维码
            console.log('Tips: 若二维码显示不全，你可以最大化窗口，或者调整字体大小')
            resolve()
        })
    })
    cookie = await new Promise((resolve) => {
        const handler = setInterval(async () => {
            const qrRes = (await NeteaseApi.login_qr_check({
                key: qrKey,
                time: Date.now()
            })).body
            // console.log(qrRes)
            if (qrRes?.code === 803) {
                clearInterval(handler)
                resolve(qrRes?.cookie)
            }
        }, 1000)
    })
    await cache.setCache('cookie', cookie)
    console.log('登录成功')
    return cookie
}

module.exports = {
    login
}
