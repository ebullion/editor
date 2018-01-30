# Editor

## Motivation

(TODO) Add a basic description about _our algorithm_.

The spatial topological relations of the floor, which is hard to generate or extract, is one of the key inputs to our algorithm. In many cases, we could only get a bitmap image file of the floorplan. And there are sophisticated tools such as [Microsoft Visio][] or [Inkscape][] which can load the image file and make a diagram manually according to the image file. But the main disadvantage is that the output of these tools is too complicated to fit in our algorithm: it is hard to parse and manipulate in our code, and it lacks the abilities of attaching semantic information to shapes. Our algorithm prefers a simple and clean data format so it can focus on processing positioning data and aggregating semantic trajectories.

The editor could help us build up the topological relations from a image file. The editor can load the image file and display it, then we can draw polygons/polylines imitating the spatial structures on the image. After completing the geometric information, we can use the editor to attach specific semantic information to polygons/polyglines. For example, we can designate severals rectangles as rooms or specify a polyline as a wall. When all is done, the editor can export both geometric and semantic information to a single json file, which can be parsed by our algorithm easily.

While the editor is created originally for our algorithm, the editor itself is just a good SVG editor which focuses on editing polygons/polylines and attaching semantic data to them. The editor should be easy to be reused in other situations.

## Introduction

This section describes what features does the editor provides and how to use them.

1. The board: The board is where shapes display and user interactions happens.
2. Mode: The mode is displayed at the lower left corner. It tells the user 'What we are doing'. The mode is default to `idle`; The mode is `rect.xxx` when drawing a rect; And the mode is `line.xxx` when drawing a line and so on.
3. Load image file: In `idle` mode, drag the image file from file explorer and drop it onto the editor board.
4. Draw polygons: In `idle` mode, press `P` to enter `polygon` mode, and an empty drawing-polygon is set up; In `polygon` mode, every mouse click will add a vertex to the drawing-polygon; If the user closes the drawing-polygon by clicks near the first vertex, a new polygon will be added and mode changes back to `idle`. The user can always press `ESC` to return `idle` mode.
5. Draw lines/rectangles: Press the shortcut and enter the corresponding mode, drag the mouse and a new shape will be added.
6. Selections and the Inspector: Click on a shape to select it, and the inspector on the right will list all the properties about the selected shape. The inspector has two tabs, one for geometric information such as width, height, z-index, and one for semantic information including region type (room / staircase / hallway), line type (wall / door). Some properties are readonly in the inspector and some are editable. (TODO a image showing the inspector
7. Dragging, Zooming and Resizing: The board supports dragging and zooming. The selected items can be resized using the resizers. These three operations are really intuitive so we just mention them here.
8. Point editing: Press `E` to toggle selection mode between `bbox`(default) and `vertices`. In `vertices` selection mode, a small circle will appear at every vertex of the selected polygon/polyline, the user could drag the circle to change the vertex position, or press `D` and delete the hovered vertex, or drag from near an edge and add a new vertex.

## Interaction Refinement

We have make efforts to improve the interactions details.

#### Shortcuts

We attach shortcuts to almost every action in the editor, including deleting a shape, start adding a rectangle, toggle between two selection mode and so on. We also display the shortcuts alongside the entries of the actions in menu bar, so the users can quickly remember the shortcuts.

The `ESC` shortcut has a consistent meaning in different modes: abort the current interaction and go back to the idle mode. And we have familiar `Ctrl + Z` (undo), `Ctrl + Y` / `Ctrl + Shift + Z` (redo), `Ctrl + C` (copy) and `Ctrl + V` (redo). (TODO ctrl+z, ctrl+c and ctrl+v are not implemented).

#### Auto-Adjust

When drawing shapes or moving vertices, auto-adjust helps the users find the correct positions without trivial minor adjustments. Auto-adjust is useful in the following situations:

* Start drawing a line from an existed polgyon vertex.
* Move a rectangle to a position where it tangents exactly to another rectangle. (TODO not implemented)
* Move a polygon vertex to a position that has the same x or y coordinate of another vertex.

Auto-adjust is default to be enabled, but it be can be disabled when the shortcuts is pressed. Since the state of editor is changing, the behavior the adjuster should also be changing. We create an adjuster stream which abstracts the changing behaviors. The adjuster reads the adjust-configs (returned from the interaction functions), current drawing mode, existed vertices of all shapes, and the current mouse position and then determine the adjusted position.

In practice, auto-adjust makes interactions more fluently, and it speeds up the generation of the output.

## Implementation Overview

This editor is built upon the web platform. We use SVG to render shapes.

We adopt [reactive programming][RP] to implement this editor. Anything changing when the editor is running, including variables, user inputs and data structures, are abstracted as asynchronous data stream in the editor. For example, click events on the board are encapsulated into a point stream, denoted by `click$` in code. Every time the user clicks, the stream emits an object that contains x and y coordinates of the click position. The state of drawn shapes is just another stream of list of polygon/polyline objects, and every time we peek the stream we can get the current state at that time. In such a framework, our editor application can be simplified as a pure function (the main function) which accepts a collection of streams (one stream for one kind of input) and returns a view stream (for rendering) plus a file stream (for exporting files). States that should be preserved when the application is running are kept as local varaiables of the main function. Note that we use `$` as the postfix to indicate that the name references to a stream.

#### Some important streams

These four streams are the most important streams in the editor:

* `mode$` records the current mode;
* `state$` records the drawn shapes;
* `selection$` records the current selected shapes;
* `transform$` records the current transform (dx, dy, scale) of the board.

Each of above streams reacts to a corresponding update-stream: when the update-stream emits a new value, the above stream will emit a new value reflecting the update. For example, when `action$` emits a "Add a new polygon", `state$` emits a new state object that contains the new polygon. The update-streams are from sub-components and this is the only way that sub-components mutates the state in the main function.

Many other streams can be calculated by above streams. For example, the stream of the inspector content can be calculated by combining `state$` and `selection$` and extracting selected-part state. The view of the shapes can be obtained by applying a puer map function to `state$`. Once we define how to calculate these streams, or in other words, once we define the dependencies of these streams, a mechanism of change propagation will be established. Under this mechanism, whenever one of the dependency streams emits a new value, the calculation will be automatically re-executed, and the calculated stream could emit a new value. Further streams thats depends on the calculated streams will be 'awaked' as well. The view of this editor is a calculated stream from above important streams, so our editor can focus on the state rather than the view.

#### Mouse and Keyboard

The editor is a highly interactive web application with a multitude of UI events. Using streams, we set up a concise and powerful interface for mouse and keyboard. ( Note that our mouse and keyboard objects are passed to the main function and sub-components as parameters and can be referenced by name `mouse` and `keyboard`. )

**Shortcuts as lazy and queryable streams**

`keyboard.shortcut('xxx')` will give us a stream which emits a `KeyboardEvent` everytime the user press the specified shortcut. The shortcut can be a simple key like `D` or can be a complex combination like `ctrl + shift + T`. The streams are lazy that none of the streams existed before calling `shortcuts('xxx')`; The streams are queryable that all the potential shortcut streams can be get from a single method.

The keyboard also provides a `isPressing` method. For example, when implementing "Press Z to disable auto-adjust", `keyboard.isPressing('z')` returns a stream indicating whether a key is pressing, which is then map to the stream of whether the auto-adjust feature is disabled.

**Pre-calculated mouse positions**

There are three different types of mouse positions: **Raw positions** are from mouse event listener directly and records the coordinates relative to the web page. **Board positions** records the coordinates relative to the board, which are calculating by combining the transform stream and raw position stream and [inverting](https://github.com/d3/d3-zoom#transform_invert) the position by the transform. **Adjusted position** are board positions processed by the adjuster. (TODO 在Interaction Refinement中添加对adjuster的说明)

We pre-calculate all types of mouse positions and pack them into the `mouse` object. For example, `mouse.rawDown$` is the stream that records the raw position of the mouse down event, and `mouse.down$` records the board position, and `mouse.adown$` records the adjusted board position.

In different situations, we use different types of mouse positions. We use adjusted board positions when drawing a new shape. When the auto-adjust is disbled, we switch to board positions. And raw positions are useful when dragging the board. As a result of pre-calculating mouse positions, the logic of interaction is seperated from transformations among different types of mouse positions, which makes the interaction implementation clean and expressive.

#### Interaction Implementation

Every interaction is implemented by an interaction function. Interaction functions have a common interface that each function takes a collection of streams as input and returns a collection of output streams. Input streams tell the interaction functions _what's the current state_ and _what does the user do_. For example, `keyboard` are a typical input stream container that records the keyboard usages, and `mode$` tells the interaction functions what is the current mode. Output streams returned from interaction functions in turn tells the main function _what should be updated and how to update them_. For example, `nextMode$` is a typical output stream that decides the next mode.

The `mode$` is the most important state in interaction implementation. The same mouse or keyboard events will be translated into different actions in different mode. And during different stages of an drawing operation, the mode is different reflecting the current drawing state. Here we pick the `drawRect` interaction function as the example to illustrate the common pattern of the interaction implementation.

The below is a slim version of `drawRect`:

```javascript
function drawRect({ mouse, keyboard, mode: mode$ }) {
  /* 1 */
  const toRectReadyMode$ = keyboard.shortcut('r').mapTo('rect.ready')

  /* 2 */
  const startPos$ = mouse.down$.when(mode$, identical('rect.ready'))
  const toRectDrawingMode$ = startPos$.mapTo('rect.drawing')
  
  /* 3 */
  const drawingRect$ = startPos$
    .map(startPos =>
      mouse.move$
        .when(mode$, identical('rect.drawing'))
        .map(movingPos => PolygonItem.rectFromPoints(startPos, movingPos)),
    )
    .flatten()
  
  /* 4 */
  const addItem$ = mouse.up$
    .when(mode$, identical('rect.drawing'))
    .peek(drawingRect$)
  	.map(actions.addItem)
  const toIdleMode$ = addItem$.mapTo('idle')
  
  return {
    drawingItem: drawingRect$,
    action: addItem$,
    nextMode: xs.merge(toRectReadyMode$, toIdleMode$, toRectDrawingMode$),
  }
}
```

Code blocks 1-4 are logics at different stages.

* Block 1: Press shortcut R in `idle` mode to enter into `rect.ready` mode.
* Block 2: In `rect.ready` mode, the position of the mouse press will be the start point of the drawing rectangle. And the mode will change to `rect.drawing`.
* Block 3: In `rect.drawing` mode, the mouse moving position will be the end point of the drawing rectangle. The segment from start point to end point is a diagonal of the drawing rectangle. We call `PolygonItem.rectFromPoints` to create a new polygon from the two points as the drawing preview.
* Block 4: In `rect.drawing` mode, when mouse is released we peek `drawingRect$` to get the drawing rectangle and transform it into an action which will add an polygon to state.

The above code maintains the mode at different stages, reacts to mouse events correctly according to the current mode, handles the drawing preview, and adds a new polygon when the drawing operation is completed. It is expressive thanks to mouse/keyboard abstraction and various operators for streams. Moreover, the above interaction function, in essence, is just a puer function that maps from input streams to output streams, which makes this code easy to understand and easy to test.



[Inkscape]: https://inkscape.org/
[Microsoft Visio]: https://products.office.com/en-us/visio/flowchart-software
[repo]: https://github.com/shinima/editor
[RP]: https://en.wikipedia.org/wiki/Reactive_programming
