<template>
  <div :class="$style.artistCells">
    <button
      v-for="artist in artists"
      :key="artist.id || artist.name"
      type="button"
      :class="$style.artistChip"
      :title="artist.name"
      @click.stop="$emit('artist-click', artist)"
    >
      <span :class="$style.artistAvatar">
        <img v-if="artistPic(artist)" :src="artistPic(artist)" loading="lazy" decoding="async" @error="handlePicError($event)">
        <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" space="preserve">
          <use xlink:href="#icon-artist" />
        </svg>
      </span>
      <span :class="$style.artistName">{{ artist.name }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'MaterialArtistCells',
  props: {
    artists: {
      type: Array,
      default() {
        return []
      },
    },
  },
  emits: ['artist-click'],
  setup() {
    // wy 搜索返回的歌手只有 img1v1Url，统一在这里取头像；缺省或空串时退回占位图标
    const artistPic = artist => {
      const url = artist?.picUrl || artist?.img1v1Url || ''
      // wy 的无头像占位图（img1v1 默认图）不显示
      if (!url || url.includes('/6y-UleORITEDbvrOLV0Q8A==/')) return ''
      return url
    }

    // 头像加载失败：退回占位图标（与封面处理一致）
    const handlePicError = event => {
      event.target.style.display = 'none'
    }

    return {
      artistPic,
      handlePicError,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.artistCells {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  max-width: 100%;
}

.artistChip {
  display: inline-flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-font);
  cursor: pointer;

  &:hover {
    color: var(--color-primary-font-active);
  }
}

.artistAvatar {
  flex: none;
  display: flex;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-primary-alpha-900);
  align-items: center;
  justify-content: center;

  svg {
    width: 100%;
    height: 100%;
    fill: var(--color-font-label);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.artistName {
  min-width: 0;
  .mixin-ellipsis-1();
}
</style>
