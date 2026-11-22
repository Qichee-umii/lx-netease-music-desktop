<template>
  <div :class="$style.playListBtn">
    <button
      ref="dom_btn" type="button" :class="[$style.btn, btnClass]"
      :aria-label="$t('player__play_list')" :title="`${$t('player__play_list')} (${listLength})`" @click.stop="handleShowPopup"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :height="iconHeight" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-play-list" />
      </svg>
    </button>
    <span v-if="listLength > 0" :class="$style.badge">{{ listLength > 99 ? '99+' : listLength }}</span>
    <base-popup v-model:visible="isShowPopup" :btn-el="dom_btn" @mouseenter="handleMsEnter" @mouseleave="handleMsLeave">
      <div :class="$style.popupContent">
        <div :class="$style.popupHeader">
          <span :class="$style.popupTitle">{{ $t('player__play_list') }}</span>
          <span :class="$style.popupCount">{{ $t('player__play_list_count', { num: listLength }) }}</span>
          <div :class="$style.popupActions">
            <button type="button" :class="$style.actionBtn" :disabled="!listLength" @click.stop="handleSaveList">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024">
                <use xlink:href="#icon-love" />
              </svg>
              <span>{{ $t('player__play_list_save') }}</span>
            </button>
            <button type="button" :class="$style.actionBtn" :disabled="!listLength" @click.stop="handleClearList">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024">
                <use xlink:href="#icon-delete" />
              </svg>
              <span>{{ $t('player__play_list_clear') }}</span>
            </button>
          </div>
        </div>
        <div v-if="isSavingList" :class="$style.saveRow">
          <base-input
            ref="dom_save_input" v-model="saveListName" :placeholder="$t('player__play_list_save_prompt')"
            @submit="confirmSaveList" @change="confirmSaveList" @keyup.esc="cancelSaveList"
          />
        </div>
        <ul v-if="playList_.length" ref="dom_list" :class="$style.list">
          <li
            v-for="(item, index) in playList_" :key="item.id + index" :data-index="index"
            :class="[
              $style.listItem,
              { [$style.active]: index == playInfo.playerPlayIndex && isCurrentList },
              { [$style.dragging]: dragState.index === index },
              { [$style.shifting]: dragState.offsetMap[index] != null && dragState.index !== index },
            ]"
            :style="shiftStyle(index)"
            :aria-label="item.name"
            @dblclick="handlePlay(index)"
            @pointerdown="handlePointerDown($event, index)"
          >
            <span :class="$style.dragHandle" @pointerdown.stop="handlePointerDown($event, index)">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
                <path fill="currentColor" d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              </svg>
            </span>
            <span :class="$style.listIndex">{{ String(index + 1).padStart(3, '0') }}</span>
            <img v-if="itemPic(item)" loading="lazy" :class="$style.listPic" :src="itemPic(item)" :alt="item.name" @error="handlePicError">
            <span v-else :class="$style.listPic" aria-hidden="true"></span>
            <div :class="$style.listInfo">
              <span :class="$style.listName">{{ item.name }}</span>
              <span :class="$style.listSinger">{{ item.singer }}</span>
            </div>
            <span :class="$style.listTime">{{ item.interval || '--/--' }}</span>
            <button type="button" :class="$style.listRemove" :aria-label="$t('player__play_list_remove')" @click.stop="handleRemove(item, index)">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </li>
        </ul>
        <div v-else :class="$style.empty">{{ $t('player__play_list_empty') }}</div>
      </div>
    </base-popup>
  </div>
</template>

<script>
import { computed, nextTick, reactive, ref, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { getListMusics, removeListMusics, clearListMusics, createUserList, updateListMusicsPosition } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/state'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
import { playList } from '@renderer/core/player'
import { showToast } from '@renderer/utils/showToast'
import { useI18n } from '@renderer/plugins/i18n'
import { dialog } from '@renderer/plugins/Dialog'

export default {
  name: 'PlayListBtn',
  props: {
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
    const t = useI18n()
    const isShowPopup = ref(false)
    const dom_btn = ref(null)
    const dom_list = ref(null)
    const list = ref([])

    const isCurrentList = computed(() => {
      const musicInfo = playMusicInfo.musicInfo
      return !!musicInfo && !!playInfo.playerListId
    })
    const playList_ = computed(() => list.value ?? [])
    const listLength = computed(() => (list.value ?? []).length)

    const refreshList = async() => {
      const listId = playInfo.playerListId
      if (!listId) {
        list.value = []
        return
      }
      list.value = await getListMusics(listId)
    }

    watch(() => playInfo.playerListId, () => { void refreshList() }, { immediate: true })
    watch(() => playMusicInfo.musicInfo?.id, () => { void refreshList() })

    const handleShowPopup = async(evt) => {
      evt.stopPropagation()
      await refreshList()
      isShowPopup.value = true
    }

    let leaveTimer = null
    const handleMsEnter = () => {
      if (leaveTimer) clearTimeout(leaveTimer)
    }
    const handleMsLeave = () => {
      if (dragState.active) return
      leaveTimer = setTimeout(() => {
        isShowPopup.value = false
      }, 300)
    }

    const handlePlay = (index) => {
      const listId = playInfo.playerListId
      if (!listId) return
      playList(listId, index)
    }

    // 移除按钮只对列表中存在的歌曲生效
    const handleRemove = async(item, index) => {
      const listId = playInfo.playerListId
      if (!listId) return
      await removeListMusics({ listId, ids: [item.id] })
      const next = playList_.value.slice()
      next.splice(index, 1)
      list.value = next
    }

    // 清空播放列表（不可逆操作，需二次确认）
    const handleClearList = async() => {
      const listId = playInfo.playerListId
      if (!listId || !listLength.value) return
      if (!(await dialog.confirm(t('player__play_list_clear_confirm')))) return
      await clearListMusics([listId])
      list.value = []
      showToast(t('player__play_list_clear_done'))
    }

    // 保存为歌单：头部内嵌输入框（回车确认 / Esc 取消，失焦确认）
    const isSavingList = ref(false)
    const saveListName = ref('')
    const dom_save_input = ref(null)

    const handleSaveList = () => {
      if (!listLength.value) return
      if (isSavingList.value) {
        cancelSaveList()
        return
      }
      isSavingList.value = true
      saveListName.value = t('player__play_list_save_default', { date: formatDate() })
      void nextTick(() => {
        dom_save_input.value?.focus?.()
      })
    }

    const cancelSaveList = () => {
      isSavingList.value = false
      saveListName.value = ''
    }

    const confirmSaveList = async(name) => {
      if (!isSavingList.value) return
      isSavingList.value = false
      saveListName.value = ''
      if (!name) return
      if (userLists.some(l => l.name == name) && !(await dialog.confirm(t('list_duplicate_tip')))) return
      await createUserList({ name, list: playList_.value.slice() })
      showToast(t('player__play_list_save_done'))
    }

    const formatDate = () => {
      const d = new Date()
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    /* ------------------------------------------------------------------
     * 拖拽排序：Pointer Events，垂直单列，实时让位（live reordering），
     * 松手提交（把最终顺序一次性写入列表，避免拖动过程中反复落库）。
     * ------------------------------------------------------------------ */
    const dragState = reactive({
      active: false,
      index: -1,
      targetIndex: -1,
      startY: 0,
      currentY: 0,
      itemHeight: 46,
      offsetMap: {},
    })

    // CSS Module 下类名会被改写，用元素自带的 data-index 定位行
    const getRows = () => {
      if (!dom_list.value) return []
      return Array.from(dom_list.value.querySelectorAll('[data-index]'))
    }

    const handlePointerDown = (event, index) => {
      if (event.button != null && event.button !== 0) return
      if (listLength.value < 2) return
      if (event.target?.closest?.('button[aria-label]')) return
      dragState.active = true
      dragState.index = index
      dragState.targetIndex = index
      dragState.startY = event.clientY
      dragState.currentY = 0
      dragState.offsetMap = {}
      const rows = getRows()
      dragState.itemHeight = rows.length ? rows[0].getBoundingClientRect().height : 46

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    }

    // 实时让位：拖动中的行跟随指针，被让位区间内的行整体上/下平移一行
    const handlePointerMove = (event) => {
      if (!dragState.active) return
      const delta = event.clientY - dragState.startY
      dragState.currentY = delta
      const rowH = dragState.itemHeight || 46
      // 交互阈值：不足半行不换位，避免抖动
      const target = Math.max(0, Math.min(listLength.value - 1, dragState.index + Math.round(delta / rowH)))
      dragState.targetIndex = target

      const offsetMap = {}
      const from = dragState.index
      const to = target
      if (from !== to) {
        for (let i = 0; i < listLength.value; i++) {
          if (i === from) continue
          if (from < to && i > from && i <= to) offsetMap[i] = -rowH
          else if (from > to && i >= to && i < from) offsetMap[i] = rowH
        }
      }
      dragState.offsetMap = offsetMap
    }

    const handlePointerUp = async() => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      const from = dragState.index
      const to = dragState.targetIndex
      const wasDragging = Math.abs(dragState.currentY) > 4
      dragState.active = false
      dragState.index = -1
      dragState.targetIndex = -1
      dragState.offsetMap = {}
      dragState.currentY = 0

      if (!wasDragging || from === to || from < 0 || to < 0) return

      // 松手提交：本地先重排，再落库
      const next = playList_.value.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      list.value = next
      const listId = playInfo.playerListId
      if (!listId) return
      try {
        await updateOrder(listId, next)
      } catch (err) {
        console.error(err)
        void refreshList()
      }
    }

    // 通过 updateListMusicsPosition 整体覆盖顺序（position 0 + 全量 ids）
    const updateOrder = async(listId, orderedList) => {
      await updateListMusicsPosition({ listId, position: 0, ids: orderedList.map(item => item.id) })
    }

    const shiftStyle = index => {
      if (!dragState.active) return null
      if (dragState.index === index) {
        return {
          transform: `translateY(${dragState.currentY}px)`,
          zIndex: 3,
        }
      }
      const offset = dragState.offsetMap[index]
      if (offset == null) return null
      return { transform: `translateY(${offset}px)` }
    }

    onBeforeUnmount(() => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    })

    const handlePicError = event => {
      // 加载失败时改为透明占位，保持空白外框（对应“无封面显示空白占位”）
      event.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
    }

    // 封面存在 meta.picUrl（见 toNewMusicInfo）；local 歌曲无封面
    const itemPic = item => item?.meta?.picUrl || ''

    return {
      isShowPopup,
      dom_btn,
      dom_list,
      dom_save_input,
      playList_,
      listLength,
      isCurrentList,
      playInfo,
      dragState,
      isSavingList,
      saveListName,
      handleShowPopup,
      handleMsEnter,
      handleMsLeave,
      handlePlay,
      handleRemove,
      handleClearList,
      handleSaveList,
      confirmSaveList,
      cancelSaveList,
      handlePointerDown,
      shiftStyle,
      handlePicError,
      itemPic,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.playListBtn {
  position: relative;
  flex: none;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
}

.btn {
  flex: none;
  height: 100%;
  transition: @transition-fast;
  transition-property: color, opacity;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border: none;
  padding: 0;
  opacity: .6;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
  &:active {
    opacity: 1;
  }
}

.badge {
  position: absolute;
  top: -2px;
  right: -6px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background-color: var(--color-primary);
  color: #fff;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  pointer-events: none;
  box-sizing: border-box;
}

.popupContent {
  display: flex;
  flex-flow: column nowrap;
  width: 386px;
  max-width: 92vw;
  height: 420px;
  max-height: 62vh;
  padding: 0;
  overflow: hidden;
}

.popupHeader {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  padding: 8px 10px;
  flex: none;

  .popupTitle {
    font-size: 13px;
    font-weight: 600;
    flex: none;
  }

  .popupCount {
    flex: none;
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 9px;
    background-color: var(--color-primary-alpha-900);
    color: var(--color-primary);
    font-size: 11px;
    line-height: 16px;
  }

  .popupActions {
    flex: none;
    margin-left: auto;
    display: flex;
    flex-flow: row nowrap;
    gap: 4px;
  }

  .actionBtn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    border: none;
    border-radius: 3px;
    background-color: transparent;
    color: var(--color-font);
    font-size: 11px;
    cursor: pointer;
    opacity: .7;
    transition: @transition-fast;

    svg {
      width: 12px;
      height: 12px;
    }

    &:hover:not(:disabled) {
      opacity: 1;
      background-color: var(--color-primary-alpha-900);
      color: var(--color-primary);
    }

    &:disabled {
      opacity: .3;
      cursor: default;
    }
  }
}

.saveRow {
  flex: none;
  margin: 0 10px 8px;

  input {
    width: 100%;
    box-sizing: border-box;
  }
}

// 复用项目全局 .scroll 滚动条定义（index.less:440）
.list {
  flex: 1;
  overflow: auto;
  list-style: none;
  margin: 0;
  padding: 0 6px 6px;
  position: relative;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    background-color: rgba(0, 0, 0, 0);
  }
  &::-webkit-scrollbar-track {
    background-color: var(--color-primary-light-100-alpha-800);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background-color: var(--color-primary-alpha-600);
    transition: background-color .4s ease;
  }
  &::-webkit-scrollbar-thumb:hover {
    border-radius: 3px;
    background-color: var(--color-primary-alpha-400);
    transition: background-color .4s ease;
  }

  .listItem {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    background-color: var(--color-content-background);
    transition: transform .15s ease, background-color @transition-fast;
    will-change: transform;
    touch-action: none;

    &:hover {
      background-color: var(--color-primary-alpha-900);

      .listTime {
        display: none;
      }
      .listRemove {
        display: flex;
      }
    }

    &.active {
      color: var(--color-primary);
    }

    // 拖动中的行：抬升、无过渡（跟手）
    &.dragging {
      z-index: 3;
      transition: none;
      background-color: var(--color-primary-alpha-900);
      box-shadow: 0 2px 8px rgba(0, 0, 0, .25);
      cursor: grabbing;
    }

    // 被让位的行：有过渡，形成实时让位动画
    &.shifting {
      z-index: 1;
    }

    .dragHandle {
      flex: none;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 12px;
      height: 20px;
      cursor: grab;
      opacity: .35;

      &:hover {
        opacity: .8;
      }

      svg {
        width: 12px;
        height: 12px;
      }
    }

    .listIndex {
      flex: none;
      width: 2.6em;
      text-align: right;
      opacity: .4;
      font-size: 11px;
    }

    .listPic {
      display: block;
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      object-fit: cover;
      background-color: var(--color-primary-alpha-900);
    }

    .listInfo {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-flow: column nowrap;
      gap: 2px;
    }

    .listName {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .listSinger {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: .6;
      font-size: 11px;
    }

    .listTime {
      flex: none;
      margin-left: auto;
      opacity: .5;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }

    .listRemove {
      flex: none;
      display: none;
      justify-content: center;
      align-items: center;
      margin-left: auto;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background-color: transparent;
      color: inherit;
      cursor: pointer;
      opacity: .55;

      &:hover {
        opacity: 1;
        background-color: var(--color-primary-alpha-900);
      }

      svg {
        width: 14px;
        height: 14px;
      }
    }
  }
}

.empty {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 6px;
  text-align: center;
  font-size: 12px;
  opacity: .6;
}
</style>
