import { httpFetch } from '../../request'

import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'

export const filterMusicInfoItem = item => {
  const types = []
  const _types = {}
  if (item.file.size_128mp3 != 0) {
    let size = sizeFormate(item.file.size_128mp3)
    types.push({ type: '128k', size })
    _types['128k'] = {
      size,
    }
  }
  if (item.file.size_320mp3 !== 0) {
    let size = sizeFormate(item.file.size_320mp3)
    types.push({ type: '320k', size })
    _types['320k'] = {
      size,
    }
  }
  if (item.file.size_flac !== 0) {
    let size = sizeFormate(item.file.size_flac)
    types.push({ type: 'flac', size })
    _types.flac = {
      size,
    }
  }
  if (item.file.size_hires !== 0) {
    let size = sizeFormate(item.file.size_hires)
    types.push({ type: 'flac24bit', size })
    _types.flac24bit = {
      size,
    }
  }

  const albumId = item.album.id ?? ''
  const albumMid = item.album.mid ?? ''
  const albumName = item.album.name ?? ''
  return {
    source: 'tx',
    singer: formatSingerName(item.singer, 'name'),
    artists: Array.isArray(item.singer) ? item.singer.map(s => ({ id: s.mid, name: s.name })).filter(a => a.id) : null,
    name: item.title,
    albumName,
    albumId,
    albumMid,
    interval: formatPlayTime(item.interval),
    songId: item.id,
    songmid: item.mid,
    strMediaMid: item.file.media_mid,
    img: (albumId === '' || albumId === '空')
      ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
      : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`,
    types,
    _types,
    typeUrl: {},
  }
}


/**
 * 创建一个适用于TX的Http请求
 * @param {*} url
 * @param {*} options
 * @param {*} retryNum
 */
const createMusicuFetch = async(data, options, retryNum = 0) => {
  if (retryNum > 2) throw new Error('try max num')

  let result
  try {
    result = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      body: {
        comm: {
          cv: 4747474,
          ct: 24,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          uin: 0,
        },
        ...data,
      },
      headers: {
        'User-Angent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
      },
    }).promise
  } catch (err) {
    console.log(err)
    return createMusicuFetch(data, options, ++retryNum)
  }
  if (result.statusCode !== 200 || result.body.code != 0) return createMusicuFetch(data, options, ++retryNum)

  return result.body
}

/**
 * App 风格 comm 的 musicu 请求（GetHomepageHeader 等主页模块必须用 Android 设备参数，
 * web comm 返回空 BaseInfo/Singer）
 * 参考 lx-lxwalnut-music-mobile 的 signRequest comm 结构
 * @param {*} data
 * @param {*} retryNum
 */
const createMusicuAppFetch = async(data, retryNum = 0) => {
  if (retryNum > 2) throw new Error('try max num')

  let result
  try {
    result = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      body: {
        comm: {
          ct: '11',
          cv: '14090508',
          v: '14090508',
          tmeAppID: 'qqmusic',
          phonetype: 'EBG-AN10',
          deviceScore: '553.47',
          devicelevel: '50',
          newdevicelevel: '20',
          os_ver: '12',
          modeSwitch: '6',
          ui_mode: '2',
          nettype: '1020',
        },
        ...data,
      },
      headers: {
        'User-Agent': 'QQMusic 14090508(android 12)',
      },
    }).promise
  } catch (err) {
    console.log(err)
    return createMusicuAppFetch(data, ++retryNum)
  }
  if (result.statusCode !== 200 || result.body.code != 0) return createMusicuAppFetch(data, ++retryNum)

  return result.body
}

export default {
  /**
   * 获取歌手信息（参考 lx-lxwalnut-music-mobile getDetail：
   * GetHomepageHeader 拿主页头像/名字/性别/粉丝数，并发 GetAlbumList/GetSingerSongList 拿专辑/歌曲总数；
   * 旧 music.musichallSinger.SingerInfoInter/GetSingerDetail 已失效 code 104400）
   * @param {*} id 歌手 mid
   */
  async getInfo(id) {
    const [headerBody, countBody] = await Promise.all([
      createMusicuAppFetch({
        req_1: {
          module: 'music.UnifiedHomepage.UnifiedHomepageSrv',
          method: 'GetHomepageHeader',
          param: { SingerMid: id },
        },
      }).catch(err => {
        console.log(err)
        return null
      }),
      createMusicuFetch({
        req_2: {
          module: 'music.musichallAlbum.AlbumListServer',
          method: 'GetAlbumList',
          param: {
            singerMid: id,
            order: 0,
            begin: 0,
            num: 1,
            songNumTag: 0,
            singerID: 0,
          },
        },
        req_3: {
          module: 'musichall.song_list_server',
          method: 'GetSingerSongList',
          param: {
            singerMid: id,
            order: 1,
            begin: 0,
            num: 1,
          },
        },
      }).catch(err => {
        console.log(err)
        return null
      }),
    ])
    if (!headerBody && !countBody) throw new Error('get singer info faild.')

    let name = ''
    let avatar = ''
    let gender = ''
    let fansNum = 0
    if (headerBody?.req_1?.code == 0) {
      const info = headerBody.req_1.data?.Info ?? {}
      const baseInfo = info.BaseInfo ?? {}
      const singer = info.Singer ?? {}
      name = baseInfo.Name || singer.Name || ''
      avatar = baseInfo.Avatar || singer.SingerPic || ''
      if (avatar) avatar = avatar.replace(/R\d+x\d+/, 'R500x500').replace('y.qq.com', 'y.gtimg.cn')
      if (!avatar && /^[A-Za-z0-9]+$/.test(id)) avatar = `https://y.gtimg.cn/music/photo_new/T001R500x500M000${id}.jpg`
      const genderText = info.Gender?.Gender
      gender = genderText === '男' ? 'man' : genderText === '女' ? 'woman' : ''
      fansNum = info.FansNum?.Num ?? 0
    }

    return {
      source: 'tx',
      id,
      info: {
        name,
        desc: '',
        avatar,
        gender,
      },
      count: {
        music: countBody?.req_3?.data?.totalNum ?? 0,
        album: countBody?.req_2?.data?.total ?? 0,
      },
      fansNum,
    }
  },
  /**
   * 获取歌手专辑列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  getAlbumList(id, page = 1, limit = 10) {
    if (page === 1) page = 0
    return createMusicuFetch({
      req: {
        module: 'music.musichallAlbum.AlbumListServer',
        method: 'GetAlbumList',
        param: {
          singerMid: id,
          order: 0,
          begin: page * limit,
          num: limit,
          songNumTag: 1,
          singerID: 0,
        },
      },
    }).then(body => {
      if (body.req.code != 0) throw new Error('get singer album faild.')

      const list = this.filterAlbumList(body.req.data.albumList)
      return {
        source: 'tx',
        list,
        limit,
        page,
        total: body.req.data.total,
      }
    })
  },
  /**
   * 获取歌手歌曲列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  async getSongList(id, page = 1, limit = 100) {
    if (page === 1) page = 0
    return createMusicuFetch({
      req: {
        module: 'musichall.song_list_server',
        method: 'GetSingerSongList',
        param: {
          singerMid: id,
          order: 1,
          begin: page * limit,
          num: limit,
        },
      },
    }).then(body => {
      if (body.req.code != 0) throw new Error('get singer song list faild.')

      const list = this.filterSongList(body.req.data.songList)
      return {
        source: 'tx',
        list,
        limit,
        page,
        total: body.req.data.totalNum,
      }
    })
  },
  filterAlbumList(raw) {
    return raw.map(item => {
      return {
        // 专辑详情接口（fcg_v8_album_detail_cp）按 albummid 查询，id 必须用 mid
        id: item.albumMid,
        albumID: item.albumID,
        count: item.totalNum,
        info: {
          name: item.albumName,
          author: item.singerName,
          img: `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.albumMid}.jpg`,
          desc: null,
          publishDate: item.publishDate ?? '',
        },
      }
    })
  },
  filterSongList(raw) {
    return raw.map(item => {
      return filterMusicInfoItem(item.songInfo)
    })
  },
  /**
   * 歌手详情（歌单详情页形态）：歌曲分页列表 + 头部信息
   * 歌手名取自返回歌曲列表首项的歌手名，头像用 mid 模板拼接
   * @param {*} id 歌手 mid
   * @param {*} page
   * @param {*} limit
   * @param {*} sort 'hot' | 'time'（GetSingerSongList: order 1=热门，2=最新）
   */
  async getArtistDetail(id, page = 1, limit = 100, sort = 'hot') {
    const body = await createMusicuFetch({
      req: {
        module: 'musichall.song_list_server',
        method: 'GetSingerSongList',
        param: {
          singerMid: id,
          order: sort === 'time' ? 2 : 1,
          begin: (page - 1) * limit,
          num: limit,
        },
      },
    })
    if (body.req.code != 0) throw new Error('get singer song list faild.')

    const songList = body.req.data.songList || []
    const list = this.filterSongList(songList)
    const singerName = songList.length ? (songList[0].songInfo?.singer?.[0]?.name ?? '') : ''
    return {
      source: 'tx',
      list,
      limit,
      page,
      total: body.req.data.totalNum,
      info: {
        name: singerName,
        img: `https://y.gtimg.cn/music/photo_new/T001R500x500M000${id}.jpg`,
        desc: '',
        author: singerName,
      },
    }
  },
}

