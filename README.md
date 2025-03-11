# Netease Music Tools

一个命令行工具，用于将本地音乐与网易云音乐进行匹配。也可基于匹配信息，将云信息同步到本地。

> ⚠️注意⚠️
> 
> 本项目**不具有**音乐下载、播放、解密的能力。

## 功能特点

直接匹配网易云的歌曲 ID，后续操作全部基于该 ID。

- 支持将本地音频文件与网易云音乐歌单进行匹配
- 支持匹配到"我喜欢的音乐"列表
- 支持手动匹配单个音频文件
- 支持更新音频文件元数据
- 支持从网易云下载匹配的歌词
- 支持导出网易云歌单到本地
- 智能匹配算法，考虑音频时长、标题相似度等多个因素
- 支持缓存匹配结果，避免重复匹配

## 安装

1. 安装 Node.js（推荐 v16 及以上版本，开发环境为 v20.16.0）和 Python（开发环境为 3.12.5）
2. 克隆本仓库（若已下载到本地并完成解压缩，请跳过此步）：
   ```bash
   git clone https://github.com/CuiZhenhang/netease-music-tools.git
   ```
3. 安装依赖：
   ```bash
   cd netease-music-tools
   npm install
   ```
4. 安装Python依赖（用于音频元数据更新）：\
   Windows
   ```bash
   python -m venv .\python\venv
   .\python\venv\Scripts\pip install -r .\python\requirements.txt
   ```
   Linux
   ```bash
   python -m venv ./python/venv
   ./python/venv/bin/pip install -r ./python/requirements.txt
   ```

## 使用方法

对于 Windows 用户，可以选择用 `.\netease-music-tools.cmd` 来替换 `node src/app.js`。

### 操作执行顺序

首先，将本地音乐文件**匹配**到网易云：

- 优先 `match-like` 和 `match-playlist`。
- 剩余的再 `match-manual`。

然后，可以任意顺序执行以下操作：

- 更新音乐文件的元数据（若不想更新，可跳过本步骤）：依次执行 `update-file-meta` 和 `update-info`。

- 下载歌词：`download-lyric`。

- 导出歌单：`export-playlist`，建议在满足“**文件信息最新**”的条件下使用。

只要按照以上顺序执行操作，且无新增歌曲文件，每次操作完成时“**文件信息最新**”的条件都是满足的。

未来将新增命令，用于更方便地新增文件，而不重新扫描所有文件。

### 基本命令

```bash
# 匹配整个文件夹到指定歌单
# 可简写为 m-playlist, mp
node src/app.js match-playlist <音频文件夹路径> <歌单ID>

# 匹配到"我喜欢的音乐"
# 可简写为 m-like, ml
node src/app.js match-like <音频文件夹路径>

# 手动匹配单个音频文件
# 可简写为 m-manual, mm
node src/app.js match-manual <音频文件路径> <歌曲ID>

# 更新已匹配音频的缓存信息
# 可简写为 u-info
node src/app.js update-info <音频文件夹路径>

# 更新音频文件元数据
# 可简写为 u-meta
node src/app.js update-file-meta <音频文件夹路径>

# 从网易云下载歌词，保存到同名 lrc 文件（翻译为 tran.lrc，罗马音为 roma.lrc）
# 可简写为 d-lyric, dl
node src/app.js download-lyric <音频文件夹路径>

# 利用音频文件夹的匹配信息，导出网易云歌单的数据为 m3u8 文件
# 可简写为 e-playlist, ep
node src/app.js export-playlist <音频文件夹路径> <歌单ID>
```

### 常用示例

```bash
# 匹配当前目录下的音频到歌单
node src/app.js mp . 123456

# 使用登录状态匹配歌单（可以访问私密歌单）
node src/app.js mp . 123456 -l

# 手动匹配单个音频文件
node src/app.js mm ./test.mp3 456789

# 更新音频文件元数据（会修改音乐文件，不影响音质）
node src/app.js u-meta .

# 为当前目录下已匹配的音频文件下载歌词
node src/app.js dl .

# 利用当前目录下的匹配信息，导出网易云歌单的数据为 m3u8 文件（-l 使用登录状态，可以访问私密歌单）
node src.app.js ep . 123456 -l

# 对于具体到某个命令，你可以通过 `node src/app.js <命令> -h` 来查看示例。
# 这里以参数最多的 download-lyric 为例：
node src/app.js dl -h
```

### 参数说明

- `match-playlist`（别名：`m-playlist`, `mp`）
  - `<path>`: 音频文件夹路径
  - `<id>`: 网易云音乐歌单 ID
  - `--login, -l`: 使用登录状态（可选）
  - `--cache`: 是否使用缓存（默认：true）

- `match-like`（别名：`m-like`, `ml`）
  - `<path>`: 音频文件夹路径
  - `--cache`: 是否使用缓存（默认：true）

- `match-manual`（别名：`m-manual`, `mm`）
  - `<song>`: 音频文件路径
  - `<id>`: 网易云音乐歌曲 ID
  - `--login, -l`: 使用登录状态（可选）

- `download-lyric`（别名：`d-lyric`, `dl`）
  - `<path>`: 音频文件夹路径
  - `<id>`: 网易云音乐歌单 ID
  - `--login, -l`: 使用登录状态（可选）
  - `--lazy, -z`: 懒加载模式，是否跳过已有的歌词（默认：true）
  - `--tran, -t`: 是否保存翻译歌词到本地（默认：true）
  - `--roma, -r`: 是否保存翻译歌词到本地（默认：true）
  - `--wait`: 网络请求时间间隔，单位为毫秒（ms），默认值（100）

- `export-playlist`（别名：`e-playlist`, `ep`）
  - `<path>`: 音频文件夹路径
  - `<id>`: 网易云音乐歌单 ID
  - `--output, -o`: 导出到的目标文件夹，默认为 `<path>` 文件夹下的 playlist 文件夹
  - `--login, -l`: 使用登录状态（可选）
  - `--exist, -e`: 不检查本地歌曲文件是否存在（可选）
  - `--cache`: 是否使用缓存（默认：true）

Tips: 要获取网易云歌单、歌曲的 ID，可以先在 APP 中将其以链接形式分享（可能叫做“复制链接”），这会把完整的链接复制到你的剪贴板。从这个链接中找到类似 `id=123456` 的部分（类似 `creatorId` 的不算），它后面这一串数字就是需要的 ID，长度一般不超过 20 个字符。

举例：
- 如歌单链接 `https://music.163.com/playlist?id=31083004&uct2=U2FsdGVkY1/nwSOa5ZGQvNz7Jmgtyc5cp/nokyN42JM=`，就能找到 `id=31083004`，意味着这个歌单的 ID 为 31083004。
- 如歌曲链接 `https://music.163.com/song?id=675919&uct2=U2FsdGVkX184Nat7QJNKZXWkhNi0F6oalVSDpZn52+E=`，就能找到 `id=675919`，意味着这首歌曲的 ID 为 675919。

### 其他命令

```bash
# 清除自动匹配缓存
node src/app.js clear-cache <音频文件夹路径>

# 清除手动匹配数据
node src/app.js clear-manual <音频文件夹路径>

# 退出登录
node src/app.js logout

# 开发用，执行测试内容
node src/app.js test
```

### 全局选项

- `--help, -h`: 显示帮助信息
- `--version, -v`: 显示版本信息
- `--yes, -y`: 自动回答所有问题为"是"
- `--warn, -w`: 显示额外警告信息

## 算法说明

工具使用以下因素进行音频匹配：

1. 音频时长相似度
2. 标题相似度
3. 艺术家匹配度
4. 文件名格式匹配

匹配数据会被缓存以提高后续匹配效率。如果自动匹配结果不理想，可以使用手动匹配功能。

- 当音乐文件名满足格式 `{歌名} - {歌手}` 或 `{歌手} - {歌名}` 时，可提升匹配效果（不含文件后缀名、`-` 前后空格数量任意）。

- 对于字符匹配，这些字符集会被标准化：简繁体、平假名与片假名、英文字母大小写、全半角符号（保存时仍为原数据）。

- 一个文件夹中所有的匹配数据被保存在该文件夹中 `.matched.json` 和 `.matched-trashbin.json` 中。其中 `.matched.json` 是当前已匹配的信息；`.matched-trashbin.json` 是曾经匹配成功过，但当前找不到本地的文件，正常情况下删除该文件不会有明显影响。

- 你可以利用 `.matched-trashbin.json` 将两个歌曲文件列表合并，用来源文件夹的 `.matched.json` 替换目标文件夹 `.matched-trashbin.json`，然后执行一次 `ml` 或 `mp`，就可以合并它们的自动匹配歌曲（未来将添加合并功能）。

## 注意事项

1. 支持的音频格式：MP3、FLAC

2. 元数据更新功能需要 Python 环境支持

3. 部分较大的网络数据会在本地缓存 1 小时

4. 建议在元数据更新后运行 `update-info` 命令同步本地匹配信息

5. 歌曲文件夹内的数据全部未加密，且基于相对路径，意味着你可以随意分享。

6. cookie 等敏感数据均经加密保存，密钥在项目根目录下的 `.env` 文件中，第一次运行时随机生成。以 Windows 为例，数据保存在 `%APPDATA%` 目录下 `NeteaseCloudMusicTools` 文件夹中。

## 许可证

[MIT License](LICENSE)
