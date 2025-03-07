const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(process.cwd(), '.env'))) {
    const defaultEnv = (
        'PORT=23515\n'
        + 'DIR_TEST=tests\n'
        + `CACHE_ENCRYPTION_KEY=${ require('crypto').randomBytes(16).toString('hex') }\n`
        + 'UID='
    );

    fs.writeFileSync(path.join(process.cwd(), '.env'), defaultEnv)
    console.log('未在项目根目录发现 .env 文件，已自动创建')
}

const dotenv = require('dotenv');

const result = dotenv.config()
if (result.error) {
    throw result.error
}

const requiredEnvs = ['CACHE_ENCRYPTION_KEY']
const missingEnvs = requiredEnvs.filter((env) => !process.env[env])
if (missingEnvs.length) {
    throw new Error(`缺少必须env变量：${ missingEnvs.join(', ') }`)
}

const config = {
    port: Number(process.env.PORT),
    dirTest: path.relative(process.cwd(), process.env.DIR_TEST),
    cacheEncryptionKey: process.env.CACHE_ENCRYPTION_KEY,
    warnAll: process.env.WARN_ALL === 'true',
}

module.exports = config
