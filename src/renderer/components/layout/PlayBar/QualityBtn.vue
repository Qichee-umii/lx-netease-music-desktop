<template>
  <div v-if="currentLabel" :class="$style.qualityBtn" @mouseenter="handleMsEnter" @mouseleave="handleMsLeave">
    <button
      ref="dom_btn"
      type="button"
      :class="[$style.btn, isSwitching && $style.switching]"
      :disabled="!canSwitch"
      :aria-label="$t('player__play_quality')"
      :title="$t('player__play_quality')"
      @click.stop="handleMsEnter"
    >
      {{ currentLabel }}
    </button>
    <!-- 参考 lx-x 的音质选择弹层：每项带音质徽标（图片样式）+ 中文档位名，当前档位高亮 -->
    <base-popup v-model:visible="isShowMenu" :btn-el="dom_btn" :class="$style.qualityPopup" @mouseenter="handleMsEnter" @mouseleave="handleMsLeave">
      <ul :class="$style.qualityList" role="menu">
        <li
          v-for="option in qualityOptions"
          :key="option.value"
          role="menuitem"
          :class="[$style.qualityItem, option.active && $style.active, isSwitching && $style.disabled]"
          @click="handleMenuClick(option)"
        >
          <span :class="[$style.badge, $style[option.badgeClass]]">{{ option.badge }}</span>
          <span :class="$style.qualityName">{{ option.label }}</span>
          <svg v-if="option.active" :class="$style.checkIcon" viewBox="0 0 24 24">
            <path d="M9,16.17L4.83,12l-1.42,1.41L9,19 21,7l-1.41-1.41z" />
          </svg>
        </li>
      </ul>
    </base-popup>
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import usePlayQuality from '@renderer/utils/compositions/usePlayQuality'

export default {
  name: 'PlayQualityBtn',
  setup() {
    const { qualityOptions, isSwitching, switchQuality, ensureQualityDetail } = usePlayQuality()

    const dom_btn = ref(null)
    const isShowMenu = ref(false)
    let leaveTimer = null

    const currentLabel = computed(() => {
      const item = qualityOptions.value.find(option => option.active)
      return item ? item.label : ''
    })

    // 只有在存在多个可选音质时才允许切换
    const canSwitch = computed(() => qualityOptions.value.length > 1 && !isSwitching.value)

    // 悬停展开（与其他按钮一致），离开延迟收起
    const handleMsEnter = () => {
      if (leaveTimer) {
        clearTimeout(leaveTimer)
        leaveTimer = null
      }
      if (!qualityOptions.value.length) return
      // 参考 lx-x：打开菜单时后台补全歌曲音质详情，不阻塞菜单展示
      void ensureQualityDetail()
      isShowMenu.value = true
    }

    const handleMsLeave = () => {
      if (leaveTimer) clearTimeout(leaveTimer)
      leaveTimer = setTimeout(() => {
        isShowMenu.value = false
      }, 200)
    }

    const handleMenuClick = item => {
      if (!item || isSwitching.value) return
      isShowMenu.value = false
      void switchQuality(item.value)
    }

    return {
      dom_btn,
      isShowMenu,
      qualityOptions,
      isSwitching,
      currentLabel,
      canSwitch,
      handleMsEnter,
      handleMsLeave,
      handleMenuClick,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.qualityBtn {
  position: relative;
  flex: none;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  height: 100%;
}

.btn {
  padding: 0 2px;
  min-width: 32px;
  height: 100%;
  font-size: 12px;
  line-height: 1.2;
  color: var(--color-button-font);
  background-color: transparent;
  border: none;
  cursor: pointer;
  opacity: .6;
  transition: @transition-fast;
  transition-property: color, opacity;
  white-space: nowrap;

  &:hover {
    opacity: 1;
  }

  &:disabled {
    cursor: default;
    opacity: .3;
  }
}

.switching {
  opacity: .3;
}

// 弹层容器
.qualityPopup {
  padding: 4px;
}

.qualityList {
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 168px;
  max-height: 240px;
  overflow-y: auto;
}

.qualityItem {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: @radius-border;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-font);
  transition: @transition-fast;
  transition-property: background-color;

  &:hover {
    background-color: var(--color-primary-background-hover);
  }

  &:active {
    background-color: var(--color-primary-background-active);
  }
}

.active {
  color: var(--color-primary);
}

.disabled {
  cursor: default;
  opacity: .5;
}

// 音质徽标：固定宽高做“图片样式”色块，每种档位一种配色
.badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 18px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  color: #fff;
  background-color: var(--color-550);
  letter-spacing: .2px;
}

.badgeMaster {
  background: linear-gradient(135deg, #f7b733 0%, #fc4a1a 100%);
}

.badgeAtmosPlus {
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
}

.badgeAtmos {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.badgeHires {
  background: linear-gradient(135deg, #b06ab3 0%, #4568dc 100%);
}

.badgeSq {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
}

.badgeHq {
  background: linear-gradient(135deg, #1488cc 0%, #2b32b2 100%);
}

.badgeNormal {
  background: linear-gradient(135deg, #8e9eab 0%, #606c88 100%);
}

.qualityName {
  flex: auto;
  white-space: nowrap;
}

.checkIcon {
  flex: none;
  width: 14px;
  height: 14px;
  fill: var(--color-primary);
}
</style>
