import React, { useState, useEffect, useRef, useCallback } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Editor } from "tldraw";
import ForestBackground from "./components/ForestBackground";
import WritingCanvas from "./components/WritingCanvas";
import MedievalToolbar from "./components/MedievalToolbar";
import WaxSealSvg from "./components/WaxSealSvg";
import CornerFlourishGenerator from "./components/CornerFlourishGenerator";

const SESSION_UNROLLED_KEY = "scriptorium_unrolled";

interface Mote {
  id: number;
  width: number;
  height: number;
  left: string;
  top: string;
  animationDuration: string;
  animationDelay: string;
}

interface Shard {
  id: number;
  clipPath: string;
  tx: string;
  ty: string;
  tz: string;
  rx: string;
  ry: string;
  rz: string;
  duration: string;
  delay: string;
}

interface Particle {
  id: number;
  tx: string;
  ty: string;
  tz: string;
  size: number;
  duration: string;
}

export default function App() {
  const initiallyUnrolled = (() => {
    try {
      return sessionStorage.getItem(SESSION_UNROLLED_KEY) === "1";
    } catch {
      return false;
    }
  })();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [isOpened, setIsOpened] = useState(initiallyUnrolled);
  const [isUnrolling, setIsUnrolling] = useState(false);
  const [isOpeningRig, setIsOpeningRig] = useState(initiallyUnrolled);
  const [sealVisible, setSealVisible] = useState(!initiallyUnrolled);
  const [sealCracked, setSealCracked] = useState(false);

  const [motes, setMotes] = useState<Mote[]>([]);
  const [shards, setShards] = useState<Shard[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [sheetMaxHeight, setSheetMaxHeight] = useState(
    initiallyUnrolled ? "82vh" : "0px"
  );
  const [dynamicSheetHeight, setDynamicSheetHeight] = useState(860);

  const [currentTool, setCurrentTool] = useState("draw");
  const [rigScale, setRigScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);

  const [shakeTop, setShakeTop] = useState(false);
  const [shakeBottom, setShakeBottom] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const topRollerRef = useRef<HTMLDivElement>(null);
  const bottomRollerRef = useRef<HTMLDivElement>(null);
  const sheetWrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  // Dragging states for rollers / pull-to-unroll
  const isDraggingRef = useRef(false);
  const isUnrollDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollYRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const inertiaFrameRef = useRef<number | null>(null);
  const unrollStartYRef = useRef(0);
  const currentUnrollHeightRef = useRef(0);

  const getTargetViewport = useCallback(() => {
    if (typeof window === "undefined") return 680;

    const vh = window.innerHeight;
    const deskLedgeHeight = 56;
    const rollerH = topRollerRef.current?.offsetHeight || 40;
    const usableRigHeight = Math.max(360, vh - deskLedgeHeight - 16);
    const usableSheetHeight = Math.max(300, usableRigHeight - rollerH * 2);

    return usableSheetHeight;
  }, []);

  const triggerThud = useCallback((type: "top" | "bottom" | "both") => {
    if (type === "top" || type === "both") {
      setShakeTop(true);
      setTimeout(() => setShakeTop(false), 500);
    }
    if (type === "bottom" || type === "both") {
      setShakeBottom(true);
      setTimeout(() => setShakeBottom(false), 500);
    }
  }, []);

  // Generate background dust motes on mount (lightweight count for zero lag)
  useEffect(() => {
    const list: Mote[] = [];
    for (let i = 0; i < 18; i++) {
      const s = 2 + Math.random() * 4;
      list.push({
        id: i,
        width: s,
        height: s,
        left: Math.random() * 100 + "vw",
        top: 60 + Math.random() * 50 + "vh",
        animationDuration: 16 + Math.random() * 18 + "s",
        animationDelay: -Math.random() * 20 + "s",
      });
    }
    setMotes(list);
  }, []);

  // Compute rigScale so scroll fills the screen right down to the 56px desk ledge
  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const rollerH =
        topRollerRef.current?.offsetHeight ||
        Math.min(Math.max(24, vw * 0.06), 52);
      const target = getTargetViewport();
      const totalH = target + rollerH * 2;
      const deskLedgeFootprint = 60;
      const usableHeight = vh - deskLedgeFootprint - 12;
      const scale = totalH > usableHeight ? usableHeight / totalH : 1;
      setRigScale(scale);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getTargetViewport]);

  // Notify tldraw of container bounds after expand/minimize settles
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      try {
        (editor as any)?.updateViewportScreenBounds?.();
      } catch (_) {}
    }, 460);
    return () => clearTimeout(timer);
  }, [isExpanded, editor]);

  // Toggle unrolled helper class on body
  useEffect(() => {
    if (isOpened) {
      document.body.classList.add("unrolled-state");
    } else {
      document.body.classList.remove("unrolled-state");
    }
    return () => {
      document.body.classList.remove("unrolled-state");
    };
  }, [isOpened]);

  // Sync active tool from the Tldraw editor
  useEffect(() => {
    if (!editor) return;
    const updateTool = () => {
      try {
        const toolId = editor.getCurrentToolId();
        if (toolId) {
          setCurrentTool(toolId);
        }
      } catch (_) {}
    };
    const unsubscribe = editor.store.listen(updateTool);
    updateTool();
    return () => unsubscribe();
  }, [editor]);

  // Dynamically grow parchment height as notes/drawings reach the bottom
  useEffect(() => {
    if (!editor) return;
    let timeoutId: any;

    const updateHeightFromShapes = () => {
      const shapes = editor.getCurrentPageShapes();
      let maxY = 0;
      const scale = (() => {
        try {
          return editor.getCamera().z || 1;
        } catch {
          return 1;
        }
      })();

      shapes.forEach((shape: any) => {
        if (shape.y !== undefined) {
          const h = shape.props?.h || shape.props?.height || shape.height || 60;
          const bottom = (shape.y + h) * scale;
          if (bottom > maxY) {
            maxY = bottom;
          }
        }
      });

      const targetViewport = getTargetViewport();
      const padding = 320;
      const calculatedHeight = Math.max(
        targetViewport,
        Math.min(maxY + padding, 5400)
      );
      setDynamicSheetHeight(calculatedHeight);
    };

    updateHeightFromShapes();

    const unsubscribe = editor.store.listen((entry: any) => {
      const changes = entry.changes;
      const hasShapeChange =
        Object.keys(changes?.added || {}).length > 0 ||
        Object.keys(changes?.removed || {}).length > 0 ||
        Object.keys(changes?.updated || {}).some((k) => k.startsWith("shape:"));
      if (!hasShapeChange) return;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateHeightFromShapes, 450);
    });

    window.addEventListener("resize", updateHeightFromShapes);
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
      window.removeEventListener("resize", updateHeightFromShapes);
    };
  }, [editor, getTargetViewport]);

  // Keep viewport max-height updated when opened
  useEffect(() => {
    if (!isOpened || isUnrolling) return;
    const handleResize = () => {
      const h = getTargetViewport();
      setSheetMaxHeight(`${h}px`);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpened, isUnrolling, getTargetViewport]);

  // Snappy V2 unroll animation (1.35s) + session memory
  const unroll = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_UNROLLED_KEY, "1");
    } catch (_) {}

    setIsOpened(true);
    setIsUnrolling(true);

    if (sheetWrapRef.current) {
      sheetWrapRef.current.style.maxHeight = "0px";
      sheetWrapRef.current.scrollTop = 0;
    }

    const finalHeight = getTargetViewport();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSheetMaxHeight(`${finalHeight}px`);
      });
    });

    const openTimeout = setTimeout(() => setIsOpeningRig(true), 350);

    const releaseTimeout = setTimeout(() => {
      setSheetMaxHeight(`${finalHeight}px`);
      setIsUnrolling(false);
      triggerThud("both");
      try {
        (editor as any)?.updateViewportScreenBounds?.();
        if (editor) {
          editor.setCurrentTool("draw");
        }
      } catch (_) {}
    }, 1350);

    return () => {
      clearTimeout(openTimeout);
      clearTimeout(releaseTimeout);
    };
  }, [getTargetViewport, triggerThud, editor]);

  // Shatter wax seal action
  const breakSeal = useCallback(() => {
    if (sealCracked) return;
    setSealCracked(true);

    setTimeout(() => {
      setSealVisible(false);

      const fragmentCount = 14;
      const shardList: Shard[] = [];
      for (let i = 0; i < fragmentCount; i++) {
        const angle1 = (i / fragmentCount) * Math.PI * 2;
        const angle2 = ((i + 1) / fragmentCount) * Math.PI * 2;

        const centerX = 50 + (Math.random() - 0.5) * 14;
        const centerY = 50 + (Math.random() - 0.5) * 14;

        const x1 = 50 + 50 * Math.cos(angle1);
        const y1 = 50 + 50 * Math.sin(angle1);
        const x2 = 50 + 50 * Math.cos(angle2);
        const y2 = 50 + 50 * Math.sin(angle2);

        const midAngle = (angle1 + angle2) / 2;
        const midRadius = 40 + Math.random() * 15;
        const xMid = 50 + midRadius * Math.cos(midAngle);
        const yMid = 50 + midRadius * Math.sin(midAngle);

        const clipPath = `polygon(${centerX}% ${centerY}%, ${x1}% ${y1}%, ${xMid}% ${yMid}%, ${x2}% ${y2}%)`;
        const trajAngle = midAngle + (Math.random() - 0.5) * 0.2;
        const force = 160 + Math.random() * 220;

        shardList.push({
          id: i,
          clipPath,
          tx: `${Math.cos(trajAngle) * force}px`,
          ty: `${Math.sin(trajAngle) * force + (100 + Math.random() * 140)}px`,
          tz: `${(Math.random() - 0.3) * 380}px`,
          rx: `${(Math.random() - 0.5) * 640}deg`,
          ry: `${(Math.random() - 0.5) * 640}deg`,
          rz: `${(Math.random() - 0.5) * 480}deg`,
          duration: `${0.65 + Math.random() * 0.35}s`,
          delay: `${Math.random() * 0.04}s`,
        });
      }
      setShards(shardList);

      const particleCount = 16;
      const particleList: Particle[] = [];
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const force = 90 + Math.random() * 180;
        particleList.push({
          id: i,
          tx: `${Math.cos(angle) * force}px`,
          ty: `${Math.sin(angle) * force + (120 + Math.random() * 120)}px`,
          tz: `${(Math.random() - 0.5) * 240}px`,
          size: 3 + Math.random() * 4,
          duration: `${0.45 + Math.random() * 0.35}s`,
        });
      }
      setParticles(particleList);
    }, 220);

    setTimeout(() => {
      unroll();
    }, 520);
  }, [sealCracked, unroll]);

  // Pull-to-Unroll gesture when closed
  useEffect(() => {
    if (isOpened) return;

    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest("#sealScene") ||
        target.closest("button") ||
        target.closest("a")
      )
        return;

      isUnrollDraggingRef.current = true;
      unrollStartYRef.current = e.clientY;
      currentUnrollHeightRef.current = 0;

      if (sheetWrapRef.current) {
        sheetWrapRef.current.style.transition = "none";
      }

      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    };

    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () =>
      window.removeEventListener("pointerdown", handleGlobalPointerDown);
  }, [isOpened]);

  // Wooden roller drag to scroll
  const onRollerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isOpened) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;

    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    startScrollYRef.current = sheetWrapRef.current
      ? sheetWrapRef.current.scrollTop
      : 0;

    if (inertiaFrameRef.current) {
      cancelAnimationFrame(inertiaFrameRef.current);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  useEffect(() => {
    let movePendingFrame: number | null = null;
    let latestPointerEvent: PointerEvent | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current && !isUnrollDraggingRef.current) return;
      latestPointerEvent = e;
      if (movePendingFrame !== null) return;

      movePendingFrame = requestAnimationFrame(() => {
        movePendingFrame = null;
        if (!latestPointerEvent) return;

        const ev = latestPointerEvent;
        if (isDraggingRef.current) {
          const currentY = ev.clientY;
          const now = performance.now();
          const dt = now - lastTimeRef.current;

          const deltaY = currentY - startYRef.current;
          if (sheetWrapRef.current) {
            sheetWrapRef.current.scrollTop = startScrollYRef.current - deltaY;
          }

          if (dt > 0) {
            velocityRef.current = -(currentY - lastYRef.current) / dt;
          }

          lastYRef.current = currentY;
          lastTimeRef.current = now;
        } else if (isUnrollDraggingRef.current) {
          const deltaY = ev.clientY - unrollStartYRef.current;
          if (deltaY > 0) {
            const resistance = 0.55;
            const pulledHeight = Math.min(deltaY * resistance, 150);
            currentUnrollHeightRef.current = pulledHeight;
            setSheetMaxHeight(`${pulledHeight}px`);

            const sealSceneEl = document.getElementById("sealScene");
            if (sealSceneEl) {
              sealSceneEl.style.transform = `translateY(${pulledHeight * 0.4}px)`;
            }
          } else {
            setSheetMaxHeight("0px");
          }
        }
      });
    };

    const animateInertia = () => {
      if (Math.abs(velocityRef.current) < 0.02) {
        velocityRef.current = 0;
        triggerThud("both");
        return;
      }
      if (sheetWrapRef.current) {
        sheetWrapRef.current.scrollTop += velocityRef.current * 16.6;
      }
      velocityRef.current *= 0.95;
      inertiaFrameRef.current = requestAnimationFrame(animateInertia);
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (Math.abs(velocityRef.current) > 0.05) {
          animateInertia();
        } else {
          triggerThud("both");
        }
      } else if (isUnrollDraggingRef.current) {
        isUnrollDraggingRef.current = false;
        if (sheetWrapRef.current) {
          sheetWrapRef.current.style.transition =
            "max-height 1.35s cubic-bezier(0.22, 1, 0.36, 1)";
        }
        document.body.style.userSelect = "";
        document.body.style.cursor = "";

        const sealSceneEl = document.getElementById("sealScene");
        if (sealSceneEl) {
          sealSceneEl.style.transform = "";
        }

        if (currentUnrollHeightRef.current >= 55) {
          if (sealSceneEl) {
            breakSeal();
          } else {
            unroll();
          }
        } else {
          setSheetMaxHeight("0px");
          setTimeout(() => triggerThud("both"), 300);
        }
        currentUnrollHeightRef.current = 0;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (inertiaFrameRef.current)
        cancelAnimationFrame(inertiaFrameRef.current);
      if (movePendingFrame !== null) cancelAnimationFrame(movePendingFrame);
    };
  }, [isOpened, sealCracked, breakSeal, unroll, triggerThud]);

  // Window-level wheel capture for scrolling the parchment
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isOpened && !isUnrolling && sheetWrapRef.current) {
        let deltaY = e.deltaY;
        if (e.deltaMode === 1) deltaY *= 24;
        else if (e.deltaMode === 2) deltaY *= window.innerHeight;
        sheetWrapRef.current.scrollTop += deltaY;
      }
    };
    window.addEventListener("wheel", handleWheel, {
      passive: true,
      capture: true,
    });
    return () => window.removeEventListener("wheel", handleWheel, true);
  }, [isOpened, isUnrolling]);

  // GPU-composited candlelight spotlight tracking (zero DOM repaint/blend thrash)
  useEffect(() => {
    if (!isOpened) return;
    let pendingFrame: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (pendingFrame !== null) return;

      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        if (spotlightRef.current) {
          spotlightRef.current.style.setProperty("--candle-px", `${lastX}px`);
          spotlightRef.current.style.setProperty("--candle-py", `${lastY}px`);
        }
      });
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    };
  }, [isOpened]);

  return (
    <div
      className={`min-h-full selection:bg-[#7a1f12] selection:text-[#f2e2b8] ${
        !isOpened ? "touch-none" : ""
      }`}
    >
      {/* Forest Parallax Background */}
      <ForestBackground />

      {/* GPU-composited candlelight spotlight */}
      {isOpened && <div ref={spotlightRef} className="candle-spotlight" />}

      {/* Ambient dark vignette backdrop overlay when expanding canvas */}
      <div
        className={`fixed inset-0 z-30 bg-[#0e0804]/70 backdrop-blur-[2px] transition-opacity duration-400 ease-out pointer-events-none ${
          isExpanded ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Background dust particles */}
      <div className="dust" id="dust">
        {motes.map((mote) => (
          <div
            key={mote.id}
            className="mote"
            style={{
              width: `${mote.width}px`,
              height: `${mote.height}px`,
              left: mote.left,
              top: mote.top,
              animationDuration: mote.animationDuration,
              animationDelay: mote.animationDelay,
            }}
          />
        ))}
      </div>

      {/* ======= WAX SEAL INTRO ======= */}
      {sealVisible && !isOpened && !isOpeningRig && (
        <div
          id="sealScene"
          style={{
            opacity: sealCracked ? 0 : 1,
            pointerEvents: sealCracked ? "none" : "auto",
          }}
        >
          <div
            id="seal"
            className={`clickable-seal ${sealCracked ? "seal-crack" : ""}`}
            title="Break the wax seal to unroll the scroll"
            onClick={breakSeal}
          >
            <WaxSealSvg size={210} />
          </div>
          <p className="cinzel text-[#ebdcb9]/85 text-sm tracking-[0.16em] select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            Tap the Wax Seal to Unroll
          </p>
        </div>
      )}

      {/* Shatter fragments in 3D perspective during fracture animation */}
      {!sealVisible && shards.length > 0 && (
        <div
          id="shatterContainer"
          style={{
            position: "fixed",
            width: "210px",
            height: "210px",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            perspective: "1200px",
            transformStyle: "preserve-3d",
            pointerEvents: "none",
            zIndex: 60,
          }}
        >
          {shards.map((shard) => (
            <div
              key={shard.id}
              className="shard"
              style={{
                clipPath: shard.clipPath,
                animation: `fragmentShatter ${shard.duration} cubic-bezier(0.15, 0.85, 0.3, 1) ${shard.delay} forwards`,
                WebkitClipPath: shard.clipPath,
                ["--tx" as any]: shard.tx,
                ["--ty" as any]: shard.ty,
                ["--tz" as any]: shard.tz,
                ["--rx" as any]: shard.rx,
                ["--ry" as any]: shard.ry,
                ["--rz" as any]: shard.rz,
              }}
            >
              <WaxSealSvg size={210} />
            </div>
          ))}

          {particles.map((p) => (
            <div
              key={p.id}
              className="wax-particle"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                animation: `particleShatter ${p.duration} cubic-bezier(0.1, 0.8, 0.25, 1) forwards`,
                ["--tx" as any]: p.tx,
                ["--ty" as any]: p.ty,
                ["--tz" as any]: p.tz,
              }}
            />
          ))}
        </div>
      )}

      {/* ======= THE SCROLL ======= */}
      <div
        id="rig"
        className={`tool-${currentTool} ${
          isOpened ? "opacity-100" : "opacity-0"
        } ${isOpeningRig ? "open" : ""} ${
          isUnrolling ? "will-change-transform" : ""
        } ${isExpanded ? "canvas-expanded" : ""}`}
        style={{
          transform: isExpanded
            ? "none"
            : `translate(-50%, calc(-50% - ${
                isOpened ? "28px" : "0px"
              })) scale(${rigScale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Top Roller */}
        <div
          ref={topRollerRef}
          className={`roller ${shakeTop ? "shake-top" : ""}`}
          id="topRoller"
          onPointerDown={onRollerPointerDown}
          onDragStart={(e) => e.preventDefault()}
        >
          <div className="handle left">
            <div className="knob"></div>
            <div className="neck"></div>
            <div className="collar"></div>
            <div className="guard"></div>
          </div>
          <div className="handle right">
            <div className="knob"></div>
            <div className="neck"></div>
            <div className="collar"></div>
            <div className="guard"></div>
          </div>
        </div>

        {/* Parchment Sheet */}
        <div id="sheetContainer" className="pointer-events-auto">
          <div className="curl-top pointer-events-none" style={{ zIndex: 20, pointerEvents: "none" }}></div>
          <div className="curl-bottom pointer-events-none" style={{ zIndex: 20, pointerEvents: "none" }}></div>

          <div
            ref={sheetWrapRef}
            id="sheetWrap"
            className={`pointer-events-auto ${isUnrolling ? "is-unrolling" : ""}`}
            style={{ maxHeight: isExpanded ? "calc(100dvh - 56px)" : sheetMaxHeight, pointerEvents: "auto" }}
          >
            <div
              id="sheet"
              className={`relative tool-${currentTool} pointer-events-auto`}
              style={{ minHeight: `${dynamicSheetHeight}px`, pointerEvents: "auto" }}
              onDragStart={(e) => e.preventDefault()}
            >
              {/* Layered Parchment Background with Organic Discoloration & Vellum Noise */}
              <div
                className="absolute inset-0 pointer-events-none parchment-bg-container"
                style={{ zIndex: -1, pointerEvents: "none" }}
              >
                <div className="absolute inset-0 parchment-tex torn pointer-events-none" />
                <div className="absolute inset-0 parchment-discoloration torn pointer-events-none" />
                <div className="absolute inset-0 parchment-noise torn pointer-events-none" />
                <div className="absolute inset-0 parchment-canvas-patina torn pointer-events-none" />
                <div className="absolute inset-0 edge-burn torn pointer-events-none" />
              </div>

              <div
                id="content"
                ref={contentRef}
                className="relative flex flex-col justify-between pointer-events-none select-none"
                style={{ minHeight: `${dynamicSheetHeight}px`, zIndex: 1, pointerEvents: "none" }}
              >
                {/* Automated Medieval Header & Corner Flourishes — rendered only when fully unrolled */}
                <CornerFlourishGenerator
                  isFullyUnrolled={isOpened && !isUnrolling}
                  year={new Date().getFullYear()}
                />

                <div className="flex-1 w-full pointer-events-none" />
              </div>

              {/* Writing Canvas — covers the entire parchment and clips to the tattered edge */}
              <div className="absolute inset-0 z-10 pointer-events-auto touch-none select-none overflow-hidden torn">
                <WritingCanvas
                  onEditorReady={setEditor}
                  userZoom={userZoom}
                  setUserZoom={setUserZoom}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Roller */}
        <div
          ref={bottomRollerRef}
          className={`roller ${shakeBottom ? "shake-bottom" : ""}`}
          id="bottomRoller"
          onPointerDown={onRollerPointerDown}
          onDragStart={(e) => e.preventDefault()}
        >
          <div className="handle left">
            <div className="knob"></div>
            <div className="neck"></div>
            <div className="collar"></div>
            <div className="guard"></div>
          </div>

          <div className="handle right">
            <div className="knob"></div>
            <div className="neck"></div>
            <div className="collar"></div>
            <div className="guard"></div>
          </div>
        </div>
      </div>

      {editor && isOpened && (
        <MedievalToolbar
          editor={editor}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
        />
      )}

      <Analytics debug={false} />
    </div>
  );
}
