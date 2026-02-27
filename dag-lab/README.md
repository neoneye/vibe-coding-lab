# DAG LAB - Werkkzeug inspired UI for editing Directed Acyclic Graphs (DAGs)

Phase 1 - Where I am at the moment.
It's a single index.html that contains js+css.

Phase 2 - Future plans.
Extract js, css, to separate files.
Make a backend using FastAPI + Flask.
Multi user login.

Unlike other DAG editors the user doesn't have to draw wires between the nodes.

The canvas is a 100x100 grid.
A node is 1 unit tall (the height cannot be resized), and is 3 units wide by default. The width can be resized between 3 units and 40 units, the width must be an integer.
A node can only be placed on an integer coordinate.

The user can dragndrop nodes around on the canvas.

In the future: When clicking on a node, then the inspector shows info about that node, with parameters for the node, the input data and output data. I don't want you to focus on this now, but keep it in mind.

In the future: The graph can be executed similar to Luigi or makefiles. And the progress shown on the nodes visually. I don't want you to focus on this now, but keep it in mind.

## How to use this prototype

Nodes: The gray boxes are your nodes.

Move: Click and drag the body of a node to move it. It will snap to the 100x100 grid (where 1 unit is 20px).

Resize: Click and drag the slightly darker right edge of a node to resize its width (min 3 units, max 40).

Implicit Wiring:

- This is the core "Werkkzeug" feature.

- Drag the "Blur" node so it is directly underneath the "Texture" node (one row down).

- Notice a grey vertical line automatically appears connecting them.

- Drag it one unit to the right. As long as the horizontal bars overlap, the connection remains. If you drag it too far, the connection breaks.

Inspector: Clicking a node updates the info panel on the left (showing coordinates and width).

## Notes for Future Phases (Phase 2)

Data Structure: The nodes array is flat. For the backend (FastAPI), this JSON can be sent directly. The backend would need to perform the same "Implicit Connection" logic to determine the execution order (topological sort based on calculated edges).

Execution: You would add an execute() function that calculates the connections array (just like renderGraph does), builds a dependency tree, and runs tasks.

Styles: The CSS is minimal but structured with variables (:root) to easily split into a separate .css file later.