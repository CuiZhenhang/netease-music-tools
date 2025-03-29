const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const config = require('./config');

function getStoragePath(appName = 'NeteaseCloudMusicTools') {
    let baseDir;

    if (process.platform === 'win32') {
        // Windows: 使用 %APPDATA%
        baseDir = process.env.APPDATA;
    } else if (process.platform === 'darwin') {
        // macOS: 使用 ~/Library/Application Support
        baseDir = path.join(os.homedir(), 'Library', 'Application Support');
    } else {
        // Linux: 使用 $XDG_CONFIG_HOME 或 ~/.config
        baseDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    }

    // 拼接应用程序特定的子目录
    const appDir = path.join(baseDir, appName);
    return appDir;
}

const storagePath = getStoragePath()
const cahceFile = path.join(storagePath, 'cache');
const ALGORITHM = 'aes-256-cbc';
const SensitiveKeyList = ['cookie'];

let cache = {
    cookie: '',
};

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, config.cacheEncryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, config.cacheEncryptionKey, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function initCache() {
    try {
        try {
            await fs.access(storagePath);
        } catch (err) {
            await fs.mkdir(storagePath, { recursive: true });
        }
        
        try {
            await fs.access(cahceFile);
        } catch (err) {
            await fs.writeFile(cahceFile, '{}');
        }
        
        const data = await fs.readFile(cahceFile, 'utf-8');
        try {
            cache = JSON.parse(data);
        } catch (error) {
            const decryptedData = decrypt(data);
            cache = JSON.parse(decryptedData);
        }
        for (const key of SensitiveKeyList) {
            if (typeof cache[key] === 'string') {
                try {
                    cache[key] = JSON.parse(decrypt(cache[key]));
                } catch (error) {
                    // do nothing
                }
            }
        }
    } catch (error) {
        console.error('初始化缓存出错:', error);
        cache = {};
    }
}

async function saveCache() {
    try {
        const cacheCopy = JSON.parse(JSON.stringify(cache));
        for (const key of SensitiveKeyList) {
            if (typeof cacheCopy[key] !== 'undefined') {
                cacheCopy[key] = encrypt(JSON.stringify(cacheCopy[key]));
            }
        }
        await fs.writeFile(cahceFile, JSON.stringify(cacheCopy), 'utf-8');
    } catch (error) {
        console.error('保存缓存出错:', error);
    }
}

function getCache(key) {
    return cache[key];
}

async function setCache(key, value) {
    cache[key] = value;
    await saveCache();
}

function setCacheNoSave(key, value) {
    cache[key] = value;
}

module.exports = {
    initCache,
    saveCache,
    getCache,
    setCache,
    setCacheNoSave,
};
