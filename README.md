# Netease Music Tools

一个命令行工具，用于将本地音乐文件与网易云音乐进行匹配。

## 功能特点

- 支持将本地音频文件与网易云音乐歌单进行匹配
- 支持匹配到"我喜欢的音乐"列表
- 支持手动匹配单个音频文件
- 智能匹配算法，考虑音频时长、标题相似度等多个因素
- 支持缓存匹配结果，避免重复匹配
- 支持更新音频文件元数据

- 当音乐文件名满足格式 `{歌名} - {歌手}` 或 `{歌手} - {歌名}` 时，可提升匹配效果（不含文件后缀名、`-` 前后也可无空）。
- 对于字符匹配，这些字符集会被标准化：简繁体、平假名与片假名、英文字母大小写、全半角符号。

## 安装

1. 安装 Node.js（推荐v16及以上版本，开发环境为v20.16.0）和 Python
2. 克隆本仓库：
   ```bash
   git clone https://github.com/CuiZhenhang/netease-music-tools.git
   ```
3. 安装依赖：
   ```bash
   cd node src/app.js
   npm install
   ```
4. 安装Python依赖（用于音频元数据更新）：\
   Windows
   ```bash
   python -m venv python/venv
   python/venv/Scripts/pip install -r python/requirements.txt
   ```
   Linux
   ```bash
   python -m venv python/venv
   python/venv/bin/pip install -r python/requirements.txt
   ```

## 使用方法

对于 Windows 用户，可以选择用 `.\netease-music-tools.cmd` 来替换 `node src/app.js`。

### 基本命令

```bash
# 匹配整个文件夹到指定歌单
node src/app.js match-playlist <音频文件夹路径> <歌单ID>

# 匹配到"我喜欢的音乐"
node src/app.js match-like <音频文件夹路径>

# 手动匹配单个音频文件
node src/app.js match-manual <音频文件路径> <歌曲ID>

# 更新已匹配音频的缓存信息
node src/app.js update-info <音频文件夹路径>

# 更新音频文件元数据
node src/app.js update-file-meta <音频文件夹路径>
```

### 常用示例

```bash
# 匹配当前目录下的音频到歌单
node src/app.js mp . 123456

# 使用登录状态匹配歌单（可以访问私密歌单）
node src/app.js mp . 123456 -l

# 手动匹配单个音频文件
node src/app.js mm ./test.mp3 456789

# 更新音频文件元数据
node src/app.js u-meta .
```

### 参数说明

- `match-playlist`（别名：`m-playlist`, `mp`）
  - `<path>`: 音频文件夹路径
  - `<id>`: 网易云音乐歌单ID
  - `--login, -l`: 使用登录状态（可选）
  - `--cache`: 是否使用缓存（默认：true）

- `match-like`（别名：`m-like`, `ml`）
  - `<path>`: 音频文件夹路径
  - `--cache`: 是否使用缓存（默认：true）

- `match-manual`（别名：`m-manual`, `mm`）
  - `<song>`: 音频文件路径
  - `<id>`: 网易云音乐歌曲ID
  - `--login, -l`: 使用登录状态（可选）

### 其他命令

```bash
# 清除自动匹配缓存
node src/app.js clear-cache <音频文件夹路径>

# 清除手动匹配数据
node src/app.js clear-manual <音频文件夹路径>

# 退出登录
node src/app.js logout
```

### 全局选项

- `--help, -h`: 显示帮助信息
- `--version, -v`: 显示版本信息
- `--yes, -y`: 自动回答所有问题为"是"
- `--warn, -w`: 显示额外警告信息

## 匹配算法说明

工具使用以下因素进行音频匹配：

1. 音频时长相似度
2. 标题相似度
3. 艺术家匹配度
4. 文件名格式匹配

匹配数据会被缓存以提高后续匹配效率。如果自动匹配结果不理想，可以使用手动匹配功能。

## 注意事项

1. 支持的音频格式：MP3、FLAC
2. 元数据更新功能需要Python环境支持
3. 部分较大的网络数据会在本地缓存1小时
4. 建议在元数据更新后运行 `update-info` 命令同步本地匹配信息

## 许可证

[MIT License](LICENSE)
