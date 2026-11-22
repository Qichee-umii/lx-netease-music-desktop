// 音质详情接口（参考 lx-x musicSdk/tx/quality_detail.js）
import { httpFetch } from '../../request'
import { sizeFormate } from '../../index'
import getMusicInfo from './musicInfo'

const pushType = (types: any[], _types: Record<string, any>, type: string, size: string) => {
  types.push({ type, size })
  _types[type] = { size }
}

export const getQualityDetail = async({ songId, songmid }: { songId?: string | number, songmid: string }) => {
  let id = songId
  if (!id) {
    const info = await getMusicInfo(songmid).catch(() => null)
    if (!info?.songId) return Promise.reject(new Error('获取音质信息失败'))
    id = info.songId
  }
  const requestObj = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
    },
    body: {
      comm: {
        ct: '19',
        cv: '1859',
        uin: '0',
      },
      req: {
        module: 'music.trackInfo.UniformRuleCtrl',
        method: 'CgiGetTrackInfo',
        param: {
          types: [1],
          ids: [id],
          ctx: 0,
        },
      },
    },
  })

  return requestObj.promise.then(async({ statusCode, body }) => {
    if (statusCode != 200 || body.code != 0) return Promise.reject(new Error('获取音质信息失败'))

    const track = body.req.data.tracks?.[0]
    const file = track?.file
    if (!file) return Promise.reject(new Error('获取音质信息失败'))

    const types: any[] = []
    const _types: Record<string, any> = {}

    const qualityMap: Array<[string | number, string]> = [
      // [接口字段, 桌面音质档位]（lx-x 'hires' 桌面对应 'flac24bit'）
      ['size_128mp3', '128k'],
      ['size_320mp3', '320k'],
      ['size_flac', 'flac'],
      ['size_hires', 'flac24bit'],
    ]
    for (const [field, type] of qualityMap) {
      const size = (file)[field]
      if (!size) continue
      pushType(types, _types, type, sizeFormate(size))
    }

    if (Array.isArray(file.size_new)) {
      // 参考 lx-x：size_new[0]=master [1]=atmos [2]=atmos_plus
      const newQualityMap: Array<[number, string]> = [
        [0, 'master'],
        [1, 'atmos'],
        [2, 'atmos_plus'],
      ]
      for (const [index, type] of newQualityMap) {
        const size = file.size_new[index]
        if (!size) continue
        pushType(types, _types, type, sizeFormate(size))
      }
    }

    return { types, _types }
  })
}
