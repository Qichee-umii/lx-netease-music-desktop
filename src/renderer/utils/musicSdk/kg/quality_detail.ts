// 音质详情接口（参考 lx-x musicSdk/kg/quality_detail.js）
// https://gateway.kugou.com/goodsmstore/v1/get_res_privilege
import { httpFetch } from '../../request'
import { sizeFormate } from '../../index'

export const getQualityDetail = async(songInfo: any) => {
  const requestObj = httpFetch(
    `https://gateway.kugou.com/goodsmstore/v1/get_res_privilege?appid=1005&clientver=20049&clienttime=${Date.now()}&mid=NeZha`,
    {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
      },
      body: {
        behavior: 'play',
        clientver: '20049',
        resource: [
          {
            id: 0,
            type: 'audio',
            hash: songInfo.hash,
          },
        ],
        area_code: '1',
        quality: '128',
        qualities: ['128', '320', 'flac', 'high', 'dolby', 'viper_atmos', 'viper_tape', 'viper_clear'],
      },
    },
  )

  return requestObj.promise.then(async({ statusCode, body }) => {
    if (statusCode != 200 || body.error_code != 0) return Promise.reject(new Error('获取音质信息失败'))

    const songData = body.data?.[0]
    const types: any[] = []
    const _types: Record<string, any> = {}
    if (!songData?.relate_goods) return { types, _types }

    // lx-x kg quality → 桌面档位（'high' 即 lx-x 'hires' → 'flac24bit'）
    const qualityMap: Record<string, string> = {
      128: '128k',
      320: '320k',
      flac: 'flac',
      high: 'flac24bit',
      viper_clear: 'master',
      viper_atmos: 'atmos',
    }
    for (const goods of songData.relate_goods) {
      const type = qualityMap[goods.quality]
      const size = goods.info?.filesize
      if (!type || !size || _types[type]) continue
      types.push({ type, size: sizeFormate(size), hash: goods.hash })
      _types[type] = { size: sizeFormate(size), hash: goods.hash }
    }

    return { types, _types }
  })
}
