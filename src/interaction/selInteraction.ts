import { OrderedSet, Set } from 'immutable'
import { is } from 'immutable'
import { identical } from 'ramda'
import xs from 'xstream'
import ChangeSelAction from '../actions/ChangeSelAction'
import ChangeZIndexAction from '../actions/ChangeZIndexAction'
import DeleteItemsAction from '../actions/DeleteItemsAction'
import EditItemAction from '../actions/EditItemAction'
import ToggleLockAction from '../actions/ToggleLockAction'
import ToggleSemanticTagAction from '../actions/ToggleSemanticTagAction'
import { Component, UIIntent } from '../interfaces'

const selInteraction: Component = ({
  mouse,
  keyboard,
  UI,
  mode: mode$,
  state: state$,
  config: config$,
}) => {
  const changeSelFromUI$ = UI.intent<UIIntent.ChangeSel>('change-sel')
    .sampleCombine(state$)
    .filter(([{ itemIdArray }, state]) => !is(state.selIdSet, OrderedSet(itemIdArray)))
    .map(([{ itemIdArray }]) => new ChangeSelAction(itemIdArray))

  const deleteSel$ = xs
    .merge(
      UI.intent('delete'),
      keyboard
        .shortcut('d')
        .when(
          state$,
          state => !state.selIdSet.isEmpty() && (state.selMode === 'bbox' || state.sitem().locked),
        ),
    )
    .peek(state$)
    .map(state => new DeleteItemsAction(state.selIdSet.toArray()))

  const deleteItems$ = UI.intent<UIIntent.DeleteItems>('delete-items').map(
    ({ itemIdArray }) => new DeleteItemsAction(itemIdArray),
  )

  const toggleLock$ = xs
    .merge(UI.intent('toggle-lock'), keyboard.shortcut('b'))
    .when(state$, state => !state.selIdSet.isEmpty())
    .map(() => new ToggleLockAction())

  const edit$ = UI.intent<UIIntent.Edit>('edit').map(({ field, value }) => {
    const numberFields = ['strokeWidth', 'opacity', 'sem.dx', 'sem.dy', 'sem.fontSize']
    const useNumberValue = numberFields.includes(field)
    const val: any = useNumberValue ? Number(value) : value
    return new EditItemAction(field, val)
  })

  const changeZIndex$ = UI.intent<UIIntent.ChangeZIndex>('change-z-index').map(
    ({ op }) => new ChangeZIndexAction(op),
  )

  const toggleSemanticTag$ = UI.intent<UIIntent.ToggleSemanticTag>('toggle-semantic-tag')
    .when(state$, state => !state.selIdSet.isEmpty())
    .sampleCombine(state$, config$)
    .map(([{ tagName }, state, config]) => {
      const tagConfig = config.semantics.tags.find(tag => tag.name === tagName)
      return new ToggleSemanticTagAction(tagConfig)
    })

  const toIdle$ = keyboard.shortcut('esc').mapTo('idle')

  return {
    action: xs.merge(
      changeSelFromUI$,
      deleteSel$,
      deleteItems$,
      toggleLock$,
      edit$,
      changeZIndex$,
      toggleSemanticTag$,
    ),
    nextMode: toIdle$,
    nextAdjustConfigs: toIdle$.mapTo([]),
  }
}

export default selInteraction
