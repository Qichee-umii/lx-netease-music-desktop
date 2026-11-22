<template>
  <div :class="$style.desktopLyricBtn">
    <button
      ref="dom_btn"
      type="button"
      :class="btnClass"
      :aria-label="toggleDesktopLyricBtnTitle"
      :title="toggleDesktopLyricBtnTitle"
      @click.stop="toggleDesktopLyric"
      @contextmenu.prevent="toggleLockDesktopLyric"
    >
      <svg v-show="appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :height="iconHeight" viewBox="0 0 512 512" space="preserve">
        <use xlink:href="#icon-desktop-lyric-on" />
      </svg>
      <svg v-show="!appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :height="iconHeight" viewBox="0 0 512 512" space="preserve">
        <use xlink:href="#icon-desktop-lyric-off" />
      </svg>
    </button>
  </div>
</template>

<script>
import { appSetting } from '@renderer/store/setting'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'

export default {
  name: 'DesktopLyricBtn',
  props: {
    // PlayBar 与 PlayDetail 的按钮样式不同，由父组件传入
    btnClass: {
      type: [String, Array, Object],
      default: '',
    },
    iconHeight: {
      type: String,
      default: '100%',
    },
  },
  setup() {
    const { toggleDesktopLyricBtnTitle, toggleDesktopLyric, toggleLockDesktopLyric } = useToggleDesktopLyric()

    return {
      appSetting,
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.desktopLyricBtn {
  position: relative;
  flex: none;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
}
</style>
