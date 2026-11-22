// import '../../polyfill/array.find'

import { httpFetch } from '../../request'
import { formatPlayTime, decodeName } from '../../index'
// import { debug } from '../../utils/env'
import { formatSinger, objStr2JSON } from './util'

export default {
  regExps: {
    mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/,
  },
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  // cancelFn: null,
  musicSearch(str, page, limit) {
    const musicSearchRequestObj = httpFetch(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`)
    return musicSearchRequestObj.promise
  },
  // getImg(songId) {
  //   return httpGet(`http://player.kuwo.cn/webmusic/sj/dtflagdate?flag=6&rid=MUSIC_${songId}`)
  // },
  // getLrc(songId) {
  //   return httpGet(`http://mobile.kuwo.cn/mpage/html5/songinfoandlrc?mid=${songId}&flag=0`)
  // },
  handleResult(rawData) {
    const result = []
    if (!rawData) return result
    // console.log(rawData)
    for (let i = 0; i < rawData.length; i++) {
      const info = rawData[i]
      let songId = info.MUSICRID.replace('MUSIC_', '')
      // const format = (info.FORMATS || info.formats).split('|')

      if (!info.N_MINFO) {
        console.log('N_MINFO is undefined')
        return null
      }

      const types = []
      const _types = {}

      let infoArr = info.N_MINFO.split(';')
      for (let info of infoArr) {
        info = info.match(this.regExps.mInfo)
        if (info) {
          switch (info[3]) {
            // 参考 lx-x：优先按格式识别新音质档位
            case 'HIRFLAC':
              types.push({ type: 'flac24bit', size: info[4] })
              _types.flac24bit = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            case 'ZPGA201':
              types.push({ type: 'atmos', size: info[4] })
              _types.atmos = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            case 'ZPGA501':
              types.push({ type: 'atmos_plus', size: info[4] })
              _types.atmos_plus = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            case 'ZPLY':
              types.push({ type: 'master', size: info[4] })
              _types.master = {
                size: info[4].toLocaleUpperCase(),
              }
              break
            default:
              switch (info[2]) {
                case '4000':
                  types.push({ type: 'flac24bit', size: info[4] })
                  _types.flac24bit = {
                    size: info[4].toLocaleUpperCase(),
                  }
                  break
                case '2000':
                  types.push({ type: 'flac', size: info[4] })
                  _types.flac = {
                    size: info[4].toLocaleUpperCase(),
                  }
                  break
                case '320':
                  types.push({ type: '320k', size: info[4] })
                  _types['320k'] = {
                    size: info[4].toLocaleUpperCase(),
                  }
                  break
                case '128':
                  types.push({ type: '128k', size: info[4] })
                  _types['128k'] = {
                    size: info[4].toLocaleUpperCase(),
                  }
                  break
              }
          }
        }
      }
      types.reverse()

      let interval = parseInt(info.DURATION)

      // 多歌手：allartistid 为 & 连接的完整歌手 id 列表（如 "105315&604328"），与 ARTIST 的 & 分段一一对应
      const artistIds = String(info.allartistid ?? info.ARTISTID ?? '').split('&').filter(Boolean)
      const artistNames = String(info.ARTIST ?? '').split('&').map(decodeName)
      const artists = artistIds.length
        ? artistIds.map((id, i) => ({ id: String(id), name: artistNames[i] || artistNames[0] || '' }))
        : null

      result.push({
        name: decodeName(info.SONGNAME),
        singer: formatSinger(decodeName(info.ARTIST)),
        artists,
        source: 'kw',
        // img = (info.album.name === '' || info.album.name === '空')
        //   ? `http://player.kuwo.cn/webmusic/sj/dtflagdate?flag=6&rid=MUSIC_160911.jpg`
        //   : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${info.album.mid}.jpg`
        songmid: songId,
        albumId: decodeName(info.ALBUMID || ''),
        interval: Number.isNaN(interval) ? 0 : formatPlayTime(interval),
        albumName: info.ALBUM ? decodeName(info.ALBUM) : '',
        lrc: null,
        img: info.web_albumpic_short
          ? `http://img1.kuwo.cn/star/albumcover/${info.web_albumpic_short.replace(/^\d+\//, '500/')}`
          : null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      })
    }
    // console.log(result)
    return result
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit
    // http://newlyric.kuwo.cn/newlyric.lrc?62355680
    return this.musicSearch(str, page, limit).then(({ body: result }) => {
      // console.log(result)
      if (!result || (result.TOTAL !== '0' && result.SHOW === '0')) return this.search(str, page, limit, ++retryNum)
      let list = this.handleResult(result.abslist)

      if (list == null) return this.search(str, page, limit, ++retryNum)

      this.total = parseInt(result.TOTAL)
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        total: this.total,
        limit,
        source: 'kw',
      })
    })
  },
  searchSinger(str, page = 1, limit = 30, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))
    const requestObj = httpFetch(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=artist&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`)
    return requestObj.promise.then(({ body: result }) => {
      if (!result || (result.TOTAL !== '0' && result.SHOW === '0')) return this.searchSinger(str, page, limit, ++retryNum)
      const basePicPath = result.BASEPICPATH || 'http://img1.kuwo.cn/star/starheads/'
      const list = (result.abslist || []).map(item => ({
        id: item.ARTISTID,
        name: decodeName(item.ARTIST),
        picUrl: item.PICPATH ? basePicPath + item.PICPATH.replace(/^\d+\//, '500/') : '',
        alias: item.AARTIST ? [decodeName(item.AARTIST)] : [],
        musicSize: parseInt(item.SONGNUM) || null,
        albumSize: parseInt(item.ALBUMNUM) || null,
        source: 'kw',
      }))
      const total = parseInt(result.TOTAL) || list.length
      return {
        list,
        allPage: Math.ceil(total / limit),
        limit,
        total,
        source: 'kw',
      }
    })
  },
  searchAlbum(str, page = 1, limit = 30, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))
    const requestObj = httpFetch(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=album&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&issubtitle=1`)
    return requestObj.promise.then(({ body: result }) => {
      let data = null
      try {
        data = typeof result === 'string' ? objStr2JSON(result) : result
      } catch (err) {
        data = null
      }
      if (!data || !Array.isArray(data.albumlist)) return this.searchAlbum(str, page, limit, ++retryNum)
      const list = data.albumlist.map(item => ({
        id: item.albumid,
        name: decodeName(item.name),
        picUrl: item.pic
          ? `http://img1.kuwo.cn/star/albumcover/${item.pic.replace(/^\d+\//, '500/')}`
          : (item.img || item.hts_img || ''),
        artistName: decodeName(item.artist),
        artistId: item.artistid,
        size: parseInt(item.musiccnt) || null,
        publishTime: item.pub || '',
        source: 'kw',
      }))
      const total = parseInt(data.total) || list.length
      return {
        list,
        allPage: Math.ceil(total / limit),
        limit,
        total,
        source: 'kw',
      }
    })
  },
}
