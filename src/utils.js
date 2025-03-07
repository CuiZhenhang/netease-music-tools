const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sleep(time = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, time)
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

module.exports = {
    sleep,
    hashFile,
    CacheMap
}
