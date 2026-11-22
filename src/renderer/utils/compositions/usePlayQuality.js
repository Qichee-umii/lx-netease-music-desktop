import { computed, ref } from '@common/utils/vueTools'
import { updateSetting } from '@renderer/store/setting'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { getMusicUrl } from '@renderer/core/music'
import { getPlayQuality, getPlayQualityBySource, TRY_QUALITYS_LIST } from '@renderer/core/music/utils'
import { getCurrentTime, onLoadedmetadata, setCurrentTime, setPlay, setResource } from '@renderer/plugins/player'
import musicSdk from '@renderer/utils/musicSdk'
import { toOldMusicInfo } from '@common/utils/tools'

// 音质档位中文名（参考图：标准品质 / 超高品质 / 无损品质 / 高解析无损 / 高清臻音 / 超清母带 / 沉浸环绕声）
export const QUALITY_LABELS = {
  master: '超清母带',
  atmos_plus: '沉浸环绕声',
  atmos: '高清臻音',
  flac24bit: '高解析无损',
  flac: '无损品质',
  wav: 'WAV',
  ape: 'APE',
  '320k': '超高品质',
  '192k': '192K',
  '128k': '标准品质',
}

// 音质档位从高到低（与设置页一致；切换弹层也按此顺序展示）
const QUALITYS_DESC = [...TRY_QUALITYS_LIST, '128k']

// 音质徽标文案与配色（菜单改为图片样式后用）
export const QUALITY_BADGES = {
  master: 'MST',
  atmos_plus: 'AT2',
  atmos: 'ATM',
  flac24bit: 'HR',
  flac: 'SQ',
  wav: 'WAV',
  ape: 'APE',
  '320k': 'HQ',
  '192k': '192K',
  '128k': '128K',
}
export const QUALITY_BADGE_CLASS = {
  master: 'badgeMaster',
  atmos_plus: 'badgeAtmosPlus',
  atmos: 'badgeAtmos',
  flac24bit: 'badgeHires',
  flac: 'badgeSq',
  wav: 'badgeSq',
  ape: 'badgeSq',
  '320k': 'badgeHq',
  '192k': 'badgeNormal',
  '128k': 'badgeNormal',
}

// 当前歌曲的音质覆盖，仅在当前歌曲生效；换歌后回落到全局设置
const qualityOverride = ref(null)
const isSwitching = ref(false)
// 音质详情懒取的版本号：拉取完成后自增，触发选项列表重算
const qualityDetailVersion = ref(0)
const qualityDetailFetching = new Set()
const qualityDetailFetched = new Set()

const labelOf = quality => QUALITY_LABELS[quality] ?? quality

const isSwitchable = musicInfo => !!musicInfo && musicInfo.source != 'local'

// 参考 lx-x calcQualitys：只依据歌曲自身的音质元数据构建选项
export default () => {
  // 当前实际使用的音质：本歌有覆盖则用覆盖值，否则按全局设置回退计算
  const currentQuality = computed(() => {
    const musicInfo = playMusicInfo.musicInfo
    if (!isSwitchable(musicInfo)) return ''
    const override = qualityOverride.value
    if (override && override.id == musicInfo.id) return override.quality
    return getPlayQuality(getPlayQualityBySource(musicInfo), musicInfo)
  })

  const qualityOptions = computed(() => {
    // 依赖版本号，音质详情拉取完成后重新计算选项
    const detailVersion = qualityDetailVersion.value
    const musicInfo = playMusicInfo.musicInfo
    if (!isSwitchable(musicInfo)) return []

    const current = currentQuality.value
    const songQualitys = musicInfo.meta?._qualitys
    const hasSongQualitys = !!songQualitys && Object.keys(songQualitys).length > 0

    // 缺少音质元数据时只展示当前档位，不把不存在的音质列给用户
    if (!hasSongQualitys) {
      return current
        ? [{
            value: current,
            label: labelOf(current),
            badge: QUALITY_BADGES[current] ?? '128K',
            badgeClass: QUALITY_BADGE_CLASS[current] ?? 'badgeNormal',
            size: '',
            active: true,
          }]
        : []
    }

    return QUALITYS_DESC
      .filter(quality => songQualitys[quality] || detailVersion < 0)
      .map(quality => ({
        value: quality,
        label: labelOf(quality),
        badge: QUALITY_BADGES[quality] ?? '128K',
        badgeClass: QUALITY_BADGE_CLASS[quality] ?? 'badgeNormal',
        size: songQualitys[quality]?.size || '',
        active: quality == current,
      }))
  })

  // 参考 lx-x fetchAndApplyDetailedQuality：打开菜单时后台补全歌曲的高音质元数据
  const ensureQualityDetail = async() => {
    const musicInfo = playMusicInfo.musicInfo
    if (!isSwitchable(musicInfo)) return
    if (qualityDetailFetched.has(musicInfo.id) || qualityDetailFetching.has(musicInfo.id)) return
    const getQualityDetail = musicSdk[musicInfo.source]?.getQualityDetail
    if (!getQualityDetail) return
    qualityDetailFetching.add(musicInfo.id)
    try {
      const { types } = await getQualityDetail(toOldMusicInfo(musicInfo))
      if (types?.length) {
        qualityDetailFetched.add(musicInfo.id)
        const metaQualitys = musicInfo.meta.qualitys ?? []
        for (const item of types) {
          if (musicInfo.meta._qualitys[item.type]) continue
          musicInfo.meta._qualitys[item.type] = item
          metaQualitys.push(item)
        }
        musicInfo.meta.qualitys = metaQualitys
      }
    } catch (err) {
      // 拉取失败不阻塞菜单，下次打开再试
      console.debug('get quality detail failed:', err)
    } finally {
      qualityDetailFetching.delete(musicInfo.id)
      qualityDetailVersion.value++
    }
  }

  const waitResourceLoaded = url => new Promise((resolve, reject) => {
    let offLoadedmetadata = null
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, 10000)
    function cleanup() {
      clearTimeout(timer)
      if (offLoadedmetadata) {
        offLoadedmetadata()
        offLoadedmetadata = null
      }
    }
    try {
      // loadedmetadata 比 loadeddata 更早触发，缩短切换等待（参考 lx-x 优化切换速度）
      offLoadedmetadata = onLoadedmetadata(() => {
        cleanup()
        resolve()
      })
      setResource(url)
    } catch (err) {
      cleanup()
      reject(err)
    }
  })

  // 以指定音质重新获取链接，并保持当前播放进度
  const switchQuality = async quality => {
    const musicInfo = playMusicInfo.musicInfo
    if (!isSwitchable(musicInfo) || isSwitching.value) return
    if (quality == currentQuality.value) return

    isSwitching.value = true
    const prevOverride = qualityOverride.value
    const seekTime = getCurrentTime()
    const wasPlaying = isPlay.value

    try {
      // 参考 lx-x：先尝试命中缓存链接秒切，未命中再强制刷新
      let url = await getMusicUrl({ musicInfo, quality, isRefresh: false })
      if (!url) url = await getMusicUrl({ musicInfo, quality, isRefresh: true })
      if (!url) throw new Error('empty url')
      qualityOverride.value = { id: musicInfo.id, quality }
      await waitResourceLoaded(url)
      if (seekTime > 0) setCurrentTime(seekTime)
      if (wasPlaying) setPlay()
      updateSetting({ 'player.playQuality': quality })
    } catch (err) {
      qualityOverride.value = prevOverride
      console.error('switch play quality failed', err)
    } finally {
      isSwitching.value = false
    }
  }

  return {
    currentQuality,
    qualityOptions,
    isSwitching,
    ensureQualityDetail,
    switchQuality,
  }
}
