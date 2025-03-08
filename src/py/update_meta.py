#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import locale

import mutagen.id3

# 设置系统默认编码
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

"""
网易云音乐元数据更新工具
用途：更新音频文件元数据（MP3/FLAC）
使用：python update_meta.py <音频文件夹路径>
依赖：mutagen
"""

import mutagen
from mutagen.easyid3 import EasyID3
from mutagen.flac import FLAC, Picture
from mutagen.id3 import ID3, APIC
import json
import sys
import os
from pathlib import Path
import time
# import requests
# from typing import Optional

# def download_cover(url: str) -> Optional[bytes]:
#     try:
#         response = requests.get(url, timeout=10)
#         response.raise_for_status()
#         return response.content
#     except Exception as e:
#         print(f"下载封面失败: {str(e)}")
#         return None

def update_common_tags(is_mp3: bool, song_info: dict) -> dict:
    """处理MP3(ID3v2)和FLAC(Vorbis)各自的标签"""
    tags = {}
    
    # 基础标签映射 [网易云字段, MP3处理函数, FLAC处理函数]
    TAG_MAPPING = {
        'title': ['name', str, str],  # FLAC: TITLE, MP3: TIT2
        'album': ['al.name', str, str],  # FLAC: ALBUM, MP3: TALB
        'tracknumber': [  # FLAC: TRACKNUMBER, MP3: TRCK
            'no',
            lambda x: str(x) if x > 0 else None,
            lambda x: str(x) if x > 0 else None
        ],
        'discnumber': [  # FLAC: DISCNUMBER, MP3: TPOS
            'cd',
            lambda x: str(x) if x else None,
            lambda x: str(x) if x else None
        ],
        'date': [  # FLAC: DATE, MP3: TDRC
            'publishTime',
            lambda x: time.strftime('%Y-%m-%d', time.localtime(x / 1000)) if x > 0 else None,
            lambda x: time.strftime('%Y-%m-%d', time.localtime(x / 1000)) if x > 0 else None
        ],
        'artist': [  # FLAC: ARTIST, MP3: TPE1
            'ar',
            lambda x: [ar['name'] for ar in x],
            lambda x: [ar['name'] for ar in x]
        ],
        'albumartist': [  # FLAC: ALBUMARTIST, MP3: TPE2
            'al.artists',
            lambda x: [ar['name'] for ar in x] if x else None,
            lambda x: [ar['name'] for ar in x] if x else None
        ],
        # 原曲信息，MP3和FLAC分别处理
        'original': [
            'originSongSimpleData',
            lambda x: (
                f"{x['name']} - {', '.join(ar['name'] for ar in x['artists'])}" 
                if x and x.get('name') and x.get('artists') else None
            ),  # MP3将原曲信息合并到version标签
            lambda x: {  # FLAC分别存储原曲信息
                'originalartist': [ar['name'] for ar in x['artists']] if x and x.get('artists') else None,
                'originalname': x['name'] if x and x.get('name') else None
            } if x else None
        ],
    }
    
    # 处理标准标签
    processor_index = 1 if is_mp3 else 2  # 选择对应格式的处理函数
    for tag_name, (field_path, mp3_proc, flac_proc) in TAG_MAPPING.items():
        try:
            # 获取嵌套字段值
            value = song_info
            for key in field_path.split('.'):
                if value and isinstance(value, dict):
                    value = value.get(key)
                elif value and isinstance(value, list) and key == 'name':
                    value = [item['name'] for item in value]
                else:
                    value = None
                    break
            
            if value is not None:
                processor = mp3_proc if is_mp3 else flac_proc
                processed = processor(value)
                if processed:
                    tags[tag_name] = processed
        except Exception as e:
            print(f"警告：处理标签 {tag_name} 时出错: {str(e)}")
    
    # 处理特殊标签
    try:
        # 版本信息
        version_parts = []
        if 'alia' in song_info and song_info['alia']:
            version_parts.extend(song_info['alia'])
        
        if 'originCoverType' in song_info:
            cover_type = {
                0: "未知",
                1: "原创",
                2: "翻唱"
            }.get(song_info['originCoverType'], "未知")
            version_parts.append(cover_type)
            
            # 对于翻唱歌曲，添加原曲信息到version标签
            if song_info['originCoverType'] == 2 and 'original' in tags:
                version_parts.append(f"原曲: {tags['original']}")
                if is_mp3:
                    del tags['original']  # 删除临时标签
        
        if version_parts:
            if is_mp3:
                tags['version'] = ' - '.join(version_parts)  # TIT3
            else:
                tags['version'] = version_parts  # VERSION
        
        # 歌手别名
        if 'ar' in song_info:
            aliases = []
            for ar in song_info['ar']:
                if ar.get('alias'):
                    aliases.extend(ar['alias'])
            if aliases:
                if is_mp3:
                    tags['artistsort'] = aliases[0]  # TSOP
                else:
                    tags['artistsort'] = aliases  # ARTISTSORT
        
        # 专辑别名
        if 'al' in song_info and song_info['al'].get('tns'):
            if is_mp3:
                tags['albumsort'] = song_info['al']['tns'][0]  # TSOA
            else:
                tags['albumsort'] = song_info['al']['tns']  # ALBUMSORT
        
        # 付费类型
        fee_type = {
            0: "免费",
            1: "VIP",
            4: "专辑",
            8: "试听"
        }.get(song_info.get('fee'))
        if fee_type:
            if is_mp3:
                tags['genre'] = fee_type  # TCON
            else:
                tags['genre'] = [fee_type]  # GENRE
        
        # 网易云特有信息
        meta_parts = []
        if 'id' in song_info:
            meta_parts.append(f"NeteaseMusic ID: {song_info['id']}")
        if 'mv' in song_info and song_info['mv'] > 0:
            meta_parts.append(f"MV ID: {song_info['mv']}")
        if meta_parts:
            if is_mp3:
                # 将作为 TXXX 标签单独处理
                tags['netease_info'] = '; '.join(meta_parts)
            else:
                tags['description'] = meta_parts  # DESCRIPTION
        
        # 原曲信息 (FLAC)
        if not is_mp3 and 'original' in tags:
            orig_info = tags.pop('original')  # 删除临时标签
            if isinstance(orig_info, dict):
                tags.update(orig_info)
        
    except Exception as e:
        print(f"警告：处理特殊标签时出错: {str(e)}")
    
    return tags

def update_mp3_metadata(file_path: str, song_info: dict):
    try:
        # 直接使用完整的 ID3 而不是 EasyID3，以支持更多标签
        try:
            audio = ID3(file_path)
        except mutagen.id3.ID3NoHeaderError:
            audio = mutagen.File(file_path, easy=False)
            if audio is None:
                raise Exception("无法识别的MP3文件格式")
            audio.add_tags()
        except Exception as e:
            raise Exception(f"打开MP3文件失败: {str(e)}")

        # 处理标准标签
        tags = update_common_tags(True, song_info)
        
        # ID3v2.4 标签映射
        ID3_MAPPING = {
            'title': ('TIT2', str),  # 标题
            'artist': ('TPE1', lambda x: '; '.join(x) if isinstance(x, list) else str(x)),  # 艺术家
            'album': ('TALB', str),  # 专辑名
            'albumartist': ('TPE2', lambda x: '; '.join(x) if isinstance(x, list) else str(x)),  # 专辑艺术家
            'date': ('TDRC', str),  # 发行日期
            'tracknumber': ('TRCK', str),  # 音轨号
            'discnumber': ('TPOS', str),  # CD号
            'genre': ('TCON', str),  # 流派
            'artistsort': ('TSOP', str),  # 艺术家排序
            'albumsort': ('TSOA', str),  # 专辑排序
            'version': ('TIT3', str),  # 副标题/版本
        }

        # 添加标准ID3标签
        for tag_name, value in tags.items():
            if tag_name in ID3_MAPPING:
                frame_id, converter = ID3_MAPPING[tag_name]
                try:
                    # 创建新的标签帧
                    frame_class = getattr(mutagen.id3, frame_id)
                    audio.add(frame_class(encoding=3, text=converter(value)))
                except Exception as e:
                    print(f"警告：设置MP3标签 {tag_name} ({frame_id}) 失败: {str(e)}")

        # 添加TXXX自定义标签
        if 'netease_info' in tags:
            try:
                audio.add(mutagen.id3.TXXX(
                    encoding=3,
                    desc='NETEASE_INFO',
                    text=tags['netease_info']
                ))
            except Exception as e:
                print(f"警告：设置网易云信息标签失败: {str(e)}")

        # 如果有原创/翻唱信息，添加到COMM标签
        try:
            cover_type = {
                0: "未知",
                1: "原创",
                2: "翻唱"
            }.get(song_info.get('originCoverType'), "未知")
            
            comment_text = [f"类型: {cover_type}"]
            
            if song_info.get('originSongSimpleData'):
                orig = song_info['originSongSimpleData']
                if orig.get('name') and orig.get('artists'):
                    artists_str = ', '.join(ar['name'] for ar in orig['artists'])
                    comment_text.append(f"原曲: {orig['name']} - {artists_str}")
            
            if comment_text:
                audio.add(mutagen.id3.COMM(
                    encoding=3,
                    lang='eng',
                    desc='',
                    text='\n'.join(comment_text)
                ))
        except Exception as e:
            print(f"警告：设置评论标签失败: {str(e)}")

        # 处理封面
        try:
            if 'al' in song_info and song_info['al'].get('picUrl'):
                if not any(tag.startswith('APIC:') for tag in audio.keys()):
                    print("未检测到专辑封面，可以通过取消注释 download_cover 函数来启用封面下载")
                    # cover_data = download_cover(song_info['al']['picUrl'])
                    # if cover_data:
                    #     audio.add(APIC(
                    #         encoding=3,
                    #         mime='image/jpeg',
                    #         type=3,
                    #         desc='Cover',
                    #         data=cover_data
                    #     ))
                    #     print("已更新专辑封面")
        except Exception as e:
            print(f"警告：处理专辑封面失败: {str(e)}")

        # 保存更改
        try:
            audio.save(v2_version=4)  # 使用 ID3v2.4
        except Exception as e:
            print(f"警告：保存MP3标签失败: {str(e)}")

    except Exception as e:
        print(f"错误：处理MP3文件失败: {str(e)}")
        raise
    finally:
        # 更新文件时间戳
        try:
            os.utime(file_path, None)
        except Exception as e:
            print(f"警告：更新文件时间戳失败: {str(e)}")

def update_flac_metadata(file_path: str, song_info: dict):
    try:
        try:
            audio = FLAC(file_path)
        except Exception as e:
            raise Exception(f"打开FLAC文件失败: {str(e)}")
        
        # 获取并更新标签
        tags = update_common_tags(False, song_info)
        
        # 处理Vorbis Comments标签
        try:
            for key, value in tags.items():
                key = key.upper()  # FLAC标签通常使用大写
                if isinstance(value, (list, tuple)):
                    audio[key] = [str(v) for v in value]  # FLAC支持多值标签
                else:
                    audio[key] = [str(value)]
            
            audio.save()
        except Exception as e:
            print(f"警告：保存FLAC标签失败: {str(e)}")
        
        # 处理封面
        if 'al' in song_info and song_info['al'].get('picUrl'):
            if not audio.pictures:
                print("未检测到专辑封面，可以通过取消注释 download_cover 函数来启用封面下载")
                # cover_data = download_cover(song_info['al']['picUrl'])
                # if cover_data:
                #     picture = Picture()
                #     picture.type = 3  # 3 表示封面
                #     picture.mime = 'image/jpeg'
                #     picture.desc = 'Cover'
                #     picture.data = cover_data
                #     audio.add_picture(picture)
                #     print("已更新专辑封面")

        audio.save()
    except Exception as e:
        print(f"错误：处理FLAC文件失败: {str(e)}")
        raise
    finally:
        # 更新文件时间戳
        try:
            os.utime(file_path, None)  # None 表示使用当前时间
        except Exception as e:
            print(f"警告：更新文件时间戳失败: {str(e)}")

def update_metadata(folder_path: str) -> bool:
    # 读取 .matched.json 文件
    json_path = Path(folder_path) / '.matched.json'
    if not json_path.exists():
        print(f"错误：在 {folder_path} 中未找到 .matched.json 文件", flush=True)
        return False

    with open(json_path, 'r', encoding='utf-8', errors='replace') as f:
        match_data = json.load(f)

    # 合并自动匹配和手动匹配的数据，优先使用手动匹配
    all_matches = {}
    if 'files' in match_data:
        # 先加入自动匹配数据
        for match in match_data['files']:
            if match.get('fileName'):
                all_matches[match['fileName']] = match
    if 'manualMatch' in match_data:
        # 手动匹配数据覆盖自动匹配
        for match in match_data['manualMatch']:
            if match.get('fileName'):
                all_matches[match['fileName']] = match
    
    if not all_matches:
        print("警告：.matched.json 中没有匹配数据")
        return False

    updated_count = 0
    error_count = 0

    # 遍历所有已匹配的文件
    for file_name, match_info in all_matches.items():
        if not match_info.get('neteaseDetail'):
            continue
            
        file_path = Path(folder_path) / match_info['fileName']
        if not file_path.exists():
            print(f"警告：文件不存在 {match_info['fileName']}")
            continue

        try:
            if file_path.suffix.lower() == '.mp3':
                update_mp3_metadata(str(file_path), match_info['neteaseDetail'])
            elif file_path.suffix.lower() == '.flac':
                update_flac_metadata(str(file_path), match_info['neteaseDetail'])
            else:
                print(f"跳过不支持的文件格式：{match_info['fileName']}")
                continue

            updated_count += 1
            print(f"已更新：{match_info['fileName']}")

        except Exception as e:
            error_count += 1
            print(f"处理文件 {match_info['fileName']} 时出错：{str(e)}")

    print(f"\n更新完成：成功 {updated_count} 个文件，失败 {error_count} 个文件")
    return True

def main():
    if len(sys.argv) != 2:
        print("用法：python update_meta.py <文件夹路径>", flush=True)
        return 1

    folder_path = sys.argv[1]
    if not os.path.isdir(folder_path):
        print(f"错误：{folder_path} 不是有效的文件夹路径", flush=True)
        return 1

    update_metadata(folder_path)
    return 0

if __name__ == '__main__':
    sys.exit(main())
