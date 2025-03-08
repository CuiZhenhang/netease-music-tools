const NeteaseApi = require('NeteaseCloudMusicApi');
const qrcode = require('qrcode');

const config = require('./config');
const cache = require('./cache');
const { sleep } = require('./utils')

async function loginQRCode() {
    const qrKey = (await NeteaseApi.login_qr_key()).body?.data?.unikey
    const qrImg = (await NeteaseApi.login_qr_create({
        key: qrKey
    })).body?.data
    // console.log(qrKey, qrImg.qrurl)
    await new Promise((resolve, reject) => {
        qrcode.toString(qrImg.qrurl, { type: 'terminal' }, (err, url) => {
            if (err) return reject(err);
            console.log(url) // 打印二维码
            console.log('请使用网易云音乐手机APP扫码登录')
            console.log('Tips: 若二维码显示不全，你可以最大化窗口，或者调整字体大小')
            console.log('你也可以通过修改 .env 文件中的 NETEASE_ACCOUNT 和 NETEASE_PASSWORD 来登录')
            resolve()
        })
    })
    return await new Promise((resolve) => {
        const handler = setInterval(async () => {
            const qrRes = (await NeteaseApi.login_qr_check({
                key: qrKey,
                time: Date.now()
            })).body
            // console.log(qrRes)
            if (qrRes?.code === 803) {
                clearInterval(handler)
                resolve(qrRes?.cookie || '')
            }
        }, 1000)
    })
}

async function login() {
    let cookie = String(cache.getCache('cookie') || '')
    let userAccountRes = await NeteaseApi.user_account({ cookie })
    if (userAccountRes?.body?.account?.anonimousUser === false) {
        console.log('旧登录状态有效，登录成功')
        return {
            cookie,
            userId: Number(userAccountRes.body.account.id)
        }
    }

    console.log('登录状态失效，请重新登录')
    await sleep(1000)

    if (config.neteaseAccount && config.neteasePasswordMD5) {
        console.log('正在使用 .env 账号密码登录')
        console.log('该功能暂未测试，可能存在问题，您可以尝试使用二维码登录')

        const re = /^(\+\d+[^\d])?(\d+)$/.exec(config.neteaseAccount)
        if (re) {
            const countryCode = re[1]?.replaceAll(/[^\d]/g, '')
            const phone = re[2]
            const mask = phone.length >= 9 ? phone.slice(0, 3) + '*'.repeat(phone.length - 7) + phone.slice(-4) : phone
            
            if (countryCode) {
                console.log(`检测为手机号登录，国家码：${ countryCode }，手机号：${ mask }`)
            } else {
                console.log(`检测为手机号登录，手机号：${ mask }`)
            }

            cookie = (await NeteaseApi.login_cellphone({
                phone: config.neteaseAccount,
                md5_password: config.neteasePasswordMD5,
                countrycode: countryCode || undefined
            })).body?.cookie || ''
        } else {
            console.log(`检测为邮箱登录，邮箱：${ config.neteaseAccount }`)
            cookie = (await NeteaseApi.login({
                email: config.neteaseAccount,
                md5_password: config.neteasePasswordMD5
            })).body?.cookie || ''
        }
    } else {
        cookie = await loginQRCode()
    }

    await cache.setCache('cookie', cookie || '')
    console.log('登录成功')
    userAccountRes = await NeteaseApi.user_account({ cookie })
    if (userAccountRes?.body?.account?.anonimousUser === false) {
        return {
            cookie,
            userId: Number(userAccountRes.body.account.id)
        }
    } else {
        throw new Error('登录失败')
    }
}

async function logout() {
    const cookie = cache.getCache('cookie')
    if (cookie) {
        await NeteaseApi.logout({ cookie })
        console.log('已清除登录状态，再次使用时请重新登录')
    } else {
        console.log('未检测到登录状态')
    }
    await cache.setCache('cookie', '')
}

module.exports = {
    login,
    logout
}
