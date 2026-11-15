<template>
  <div :class="$style.container">
    <div v-show="!noItemLabel" class="scroll" :class="$style.content">
      <div :class="$style.grid">
        <button
          v-for="item in list"
          :key="item.id"
          type="button"
          :class="[$style.card, { [$style.disabled]: !isDetailSupported }]"
          @click="openDetail(item)"
        >
          <img v-if="item.picUrl" :class="{ [$style.artistPic]: type == 'singer' }" :src="item.picUrl" loading="lazy" decoding="async">
          <div v-else :class="{ [$style.picPlaceholder]: true, [$style.artistPic]: type == 'singer' }"></div>
          <strong>{{ item.name }}</strong>
          <span v-if="type == 'singer' && item.alias?.length">{{ item.alias.join(' / ') }}</span>
          <span v-else-if="type == 'singer'">{{ formatSingerStats(item) }}</span>
          <span v-else>{{ item.artistName }}</span>
          <em v-if="type == 'album'">{{ formatAlbumInfo(item) }}</em>
        </button>
      </div>
      <div :class="$style.pagination">
        <material-pagination :count="total" :limit="limit" :page="pageInfo" @btn-click="togglePage" />
      </div>
    </div>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-show="noItemLabel" :class="$style.noitem">
        <p v-text="noItemLabel" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '@common/utils/vueTools'
import { searchText } from '@renderer/store/search/state'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import musicSdk from '@renderer/utils/musicSdk'

type ResultType = 'singer' | 'album'

const props = defineProps<{
  type: ResultType
  page: number
  sourceId: string
}>()

const router = useRouter()
const route = useRoute()
const list = ref<any[]>([])
const total = ref(0)
const limit = ref(20)
const pageInfo = ref(1)
const noItemLabel = ref('')
const key = ref('')

// 支持点击进入详情页的（源，类型）组合
// wy 走原 /netease 路由；其余走 /artist、/album 详情页
// mg 专辑搜索结果为长 id，无法查询专辑歌曲，仍不支持
const DETAIL_UNSUPPORTED = new Set([
  'mg__album',
])
const isDetailSupported = computed(() => !DETAIL_UNSUPPORTED.has(`${props.sourceId}__${props.type}`))

const load = async(text: string, type: ResultType, page: number) => {
  if (!text) {
    list.value = []
    total.value = 0
    pageInfo.value = 1
    noItemLabel.value = ''
    key.value = ''
    return
  }
  const nextKey = `${props.sourceId}__${type}__${page}__${text}`
  if (key.value == nextKey && list.value.length) return
  key.value = nextKey
  noItemLabel.value = window.i18n.t('list__loading')
  try {
    const targetSdk = (musicSdk as any)[props.sourceId]
    const result = type == 'singer'
      ? await targetSdk.musicSearch.searchSinger(text, page)
      : await targetSdk.musicSearch.searchAlbum(text, page)
    if (key.value != nextKey) return
    list.value = result.list
    total.value = result.total
    limit.value = result.limit
    pageInfo.value = page
    noItemLabel.value = text && !result.list.length && page == 1 ? window.i18n.t('no_item') : ''
    // kg 歌手搜索接口不返回图片，异步补全后原位更新
    if (result.fillPics) void result.fillPics(list.value)
  } catch (err) {
    if (key.value != nextKey) return
    list.value = []
    total.value = 0
    noItemLabel.value = window.i18n.t('list__load_failed')
    console.log(err)
  }
}

watch(() => [props.type, props.page, props.sourceId, searchText.value], ([type, page, sourceId, text]) => {
  setTimeout(() => {
    void load(String(text), type as ResultType, Number(page) || 1)
  })
}, {
  immediate: true,
})

const togglePage = (page: number) => {
  void router.replace({
    path: route.path,
    query: {
      ...route.query,
      page,
    },
  })
}

const openDetail = (item: any) => {
  if (!isDetailSupported.value) return
  if (props.type == 'singer') {
    if (props.sourceId == 'wy') {
      void router.push({
        path: '/netease/artist',
        query: {
          id: String(item.id),
          name: item.name,
        },
      })
    } else {
      void router.push({
        path: '/artist',
        query: {
          source: props.sourceId,
          id: String(item.id),
          name: item.name,
        },
      })
    }
    return
  }
  if (props.sourceId == 'wy') {
    void router.push({
      path: '/netease/album',
      query: {
        id: String(item.id),
        name: item.name,
      },
    })
  } else if (props.sourceId != 'mg') {
    void router.push({
      path: '/album',
      query: {
        source: props.sourceId,
        id: String(item.id),
        name: item.name,
      },
    })
  }
}

const formatSingerStats = (item: any) => {
  const parts = []
  if (item.musicSize != null) parts.push(`${item.musicSize} 首歌`)
  if (item.albumSize != null) parts.push(`${item.albumSize} 张专辑`)
  return parts.join(' / ')
}

const formatAlbumInfo = (item: any) => {
  const parts = []
  if (item.size != null) parts.push(`${item.size} 首`)
  if (item.publishTime) {
    const date = new Date(item.publishTime)
    parts.push(isNaN(date.getTime()) ? String(item.publishTime) : date.toLocaleDateString())
  }
  return parts.join(' / ')
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.content {
  height: 100%;
  padding: 15px 18px 0;
  box-sizing: border-box;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 20px;
}

.card {
  min-width: 0;
  border: 0;
  padding: 12px;
  background: transparent;
  border-radius: 8px;
  color: var(--color-font);
  text-align: left;
  cursor: pointer;
  transition: background @transition-normal, transform @transition-normal;

  &:hover {
    background: rgba(128, 128, 128, .08);
    transform: translateY(-2px);
  }

  &.disabled {
    cursor: default;

    &:hover {
      background: transparent;
      transform: none;
    }
  }

  img {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    object-fit: cover;
    background: var(--color-primary-alpha-900);
  }

  .picPlaceholder {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--color-primary-alpha-900), var(--color-primary-alpha-800));
  }

  .artistPic {
    border-radius: 50%;
  }

  strong,
  span,
  em {
    display: block;
    min-width: 0;
    font-style: normal;
    .mixin-ellipsis-1();
  }

  strong {
    margin-top: 10px;
    font-size: 13px;
    font-weight: 600;
  }

  span,
  em {
    margin-top: 5px;
    color: var(--color-font-label);
    font-size: 12px;
  }
}

.pagination {
  text-align: center;
  padding: 15px 0;
}

.noitem {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}
</style>
