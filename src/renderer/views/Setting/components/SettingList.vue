<template lang="pug">
dt#list {{ $t('setting__list') }}
dd
  .gap-top
    base-checkbox(id="setting_list_showSource_enable" :model-value="appSetting['list.isShowSource']" :label="$t('setting__list_source')" @update:model-value="updateSetting({'list.isShowSource': $event})")
  .gap-top
    base-checkbox(id="setting_list_scroll_enable" :model-value="appSetting['list.isSaveScrollLocation']" :label="$t('setting__list_scroll')" @update:model-value="updateSetting({'list.isSaveScrollLocation': $event})")
  .gap-top
    base-checkbox(id="setting_list_clickAction_enable" :model-value="appSetting['list.isClickPlayList']" :label="$t('setting__list_click_action')" @update:model-value="updateSetting({'list.isClickPlayList': $event})")
  .p.gap-top(:class="$style.sliderRow")
    span 封面大小 {{ coverSizePx }}px
    base-slider-bar(:class="$style.slider" :value="appSetting['common.onlineListCoverSize']" :min="0" :max="8" :step="0.15" @change="updateSetting({'common.onlineListCoverSize': $event})")
dd(:aria-label="$t('setting__basic_sourcename_title')")
  h3#list_addMusicLocationType {{ $t('setting__list_add_music_location_type') }}
  div
    base-checkbox.gap-left(
      id="setting_list_add_music_location_type_top" name="setting_list_add_music_location_type" need
      :model-value="appSetting['list.addMusicLocationType']" value="top" :label="$t('setting__list_add_music_location_type_top')"
      @update:model-value="updateSetting({'list.addMusicLocationType': $event})")
    base-checkbox.gap-left(
      id="setting_list_add_music_location_type_bottom" name="setting_list_add_music_location_type" need
      :model-value="appSetting['list.addMusicLocationType']" value="bottom" :label="$t('setting__list_add_music_location_type_bottom')"
      @update:model-value="updateSetting({'list.addMusicLocationType': $event})")

</template>

<script>
import { computed } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingList',
  setup() {
    const coverSizePx = computed(() => {
      const size = appSetting['common.onlineListCoverSize'] ?? 4.35
      const fontSize = appSetting['common.fontSize']
      return Math.round(size * fontSize)
    })
    return {
      appSetting,
      updateSetting,
      coverSizePx,
    }
  },
}
</script>

<style lang="less" module>
.sliderRow {
  display: flex;
  align-items: center;
  gap: 12px;

  span {
    flex: none;
    width: 110px;
    color: var(--color-font-label);
  }
}

.slider {
  width: 180px;
}

</style>
