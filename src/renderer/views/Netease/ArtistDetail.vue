<template>
  <div :class="$style.container">
    <section :class="$style.hero">
      <button
        v-if="isWy && artist?.id"
        type="button"
        :class="[$style.follow, { [$style.liked]: isFollowed }]"
        :aria-label="isFollowed ? '取消关注' : '关注歌手'"
        @click="handleFollowArtist"
      >
        <span>{{ isFollowed ? '♥' : '♡' }}</span>
      </button>
      <img v-if="artistBg" :class="$style.bg" :src="artistBg" decoding="async">
      <button type="button" :class="$style.back" @click="router.back()">返回</button>
      <div :class="$style.profile">
        <img v-if="artistAvatar" :class="$style.avatar" :src="artistAvatar" decoding="async">
        <div :class="$style.info">
          <h2>
            {{ displayName }}
            <span v-if="artistAlias">{{ artistAlias }}</span>
          </h2>
          <p class="scroll">{{ artistDesc || '暂无简介' }}</p>
          <div :class="$style.stats">
            <span>{{ songTotal }} 首歌</span>
            <span v-if="hasAlbumTab">{{ albumTotal }} 张专辑</span>
          </div>
        </div>
      </div>
    </section>

    <div :class="$style.tabs">
      <div :class="$style.mainTabs">
        <button type="button" :class="{[$style.active]: tab == 'songs'}" @click="tab = 'songs'">歌曲</button>
        <button v-if="hasAlbumTab" type="button" :class="{[$style.active]: tab == 'albums'}" @click="tab = 'albums'">专辑</button>
      </div>
      <div v-show="tab == 'songs' && (isWy || source == 'tx')" :class="$style.songSortTabs">
        <button type="button" :class="{[$style.active]: songSort == 'hot'}" @click="handleSongSortChange('hot')">热门</button>
        <button type="button" :class="{[$style.active]: songSort == 'time'}" @click="handleSongSortChange('time')">最新</button>
      </div>
    </div>

    <div v-show="tab == 'songs'" :class="$style.panel">
      <div :class="$style.songListWrap" @click="handleSongMessageClick">
        <material-online-list
          ref="onlineListRef"
          :list-id="artistSongListId"
          force-play-list
          :page="1"
          :limit="Math.max(songs.length, 1)"
          :total="songs.length"
          :list="songs"
          :no-item="songMessage"
          @play-list="handlePlayList"
        />
      </div>
    </div>

    <div v-show="tab == 'albums'" class="scroll" :class="$style.albumPanel">
      <div v-if="albumMessage" :class="[$style.message, { [$style.retryable]: albumsFailed }]" @click="handleAlbumMessageClick">{{ albumMessage }}</div>
      <div v-else :class="$style.grid">
        <button v-for="album in albums" :key="album.id" type="button" :class="$style.card" @click="openAlbum(album)">
          <img :src="album.info.img" decoding="async" loading="lazy">
          <strong>{{ album.info.name }}</strong>
          <span>{{ album.info.author }}</span>
          <em>{{ album.count }} 首</em>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import musicSdk from '@renderer/utils/musicSdk'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { LIST_IDS } from '@common/constants'
import { toggleWyFollowArtist } from '@renderer/store/user/action'
import { wyFollowedArtists } from '@renderer/store/user/state'

const route = useRoute()
const router = useRouter()
const tab = ref<'songs' | 'albums'>('songs')
const getRouteSongSort = () => route.query.sort == 'time' ? 'time' : 'hot'
const songSort = ref<'hot' | 'time'>(getRouteSongSort())
const artist = ref<any>(null)
const songs = ref<LX.Music.MusicInfoOnline[]>([])
const albums = ref<any[]>([])
const songMessage = ref('加载中...')
const albumMessage = ref('加载中...')
const onlineListRef = ref<any>(null)
const songsFailed = ref(false)
const albumsFailed = ref(false)

const artistId = computed(() => String(route.query.id ?? ''))
const source = computed(() => (route.query.source ?? 'wy') as string)
const isWy = computed(() => source.value == 'wy')
// wy 有歌手专辑列表接口；kg 有歌手专辑列表；tx 走 musicu.fcg GetAlbumList；kw 靠专辑搜索过滤歌手，mg 无专辑数据
const hasAlbumTab = computed(() => isWy.value || ['kg', 'tx', 'kw'].includes(source.value))
const displayName = computed(() => artist.value?.info?.name ?? route.query.name ?? '网易云歌手')
const artistAvatar = computed(() => artist.value?.info?.avatar ?? artist.value?.info?.img ?? artist.value?.info?.cover ?? '')
const artistBg = computed(() => artist.value?.info?.cover ?? artistAvatar.value)
const artistAlias = computed(() => artist.value?.info?.alias?.length ? artist.value.info.alias[0] : '')
const artistDesc = computed(() => artist.value?.info?.desc ?? '')
const songTotal = computed(() => artist.value?.count?.music ?? songs.value.length)
const albumTotal = computed(() => artist.value?.count?.album || albums.value.length)
const isFollowed = computed(() => wyFollowedArtists.some(item => String(item.id) == artistId.value))
const artistSongListId = computed(() => `${source.value}_artist_${artistId.value}_${songSort.value}`)

const restoreScroll = () => {
  const index = route.query.scrollIndex
  if (index == null) return
  tab.value = 'songs'
  void nextTick(() => {
    onlineListRef.value?.scrollToIndex(Number(index))
  })
}

const fetchSongPage = async(page: number, sort = songSort.value) => {
  if (isWy.value) {
    return musicSdk.wy.singer.getSongList(artistId.value, page, 100, sort)
  }
  if (source.value == 'tx') {
    // tx 歌手搜索支持热门/最新排序（GetSingerSongList order: 1=热门 2=最新）；kw/kg 无排序参数自动忽略
    return musicSdk.tx.songList.getListDetail(`artist_${artistId.value}`, page, sort)
  }
  return (musicSdk as any)[source.value].songList.getListDetail(source.value == 'mg'
    ? `artist_${artistId.value}@${encodeURIComponent(String(route.query.name ?? ''))}`
    : `artist_${artistId.value}`, page)
}

const loadSongs = async(sort = songSort.value) => {
  if (!artistId.value) return
  songsFailed.value = false
  songMessage.value = '加载中...'
  try {
    const first = await fetchSongPage(1, sort)
    if (sort != songSort.value) return
    let list = first.list ?? []
    const total = first.total ?? list.length
    const limit = first.limit ?? 100
    const pageCount = limit > 0 ? Math.ceil(total / limit) : 1
    const capPages = Math.min(pageCount, 20)
    if (capPages > 1 && list.length) {
      const rest = await Promise.all(
        Array.from({ length: capPages - 1 }, async(_, i) => fetchSongPage(i + 2, sort).catch(() => null)),
      )
      let merged = list
      for (const r of rest) {
        if (r?.list) merged = merged.concat(r.list)
      }
      list = merged
    }
    if (sort != songSort.value) return
    songs.value = deduplicationList(list.map((m: any) => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[])
    restoreScroll()
    songMessage.value = songs.value.length ? '' : '暂无歌曲'
  } catch (err: any) {
    if (sort != songSort.value) return
    songsFailed.value = true
    songMessage.value = (err?.message || '歌手歌曲加载失败') + '，点击重试'
    songs.value = []
    console.log(err)
  }
}

const loadAlbums = async() => {
  if (!artistId.value) return
  albumsFailed.value = false
  albumMessage.value = '加载中...'
  try {
    let albumRes
    if (isWy.value) {
      albumRes = await musicSdk.wy.singer.getAlbumList(artistId.value, 1, 100)
    } else if (source.value == 'kg') {
      albumRes = await musicSdk.kg.singer.getAlbumList(artistId.value, 1, 100)
    } else if (source.value == 'tx') {
      albumRes = await musicSdk.tx.singer.getAlbumList(artistId.value, 1, 100)
    } else if (source.value == 'kw') {
      // kw 无歌手专辑 API：用专辑搜索 + 按 artistId 过滤的近似方案
      const albumResKw = await musicSdk.kw.musicSearch.searchAlbum(String(route.query.name ?? ''), 1, 100)
      albums.value = albumResKw.list
        .filter((a: any) => String(a.artistId) === artistId.value)
        .map((a: any) => ({ id: a.id, info: { name: a.name, author: a.artistName, img: a.picUrl }, count: a.size }))
      albumMessage.value = albums.value.length ? '' : '暂无专辑'
      return
    } else {
      albums.value = []
      albumMessage.value = ''
      return
    }
    albums.value = albumRes.list
    albumMessage.value = albums.value.length ? '' : '暂无专辑'
  } catch (err: any) {
    albumsFailed.value = true
    albums.value = []
    albumMessage.value = (err?.message || '专辑加载失败') + '，点击重试'
    console.log(err)
  }
}

const load = async() => {
  if (!artistId.value) {
    songMessage.value = '缺少歌手 ID'
    albumMessage.value = '缺少歌手 ID'
    return
  }
  songsFailed.value = false
  albumsFailed.value = false
  if (isWy.value) {
    try {
      artist.value = await musicSdk.wy.singer.getInfo(artistId.value)
    } catch (err: any) {
      songsFailed.value = true
      songMessage.value = (err?.message || '歌手详情加载失败') + '，点击重试'
      console.log(err)
    }
    if (!hasAlbumTab.value) albumMessage.value = ''
    else void loadAlbums()
    await loadSongs()
    return
  }
  // 其他平台：统一走 songList 的 artist_ 前缀分支（返回 {list,total,info{name,img,desc,author}}）
  // mg 无歌手歌曲接口，需把歌手名编入 id 供搜索兜底：<id>@<encodeURIComponent(name)>
  const detailId = source.value == 'mg'
    ? `artist_${artistId.value}@${encodeURIComponent(String(route.query.name ?? ''))}`
    : `artist_${artistId.value}`
  try {
    const res = await (musicSdk as any)[source.value].songList.getListDetail(detailId, 1)
    artist.value = {
      info: {
        name: res.info?.name ?? route.query.name ?? '',
        desc: res.info?.desc ?? '',
        img: res.info?.img ?? '',
      },
      count: { music: res.total ?? 0, album: 0 },
    }
  } catch (err: any) {
    songsFailed.value = true
    console.log(err)
  }
  // tx：并发拉真实歌手信息（GetHomepageHeader 头像/名字 + 专辑/歌曲总数），失败保持原数据
  if (source.value == 'tx') void enrichTxArtistInfo()
  if (!hasAlbumTab.value) albumMessage.value = ''
  else void loadAlbums()
  await loadSongs()
}

const enrichTxArtistInfo = async() => {
  if (!artistId.value) return
  try {
    const detail = await (musicSdk as any).tx.singer.getInfo(artistId.value)
    if (!artist.value) return
    artist.value = {
      ...artist.value,
      id: detail.id,
      info: {
        ...artist.value.info,
        name: detail.info?.name || artist.value.info?.name,
        avatar: detail.info?.avatar || artist.value.info?.avatar,
        gender: detail.info?.gender || '',
      },
      count: {
        music: detail.count?.music || artist.value.count?.music || 0,
        album: detail.count?.album || 0,
      },
    }
  } catch (err) {
    console.log(err)
  }
}

const openAlbum = (album: any) => {
  if (isWy.value) {
    void router.push({
      path: '/netease/album',
      query: {
        id: String(album.id),
        name: album.info.name,
      },
    })
  } else {
    void router.push({
      path: '/album',
      query: {
        source: source.value,
        id: String(album.id),
        name: album.info.name,
      },
    })
  }
}

const handlePlayList = async(index: number) => {
  await setTempList(artistSongListId.value, [...songs.value])
  playList(LIST_IDS.TEMP, index)
}

const handleSongSortChange = (sort: 'hot' | 'time') => {
  if (songSort.value == sort) return
  songSort.value = sort
  void loadSongs(sort)
}

const handleFollowArtist = async() => {
  if (!artist.value?.id) return
  await toggleWyFollowArtist({
    id: artist.value.id,
    name: artist.value.info?.name,
    picUrl: artistAvatar.value,
    img1v1Url: artistAvatar.value,
  })
}

const handleSongMessageClick = () => {
  if (!songsFailed.value) return
  void loadSongs()
}

const handleAlbumMessageClick = () => {
  if (!albumsFailed.value) return
  void loadAlbums()
}

onMounted(() => {
  void load()
})

watch(() => [route.query.scrollIndex, route.query.locationId, route.query.sort], () => {
  const routeSort = getRouteSongSort()
  if (routeSort != songSort.value) {
    songSort.value = routeSort
    void loadSongs(routeSort)
    return
  }
  restoreScroll()
})

watch(() => [route.query.id, route.query.source], () => {
  songSort.value = getRouteSongSort()
  void load()
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
}

.hero {
  position: relative;
  flex: none;
  height: 218px;
  overflow: hidden;
  background: #222;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(0, 0, 0, .62), rgba(0, 0, 0, .32));
  }
}

.bg {
  position: absolute;
  inset: -30px;
  width: calc(100% + 60px);
  height: calc(100% + 60px);
  object-fit: cover;
  filter: blur(18px) brightness(.68);
}

.back {
  position: absolute;
  left: 16px;
  top: 14px;
  z-index: 2;
  border: 0;
  border-radius: 4px;
  padding: 7px 12px;
  background: rgba(0, 0, 0, .35);
  color: #fff;
  cursor: pointer;
}

.follow {
  position: absolute;
  right: 16px;
  top: 14px;
  z-index: 2;
  border: 0;
  border-radius: 4px;
  width: 42px;
  height: 34px;
  padding: 0;
  background: rgba(255, 255, 255, .18);
  color: #fff;
  cursor: pointer;

  span {
    display: block;
    margin-top: -1px;
    font-size: 22px;
    line-height: 34px;
  }

  &.liked {
    color: #e94b5f;
  }
}

.profile {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 76px 28px 18px;
  color: #fff;
}

.avatar {
  flex: none;
  width: 112px;
  height: 112px;
  border-radius: 56px;
  object-fit: cover;
  object-position: center;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .35);
}

.info {
  min-width: 0;
  max-width: 800px;

  h2 {
    margin-bottom: 10px;
    font-size: 28px;
    font-weight: 700;
    .mixin-ellipsis-1();

    span {
      margin-left: .5em;
      font-size: 16px;
      color: rgba(255, 255, 255, .78);
      font-weight: 400;
    }
  }

  p {
    max-width: 780px;
    max-height: 66px;
    padding-right: 8px;
    overflow: auto;
    font-size: 14px;
    line-height: 22px;
    color: rgba(255, 255, 255, .82);
  }
}

.stats {
  display: flex;
  gap: 18px;
  margin-top: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, .82);
}

.tabs {
  flex: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;

  button {
    border: 0;
    border-bottom: 2px solid transparent;
    padding: 8px 8px 7px;
    background: transparent;
    color: var(--color-font);
    cursor: pointer;
  }
}

.mainTabs,
.songSortTabs {
  display: flex;
  gap: 10px;
}

.active {
  color: var(--color-primary-font-active) !important;
  border-bottom-color: var(--color-primary-font-active) !important;
}

.panel,
.albumPanel {
  position: relative;
  flex: auto;
  min-height: 0;
}

.panel {
  display: flex;
  flex-flow: column nowrap;
}

.songSortTabs {
  button {
    padding: 5px 8px 6px;
    font-size: 13px;
  }
}

.songListWrap {
  position: relative;
  flex: auto;
  min-height: 0;
}

.albumPanel {
  padding: 8px 18px 20px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
}

.card {
  border: 0;
  text-align: left;
  background: transparent;
  color: var(--color-font);
  cursor: pointer;

  img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 6px;
  }

  strong,
  span,
  em {
    display: block;
    margin-top: 7px;
    font-style: normal;
    .mixin-ellipsis-1();
  }

  span,
  em {
    color: var(--color-font-label);
    font-size: 12px;
  }
}

.message {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);

  &.retryable {
    cursor: pointer;
    color: var(--color-primary);

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
