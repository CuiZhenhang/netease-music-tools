const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const colors = require('colors/safe');
const readline = require('readline');

const config = require('./config');
const cache = require('./cache');

function sleep(time = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, time)
    })
}

/**
 * @param { string } msg 
 * @returns { Promise<boolean> }
 */
async function confirm(msg) {
    if (config.yesAll) {
        console.log(colors.gray(`[自动回答] ${msg} (y)`))
        return true
    }
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return await new Promise((resolve) => {
        rl.question(colors.yellow(`${msg} (y/N) `), async (answer) => {
            rl.close()
            const ok = answer[0]?.toLowerCase() === 'y'
            if (ok) await sleep(300)
            resolve(ok)
        })
    })
}

/**
 * @param { fs.PathLike } filePath
 * @param { string } [algorithm]
 * @returns { Promise<string> }
 */
function hashFile(filePath, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm)
    const stream = fs.createReadStream(filePath)
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => {
            hash.update(chunk)
        })
        stream.on('end', () => {
            resolve(hash.digest('hex'))
        })
        stream.on('error', reject)
    })
}

class CacheMap {
    data = new Map()
    queue = {
        v: [],
        l: 0,
        r: 0
    }
    maxSize = 1000

    constructor(maxSize = 1000) {
        this.maxSize = maxSize
    }

    has(key) {
        return this.data.has(key)
    }

    get(key) {
        return this.data.get(key)
    }

    set(key, value) {
        if (this.data.size >= this.maxSize) {
            const delCount = Math.ceil(this.maxSize / 5)
            for (let i = 0; i < delCount; i++) {
                this.data.delete(this.queue.v[this.queue.l])
                this.queue.l++
            }
            if (this.queue.l >= this.maxSize) {
                this.queue.v = this.queue.v.slice(this.queue.l)
                this.queue.l = 0
                this.queue.r = this.queue.v.length
            }
        }
        const oldSize = this.data.size
        this.data.set(key, value)
        if (this.data.size > oldSize) {
            this.queue.v[this.queue.r] = key
            this.queue.r++
        }
    }

    clear() {
        this.data.clear()
        this.queue = {
            v: [],
            l: 0,
            r: 0
        }
    }

}

class ExpireCacheDict {
    key = ''
    dict = {}

    constructor(key) {
        if (typeof key !== 'string') throw new TypeError('ExpireCacheDict(key): key must be string')
        this.key = key
        this.dict = cache.getCache(key) || {}
    }
    
    getCache(key) {
        if (Date.now() - this.dict[key]?.time <= config.expire) {
            return this.dict[key].data
        }
    }

    setCacheNoSave(key, value) {
        this.dict[key] = {
            data: value,
            time: Date.now()
        }
    }

    async setCache(key, value) {
        this.setCacheNoSave(key, value)
        await this.save()
    }

    async save() {
        const now = Date.now()
        for (const key in this.dict) {
            if (now - this.dict[key]?.time <= config.expire) continue
            delete this.dict[key]
        }
        await cache.setCache(this.key, this.dict)
    }
}

function isMusicFile(fileName) {
    if (typeof fileName !== 'string') return false
    return fileName.toLowerCase().endsWith('.mp3')
        || fileName.toLowerCase().endsWith('.flac')
}

function getTimeString(time = Date.now()) {
    const date = new Date(time)
    return {
        date: `${ date.getFullYear() }-${ date.getMonth() + 1 }-${ date.getDate() }`,
        time: `${ date.getHours() }:${ date.getMinutes() }:${ date.getSeconds() }`
    }
}

module.exports = {
    sleep,
    confirm,
    hashFile,
    CacheMap,
    ExpireCacheDict,
    isMusicFile,
    getTimeString,
}
