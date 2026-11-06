import React, { useEffect } from "react";
import Ably from "ably";
import {
  Tldraw,
  useEditor,
  createShapeId,
  Editor,
  DefaultColorStyle,
  DefaultSizeStyle,
  DefaultFontStyle,
} from "tldraw";
import "tldraw/tldraw.css";
import { quillAudio } from "../utils/quillAudio";

// ---------------------------------------------------------------------------
// Session identity — stable per browser tab
// ---------------------------------------------------------------------------
const SESSION_ID = Math.random().toString(36).slice(2, 11);
const LOCAL_CACHE_KEY = "scriptorium_v2_shapes_cache";

const CURSOR_COLORS = [
  { name: "Sepia",       hex: "#7a4f2e" },
  { name: "Vermillion",  hex: "#a8251a" },
  { name: "Verdigris",   hex: "#2e7a5a" },
  { name: "Ultramarine", hex: "#1a3ca8" },
  { name: "Oak Gall",    hex: "#3d2b0f" },
  { name: "Saffron",     hex: "#b8860b" },
];

function getStableSessionColor(id: string): { name: string; hex: string } {
  const sum = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURSOR_COLORS[sum % CURSOR_COLORS.length];
}

const SESSION_COLOR = getStableSessionColor(SESSION_ID);

// ---------------------------------------------------------------------------
// Ably singleton — one connection shared for the whole app lifetime
// ---------------------------------------------------------------------------
let ablyClient: Ably.Realtime | null = null;
function getAblyClient(): Ably.Realtime {
  if (ablyClient) return ablyClient;
  ablyClient = new Ably.Realtime({
    authUrl: "/api/ably-token",
    authParams: { clientId: SESSION_ID },
    clientId: SESSION_ID,
    disconnectedRetryTimeout: 10000,
    suspendedRetryTimeout: 20000,
  });
  return ablyClient;
}

// ---------------------------------------------------------------------------
// Coordinate helpers — all shapes and cursors stored in page space (virtual
// tldraw coords, 800 units wide).
// ---------------------------------------------------------------------------
function screenToPage(editor: Editor, screenX: number, screenY: number) {
  try {
    const pt = editor.screenToPage({ x: screenX, y: screenY });
    return { x: pt.x, y: pt.y };
  } catch {
    return { x: screenX, y: screenY };
  }
}

function pageToScreen(editor: Editor, pageX: number, pageY: number) {
  try {
    const pt = editor.pageToScreen({ x: pageX, y: pageY });
    return { x: pt.x, y: pt.y };
  } catch {
    return { x: pageX, y: pageY };
  }
}

export function insertImageFileOntoScroll(editor: Editor, file: File) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = ev.target?.result as string;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      let w = img.width,
        h = img.height;
      const max = 440;
      if (w > max || h > max) {
        const r = Math.min(max / w, max / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const randId = Math.random().toString(36).slice(2, 11);
      const assetId = ("asset:" + randId) as any;
      const shapeId = createShapeId(randId);
      try {
        (editor as any).updateViewportScreenBounds?.();
      } catch (_) {}
      const centerPage = screenToPage(
        editor,
        window.innerWidth / 2,
        window.innerHeight * 0.44
      );
      editor.run(() => {
        editor.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: file.name || "parchment-image.png",
              src,
              w,
              h,
              mimeType: file.type || "image/png",
            },
          } as any,
        ]);
        editor.createShapes([
          {
            id: shapeId,
            type: "image",
            x: Math.max(24, Math.min(776 - w, centerPage.x - w / 2)),
            y: Math.max(24, centerPage.y - h / 2),
            props: { assetId, w, h },
          } as any,
        ]);
        editor.setCurrentTool("select");
        editor.select(shapeId);
      });
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

// ---------------------------------------------------------------------------
// GhostCursors — renders remote users' cursors in screen space
// ---------------------------------------------------------------------------
export interface RemoteCursor {
  sessionId: string;
  pageX: number;
  pageY: number;
  color: string;
  tool: string;
  ts: number;
}

function GhostCursors({
  cursors,
  mySessionId,
  editor,
}: {
  cursors: Record<string, RemoteCursor>;
  mySessionId: string;
  editor: Editor | null;
}) {
  const [, tick] = React.useReducer((n) => n + 1, 0);
  const hasCursors =
    editor != null &&
    Object.keys(cursors).some(
      (sid) => sid !== mySessionId && Date.now() - cursors[sid].ts < 15_000
    );

  useEffect(() => {
    if (!hasCursors) return;
    let frame: number;
    const loop = () => {
      tick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [hasCursors]);

  if (!editor) return null;
  const now = Date.now();
  const entries = Object.entries(cursors).filter(
    ([sid, c]) =>
      sid !== mySessionId &&
      now - c.ts < 15_000 &&
      c.pageX >= 0 &&
      c.pageY >= 0
  );
  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(([sid, c]) => {
        const age = now - c.ts;
        const opacity =
          age < 8_000 ? 0.9 : Math.max(0, 0.9 * (1 - (age - 8_000) / 7_000));
        const screen = pageToScreen(editor, c.pageX, c.pageY);
        const isQuill = c.tool === "draw";
        return (
          <div
            key={sid}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              transform: `translate3d(${screen.x - 2}px, ${screen.y - 2}px, 0)`,
              pointerEvents: "none",
              zIndex: 999,
              opacity,
              willChange: "transform",
            }}
          >
            {isQuill ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 20 20"
                fill="none"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
              >
                <path
                  d="M15 2 C12 4 5 10 3 17 L7 13 C8 11 11 8 15 2Z"
                  fill={c.color}
                  fillOpacity="0.92"
                />
                <path
                  d="M3 17 L5 14 L7 16Z"
                  fill={c.color}
                  fillOpacity="0.75"
                />
                <path
                  d="M3 17 L2 19"
                  stroke={c.color}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
              >
                <path
                  d="M2 2 L2 13 L5.5 9.5 L8 14 L9.5 13.3 L7 8.5 L11.5 8.5Z"
                  fill={c.color}
                  fillOpacity="0.92"
                  stroke="#fff"
                  strokeWidth="0.5"
                />
              </svg>
            )}
            <div
              style={{
                position: "absolute",
                top: "18px",
                left: "4px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: c.color,
                border: "1.5px solid rgba(255,255,255,0.75)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              }}
            />
          </div>
        );
      })}
    </>
  );
}

export interface PendingStamp {
  id: string;
  symbol: string;
  label: string;
  color: string;
}

interface WritingCanvasProps {
  onEditorReady: (editor: Editor) => void;
  userZoom: number;
  setUserZoom: React.Dispatch<React.SetStateAction<number>>;
  onActiveScribesChange?: (count: number) => void;
  pendingStamp?: PendingStamp | null;
  onStampPlaced?: () => void;
}

function EditorRefSetter({
  onEditorReady,
}: {
  onEditorReady: (editor: Editor) => void;
}) {
  const editor = useEditor();
  const lastRef = React.useRef<Editor | null>(null);
  useEffect(() => {
    if (editor && editor !== lastRef.current) {
      lastRef.current = editor;
      if (typeof window !== "undefined") (window as any).tldrawEditor = editor;
      // Set initial active tool to draw (Quill) and configure authentic medieval ink defaults
      try {
        editor.setCurrentTool("draw");
        editor.setStyleForNextShapes(DefaultColorStyle, "black");
        editor.setStyleForNextShapes(DefaultSizeStyle, "m");
        editor.setStyleForNextShapes(DefaultFontStyle, "serif");
        (editor as any).updateViewportScreenBounds?.();
      } catch (_) {}
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);
  return null;
}

// ---------------------------------------------------------------------------
// CommunalSync — O(1) incremental delta sync + Redis + LocalStorage cache
// ---------------------------------------------------------------------------
function CommunalSync({
  onCursorsUpdate,
  onActiveScribesChange,
}: {
  onCursorsUpdate: (cursors: Record<string, RemoteCursor>) => void;
  onActiveScribesChange?: (count: number) => void;
}) {
  const editor = useEditor();
  const isInitialLoadDoneRef = React.useRef(false);
  const isApplyingRemoteRef = React.useRef(false);

  // Track serialized strings only for shapes we have touched/synced
  const lastSentAblyRef = React.useRef<Record<string, string>>({});
  const lastSavedRedisRef = React.useRef<Record<string, string>>({});

  // O(1) dirty queues populated directly by editor.store.listen(entry.changes)
  const dirtyAblyUpsertsRef = React.useRef<Set<string>>(new Set());
  const dirtyAblyDeletesRef = React.useRef<Set<string>>(new Set());
  const dirtyRedisUpsertsRef = React.useRef<Set<string>>(new Set());
  const dirtyRedisDeletesRef = React.useRef<Set<string>>(new Set());

  // Local shape map for instant localStorage persistence
  const localShapeCacheRef = React.useRef<Record<string, any>>({});

  const cursorThrottleRef = React.useRef(0);

  useEffect(() => {
    const isShapeRecord = (r: any) =>
      r &&
      typeof r === "object" &&
      typeof r.id === "string" &&
      (r.typeName === "shape" || r.typeName === "asset");

    const saveLocalCache = () => {
      try {
        localStorage.setItem(
          LOCAL_CACHE_KEY,
          JSON.stringify(localShapeCacheRef.current)
        );
      } catch (_) {}
    };

    // 0. Instant hydrate from localStorage so reload feels 0ms fast
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const cachedRecords = Object.values(parsed).filter(isShapeRecord);
          if (cachedRecords.length > 0) {
            isApplyingRemoteRef.current = true;
            editor.store.put(cachedRecords as any[]);
            for (const r of cachedRecords as any[]) {
              localShapeCacheRef.current[r.id] = r;
              const s = JSON.stringify(r);
              lastSentAblyRef.current[r.id] = s;
              lastSavedRedisRef.current[r.id] = s;
            }
            isApplyingRemoteRef.current = false;
          }
        }
      }
    } catch (_) {
      isApplyingRemoteRef.current = false;
    }

    const ably = getAblyClient();
    const shapesChannel = ably.channels.get("scroll:shapes");
    const cursorsChannel = ably.channels.get("scroll:cursors");

    const loadRemoteState = async () => {
      try {
        isApplyingRemoteRef.current = true;
        const accumulatedShapes: Record<string, any> = {
          ...localShapeCacheRef.current,
        };
        const accumulatedDeleted: Set<string> = new Set();

        // 1. Fetch durable state from server (/api/sync-state -> Redis or server memory)
        try {
          const res = await fetch("/api/sync-state");
          if (res.ok) {
            const data = await res.json();
            if (data && data.shapes) {
              for (const [id, record] of Object.entries(data.shapes)) {
                if (typeof id === "string" && isShapeRecord(record)) {
                  accumulatedShapes[id] = record;
                }
              }
            }
            if (data && Array.isArray(data.deleted)) {
              for (const id of data.deleted) {
                if (typeof id === "string") {
                  accumulatedDeleted.add(id);
                  delete accumulatedShapes[id];
                }
              }
            }
          }
        } catch (_) {}

        // 2. Replay recent Ably history if connected
        try {
          let historyPage = await shapesChannel.history({
            limit: 100,
            direction: "forwards",
          });
          while (historyPage) {
            const items = historyPage.items || [];
            for (const msg of items) {
              if (msg.name === "delta" && msg.data) {
                const { upserted = {}, deleted = [] } = msg.data as {
                  upserted: Record<string, any>;
                  deleted: any[];
                };
                if (upserted && typeof upserted === "object") {
                  for (const [id, record] of Object.entries(upserted)) {
                    if (typeof id === "string" && isShapeRecord(record)) {
                      accumulatedShapes[id] = record;
                      accumulatedDeleted.delete(id);
                    }
                  }
                }
                if (Array.isArray(deleted)) {
                  for (const id of deleted) {
                    if (typeof id === "string") {
                      delete accumulatedShapes[id];
                      accumulatedDeleted.add(id);
                    }
                  }
                }
              }
            }
            if (historyPage.hasNext?.()) {
              historyPage = await historyPage.next();
            } else {
              break;
            }
          }
        } catch (_) {}

        const toPut = Object.values(accumulatedShapes).filter(isShapeRecord);
        if (toPut.length > 0) {
          try {
            editor.store.put(toPut);
          } catch (_) {}
        }

        const toRemove = Array.from(accumulatedDeleted).filter((id) => {
          try {
            const r = editor.store.get(id as any);
            return r && isShapeRecord(r);
          } catch {
            return false;
          }
        });
        if (toRemove.length > 0) {
          try {
            editor.store.remove(toRemove as any[]);
          } catch (_) {}
        }

        // Sync tracking maps
        localShapeCacheRef.current = {};
        for (const r of toPut) {
          if (!accumulatedDeleted.has(r.id)) {
            const serialized = JSON.stringify(r);
            localShapeCacheRef.current[r.id] = r;
            lastSentAblyRef.current[r.id] = serialized;
            lastSavedRedisRef.current[r.id] = serialized;
          }
        }
        saveLocalCache();
      } catch (_) {
      } finally {
        isApplyingRemoteRef.current = false;
        isInitialLoadDoneRef.current = true;
      }
    };

    const onShapeDelta = (msg: Ably.Message) => {
      if (!isInitialLoadDoneRef.current) return;
      const { upserted = {}, deleted = [] } = (msg.data || {}) as {
        upserted: Record<string, any>;
        deleted: any[];
      };

      const toPut = Object.values(upserted || {}).filter(isShapeRecord);
      const filtered = toPut.filter((r: any) => {
        const serialized = JSON.stringify(r);
        return lastSentAblyRef.current[r.id] !== serialized;
      });

      const toRemove = (Array.isArray(deleted) ? deleted : []).filter(
        (id): id is string =>
          typeof id === "string" &&
          (() => {
            try {
              return editor.store.get(id as any) !== undefined;
            } catch {
              return false;
            }
          })()
      );

      if (filtered.length === 0 && toRemove.length === 0) return;

      isApplyingRemoteRef.current = true;
      if (filtered.length > 0) {
        try {
          editor.store.put(filtered);
        } catch (_) {}
        for (const r of filtered) {
          const serialized = JSON.stringify(r);
          lastSentAblyRef.current[r.id] = serialized;
          lastSavedRedisRef.current[r.id] = serialized;
          localShapeCacheRef.current[r.id] = r;
        }
      }
      if (toRemove.length > 0) {
        try {
          editor.store.remove(toRemove as any[]);
        } catch (_) {}
        for (const id of toRemove) {
          delete lastSentAblyRef.current[id];
          delete lastSavedRedisRef.current[id];
          delete localShapeCacheRef.current[id];
        }
      }
      saveLocalCache();
      isApplyingRemoteRef.current = false;
    };

    shapesChannel.subscribe("delta", onShapeDelta);

    let publishAblyTimeout: any = null;
    let saveRedisTimeout: any = null;

    // O(1) incremental Ably publish — only inspects shapes marked dirty since last publish!
    const publishDiffAbly = () => {
      if (!editor) return;
      const upserted: Record<string, any> = {};
      const deletedIds: string[] = [];

      for (const id of Array.from(dirtyAblyUpsertsRef.current)) {
        dirtyAblyUpsertsRef.current.delete(id);
        try {
          const record = editor.store.get(id as any);
          if (record && isShapeRecord(record)) {
            const serialized = JSON.stringify(record);
            if (lastSentAblyRef.current[id] !== serialized) {
              upserted[id] = record;
              lastSentAblyRef.current[id] = serialized;
            }
          }
        } catch (_) {}
      }

      for (const id of Array.from(dirtyAblyDeletesRef.current)) {
        dirtyAblyDeletesRef.current.delete(id);
        deletedIds.push(id);
        delete lastSentAblyRef.current[id];
      }

      if (Object.keys(upserted).length === 0 && deletedIds.length === 0) return;
      try {
        shapesChannel.publish("delta", { upserted, deleted: deletedIds });
      } catch (_) {}
    };

    // O(1) incremental Redis + LocalStorage persistence
    const saveToRedis = async () => {
      if (!editor) return;
      const upserted: Record<string, any> = {};
      const deletedIds: string[] = [];

      for (const id of Array.from(dirtyRedisUpsertsRef.current)) {
        dirtyRedisUpsertsRef.current.delete(id);
        try {
          const record = editor.store.get(id as any);
          if (record && isShapeRecord(record)) {
            const serialized = JSON.stringify(record);
            localShapeCacheRef.current[id] = record;
            if (lastSavedRedisRef.current[id] !== serialized) {
              upserted[id] = record;
              lastSavedRedisRef.current[id] = serialized;
            }
          }
        } catch (_) {}
      }

      for (const id of Array.from(dirtyRedisDeletesRef.current)) {
        dirtyRedisDeletesRef.current.delete(id);
        deletedIds.push(id);
        delete lastSavedRedisRef.current[id];
        delete localShapeCacheRef.current[id];
      }

      saveLocalCache();

      if (Object.keys(upserted).length === 0 && deletedIds.length === 0) return;

      try {
        await fetch("/api/sync-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upserted,
            deleted: deletedIds,
          }),
        });
      } catch (_) {}
    };

    const unsubscribeStore = editor.store.listen((entry: any) => {
      if (isApplyingRemoteRef.current) return;
      if (!isInitialLoadDoneRef.current) return;

      const changes = entry.changes;
      let hasShapeChange = false;

      try {
        for (const r of Object.values(changes.added || {}) as any[]) {
          if (isShapeRecord(r)) {
            hasShapeChange = true;
            dirtyAblyUpsertsRef.current.add(r.id);
            dirtyRedisUpsertsRef.current.add(r.id);
            dirtyAblyDeletesRef.current.delete(r.id);
            dirtyRedisDeletesRef.current.delete(r.id);
          }
        }
        for (const u of Object.values(changes.updated || {}) as any[]) {
          const rec = Array.isArray(u) ? u[1] : u;
          if (isShapeRecord(rec)) {
            hasShapeChange = true;
            dirtyAblyUpsertsRef.current.add(rec.id);
            dirtyRedisUpsertsRef.current.add(rec.id);
          }
        }
        for (const r of Object.values(changes.removed || {}) as any[]) {
          if (isShapeRecord(r)) {
            hasShapeChange = true;
            dirtyAblyDeletesRef.current.add(r.id);
            dirtyRedisDeletesRef.current.add(r.id);
            dirtyAblyUpsertsRef.current.delete(r.id);
            dirtyRedisUpsertsRef.current.delete(r.id);
          }
        }
      } catch (_) {}

      if (hasShapeChange) {
        if (publishAblyTimeout) clearTimeout(publishAblyTimeout);
        publishAblyTimeout = setTimeout(publishDiffAbly, 75);

        if (saveRedisTimeout) clearTimeout(saveRedisTimeout);
        saveRedisTimeout = setTimeout(saveToRedis, 1500);
      }
    });

    // ── Cursors & Presence ───────────────────────────────────────────────────
    const cursorsMap: Record<string, RemoteCursor> = {};

    const syncCursors = (members: Ably.PresenceMessage[]) => {
      for (const key of Object.keys(cursorsMap)) delete cursorsMap[key];
      let otherCount = 0;
      for (const m of members) {
        if (m.clientId === SESSION_ID) continue;
        otherCount++;
        const d = m.data as any;
        if (!d || d.pageX === undefined || d.pageY === undefined) continue;
        cursorsMap[m.clientId] = {
          sessionId: m.clientId,
          pageX: d.pageX,
          pageY: d.pageY,
          color: d.color ?? "#cca162",
          tool: d.tool ?? "draw",
          ts: d.ts ?? Date.now(),
        };
      }
      onCursorsUpdate({ ...cursorsMap });
      if (onActiveScribesChange) {
        onActiveScribesChange(otherCount + 1);
      }
    };

    cursorsChannel.presence.subscribe(() => {
      cursorsChannel.presence
        .get()
        .then((members) => syncCursors(members))
        .catch(() => {});
    });

    const enterPresence = async () => {
      await loadRemoteState();
      try {
        await cursorsChannel.presence.enter({
          pageX: -1000,
          pageY: -1000,
          color: SESSION_COLOR.hex,
          tool: "draw",
          ts: Date.now(),
        });
      } catch (_) {}
    };
    enterPresence();

    const handlePointerMove = (e: PointerEvent) => {
      const isTouch = e.pointerType === "touch";
      if (!isInitialLoadDoneRef.current) return;
      if (isTouch && e.buttons === 0) return;

      const now = Date.now();
      if (now - cursorThrottleRef.current < 55) return;
      cursorThrottleRef.current = now;

      const pt = screenToPage(editor, e.clientX, e.clientY);
      const tool = (() => {
        try {
          return editor.getCurrentToolId() ?? "draw";
        } catch {
          return "draw";
        }
      })();

      cursorsChannel.presence
        .update({
          pageX: pt.x,
          pageY: pt.y,
          color: SESSION_COLOR.hex,
          tool,
          ts: now,
        })
        .catch(() => {});
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch" && isInitialLoadDoneRef.current) {
        cursorsChannel.presence
          .update({
            pageX: -1000,
            pageY: -1000,
            color: SESSION_COLOR.hex,
            tool: "draw",
            ts: Date.now(),
          })
          .catch(() => {});
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });

    const handleBeforeUnload = () => {
      try {
        cursorsChannel.presence.leave();
      } catch (_) {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const reenterPresence = () => {
      cursorsChannel.presence
        .update({
          pageX: -1000,
          pageY: -1000,
          color: SESSION_COLOR.hex,
          tool: "draw",
          ts: Date.now(),
        })
        .catch(() => {
          cursorsChannel.presence
            .enter({
              pageX: -1000,
              pageY: -1000,
              color: SESSION_COLOR.hex,
              tool: "draw",
              ts: Date.now(),
            })
            .catch(() => {});
        });
    };

    const onConnected = () => {
      if (!isInitialLoadDoneRef.current) return;
      loadRemoteState();
      reenterPresence();
    };
    ably.connection.on("connected", onConnected);

    const onVisibility = () => {
      if (document.hidden) {
        try {
          cursorsChannel.presence.leave();
        } catch (_) {}
      } else if (isInitialLoadDoneRef.current) {
        loadRemoteState();
        reenterPresence();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsubscribeStore();
      if (publishAblyTimeout) clearTimeout(publishAblyTimeout);
      if (saveRedisTimeout) clearTimeout(saveRedisTimeout);
      shapesChannel.unsubscribe("delta", onShapeDelta);
      cursorsChannel.presence.unsubscribe();
      try {
        cursorsChannel.presence.leave();
      } catch (_) {}
      ably.connection.off("connected", onConnected);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [editor, onCursorsUpdate, onActiveScribesChange]);

  return null;
}

// ---------------------------------------------------------------------------
// CameraLock — keeps camera strictly locked at origin (x: 0, y: 0) scaled to
// the 800-unit virtual width, listening ONLY to camera mutations or resize
// (zero layout thrashing during drawing strokes).
// ---------------------------------------------------------------------------
function CameraLock({ userZoom }: { userZoom: number }) {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    let active = true;
    const VIRTUAL_WIDTH = 800;
    let cachedTargetZoom: number | null = null;

    const updateCamera = (forceRecalculateRect = false) => {
      if (!active) return;
      try {
        if (forceRecalculateRect || cachedTargetZoom === null) {
          const container = editor.getContainer();
          if (container) {
            try {
              (editor as any).updateViewportScreenBounds();
            } catch (_) {}
            const rect = container.getBoundingClientRect();
            if (rect.width > 0) {
              const baselineZoom = rect.width / VIRTUAL_WIDTH;
              cachedTargetZoom = baselineZoom * userZoom;
            }
          }
        }

        const targetZoom = cachedTargetZoom ?? 1;
        const currentCam = editor.getCamera();
        if (
          Math.abs(currentCam.x) > 0.01 ||
          Math.abs(currentCam.y) > 0.01 ||
          Math.abs(currentCam.z - targetZoom) > 0.001
        ) {
          editor.setCamera({ x: 0, y: 0, z: targetZoom });
        }
      } catch (_) {}
    };

    updateCamera(true);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (active) updateCamera(true);
      });
    });

    try {
      const container = editor.getContainer();
      if (container) resizeObserver.observe(container);
    } catch (_) {}

    // Only invoke updateCamera when a camera record actually changes!
    const unsub = editor.store.listen((entry: any) => {
      const updated = entry.changes?.updated;
      if (!updated) return;
      for (const key of Object.keys(updated)) {
        if (key.startsWith("camera:")) {
          updateCamera(false);
          break;
        }
      }
    });

    return () => {
      active = false;
      resizeObserver.disconnect();
      unsub();
    };
  }, [editor, userZoom]);

  return null;
}

// ---------------------------------------------------------------------------
// ScrollBoundsUpdater — keeps tldraw viewport in sync with parchment scroll
// ---------------------------------------------------------------------------
function ScrollBoundsUpdater() {
  const editor = useEditor();
  useEffect(() => {
    if (!editor) return;
    const sheetWrap = document.getElementById("sheetWrap");
    if (!sheetWrap) return;
    let pendingFrame: number | null = null;
    const handler = () => {
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        try {
          (editor as any).updateViewportScreenBounds();
        } catch (_) {}
      });
    };
    sheetWrap.addEventListener("scroll", handler, { passive: true });
    return () => {
      sheetWrap.removeEventListener("scroll", handler);
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    };
  }, [editor]);
  return null;
}

// ---------------------------------------------------------------------------
// InkSoakFilterDef — Microscopic vellum fiber grain & capillary absorption filters
// ---------------------------------------------------------------------------
function InkSoakFilterDef() {
  return (
    <svg
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Capillary Absorption & Vellum Edge Bleed */}
        <filter
          id="ink-soak-capillary"
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="3"
            seed="31"
            result="fibers"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fibers"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
            result="feathered"
          />
          <feMorphology
            in="feathered"
            operator="dilate"
            radius="0.75"
            result="dilated"
          />
          <feGaussianBlur
            in="dilated"
            stdDeviation="0.4"
            result="gritBleed"
          />
          <feColorMatrix
            in="dilated"
            type="matrix"
            values="0.86 0    0    0 0
                    0    0.86 0    0 0
                    0    0    0.86 0 0
                    0    0    0    1 0"
            result="darkPigment"
          />
          <feMerge>
            <feMergeNode in="gritBleed" />
            <feMergeNode in="darkPigment" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Fully Cured & Settled Matte Vellum Ink Filter */}
        <filter
          id="ink-soaked-cured"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="2"
            seed="19"
            result="fineGrain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fineGrain"
            scale="0.65"
            xChannelSelector="R"
            yChannelSelector="G"
            result="curedStroke"
          />
          <feColorMatrix
            in="curedStroke"
            type="matrix"
            values="0.92 0    0    0 0
                    0    0.92 0    0 0
                    0    0    0.92 0 0
                    0    0    0    1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// InkSoakManager — Tracks newly drawn strokes and applies capillary absorption
// ---------------------------------------------------------------------------
function InkSoakManager() {
  const editor = useEditor();
  const sessionCreatedShapeIds = React.useRef<Set<string>>(new Set());
  const activeTimeouts = React.useRef<Map<string, number>>(new Map());
  const isHydratedRef = React.useRef(false);

  useEffect(() => {
    // Grace period so any shapes loaded from cache or Ably are marked cured and never re-animate
    const timer = setTimeout(() => {
      isHydratedRef.current = true;
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!editor) return;

    // Listen only to draw shapes added interactively in this session
    const unsub = editor.store.listen((entry: any) => {
      if (!isHydratedRef.current) return;
      const added = entry.changes?.added;
      if (!added) return;

      for (const [id, record] of Object.entries(added) as [string, any][]) {
        if (record?.typeName === "shape" && record?.type === "draw") {
          sessionCreatedShapeIds.current.add(id);
        }
      }
    });

    return () => unsub();
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const applyInkSoakToShape = (shapeId: string) => {
      const container = editor.getContainer();
      if (!container) return;

      const shapeEl = container.querySelector(
        `[data-shape-id="${shapeId}"]`
      ) as HTMLElement | null;

      if (!shapeEl) {
        requestAnimationFrame(() => {
          const retryEl = container.querySelector(
            `[data-shape-id="${shapeId}"]`
          ) as HTMLElement | null;
          if (retryEl && !retryEl.classList.contains("ink-soaking-fresh")) {
            triggerSoak(retryEl, shapeId);
          }
        });
        return;
      }

      if (
        !shapeEl.classList.contains("ink-soaking-fresh") &&
        !shapeEl.classList.contains("ink-soaked-settled")
      ) {
        triggerSoak(shapeEl, shapeId);
      }
    };

    const triggerSoak = (el: HTMLElement, shapeId: string) => {
      el.classList.remove("ink-soaked-settled");
      el.classList.add("ink-soaking-fresh");

      if (activeTimeouts.current.has(shapeId)) {
        window.clearTimeout(activeTimeouts.current.get(shapeId));
      }

      // Natural drying pace over 440ms
      const t = window.setTimeout(() => {
        el.classList.remove("ink-soaking-fresh");
        el.classList.add("ink-soaked-settled");
        activeTimeouts.current.delete(shapeId);
      }, 440);

      activeTimeouts.current.set(shapeId, t);
    };

    const onStrokeComplete = () => {
      if (sessionCreatedShapeIds.current.size === 0) return;
      sessionCreatedShapeIds.current.forEach((id) => {
        applyInkSoakToShape(id);
      });
    };

    window.addEventListener("pointerup", onStrokeComplete, { passive: true });
    window.addEventListener("touchend", onStrokeComplete, { passive: true });

    return () => {
      window.removeEventListener("pointerup", onStrokeComplete);
      window.removeEventListener("touchend", onStrokeComplete);
      activeTimeouts.current.forEach((t) => window.clearTimeout(t));
      activeTimeouts.current.clear();
    };
  }, [editor]);

  return null;
}

// ---------------------------------------------------------------------------
// Magnifier loupe (touch only) — On-demand RAF loop (0 CPU when idle)
// ---------------------------------------------------------------------------
const DRAW_TOOLS = new Set(["draw", "eraser", "highlight", "laser"]);
const LOUPE_D = 148;
const LOUPE_MAG_MIN = 1.5;
const LOUPE_MAG_MAX = 6;
const LOUPE_MAG_DEFAULT = 2.5;

interface LoupeState {
  active: boolean;
  lx: number;
  ly: number;
  mag: number;
  wake?: () => void;
}

function loadLoupeMag(): number {
  try {
    const v = parseFloat(localStorage.getItem("loupe-mag") || "");
    if (!Number.isNaN(v))
      return Math.min(LOUPE_MAG_MAX, Math.max(LOUPE_MAG_MIN, v));
  } catch (_) {}
  return LOUPE_MAG_DEFAULT;
}

function Loupe({ stateRef }: { stateRef: React.MutableRefObject<LoupeState> }) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let raf: number | null = null;
    let mounted = true;
    let currentSide: "left" | "right" = "left";
    let lastCloneTime = 0;
    let cachedClone: HTMLElement | null = null;
    let cachedRect: DOMRect | null = null;

    const runLoop = (now: number) => {
      if (!mounted) return;
      const st = stateRef.current;
      const outer = outerRef.current;
      const host = hostRef.current;

      if (!outer || !host) {
        raf = null;
        return;
      }

      if (!st.active) {
        outer.style.display = "none";
        host.replaceChildren();
        cachedClone = null;
        raf = null;
        return;
      }

      outer.style.display = "block";

      // Procreate-style finger avoidance
      const padding = 16;
      const loupeRadius = LOUPE_D / 2;
      const leftCenter = padding + loupeRadius;
      const rightCenter = window.innerWidth - padding - loupeRadius;
      const topCenter = padding + loupeRadius;

      const distToLeft = Math.hypot(st.lx - leftCenter, st.ly - topCenter);
      const distToRight = Math.hypot(st.lx - rightCenter, st.ly - topCenter);
      const threshold = 160;

      if (currentSide === "left" && distToLeft < threshold) {
        currentSide = "right";
      } else if (currentSide === "right" && distToRight < threshold) {
        currentSide = "left";
      }

      outer.className =
        currentSide === "left" ? "loupe-pos-left" : "loupe-pos-right";

      // Refresh DOM clone at ~30fps (every 32ms) while translating at 60fps
      if (!cachedClone || now - lastCloneTime >= 32) {
        const canvasEl = document.querySelector(
          ".tl-canvas"
        ) as HTMLElement | null;
        if (canvasEl) {
          cachedRect = canvasEl.getBoundingClientRect();
          const clone = canvasEl.cloneNode(true) as HTMLElement;
          clone.style.cssText = "";
          clone.style.position = "absolute";
          clone.style.left = "0";
          clone.style.top = "0";
          clone.style.width = `${cachedRect.width}px`;
          clone.style.height = `${cachedRect.height}px`;
          clone.style.transformOrigin = "0 0";
          clone.style.pointerEvents = "none";
          host.replaceChildren(clone);
          cachedClone = clone;
          lastCloneTime = now;
        }
      }

      if (cachedClone && cachedRect) {
        const cx = LOUPE_D / 2;
        const cy = LOUPE_D / 2;
        const fx = st.lx - cachedRect.left;
        const fy = st.ly - cachedRect.top;
        const tx = cx - fx * st.mag;
        const ty = cy - fy * st.mag;
        cachedClone.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${st.mag})`;
      }

      raf = requestAnimationFrame(runLoop);
    };

    stateRef.current.wake = () => {
      if (raf === null && mounted) {
        raf = requestAnimationFrame(runLoop);
      }
    };

    return () => {
      mounted = false;
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [stateRef]);

  return (
    <div
      ref={outerRef}
      style={{
        display: "none",
        position: "fixed",
        width: LOUPE_D,
        height: LOUPE_D,
        borderRadius: "50%",
        border: "4px solid #b8860b",
        boxShadow:
          "0 10px 28px rgba(0,0,0,0.7), 0 0 0 1px rgba(204,161,98,0.4), inset 0 2px 4px rgba(255,255,255,0.3)",
        zIndex: 9999,
        pointerEvents: "none",
        overflow: "hidden",
        backgroundColor: "#f4ebd0",
      }}
    >
      <div
        ref={hostRef}
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: "50%",
          border: "1.5px solid #ebdcb9",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 6,
          height: 6,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: "rgba(122,31,18,0.45)",
          pointerEvents: "none",
          zIndex: 12,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "45%",
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 11,
          borderRadius: "50% 50% 0 0",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WritingCanvas — main export
// ---------------------------------------------------------------------------
export default function WritingCanvas({
  onEditorReady,
  userZoom,
  setUserZoom,
  onActiveScribesChange,
  pendingStamp,
  onStampPlaced,
}: WritingCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [remoteCursors, setRemoteCursors] = React.useState<
    Record<string, RemoteCursor>
  >({});
  const loupeRef = React.useRef<LoupeState>({
    active: false,
    lx: 0,
    ly: 0,
    mag: LOUPE_MAG_DEFAULT,
  });

  React.useEffect(() => {
    loupeRef.current.mag = loadLoupeMag();
  }, []);

  const userZoomRef = React.useRef(userZoom);
  const setUserZoomRef = React.useRef(setUserZoom);
  const pendingStampRef = React.useRef(pendingStamp);
  const onStampPlacedRef = React.useRef(onStampPlaced);

  React.useEffect(() => {
    userZoomRef.current = userZoom;
    setUserZoomRef.current = setUserZoom;
  }, [userZoom, setUserZoom]);

  React.useEffect(() => {
    pendingStampRef.current = pendingStamp;
    onStampPlacedRef.current = onStampPlaced;
  }, [pendingStamp, onStampPlaced]);

  const handleEditorReady = (ed: Editor) => {
    setEditor(ed);
    try {
      ed.setCurrentTool("draw");
      ed.setStyleForNextShapes(DefaultColorStyle, "black");
      ed.setStyleForNextShapes(DefaultSizeStyle, "m");
      ed.setStyleForNextShapes(DefaultFontStyle, "serif");
      (ed as any).updateViewportScreenBounds?.();
    } catch (_) {}
    if (onEditorReady) onEditorReady(ed);
  };

  const handleCursorsUpdate = React.useCallback(
    (c: Record<string, RemoteCursor>) => setRemoteCursors(c),
    []
  );

  // Wheel → scroll parchment smoothly
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      const sheetWrap = document.getElementById("sheetWrap");
      if (sheetWrap) {
        const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
        sheetWrap.scrollBy(0, dy);
      }
      e.stopPropagation();
    };
    container.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: true,
    });
    return () =>
      container.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  // Desktop & Touch "Hand" (Grab/Scroll) tool, Spacebar/Middle-click pan + Pending Wax Stamp placement
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;

    let isHandDragging = false;
    let isSpaceHeld = false;
    let handStartY = 0;
    let handStartScrollTop = 0;
    let lastHandY = 0;
    let lastHandTime = 0;
    let handVelocity = 0;
    let inertiaFrame: number | null = null;

    const stopInertia = () => {
      if (inertiaFrame !== null) {
        cancelAnimationFrame(inertiaFrame);
        inertiaFrame = null;
      }
    };

    const runHandInertia = () => {
      const sw = document.getElementById("sheetWrap");
      if (!sw || Math.abs(handVelocity) < 0.03) {
        handVelocity = 0;
        inertiaFrame = null;
        return;
      }
      sw.scrollTop += handVelocity * 16;
      handVelocity *= 0.94;
      inertiaFrame = requestAnimationFrame(runHandInertia);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      isSpaceHeld = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceHeld = false;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // 1. If a Wax Stamp is pending placement, stamp it at this page coordinate!
      const stamp = pendingStampRef.current;
      if (stamp && (e.pointerType !== "mouse" || e.button === 0)) {
        e.stopPropagation();
        e.preventDefault();
        try {
          (editor as any).updateViewportScreenBounds?.();
          const pt = screenToPage(editor, e.clientX, e.clientY);
          const id = createShapeId();
          editor.run(() => {
            editor.createShape({
              id,
              type: "text",
              x: Math.max(24, Math.min(740, pt.x - 24)),
              y: Math.max(24, pt.y - 24),
              props: {
                text: stamp.symbol,
                color: stamp.color as any,
                size: "xl",
                font: "serif",
                autoSize: true,
              },
            } as any);
            editor.setCurrentTool("select");
            editor.select(id);
          });
        } catch (_) {}
        if (onStampPlacedRef.current) onStampPlacedRef.current();
        return;
      }

      // 2. If Hand tool is active, Spacebar is held, or Middle mouse button is pressed -> scroll #sheetWrap
      const currentTool = (() => {
        try {
          return editor.getCurrentToolId() ?? "draw";
        } catch {
          return "draw";
        }
      })();

      const isMiddleMouse = e.pointerType === "mouse" && e.button === 1;
      const isPrimaryClick = e.pointerType !== "mouse" || e.button === 0;

      if (
        isMiddleMouse ||
        ((currentTool === "hand" || isSpaceHeld) && isPrimaryClick)
      ) {
        stopInertia();
        const sw = document.getElementById("sheetWrap");
        if (!sw) return;
        isHandDragging = true;
        handStartY = e.clientY;
        lastHandY = e.clientY;
        lastHandTime = performance.now();
        handVelocity = 0;
        handStartScrollTop = sw.scrollTop;
        document.body.style.cursor = "grabbing";
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // 3. If draw tool is active and primary button is down, trigger quill scratching sound
      if (currentTool === "draw" && isPrimaryClick && !isSpaceHeld) {
        try {
          quillAudio.startStroke(e.clientX, e.clientY);
        } catch (_) {}
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isHandDragging) {
        const sw = document.getElementById("sheetWrap");
        if (!sw) return;
        const now = performance.now();
        const dt = now - lastHandTime;
        const deltaY = e.clientY - handStartY;
        sw.scrollTop = handStartScrollTop - deltaY;
        if (dt > 0) {
          handVelocity = -(e.clientY - lastHandY) / dt;
        }
        lastHandY = e.clientY;
        lastHandTime = now;
        e.stopPropagation();
        return;
      }

      // If user is actively drawing (e.buttons === 1 or touch dragging with draw tool)
      const currentTool = (() => {
        try {
          return editor.getCurrentToolId() ?? "draw";
        } catch {
          return "draw";
        }
      })();

      if (currentTool === "draw" && (e.buttons & 1 || e.pointerType === "touch")) {
        try {
          quillAudio.updateStroke(e.clientX, e.clientY);
        } catch (_) {}
      } else {
        try {
          quillAudio.endStroke();
        } catch (_) {}
      }
    };

    const onPointerUp = () => {
      quillAudio.endStroke();
      if (!isHandDragging) return;
      isHandDragging = false;
      document.body.style.cursor = "";
      if (Math.abs(handVelocity) > 0.06) {
        inertiaFrame = requestAnimationFrame(runHandInertia);
      }
    };

    container.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      stopInertia();
      quillAudio.endStroke();
      container.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [editor]);

  // Paste images
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        insertImageFileOntoScroll(editor, file);
      }
    };
    container.addEventListener("paste", handlePaste);
    return () => container.removeEventListener("paste", handlePaste);
  }, [editor]);

  // Touch gestures + Double-tap / Double-click quick note creation with active ink color
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editor) return;

    const getTool = () => {
      try {
        return editor?.getCurrentToolId?.() ?? "draw";
      } catch {
        return "draw";
      }
    };

    const placeQuickNoteAt = (clientX: number, clientY: number) => {
      try {
        (editor as any).updateViewportScreenBounds?.();
        const pagePoint = screenToPage(editor, clientX, clientY);
        const activeColor =
          editor.getSharedStyles().getAsKnownValue(DefaultColorStyle) ||
          "black";
        const activeSize =
          editor.getSharedStyles().getAsKnownValue(DefaultSizeStyle) || "m";
        const id = createShapeId();
        editor.run(() => {
          editor.createShape({
            id,
            type: "text",
            x: pagePoint.x,
            y: pagePoint.y,
            props: {
              text: "",
              color: activeColor,
              size: activeSize,
              font: "serif",
              autoSize: true,
            },
          } as any);
          editor.setCurrentTool("select");
          editor.select(id);
          editor.setEditingShape(id);
        });
      } catch (_) {}
    };

    let mode: "none" | "draw" | "scroll" | "pinch" = "none";
    let lastMidY = 0;
    let baseDist = 1;
    let baseMag = loupeRef.current.mag;
    let baseZoom = 1;

    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const setLoupeFromTouch = (t: Touch) => {
      const st = loupeRef.current;
      st.lx = t.clientX;
      st.ly = t.clientY;
      st.active = true;
      st.wake?.();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (pendingStampRef.current) return;

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const now = Date.now();
        const dx = t.clientX - lastTapX;
        const dy = t.clientY - lastTapY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (now - lastTapTime < 320 && dist < 30) {
          e.preventDefault();
          lastTapTime = 0;
          placeQuickNoteAt(t.clientX, t.clientY);
          mode = "none";
          loupeRef.current.active = false;
          return;
        }
        lastTapTime = now;
        lastTapX = t.clientX;
        lastTapY = t.clientY;

        if (DRAW_TOOLS.has(getTool())) {
          mode = "draw";
          setLoupeFromTouch(e.touches[0]);
        } else {
          mode = "none";
          loupeRef.current.active = false;
        }
      } else if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist =
          Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        if (mode === "draw") {
          mode = "pinch";
          baseDist = dist;
          baseMag = loupeRef.current.mag;
        } else {
          mode = "scroll";
          lastMidY = (a.clientY + b.clientY) / 2;
          baseDist = dist;
          baseZoom = userZoomRef.current;
          loupeRef.current.active = false;
        }
        try {
          editor?.cancel?.();
        } catch (_) {}
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (mode === "draw" && e.touches.length === 1) {
        setLoupeFromTouch(e.touches[0]);
        // Do NOT preventDefault() on single-touch drawing strokes!
        // Calling preventDefault on touchmove with capture: true cancels standard
        // PointerEvents on child elements, stopping Tldraw from receiving ink strokes.
      } else if (mode === "scroll" && e.touches.length >= 2) {
        const a = e.touches[0],
          b = e.touches[1];
        const midY = (a.clientY + b.clientY) / 2;
        const sw = document.getElementById("sheetWrap");
        if (sw) sw.scrollTop += lastMidY - midY;
        lastMidY = midY;

        const dist =
          Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        const ratio = dist / baseDist;
        const targetZoom = Math.min(2.5, Math.max(0.75, baseZoom * ratio));
        if (setUserZoomRef.current) {
          setUserZoomRef.current(targetZoom);
        }
        e.preventDefault();
      } else if (mode === "pinch" && e.touches.length >= 2) {
        const a = e.touches[0],
          b = e.touches[1];
        const dist =
          Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        const mag = Math.min(
          LOUPE_MAG_MAX,
          Math.max(LOUPE_MAG_MIN, baseMag * (dist / baseDist))
        );
        loupeRef.current.mag = mag;
        loupeRef.current.wake?.();
        try {
          localStorage.setItem("loupe-mag", String(mag));
        } catch (_) {}
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      mode = "none";
      loupeRef.current.active = false;
    };

    // Desktop: double-click anywhere on the parchment → place colored text note
    const onDblClick = (e: MouseEvent) => {
      const tool = getTool();
      if (tool !== "draw" && tool !== "select") return;
      placeQuickNoteAt(e.clientX, e.clientY);
    };

    container.addEventListener("touchstart", onTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", onTouchMove, {
      passive: true,
    });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });
    container.addEventListener("dblclick", onDblClick);
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      container.removeEventListener("dblclick", onDblClick);
    };
  }, [editor]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-auto touch-none select-none"
      style={{ zIndex: 10 }}
      onPointerDownCapture={() => {
        try {
          (editor as any)?.updateViewportScreenBounds?.();
          editor?.focus?.();
        } catch (_) {}
      }}
    >
      <Tldraw
        licenseKey={
          (import.meta as any).env.VITE_TLDRAW_LICENSE_KEY ||
          "tldraw-2026-07-16/WyJSbno4UEg5NyIsWyIqIl0sMTYsIjIwMjYtMDctMTYiXQ.LQDDOTuUGf1MoAbBi9VJ51zhvlQVtcKPlTex82YLal0mcUXaEtekcMIvYoFN1PWjgYKHwn2exAEh0CQf2EaOiQ"
        }
        autoFocus={false}
        hideUi={true}
      >
        <EditorRefSetter onEditorReady={handleEditorReady} />
        <CommunalSync
          onCursorsUpdate={handleCursorsUpdate}
          onActiveScribesChange={onActiveScribesChange}
        />
        <CameraLock userZoom={userZoom} />
        <ScrollBoundsUpdater />
        <InkSoakManager />
      </Tldraw>

      <InkSoakFilterDef />

      <GhostCursors
        cursors={remoteCursors}
        mySessionId={SESSION_ID}
        editor={editor}
      />

      <Loupe stateRef={loupeRef} />
    </div>
  );
}
