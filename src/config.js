const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoDir = path.resolve(__dirname, '../')

if (!fs.existsSync(path.join(repoDir, '.env'))) {
    const defaultEnv = (
        'PORT=23515\n'
        + 'DIR_TEST=tests\n'
        + 'NETEASE_ACCOUNT=\n'
        + 'NETEASE_PASSWORD=\n'
        + `CACHE_ENCRYPTION_KEY=${ require('crypto').randomBytes(16).toString('hex') }\n`
        + 'WARN_ALL=false\n'
        + 'YES_ALL=false\n'
    );

    fs.writeFileSync(path.join(repoDir, '.env'), defaultEnv)
    console.log('未在项目根目录发现 .env 文件，已自动创建')
}

const dotenv = require('dotenv');

const result = dotenv.config({
    path: path.join(repoDir, '.env'),
})
if (result.error) {
    throw result.error
}

const requiredEnvs = ['CACHE_ENCRYPTION_KEY']
const missingEnvs = requiredEnvs.filter((env) => !process.env[env])
if (missingEnvs.length) {
    throw new Error(`缺少必须env变量：${ missingEnvs.join(', ') }`)
}

const config = {
    repoDir,
    port: Number(process.env.PORT),
    dirTest: path.resolve(repoDir, process.env.DIR_TEST),
    neteaseAccount: process.env.NETEASE_ACCOUNT,
    neteasePasswordMD5: ((password) => {
        password = (password || '').trim()
        if (!password) return ''
        return crypto.createHash('md5').update(password).digest('hex')
    })(process.env.NETEASE_PASSWORD || ''),
    cacheEncryptionKey: process.env.CACHE_ENCRYPTION_KEY,
    warnAll: process.env.WARN_ALL === 'true',
    yesAll: process.env.YES_ALL === 'true',
    expire: 1000 * 60 * 60, // 1 hour
}

module.exports = config
