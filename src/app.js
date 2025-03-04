const config = require('./config');
const fs = require('fs/promises');
const path = require('path');

const { initCache } = require('./cache');
const { login } = require('./login');
const NeteaseApi = require('NeteaseCloudMusicApi');

async function main() {
    try {
        await initCache();
        const cookie = await login();

        const likes = (await NeteaseApi.likelist({
            uid: config.uid,
            cookie
        })).body

        await fs.writeFile(path.join(config.dirTest, 'like.json'), JSON.stringify(likes))

        // const playlist = await NeteaseApi.playlist_track_all({
        //     id: 'unshown'
        // })
        // await fs.writeFile(path.join(config.dirTest, 'playlist.json'), JSON.stringify(playlist.body))
    } catch (error) {
        console.error(error);
    }
}

main();
