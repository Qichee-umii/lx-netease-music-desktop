// 音质详情接口（参考 lx-x musicSdk/wy/quality_detail.js）
// https://music.163.com/api/song/music/detail/get
import { httpFetch } from '../../request'
import { sizeFormate } from '../../index'

const pushType = (types: any[], _types: Record<string, any>, type: string, size: string) => {
  types.push({ type, size })
  _types[type] = { size }
}

export const getQualityDetail = async(songInfo: any) => {
  const requestObj = httpFetch(`https://music.163.com/api/song/music/detail/get?songId=${songInfo.songmid}`, {
    method: 'get',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      Referer: 'https://music.163.com/',
    },
  })

  return requestObj.promise.then(async({ statusCode, body }) => {
    if (statusCode != 200 || body.code != 200) return Promise.reject(new Error('获取音质信息失败'))

    const data = body.data

    const types: any[] = []
    const _types: Record<string, any> = {}

    const qualityMap: Array<[string, string]> = [
      // [接口字段, 桌面音质档位]（lx-x 'hires' 桌面对应 'flac24bit'）
      ['l', '128k'],
      ['m', '128k'],
      ['h', '320k'],
      ['sq', 'flac'],
      ['hr', 'flac24bit'],
      ['jm', 'master'],
      ['je', 'atmos'],
    ]
    for (const [field, type] of qualityMap) {
      const size = data[field]?.size
      if (size == null || (type in _types)) continue
      pushType(types, _types, type, sizeFormate(size))
    }

    return { types, _types }
  })
}
