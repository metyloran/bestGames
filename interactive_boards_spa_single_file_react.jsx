// InteractiveBoards.jsx
// Single-file React SPA for creating & sharing interactive boards
// - Uses Tailwind classes for styling
// - Exports a default React component
// - Features: create/delete boards, freeform canvas, add/move/resize sticky notes, shapes,
//   upload image, zoom & pan, shareable permalink (board state encoded in URL), export/import JSON
// - Assumes Tailwind is available in the project and shadcn/ui + lucide-react are installed (optional)

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Utility: simple uid
const uid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);

// Encode/decode board state into compact base64 for shareable links
function encodeState(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeState(s) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  } catch (e) {
    return null;
  }
}

// Default board template
const makeBoard = (name = 'Untitled board') => ({
  id: uid(),
  name,
  items: [], // items: {id, type:'note'|'shape'|'image', x,y,w,h, text, color, meta}
  createdAt: Date.now(),
});

export default function InteractiveBoardsSPA() {
  // Boards list stored in localStorage
  const [boards, setBoards] = useState(() => {
    try {
      const raw = localStorage.getItem('ib_boards_v1');
      return raw ? JSON.parse(raw) : [makeBoard('My first board')];
    } catch (e) {
      return [makeBoard('My first board')];
    }
  });
  const [activeBoardId, setActiveBoardId] = useState(() => {
    const url = new URL(window.location.href);
    const shared = url.searchParams.get('b');
    if (shared) {
      const decoded = decodeState(shared);
      if (decoded && decoded.id) {
        // push shared board into local list (if not exists)
        try {
          const exists = JSON.parse(localStorage.getItem('ib_boards_v1') || '[]').some(b => b.id === decoded.id);
          if (!exists) {
            const saved = JSON.parse(localStorage.getItem('ib_boards_v1') || '[]');
            saved.push(decoded);
            localStorage.setItem('ib_boards_v1', JSON.stringify(saved));
          }
        } catch (e) {}
        return decoded.id;
      }
    }
    return JSON.parse(localStorage.getItem('ib_active_board') || 'null') || null;
  });

  const activeBoard = boards.find(b => b.id === activeBoardId) || boards[0];

  useEffect(() => {
    localStorage.setItem('ib_boards_v1', JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    if (activeBoardId) localStorage.setItem('ib_active_board', JSON.stringify(activeBoardId));
  }, [activeBoardId]);

  // Canvas transform state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Selected item
  const [selectedId, setSelectedId] = useState(null);

  // Helpers to update active board
  const updateActiveBoard = useCallback((updater) => {
    setBoards(prev => prev.map(b => (b.id === (activeBoard && activeBoard.id) ? updater(b) : b)));
  }, [activeBoard]);

  // Add sticky note
  function addNote() {
    const newItem = {
      id: uid(),
      type: 'note',
      x: 100, y: 100, w: 220, h: 140,
      text: 'New note',
      color: '#fff9b1',
    };
    updateActiveBoard(b => ({ ...b, items: [...b.items, newItem] }));
    setSelectedId(newItem.id);
  }

  function addShape(shape = 'rect') {
    const newItem = {
      id: uid(),
      type: 'shape',
      shape,
      x: 150, y: 150, w: 140, h: 100,
      color: '#d1e8ff',
    };
    updateActiveBoard(b => ({ ...b, items: [...b.items, newItem] }));
    setSelectedId(newItem.id);
  }

  function addImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newItem = {
        id: uid(),
        type: 'image',
        x: 80, y: 80, w: 300, h: 200,
        src: e.target.result,
      };
      updateActiveBoard(b => ({ ...b, items: [...b.items, newItem] }));
      setSelectedId(newItem.id);
    };
    reader.readAsDataURL(file);
  }

  // Drag & resize handlers
  function onPointerDownItem(e, item) {
    e.stopPropagation();
    setSelectedId(item.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const init = { x: item.x, y: item.y };

    function onMove(ev) {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      updateActiveBoard(b => ({ ...b, items: b.items.map(it => it.id === item.id ? ({ ...it, x: init.x + dx, y: init.y + dy }) : it) }));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onResizeStart(e, item, corner) {
    e.stopPropagation();
    setSelectedId(item.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const init = { x: item.x, y: item.y, w: item.w, h: item.h };

    function onMove(ev) {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let nx = init.x;
      let ny = init.y;
      let nw = init.w + dx;
      let nh = init.h + dy;
      if (corner === 'nw') { nx = init.x + dx; ny = init.y + dy; nw = init.w - dx; nh = init.h - dy; }
      updateActiveBoard(b => ({ ...b, items: b.items.map(it => it.id === item.id ? ({ ...it, x: nx, y: ny, w: Math.max(24, nw), h: Math.max(24, nh) }) : it) }));
    }
    function onUp() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Canvas pointer handlers for panning and deselect
  function onCanvasPointerDown(e) {
    // middle-button or space + left drag to pan
    if (e.button === 1 || e.shiftKey) {
      panning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    } else {
      // deselect
      setSelectedId(null);
    }
  }
  function onCanvasPointerMove(e) {
    if (panning.current) {
      const dx = (e.clientX - panStart.current.x);
      const dy = (e.clientY - panStart.current.y);
      setOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
    }
  }
  function onCanvasPointerUp() { panning.current = false; }

  // Remove item
  function removeSelected() {
    if (!selectedId) return;
    updateActiveBoard(b => ({ ...b, items: b.items.filter(it => it.id !== selectedId) }));
    setSelectedId(null);
  }

  // Board CRUD
  function newBoard() {
    const nb = makeBoard('Board ' + (boards.length + 1));
    setBoards(prev => [...prev, nb]);
    setActiveBoardId(nb.id);
  }
  function renameBoard(id, name) {
    setBoards(prev => prev.map(b => b.id === id ? { ...b, name } : b));
  }
  function deleteBoard(id) {
    if (!confirm('Delete board? This cannot be undone.')) return;
    setBoards(prev => prev.filter(b => b.id !== id));
    if (activeBoardId === id) setActiveBoardId(prev => (boards.find(b => b.id !== id) || {}).id || null);
  }

  // Share: encode activeBoard to URL
  function makeShareLink(board) {
    const base = new URL(window.location.href);
    base.searchParams.set('b', encodeState(board));
    return base.toString();
  }

  // Import/Export
  function exportBoardJSON(board) {
    const data = JSON.stringify(board, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = `${board.name || 'board'}.json`; a.click();
    URL.revokeObjectURL(href);
  }

  function importBoardFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.id) parsed.id = uid();
        setBoards(prev => [...prev, parsed]);
        setActiveBoardId(parsed.id);
      } catch (err) {
        alert('Invalid board file');
      }
    };
    reader.readAsText(file);
  }

  // Update selected item text
  function updateSelectedText(text) {
    if (!selectedId) return;
    updateActiveBoard(b => ({ ...b, items: b.items.map(it => it.id === selectedId ? ({ ...it, text }) : it) }));
  }

  // Update selected item color
  function updateSelectedColor(color) {
    if (!selectedId) return;
    updateActiveBoard(b => ({ ...b, items: b.items.map(it => it.id === selectedId ? ({ ...it, color }) : it) }));
  }

  // Zoom controls
  function zoomIn() { setZoom(z => Math.min(3, +(z + 0.1).toFixed(2))); }
  function zoomOut() { setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(2))); }
  function fitToScreen() { setZoom(1); setOffset({ x: 0, y: 0 }); }

  // Keyboard shortcuts (Delete, Ctrl+D duplicate)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Delete') removeSelected();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        // duplicate selected
        if (!selectedId) return;
        updateActiveBoard(b => {
          const it = b.items.find(x => x.id === selectedId);
          if (!it) return b;
          const copy = { ...JSON.parse(JSON.stringify(it)), id: uid(), x: it.x + 20, y: it.y + 20 };
          return { ...b, items: [...b.items, copy] };
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // Render
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-3 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Boards</h2>
        <div className="flex gap-2">
          <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={newBoard}>New</button>
          <button className="px-2 py-1 bg-gray-100 rounded" onClick={() => {
            if (!activeBoard) return; navigator.clipboard.writeText(makeShareLink(activeBoard)); alert('Share link copied');
          }}>Share</button>
        </div>

        <div className="flex-1 overflow-auto">
          {boards.map(b => (
            <div key={b.id} className={`p-2 rounded cursor-pointer flex items-center justify-between ${b.id === (activeBoard && activeBoard.id) ? 'bg-gray-100' : ''}`}>
              <div onClick={() => setActiveBoardId(b.id)} className="flex-1">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-xs text-gray-500">{b.items.length} items</div>
              </div>
              <div className="ml-2 flex gap-1">
                <button title="Rename" onClick={() => { const nv = prompt('Rename', b.name); if (nv) renameBoard(b.id, nv); }} className="text-xs px-2 py-1 bg-gray-100 rounded">✏️</button>
                <button title="Delete" onClick={() => deleteBoard(b.id)} className="text-xs px-2 py-1 bg-red-50 rounded">🗑️</button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t">
          <div className="flex gap-2 mb-2">
            <button onClick={addNote} className="flex-1 py-1 rounded border">+ Note</button>
            <button onClick={() => addShape('rect')} className="py-1 px-2 rounded border">▭</button>
            <button onClick={() => addShape('ellipse')} className="py-1 px-2 rounded border">◯</button>
          </div>
          <label className="block text-xs mb-1">Image upload</label>
          <input type="file" accept="image/*" onChange={(e) => e.target.files && addImageFromFile(e.target.files[0])} />
        </div>

        <div className="pt-2 border-t">
          <div className="flex gap-2">
            <button onClick={() => exportBoardJSON(activeBoard)} className="flex-1 py-1 rounded border">Export</button>
            <label className="flex-1 py-1 rounded border text-center cursor-pointer">Import
              <input type="file" accept="application/json" onChange={(e) => e.target.files && importBoardFromFile(e.target.files[0])} className="hidden" />
            </label>
          </div>
        </div>

        <div className="text-xs text-gray-500 pt-2">Hints: drag notes, use Shift to pan, middle mouse to pan, Delete to remove, Cmd/Ctrl+D duplicate.</div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-3 border-b bg-white">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">{activeBoard ? activeBoard.name : 'No board'}</h1>
            <div className="flex items-center gap-2">
              <button onClick={zoomOut} className="px-2 py-1 rounded border">-</button>
              <div className="px-2 py-1 border rounded">{Math.round(zoom * 100)}%</div>
              <button onClick={zoomIn} className="px-2 py-1 rounded border">+</button>
              <button onClick={fitToScreen} className="px-2 py-1 rounded border">Reset</button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600">Items: {activeBoard ? activeBoard.items.length : 0}</div>
            <div className="text-sm text-gray-600">Zoom: {zoom.toFixed(2)}</div>
            <div className="w-px h-6 bg-gray-200 mx-2" />
            <button onClick={() => { const link = makeShareLink(activeBoard); navigator.clipboard.writeText(link); alert('Share link copied'); }} className="px-3 py-1 bg-green-600 text-white rounded">Copy share link</button>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden" onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp}>
          {/* Canvas area */}
          <div ref={canvasRef} className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'40\' height=\'40\' fill=\'%23f8fafc\'/><path d=\'M0 0 L40 0 L40 40\' stroke=\'%23e6edf3\' stroke-width=1 fill=\'none\'/></svg>')]">
            <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 4000, height: 3000 }}>
              {/* board background */}
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {(activeBoard && activeBoard.items || []).map(item => (
                  <BoardItem key={item.id} item={item} selected={item.id === selectedId} onPointerDown={(e) => onPointerDownItem(e, item)} onResizeStart={(e, c) => onResizeStart(e, item, c)} onUpdate={updateActiveBoard} />
                ))}
              </div>
            </div>
          </div>

          {/* Inspector */}
          <div className="absolute right-4 bottom-4 w-80 bg-white p-3 rounded shadow">
            <div className="font-semibold mb-2">Inspector</div>
            {selectedId ? (
              (() => {
                const it = (activeBoard && activeBoard.items || []).find(x => x.id === selectedId);
                if (!it) return <div className="text-sm text-gray-500">Item not found</div>;
                return (
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Type: {it.type}</div>
                    {it.type === 'note' && (
                      <>
                        <textarea value={it.text || ''} onChange={(e) => updateSelectedText(e.target.value)} className="w-full p-2 border rounded h-24" />
                        <div className="flex gap-2 items-center">
                          <label className="text-xs">Color</label>
                          <input type="color" value={it.color || '#fff9b1'} onChange={(e) => updateSelectedColor(e.target.value)} />
                        </div>
                      </>
                    )}
                    {it.type === 'image' && (
                      <div className="text-sm">Image — {Math.round(it.w)}×{Math.round(it.h)}</div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(it)); alert('Item JSON copied'); }} className="flex-1 py-1 rounded border">Copy JSON</button>
                      <button onClick={removeSelected} className="flex-1 py-1 rounded border text-red-600">Delete</button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-gray-500">Select an item to edit</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function BoardItem({ item, selected, onPointerDown, onResizeStart, onUpdate }) {
  const styleBase = {
    position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h, touchAction: 'none'
  };
  if (item.type === 'note') {
    return (
      <div style={styleBase} className={`shadow ${selected ? 'ring-2 ring-blue-400' : ''}`} onPointerDown={onPointerDown}>
        <div style={{ width: '100%', height: '100%', background: item.color || '#fff9b1', padding: 10, boxSizing: 'border-box', overflow: 'hidden', borderRadius: 6 }}>
          <div contentEditable suppressContentEditableWarning onBlur={(e) => onUpdate(b => ({ ...b, items: b.items.map(it => it.id === item.id ? ({ ...it, text: e.target.innerText }) : it) }))} style={{ width: '100%', height: '100%', outline: 'none', whiteSpace: 'pre-wrap' }}>{item.text}</div>
        </div>
        {/* resize handle */}
        <div style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, cursor: 'nwse-resize' }} onPointerDown={(e) => onResizeStart(e, 'se')} />
      </div>
    );
  }
  if (item.type === 'shape') {
    return (
      <div style={styleBase} onPointerDown={onPointerDown}>
        <div style={{ width: '100%', height: '100%', background: item.shape === 'ellipse' ? 'transparent' : (item.color || '#d1e8ff'), borderRadius: item.shape === 'ellipse' ? '50%' : 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {item.shape === 'ellipse' ? <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><ellipse cx="50" cy="50" rx="50" ry="50" fill={item.color || '#d1e8ff'} /></svg> : null}
        </div>
        <div style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, cursor: 'nwse-resize' }} onPointerDown={(e) => onResizeStart(e, 'se')} />
      </div>
    );
  }
  if (item.type === 'image') {
    return (
      <div style={styleBase} onPointerDown={onPointerDown}>
        <img src={item.src} alt="uploaded" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
        <div style={{ position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, cursor: 'nwse-resize' }} onPointerDown={(e) => onResizeStart(e, 'se')} />
      </div>
    );
  }
  return null;
}
