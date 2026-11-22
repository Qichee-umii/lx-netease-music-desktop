import { onMounted, onBeforeUnmount, watch, reactive, ref, nextTick } from '@common/utils/vueTools'


export default ({ visible, location, onHide }) => {
  const transition1 = 'transform, opacity'
  const transition2 = 'transform, opacity, top, left'
  let show = false
  const dom_menu = ref(null)
  const menuStyles = reactive({
    left: 0,
    top: 0,
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transform: 'scale(.8, .7) translate(0,0)',
    pointerEvents: 'none',
  })

  // 首次展示时菜单还没有尺寸，`clientWidth/clientHeight` 为 0，
  // 此时算出来的偏移会把菜单顶到错误位置，表现为“第一次点击错位、后面正常”。
  // 所以展示后先测量一次真实尺寸，再应用最终位置。
  let hasMeasured = false

  const applyPosition = () => {
    if (!dom_menu.value) return
    menuStyles.left = location.value.x - window.lx.rootOffset + 2 + 'px'
    menuStyles.top = location.value.y - window.lx.rootOffset + 'px'
  }

  const showNow = () => {
    menuStyles.opacity = 1
    menuStyles.transform = `scale(1) translate(${handleGetOffsetXY(location.value.x, location.value.y)})`
    menuStyles.pointerEvents = 'auto'
  }

  const handleShow = () => {
    show = true
    if (hasMeasured && dom_menu.value?.clientHeight) {
      applyPosition()
      showNow()
      return
    }
    // 先定位但保持不可见，测量实际尺寸后再显示，避免动画期间跳动
    menuStyles.opacity = 0
    menuStyles.transform = 'scale(1) translate(0,0)'
    menuStyles.pointerEvents = 'none'
    applyPosition()
    nextTick(() => {
      if (!show || !dom_menu.value) return
      hasMeasured = !!dom_menu.value.clientHeight
      showNow()
    })
  }
  const handleHide = () => {
    menuStyles.opacity = 0
    menuStyles.transform = 'scale(.8, .7) translate(0, 0)'
    menuStyles.pointerEvents = 'none'
    show = false
  }
  const handleGetOffsetXY = (left, top) => {
    if (!dom_menu.value) return '0px, 0px'
    const listWidth = dom_menu.value.clientWidth
    const listHeight = dom_menu.value.clientHeight
    const dom_container_parant = dom_menu.value.offsetParent
    if (!dom_container_parant) return '0px, 0px'
    const containerWidth = dom_container_parant.clientWidth
    const containerHeight = dom_container_parant.clientHeight
    const offsetWidth = containerWidth - left - listWidth
    const offsetHeight = containerHeight - top - listHeight
    let x = 0
    let y = 0
    if (containerWidth > listWidth && offsetWidth < 12) {
      x = offsetWidth - 12
    }
    if (containerHeight > listHeight && offsetHeight < 5) {
      y = offsetHeight - 5
    }
    return `${x}px, ${y}px`
  }
  const handleDocumentClick = (event) => {
    if (!show) return

    if (event.target == dom_menu.value || dom_menu.value?.contains(event.target)) return

    if (show && menuStyles.transitionProperty != transition1) menuStyles.transitionProperty = transition1

    onHide()
  }

  watch(visible, visible => {
    visible ? handleShow() : handleHide()
  }, { immediate: true })

  watch(location, location => {
    applyPosition()
    if (show) {
      if (menuStyles.transitionProperty != transition2) menuStyles.transitionProperty = transition2
      menuStyles.transform = `scale(1) translate(${handleGetOffsetXY(location.x, location.y)})`
    }
  }, { deep: true })

  // 窗口尺寸变化后重新修正位置，避免菜单跑出可视区
  const handleResize = () => {
    if (!show) return
    applyPosition()
    menuStyles.transform = `scale(1) translate(${handleGetOffsetXY(location.value.x, location.value.y)})`
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
    window.removeEventListener('resize', handleResize)
  })

  return {
    dom_menu,
    menuStyles,
  }
}
