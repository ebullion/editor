import { identical } from 'ramda'
import xs from 'xstream'
import { InteractionFn, Rect, ResizeDirConfig, State } from '../interfaces'

// TODO 该文件还可以进行优化

const resizeItems: InteractionFn = ({ mouse, mode: mode$, state: state$, sel: sel$ }) => {
  const resizer$ = mouse.resizer$
  const startInfo$ = mouse.down$
    .when(mode$, identical('idle'))
    .when(resizer$)
    .peek(xs.combine(resizer$, state$, sel$))
    .map(([resizer, state, sel]) => {
      const startItems = sel.items(state)
      // When resizer is not null, we can make sure that bbox is not null.
      const bbox = sel.getBBox(state)
      return {
        startPos: getResizerPosition(resizer, bbox),
        startItems,
        anchor: getAnchorPosition(resizer, bbox),
        resizeDirConfig: resolveResizeDirConfig(resizer),
      }
    })

  const resizeAction$ = startInfo$
    .checkedFlatMap(startInfo =>
      mouse.move$.map(movingPos => ({ movingPos, ...startInfo })).endWhen(mouse.up$),
    )
    .map(State.resizeItems)

  return {
    action: resizeAction$,
  }
}

function opposite(resizer: string) {
  if (resizer === 'nw-resize') return 'se-resize'
  if (resizer === 'se-resize') return 'nw-resize'
  if (resizer === 'n-resize') return 's-resize'
  if (resizer === 's-resize') return 'n-resize'
  if (resizer === 'ne-resize') return 'sw-resize'
  if (resizer === 'sw-resize') return 'ne-resize'
  if (resizer === 'e-resize') return 'w-resize'
  if (resizer === 'w-resize') return 'e-resize'
  throw new Error(`Invalid resizer: ${resizer}`)
}

function getResizerPosition(resizer: string, rect: Rect) {
  const { x, y, width, height } = rect
  if (resizer === 'nw-resize') return { x, y }
  if (resizer === 'n-resize') return { x: 0, y }
  if (resizer === 'ne-resize') return { x: x + width, y }
  if (resizer === 'w-resize') return { x, y: 0 }
  if (resizer === 'e-resize') return { x: x + width, y: 0 }
  if (resizer === 'sw-resize') return { x, y: y + height }
  if (resizer === 's-resize') return { x: 0, y: y + height }
  if (resizer === 'se-resize') return { x: x + width, y: y + height }
  throw new Error(`Invalid resizer: ${resizer}`)
}

function getAnchorPosition(resizer: string, rect: Rect) {
  return getResizerPosition(opposite(resizer), rect)
}

function resolveResizeDirConfig(resizer: string): ResizeDirConfig {
  if (
    resizer === 'nw-resize' ||
    resizer === 'ne-resize' ||
    resizer === 'sw-resize' ||
    resizer === 'se-resize'
  ) {
    return { h: true, v: true }
  } else if (resizer === 'n-resize' || resizer === 's-resize') {
    return { h: false, v: true }
  } else if (resizer === 'w-resize' || resizer === 'e-resize') {
    return { h: true, v: false }
  } else {
    throw new Error(`Invalid resizer: ${resizer}`)
  }
}

export default resizeItems
