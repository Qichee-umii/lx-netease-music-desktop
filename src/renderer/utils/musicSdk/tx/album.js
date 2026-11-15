import { httpFetch } from '../../request'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'

const filterOldMusicInfoItem = item => {
  const types = []
  const _types = {}
  if (item.size128 > 0) {
    const size = sizeFormate(item.size128)
    types.push({ type: '128k', size })
    _types['128k'] = { size }
  }
  if (item.size320 > 0) {
    const size = sizeFormate(item.size320)
    types.push({ type: '320k', size })
    _types['320k'] = { size }
  }
  if (item.sizeflac > 0) {
    const size = sizeFormate(item.sizeflac)
    types.push({ type: 'flac', size })
    _types.flac = { size }
  }

  const albumId = item.albumid ?? ''
  const albumMid = item.albummid ?? ''
  const albumName = item.albumname ?? ''
  return {
    source: 'tx',
    singer: formatSingerName(item.singer, 'name'),
    artists: Array.isArray(item.singer) ? item.singer.map(s => ({ id: s.mid ?? '', name: s.name ?? '' })).filter(a => a.id) : null,
    name: item.songname,
    albumName,
    albumId: String(albumId),
    albumMid,
    interval: formatPlayTime(item.interval),
    songId: item.songid,
    songmid: item.songmid,
    strMediaMid: item.strMediaMid ?? item.songmid,
    img: `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`,
    types,
    _types,
    typeUrl: {},
  }
}

export default {
  // 老 web 专辑歌曲端点（新版 musics.fcg 各 AlbumSongList 模块均已下线）
  async getAlbumDetail(id, page = 1, limit = 200) { // id 为 albummid
    const result = await httpFetch(`https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_detail_cp.fcg?albummid=${id}&format=json&page=${page}&pagesize=${limit}`, {
      headers: {
        Referer: 'https://y.qq.com/',
      },
    }).promise
    const body = result.body
    if (!body || body.code !== 0 || !body.data) return this.getAlbumDetail(id, page, limit)
    const rawList = body.data.getSongInfo
    if (!Array.isArray(rawList)) throw new Error('Get album list failed.')
    const albumInfo = body.data.getAlbumInfo ?? {}
    return {
      list: rawList.map(filterOldMusicInfoItem),
      page,
      limit,
      total: Math.max(rawList.length, Number(page) * limit),
      source: 'tx',
      info: {
        name: albumInfo.Falbum_name ?? '',
        img: `https://y.gtimg.cn/music/photo_new/T002R500x500M000${id}.jpg`,
        desc: body.data.getAlbumDesc?.Falbum_desc ?? '',
        author: body.data.getSingerInfo?.Fsinger_name ?? '',
        publishDate: albumInfo.Fpublic_time ?? '',
      },
    }
  },
}
