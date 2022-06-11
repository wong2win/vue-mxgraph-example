import {
  mxConstants,
  mxEvent,
  mxGraph,
  mxGraphView,
  mxMouseEvent,
  mxRectangle,
  mxUtils,
  mxPoint
} from 'mxgraph/javascript/mxClient'

export function resetScrollbars(vueItem) {
  let pad = getPagePadding(vueItem)
  let bounds = vueItem.graph.getGraphBounds()

  vueItem.graph.container.scrollTop = Math.floor(pad.y) - 1
  vueItem.graph.container.scrollLeft = Math.floor(Math.min(pad.x, (vueItem.graph.container.scrollWidth - vueItem.graph.container.clientWidth) / 2)) - 1

  if (bounds.width > 0 && bounds.height > 0) {
    if (bounds.x > vueItem.graph.container.scrollLeft + vueItem.graph.container.clientWidth * 0.9) {
      vueItem.graph.container.scrollLeft = Math.min(bounds.x + bounds.width - vueItem.graph.container.clientWidth, bounds.x - 10)
    }
    if (bounds.y > vueItem.graph.container.scrollTop + vueItem.graph.container.clientHeight * 0.9) {
      vueItem.graph.container.scrollTop = Math.min(bounds.y + bounds.height - vueItem.graph.container.clientHeight, bounds.y - 10)
    }
  }
}
/**
 * 如果输入bounds有效, 则重置container滚动条使bounds区域居中
 * 否则使背景与container左上角对齐
 * 需bind(graph所在vue实例)使用
 */
 export function resetScrollbars_Gai(bounds) {
  const container = this.graph.container,
    pad = getPagePadding(this)
  // 如果bounds面积不为0
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    const AspectRatio_bounds = bounds.width / bounds.height,
      AspectRatio_container = container.clientWidth / container.clientHeight
    const alignByHeight = AspectRatio_container > AspectRatio_bounds
    if (alignByHeight){
      container.scrollTop = Math.floor(bounds.y)
      container.scrollLeft = Math.floor(pad.x - (container.clientWidth - bounds.width) / 2)
    }
    else{
      container.scrollTop = Math.floor(pad.y - (container.clientHeight - bounds.height) / 2)
      container.scrollLeft = Math.floor(bounds.x)
    }
  }
  else {
    container.scrollTop = Math.floor(pad.y) - 1
    container.scrollLeft = Math.floor(pad.x) - 1
  }
}
/**
 * 根据当前scale缩放过的背景纸张尺寸in pixels
 */
 export function getScaledPageSize(vueItem) {
  const scale = vueItem.graph.view.scale
  return new mxRectangle(0, 0, vueItem.graph.pageFormat.width * scale, vueItem.graph.pageFormat.height * scale)
}

/**
 * (scale = 1时)背景纸张尺寸in pixels
 */
export function getPageSize(vueItem) {
  return new mxRectangle(0, 0, vueItem.graph.pageFormat.width, vueItem.graph.pageFormat.height)
}

/**
 * 计算内边距, (容器宽/高 - 34)
 * @returns 
 */
export function getPagePadding(vueItem) {
  return new mxPoint(Math.max(0, Math.round(vueItem.graph.container.offsetWidth - 34)),
    Math.max(0, Math.round(vueItem.graph.container.offsetHeight - 34)))
}

/**
 * (容器宽/高 - 34)/scale, /scale是为了抵消node_module里mxgraph的*scale操作  
 * @returns 内边距/scale
 */
export function getPagePadding_d_scale(vueItem) {
  const { container, view } = vueItem.graph
  return new mxPoint(Math.max(0, Math.round((container.offsetWidth - 34) / view.scale)),
    Math.max(0, Math.round((container.offsetHeight - 34) / view.scale)))
}

/**
 * 计算以纸张长宽为单位的背景 
 * @returns {mxRectangle} 背景画布长宽(页数)
 */
export function getPageLayout(vueItem) {
  let size = getScaledPageSize(vueItem)
  let bounds = vueItem.graph.getGraphBounds()
  const { translate, scale } = vueItem.graph.view
  if (bounds.width === 0 || bounds.height === 0) {
    return new mxRectangle(0, 0, 1, 1)
  }
  // graph(左上角)相对背景(左上角)的坐标in pixels(大概)
  let x = Math.ceil(bounds.x - translate.x * scale)
  let y = Math.ceil(bounds.y - translate.y * scale)
  // graph长宽in pixels
  let w = Math.floor(bounds.width)
  let h = Math.floor(bounds.height)
  // 背景在左上方向扩大/缩小量(以纸张为单位)
  let x0 = Math.floor(x / size.width)
  let y0 = Math.floor(y / size.height)
  // graph(右下角端点)相对背景原点(左上角)所在区间 - 左上方向扩大缩小量 >> graph长宽所需页数
  let w0 = Math.ceil((x + w) / size.width) - x0
  let h0 = Math.ceil((y + h) / size.height) - y0

  return new mxRectangle(x0, y0, w0, h0)
}

export function lazyZoom(vueItem, zoomIn) {
  // if (vueItem.updateZoomTimeout !== undefined) {}
  // 取消上一个setTimeout, 累积缩放比例
  window.clearTimeout(vueItem.updateZoomTimeout)
  
  const zoomFactor = vueItem.graph.zoomFactor
  const scale = vueItem.graph.view.scale

  let cumulativeZoomFactor = 1

  if (zoomIn) {
    if (scale * cumulativeZoomFactor < 0.15) {
      cumulativeZoomFactor = (scale + 0.01) / scale
    } else {
      cumulativeZoomFactor *= zoomFactor
      cumulativeZoomFactor = Math.round(scale * cumulativeZoomFactor * 20) / 20 / scale
    }
  } else {
    if (scale * cumulativeZoomFactor <= 0.15) {
      cumulativeZoomFactor = (scale - 0.01) / scale
    } else {
      cumulativeZoomFactor /= zoomFactor
      cumulativeZoomFactor = Math.round(scale * cumulativeZoomFactor * 20) / 20 / scale
    }
  }
  cumulativeZoomFactor = Math.max(0.01, Math.min(scale * cumulativeZoomFactor, 160) / scale)
  // 实施缩放, 及重置滚动条位置
  vueItem.updateZoomTimeout = window.setTimeout(() => {
    const offset = mxUtils.getOffset(vueItem.graph.container)
    let dx = 0
    let dy = 0
    // 缩放前缓存鼠标距离container中心的偏移量(像素)
    if (vueItem.cursorPosition !== null) {
      dx = vueItem.graph.container.offsetWidth / 2 - vueItem.cursorPosition.x + offset.x
      dy = vueItem.graph.container.offsetHeight / 2 - vueItem.cursorPosition.y + offset.y
    }
    const prev = vueItem.graph.view.scale

    vueItem.graph.zoom(cumulativeZoomFactor)
    const s = vueItem.graph.view.scale
    // 如防抖后的缩放比例有变化, 根据上述偏移量重置滚动条位置
    if (s !== prev) {
      if (mxUtils.hasScrollbars(vueItem.graph.container) && (dx !== 0 || dy !== 0)) {
        vueItem.graph.container.scrollLeft -= dx * (cumulativeZoomFactor - 1)
        vueItem.graph.container.scrollTop -= dy * (cumulativeZoomFactor - 1)
      }
    }
  }, 10)
}

/**
 * 注入画背景方法
 */
function createSvgGrid(vue, graphConfig) {
  vue.graph.view.createSvgGrid = function (color) {
    let tmpGridSize = this.graph.gridSize * this.scale

    while (tmpGridSize < graphConfig.minGridSize) {
      tmpGridSize *= 2
    }
    const tmpGridStep = graphConfig.gridSteps * tmpGridSize
    const size = tmpGridStep
    const d = Array.from({length: graphConfig.gridSteps - 1}).map((_, index) => {
      const size = (index + 1) * tmpGridSize

      return `M 0 ${size} L ${tmpGridStep} ${size} M ${size} 0 L ${size} ${tmpGridStep}`
    })

    return `<svg width="${size}" height="${size}" xmlns="${mxConstants.NS_SVG}">
                <defs>
                    <pattern id="grid" width="${tmpGridStep}" height="${tmpGridStep}" patternUnits="userSpaceOnUse">
                        <path d="${d.join(' ')}" fill="none" stroke="${color}" opacity="0.2" stroke-width="1"/>
                        <path d="M ${tmpGridStep} 0 L 0 0 0 ${tmpGridStep}" fill="none" stroke="${color}" stroke-width="1"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)"/>
            </svg>`
  }
}

/**
 * 注入方法
 * 重绘(大小/位置修正后的)背景
 */
function validateBackgroundStyles(vueItem, graphConfig) {
  vueItem.graph.view.validateBackgroundStyles = function () {
    let image = 'none'
    let position = ''
    if (this.graph.isGridEnabled()) {
      image = unescape(encodeURIComponent(this.createSvgGrid(graphConfig.gridColor)))
      image = btoa(image, true)
      image = `url(data:image/svg+xml;base64,${image})`
      let phase = this.graph.gridSize * this.scale * graphConfig.gridSteps
      let x0 = 0
      let y0 = 0

      if (this.backgroundPageShape) {
        let bds = this.getBackgroundPageBounds()

        x0 = 1 + bds.x
        y0 = 1 + bds.y
      }
      position = -Math.round(phase - mxUtils.mod(this.translate.x * this.scale - x0, phase)) + 'px ' +
        -Math.round(phase - mxUtils.mod(this.translate.y * this.scale - y0, phase)) + 'px'
    }
    let canvas = this.canvas

    if (canvas.ownerSVGElement) {
      canvas = canvas.ownerSVGElement
    }
    let tmpGridBackgroundColor = graphConfig.gridBackgroundEnabled ? graphConfig.gridBackgroundColor : '#FFF'

    if (this.backgroundPageShape) {
      this.backgroundPageShape.node.style.backgroundRepeat = 'repeat'
      this.backgroundPageShape.node.style.backgroundPosition = position
      this.backgroundPageShape.node.style.backgroundImage = image
      this.backgroundPageShape.node.style.backgroundColor = tmpGridBackgroundColor
      this.backgroundPageShape.node.style.border = '1px solid white'
      this.backgroundPageShape.node.style.boxShadow = '2px 2px 1px #E6E6E6'
      canvas.style.backgroundImage = 'none'
      canvas.style.backgroundColor = ''
    } else {
      canvas.style.backgroundPosition = position
      canvas.style.backgroundColor = tmpGridBackgroundColor
      canvas.style.backgroundImage = image
    }
  }
}

/**
 * 注入方法
 * 触发了一次点击...不知道在干吗...
 */
function validateBackgroundPage(vueItem) {
  vueItem.graph.view.validateBackgroundPage = function () {
    if (this.graph.container) {
      let bounds = this.getBackgroundPageBounds()

      if (! this.backgroundPageShape) {
        let firstChild = this.graph.container.querySelector('svg')

        if (firstChild !== null) {
          this.backgroundPageShape = this.createBackgroundPageShape(bounds)
          this.backgroundPageShape.scale = 1
          this.backgroundPageShape.dialect = mxConstants.DIALECT_STRICTHTML
          this.backgroundPageShape.init(this.graph.container)
          firstChild.style.position = 'absolute'
          this.graph.container.insertBefore(this.backgroundPageShape.node, firstChild)
          this.backgroundPageShape.redraw()
          this.backgroundPageShape.node.className = 'geBackgroundPage'

          mxEvent.addGestureListeners(this.backgroundPageShape.node,
            mxUtils.bind(this, (evt) => {
              this.graph.fireMouseEvent(mxEvent.MOUSE_DOWN, new mxMouseEvent(evt))
            }),
            mxUtils.bind(this, (evt) => {
              this.graph.fireMouseEvent(mxEvent.MOUSE_UP, new mxMouseEvent(evt))
            })
          )
        }
      } else {
        this.backgroundPageShape.scale = 1
        this.backgroundPageShape.bounds = bounds
        this.backgroundPageShape.redraw()
      }
      this.validateBackgroundStyles()
    }
  }
}

/**
 * 注入方法
 * 计算修正后的背景bounds
 */
function getBackgroundPageBounds(vueItem) {
  vueItem.graph.view.getBackgroundPageBounds = function () {
    let layout = getPageLayout(vueItem)
    let page = getScaledPageSize(vueItem)
    let { scale, translate } = this

    return new mxRectangle(translate.x * scale + layout.x * page.width,
      translate.y * scale + layout.y * page.height,
      layout.width * page.width,
      layout.height * page.height)
  }
}

/**
 * 依赖注入
 * 重写原graph的sizeDidChange方法
 */
function sizeDidChange(vueItem) {
  vueItem.graph.sizeDidChange = function () {
    if (this.container && mxUtils.hasScrollbars(this.container)) {
      const scale = this.view.scale
      let pages = getPageLayout(vueItem)
      let pad = getPagePadding_d_scale(vueItem)
      // 怀疑这缩放部分根本就不是一个人写的...几个人没就什么时候*scale达成一致, 以至于都不知道*过几次scale
      // 最诡异的是用那个EditorUI创建的mxGraph缩放和滚动条居然是正常可用的...
      // 之前size是乘过一次scale的数据
      let size = getPageSize(vueItem)
      // 但后续apply里还会再乘一次scale, 故此处改用未scaled的size, pad同理
      let minW = Math.ceil(2 * pad.x + pages.width * size.width)
      let minH = Math.ceil(2 * pad.y + pages.height * size.height)
      /**
       * 重置this.minimumGraphSize, 在原sizeDidChange中重置画布长宽会再乘以scale  
       * node_modules\mxgraph\javascript\mxClient.js\sizeDidChange  
       * 第57966行  
       * ```
       * if (this.minimumGraphSize != null) {
       *   width = Math.max(width, this.minimumGraphSize.width * this.view.scale);
       *   height = Math.max(height, this.minimumGraphSize.height * this.view.scale);
       * }
       * ```
       * 这变量名和最后直接乘scale就很怪, 合理怀疑此处是滥用以前的API勉强实现重置大小
       */
      let min = this.minimumGraphSize
      if (!min || min.width !== minW || min.height !== minH) {
        this.minimumGraphSize = new mxRectangle(0, 0, minW, minH)
      }
      // Updates auto-translate to include padding and graph size
      let dx = pad.x - pages.x * size.width * scale
      let dy = pad.y - pages.y * size.height * scale

      if (!this.autoTranslate && (this.view.translate.x !== dx || this.view.translate.y !== dy)) {
        let tx = this.view.translate.x
        let ty = this.view.translate.y

        this.view.x0 = pages.x
        this.view.y0 = pages.y
        this.autoTranslate = true
        this.view.setTranslate(dx, dy) // SETTING THE TRANSLATE TRIGGERS A REVALIDATION.
        this.autoTranslate = false
        this.container.scrollLeft += Math.round((dx - tx) * this.view.scale)
        this.container.scrollTop += Math.round((dy - ty) * this.view.scale)
        return
      }
      mxGraph.prototype.sizeDidChange.apply(this, arguments)
    }
  }
}

/**
 * 依赖注入
 * 重写原mxGraphView的validate方法
 * 根据sizeDidChange里更新(注入)的view.x0和view.y0更新view.translate(背景偏移量)
 */
function validate(vueItem) {
  vueItem.graph.view.validate = function () {
    if (this.graph.container && mxUtils.hasScrollbars(this.graph.container)) {
      const pad = getPagePadding_d_scale(vueItem)
      const size = getScaledPageSize(vueItem)

      this.translate.x = pad.x - (this.x0 || 0) * size.width
      this.translate.y = pad.y - (this.y0 || 0) * size.height
    }
    mxGraphView.prototype.validate.apply(this, arguments)
  }
}

// 我的结论是这个更新模式应该好好优化下...
// 以减少额外的计算和函数的副作用
const graphUtility = (vueItem) => {
  createSvgGrid(vueItem, vueItem.graphConfig) // 注入画背景方法
  validateBackgroundStyles(vueItem, vueItem.graphConfig)
  validateBackgroundPage(vueItem)
  getBackgroundPageBounds(vueItem)
  sizeDidChange(vueItem) // 重写原graph的sizeDidChange方法
  validate(vueItem)
}

export {graphUtility}
