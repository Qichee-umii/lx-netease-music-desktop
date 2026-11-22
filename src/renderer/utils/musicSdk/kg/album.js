import { getMusicInfosByList } from './musicInfo'
import { createHttpFetch } from './util'

export default {
  /**
   * 通过AlbumId获取专辑信息
   * @param {*} id
   */
  async getAlbumInfo(id) {
    // v3/album/info 端点：{errcode,status?,data:{albumname,singername,intro,publishtime,imgurl,...}}，createHttpFetch 自动解包 data
    const albumInfo = await createHttpFetch(`http://mobiles.kugou.com/api/v3/album/info?version=5&albumid=${id}`)
    if (!albumInfo?.albumname) return Promise.reject(new Error('get album info failed.'))

    return {
      name: albumInfo.albumname,
      image: albumInfo.imgurl ? albumInfo.imgurl.replace('{size}', 240) : '',
      desc: albumInfo.intro,
      authorName: albumInfo.singername,
      publishDate: albumInfo.publishtime?.split(' ')[0] ?? '',
    }
  },
  /**
   * 通过AlbumId获取专辑
   * @param {*} id
   * @param {*} page
   */
  async getAlbumDetail(id, page = 1, limit = 200) {
    const albumList = await createHttpFetch(`http://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${id}&plat=0&pagesize=${limit}&area_code=0&page=${page}&with_res_tag=0`)
    if (!albumList.info) return Promise.reject(new Error('Get album list failed.'))

    let result = await getMusicInfosByList(albumList.info)

    const info = await this.getAlbumInfo(id)

    return {
      list: result || [],
      page,
      limit,
      total: albumList.total,
      source: 'kg',
      info: {
        name: info.name,
        img: info.image,
        desc: info.desc,
        author: info.authorName,
        publishDate: info.publishDate,
        // play_count: this.formatPlayCount(info.count),
      },
    }
  },
}
