Full spec: the user's complete STARPORT RUSH master prompt v1.0 and Technical Addendum v1.1 (as submitted in the first message). Summary of authoritative details is in requirements.md.

Level 1 JSON (authoritative):
{"levelId":1,"name":"First Contact","board":{"width":6,"height":6},"dockingBayCount":2,
"ships":[
{"id":"cyan-01","color":"cyan","symbol":"triangle","x":4,"y":0,"width":1,"height":2,"exitDirection":"NORTH","capacity":4},
{"id":"yellow-01","color":"yellow","symbol":"star","x":1,"y":1,"width":2,"height":1,"exitDirection":"EAST","capacity":4},
{"id":"pink-01","color":"pink","symbol":"circle","x":2,"y":4,"width":2,"height":1,"exitDirection":"EAST","capacity":4}],
"passengerGroups":[{"color":"yellow","count":4},{"color":"cyan","count":4},{"color":"pink","count":4}],
"expectedSolution":["cyan-01","yellow-01","pink-01"]}

Rules: grid origin top-left, X right, Y down. Ship lifecycle PARKED, DISPATCHING, DOCKED, BOARDING, DEPARTING, DEPARTED. Dispatch requires all swept cells to the board edge free and a free bay; lowest-numbered bay reserved. Auto-boarding: lowest-numbered matching bay first; full ships depart and free bay; exhausted group advances queue. Negative test: Pink then Cyan fills both bays while Yellow is at queue front -> forward deadlock, show Undo/Restart. Timing targets: dispatch 300-450ms, dock 200-350ms, departure 350-600ms. Stage 1 gate evidence: technical, visual, gameplay, performance as listed by user; report incomplete items honestly.
