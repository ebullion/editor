import { h, VNode } from '@cycle/dom'
import { is } from 'immutable'
import xs from 'xstream'
import { Sinks, Sources } from './Inspector'
import { Item, State, UIIntent } from '../interfaces'
import { isPolygonItem, isPolylineItem, round3 } from '../utils/common'
import { EditableField, Row } from './InspectorCommon'

function PositionAndSize(state: State) {
  const bbox = state.getBBox()
  if (bbox == null) {
    return null
  }
  const { x, y, width, height } = bbox
  return h('div', [
    Row({ label: 'Position', key: 'position' }, [
      EditableField({ field: 'x', label: 'X', type: 'number', disabled: true, value: round3(x) }),
      EditableField({ field: 'y', label: 'Y', type: 'number', disabled: true, value: round3(y) }),
    ]),
    Row({ label: 'Size', key: 'size' }, [
      EditableField({
        field: 'width',
        label: 'width',
        type: 'number',
        disabled: true,
        value: round3(width),
      }),
      EditableField({
        field: 'height',
        label: 'Height',
        type: 'number',
        disabled: true,
        value: round3(height),
      }),
    ]),
  ])
}

function Fill(sitem: Item) {
  if (isPolygonItem(sitem)) {
    return Row({ label: 'Fill', key: 'fill' }, [
      EditableField({ field: 'fill', label: 'Fill', type: 'color', value: sitem.fill }),
    ])
  }
  return null
}

function Stroke(sitem: Item) {
  if (isPolygonItem(sitem) || isPolylineItem(sitem)) {
    return Row({ label: 'Stroke', key: 'stroke' }, [
      EditableField({ field: 'stroke', label: 'Stroke', type: 'color', value: sitem.stroke }),
      EditableField({
        field: 'strokeWidth',
        label: 'Stroke Width',
        type: 'number',
        value: sitem.strokeWidth,
        min: 0,
        step: 0.1,
      }),
    ])
  }
  return null
}

function Opacity(sitem: Item) {
  return Row({ label: 'Opacity', key: 'opacity' }, [
    EditableField({
      field: 'opacity',
      label: 'Opacity',
      type: 'number',
      value: sitem.opacity,
      min: 0,
      max: 1,
      step: 0.1,
    }),
  ])
}

function Z({ selIdSet, items, zlist }: State) {
  if (selIdSet.isEmpty()) {
    return null
  }
  const sidsList = selIdSet.toList()
  const sidsCount = selIdSet.count()
  const isAtBottom = is(sidsList.sort(), zlist.take(sidsCount).sort())
  const isAtTop = is(sidsList.sort(), zlist.takeLast(sidsCount).sort())

  const zIndex = zlist.indexOf(selIdSet.first())

  return Row({ label: 'Z-index', key: 'z' }, [
    h('p', { style: { 'align-self': 'center', 'margin-right': '8px' } }, String(zIndex)),
    h('button.btn.z', { attrs: { disabled: isAtBottom }, dataset: { op: 'bottom' } }, 'bottom'),
    h('button.btn.z', { attrs: { disabled: isAtBottom }, dataset: { op: 'dec' } }, '-1'),
    h('button.btn.z', { attrs: { disabled: isAtTop }, dataset: { op: 'inc' } }, '+1'),
    h('button.btn.z', { attrs: { disabled: isAtTop }, dataset: { op: 'top' } }, 'top'),
  ])
}

function LockInfo(sitem: Item) {
  return Row(
    { label: 'Lock', key: 'lock' },
    sitem.locked
      ? [h('h2', 'locked'), h('button.toggle-lock', 'Unlock')]
      : [h('h2', 'not locked'), h('button.toggle-lock', 'Lock')],
  )
}

export default function InspectorGeometricTab(sources: Sources): Sinks {
  const domSource = sources.DOM
  const state$ = sources.state

  const changeZIndexIntent$ = domSource
    .select('.btn.z')
    .events('click')
    .map(e => e.ownerTarget.dataset.op)
    .map(op => ({ type: 'change-z-index', op } as UIIntent.ChangeZIndex))

  const toggleLockIntent$ = domSource
    .select('.toggle-lock')
    .events('click')
    .mapTo<'toggle-lock'>('toggle-lock')

  const editIntent$ = domSource
    .select('.field input')
    .events('input')
    .map<UIIntent.Edit>(e => {
      const input = e.ownerTarget as HTMLInputElement
      const field = input.dataset.field
      return { type: 'edit', field, value: input.value }
    })

  const vdom$ = state$.map(state => {
    let children: VNode[]
    const sitem = state.sitem()
    if (sitem == null) {
      children = [h('p.empty-prompt', 'No Selected Items.')]
    } else {
      children = [
        PositionAndSize(state),
        Fill(sitem),
        Stroke(sitem),
        Opacity(sitem),
        Z(state),
        LockInfo(sitem),
      ]
    }
    return h('div.tab.geometric-tab', children)
  })

  return {
    DOM: vdom$,
    intent: xs.merge(editIntent$, changeZIndexIntent$, toggleLockIntent$),
  }
}
