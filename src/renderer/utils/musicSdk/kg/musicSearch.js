import { httpFetch } from '../../request'
import { decodeName, formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'


export default {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,
  musicSearch(str, page, limit) {
    const searchRequest = httpFetch(`https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`)
    return searchRequest.promise.then(({ body }) => body)
  },
  filterData(rawData) {
    const types = []
    const _types = {}
    if (rawData.FileSize !== 0) {
      let size = sizeFormate(rawData.FileSize)
      types.push({ type: '128k', size, hash: rawData.FileHash })
      _types['128k'] = {
        size,
        hash: rawData.FileHash,
      }
    }
    if (rawData.HQFileSize !== 0) {
      let size = sizeFormate(rawData.HQFileSize)
      types.push({ type: '320k', size, hash: rawData.HQFileHash })
      _types['320k'] = {
        size,
        hash: rawData.HQFileHash,
      }
    }
    if (rawData.SQFileSize !== 0) {
      let size = sizeFormate(rawData.SQFileSize)
      types.push({ type: 'flac', size, hash: rawData.SQFileHash })
      _types.flac = {
        size,
        hash: rawData.SQFileHash,
      }
    }
    if (rawData.ResFileSize !== 0) {
      let size = sizeFormate(rawData.ResFileSize)
      types.push({ type: 'flac24bit', size, hash: rawData.ResFileHash })
      _types.flac24bit = {
        size,
        hash: rawData.ResFileHash,
      }
    }
    return {
      singer: decodeName(formatSingerName(rawData.Singers, 'name')),
      artists: (() => {
        const singers = (rawData.Singers || []).filter(s => s.id).map(s => ({ id: String(s.id), name: decodeName(s.name) }))
        return singers.length ? singers : null
      })(),
      name: decodeName(rawData.SongName),
      albumName: decodeName(rawData.AlbumName),
      albumId: rawData.AlbumID,
      songmid: rawData.Audioid,
      source: 'kg',
      interval: formatPlayTime(rawData.Duration),
      _interval: rawData.Duration,
      img: rawData.Image ? rawData.Image.replace('{size}', '400') : null,
      lrc: null,
      otherSource: null,
      hash: rawData.FileHash,
      types,
      _types,
      typeUrl: {},
    }
  },
  handleResult(rawData) {
    let ids = new Set()
    const list = []
    rawData.forEach(item => {
      const key = item.Audioid + item.FileHash
      if (ids.has(key)) return
      ids.add(key)
      list.push(this.filterData(item))
      for (const childItem of item.Grp) {
        const key = item.Audioid + item.FileHash
        if (ids.has(key)) continue
        ids.add(key)
        list.push(this.filterData(childItem))
      }
    })
    return list
  },
  search(str, page = 1, limit, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    if (limit == null) limit = this.limit
    // http://newlyric.kuwo.cn/newlyric.lrc?62355680
    return this.musicSearch(str, page, limit).then(result => {
      if (!result || result.error_code !== 0) return this.search(str, page, limit, retryNum)
      let list = this.handleResult(result.data.lists)

      if (list == null) return this.search(str, page, limit, retryNum)

      this.total = result.data.total
      this.page = page
      this.allPage = Math.ceil(this.total / limit)

      return Promise.resolve({
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'kg',
      })
    })
  },
  /**
   * kg 歌手搜索接口不返回歌手图片，此方法按需并发拉取歌手信息补全 picUrl
   */
  async fillSingerPics(list, concurrency = 5) {
    const pending = list.filter(item => item.id != null && !item.picUrl)
    let cursor = 0
    const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async() => {
      while (cursor < pending.length) {
        const index = cursor++
        const item = pending[index]
        try {
          const { body } = await httpFetch(`http://mobiles.kugou.com/api/v5/singer/info?singerid=${item.id}`).promise
          const data = body?.data
          if (!data) continue
          item.picUrl = data.imgurl ? data.imgurl.replace('{size}', '480') : ''
          if (!item.musicSize) item.musicSize = data.songcount ?? null
          if (!item.albumSize) item.albumSize = data.albumcount ?? null
        } catch (_) {}
      }
    })
    await Promise.all(workers)
    return list
  },
  searchSinger(str, page = 1, limit = 30, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    return httpFetch(`http://msearch.kugou.com/api/v3/search/singer?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}`).promise.then(({ body }) => {
      if (!body || body.status !== 1 || !Array.isArray(body.data)) return this.searchSinger(str, page, limit, retryNum)
      const list = body.data.map(item => ({
        id: item.singerid,
        name: decodeName(item.singername),
        picUrl: '',
        alias: [],
        musicSize: null,
        albumSize: null,
        source: 'kg',
      }))
      // kg 接口固定返回 10 条且忽略翻页参数
      this.total = list.length
      this.page = 1
      this.allPage = 1
      return {
        list,
        allPage: 1,
        limit: list.length,
        total: list.length,
        source: 'kg',
        fillPics: this.fillSingerPics,
      }
    })
  },
  searchAlbum(str, page = 1, limit = 30, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    return httpFetch(`http://msearch.kugou.com/api/v3/search/album?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}`).promise.then(({ body }) => {
      if (!body || body.status !== 1 || !body.data?.info) return this.searchAlbum(str, page, limit, retryNum)
      const list = body.data.info.map(item => ({
        id: item.albumid,
        name: decodeName(item.albumname),
        picUrl: item.imgurl ? item.imgurl.replace('{size}', '400') : '',
        artistName: decodeName(item.singername),
        artistId: null,
        size: item.songcount ?? null,
        publishTime: (item.publishtime || '').split(' ')[0],
        source: 'kg',
      }))
      this.total = body.data.total
      this.page = page
      this.allPage = Math.ceil(this.total / limit)
      return {
        list,
        allPage: this.allPage,
        limit,
        total: this.total,
        source: 'kg',
      }
    })
  },
}
