<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <base-tab v-model="source" :list="sources" @change="handleSourceChange" />
      <div :class="$style.headerRight">
        <base-tab v-model="searchType" :list="searchTypes" @change="handleTypeChange" />
      </div>
    </div>
    <div :class="$style.main">
      <song-list-list v-if="searchType == 'songlist'" v-show="searchText" :page="page" :source-id="source" />
      <netease-result-list v-else-if="searchType == 'singer' || searchType == 'album'" v-show="searchText" :page="page" :type="searchType" :source-id="source" />
      <music-list v-else v-show="searchText" :page="page" :source-id="source" />
      <blank-view :visible="!searchText" :source="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import { sources as _sources } from '@renderer/store/search/music'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import NeteaseResultList from './NeteaseResultList/index.vue'
import BlankView from './components/BlankView.vue'
import { computed, ref } from '@common/utils/vueTools'
import { sourceNames } from '@renderer/store'
import musicSdk from '@renderer/utils/musicSdk'

const source = ref('kw')
const searchType = ref('music')
const page = ref(1)
const supportsArtistSearch = id => {
  const sdk = musicSdk[id]
  return !!(sdk?.musicSearch?.searchSinger && sdk?.musicSearch?.searchAlbum)
}

const verifyQueryParams = async(to, from, next) => {
  let _source = to.query.source
  let _type = to.query.type
  let _page = to.query.page

  if (_source == null || _type == null) {
    const setting = await getSearchSetting()
    _source ??= setting.source
    _type ??= setting.type

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  source.value = _source
  searchType.value = _type

  page.value = _page ? parseInt(_page) : 1

  if (to.query.text != null) {
    searchText.value = to.query.text
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  components: {
    MusicList,
    SongListList,
    NeteaseResultList,
    BlankView,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()

    const allSources = _sources.map(id => {
      return {
        id,
        label: sourceNames.value[id],
      }
    })
    const sources = computed(() => {
      if (searchType.value == 'singer' || searchType.value == 'album') {
        return allSources.filter(item => supportsArtistSearch(item.id))
      }
      return allSources
    })
    const handleSourceChange = (id) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          source: id,
          page: 1,
        },
      })
    }

    const searchTypes = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
        { label: window.i18n.t('search__type_singer'), id: 'singer' },
        { label: window.i18n.t('search__type_album'), id: 'album' },
      ]
    })
    const handleTypeChange = (type) => {
      let nextSource = source.value
      if ((type == 'singer' || type == 'album') && !supportsArtistSearch(nextSource)) {
        nextSource = allSources.find(item => supportsArtistSearch(item.id))?.id ?? 'wy'
      }
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          source: nextSource,
          page: 1,
        },
      })
    }

    return {
      sources,
      source,
      handleSourceChange,
      searchTypes,
      searchType,
      handleTypeChange,
      page,
      searchText,
    }
  },
}


</script>

<style lang="less" module>
.container {
  display: flex;
  flex-flow: column nowrap;
}

.header {
  // padding: 5px 0;
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
}

.headerRight {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 10px;
}

.main {
  position: relative;
  flex: auto;
  // min-height: 0;
}
</style>
