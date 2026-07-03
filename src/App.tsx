import React, { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import ForestBackground from "./components/ForestBackground";
import WritingCanvas from "./components/WritingCanvas";
import MedievalToolbar from "./components/MedievalToolbar";

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
  const [editor, setEditor] = useState<any>(null);
  const [isOpened, setIsOpened] = useState(false);
  const [isUnrolling, setIsUnrolling] = useState(false);
  const [isOpeningRig, setIsOpeningRig] = useState(false);
  const [sealVisible, setSealVisible] = useState(false);
  const [sealCracked, setSealCracked] = useState(false);

  const [motes, setMotes] = useState<Mote[]>([]);
  const [shards, setShards] = useState<Shard[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [sheetMaxHeight, setSheetMaxHeight] = useState("0px");
  const [dynamicSheetHeight, setDynamicSheetHeight] = useState(720);
  const [showScrollPrompt, setShowScrollPrompt] = useState(false);
  const [currentTool, setCurrentTool] = useState("draw");
  const [rigScale, setRigScale] = useState(1);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);

  const [shakeTop, setShakeTop] = useState(false);
  const [shakeBottom, setShakeBottom] = useState(false);

  const getTargetViewport = () => {
    if (typeof window === "undefined") return 720;
    return Math.max(300, Math.min(window.innerHeight * 0.6, 1100));
  };

  const triggerThud = (type: "top" | "bottom" | "both") => {
    if (type === "top" || type === "both") {
      setShakeTop(true);
      setTimeout(() => setShakeTop(false), 600);
    }
    if (type === "bottom" || type === "both") {
      setShakeBottom(true);
      setTimeout(() => setShakeBottom(false), 600);
    }
  };

  const topRollerRef = useRef<HTMLDivElement>(null);
  const bottomRollerRef = useRef<HTMLDivElement>(null);
  const sheetWrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Dragging states
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

  // Generate background dust motes on mount
  useEffect(() => {
    const list: Mote[] = [];
    for (let i = 0; i < 26; i++) {
      const s = 2 + Math.random() * 5;
      list.push({
        id: i,
        width: s,
        height: s,
        left: Math.random() * 100 + "vw",
        top: 60 + Math.random() * 50 + "vh",
        animationDuration: 14 + Math.random() * 20 + "s",
        animationDelay: -Math.random() * 20 + "s",
      });
    }
    setMotes(list);
  }, []);

  // Synchronous and responsive scale tracking so the scroll has exactly the same size on all screens
  useEffect(() => {
    const handleResize = () => {
      const designWidth = 850;
      const width = window.innerWidth;
      // Provide a small margin for standard screen padding
      const padding = width < 480 ? 16 : 32;
      const scale = Math.min(1, (width - padding) / designWidth);
      setRigScale(scale);
    };

    handleResize(); // run immediately
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update roller background scroll offset for dynamic rotation
  useEffect(() => {
    let active = true;
    function updateRollers() {
      if (!active) return;
      if (topRollerRef.current && bottomRollerRef.current && sheetWrapRef.current) {
        const currentHeight = sheetWrapRef.current.getBoundingClientRect().height;
        const currentScroll = sheetWrapRef.current.scrollTop;

        // Top roller rotates clockwise, bottom roller rotates counter-clockwise as they unroll.
        // They both rotate clockwise as we scroll down.
        const topOffset = currentHeight * 0.45 + currentScroll * 0.6;
        const bottomOffset = -currentHeight * 0.45 + currentScroll * 0.6;

        topRollerRef.current.style.setProperty("--roller-scroll", `${topOffset}px`);
        bottomRollerRef.current.style.setProperty("--roller-scroll", `${bottomOffset}px`);
      }
      requestAnimationFrame(updateRollers);
    }
    requestAnimationFrame(updateRollers);
    return () => {
      active = false;
    };
  }, []);

  // Toggle cursor helper class on body
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
      } catch (e) {
        // Fallback
      }
    };

    const unsubscribe = editor.store.listen(updateTool);
    updateTool(); // sync initial
    return () => {
      unsubscribe();
    };
  }, [editor]);

  // Automatically unroll the scroll on load
  useEffect(() => {
    const timer = setTimeout(() => {
      unroll();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Automatically adjust sheet height based on drawn shapes and window resize
  useEffect(() => {
    if (!editor) return;

    let timeoutId: any;

    const updateHeightFromShapes = () => {
      const shapes = editor.getCurrentPageShapes();
      let maxY = 0;
      shapes.forEach((shape: any) => {
        if (shape.y !== undefined) {
          const h = shape.props?.h || shape.props?.height || shape.height || 0;
          const bottom = shape.y + h;
          if (bottom > maxY) {
            maxY = bottom;
          }
        }
      });

      const targetViewport = getTargetViewport();
      // Maintain a dynamic minimum height matching the scroll viewport, expanding as needed up to 5400px
      const padding = 450;
      const calculatedHeight = Math.max(targetViewport, Math.min(maxY + padding, 5400));
      setDynamicSheetHeight(calculatedHeight);
    };

    updateHeightFromShapes();

    const unsubscribe = editor.store.listen(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateHeightFromShapes();
      }, 800); // 800ms debounce prevents resizing layout reflows during drawing stroke
    });

    const handleResizeUpdate = () => {
      updateHeightFromShapes();
    };
    window.addEventListener("resize", handleResizeUpdate);

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
      window.removeEventListener("resize", handleResizeUpdate);
    };
  }, [editor]);

  // Keep the viewport max-height updated during window resizes
  useEffect(() => {
    if (!isOpened || isUnrolling) return;

    const handleResize = () => {
      setSheetMaxHeight(`${getTargetViewport()}px`);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpened, isUnrolling]);

  // Unrolling logic
  const unroll = () => {
    setIsOpened(true);
    setIsUnrolling(true);

    if (sheetWrapRef.current) {
      sheetWrapRef.current.style.maxHeight = "0px";
      sheetWrapRef.current.scrollTop = 0;
    }

    const target = getTargetViewport();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSheetMaxHeight(`${target}px`);
      });
    });

    // reveal text partway through the unroll
    const openTimeout = setTimeout(() => setIsOpeningRig(true), 1400);

    // after animation, lock max-height to our target height to enable internal scrolling
    const releaseTimeout = setTimeout(() => {
      setSheetMaxHeight(`${target}px`);
      setIsUnrolling(false);
      setShowScrollPrompt(true);
      triggerThud("both");
    }, 3600);

    return () => {
      clearTimeout(openTimeout);
      clearTimeout(releaseTimeout);
    };
  };

  // Shatter / break wax seal action
  const breakSeal = () => {
    if (sealCracked) return;
    setSealCracked(true);

    setTimeout(() => {
      // Hide the original seal
      setSealVisible(false);

      // Generate shatter fragments
      const fragmentCount = 18;
      const shardList: Shard[] = [];
      for (let i = 0; i < fragmentCount; i++) {
        const angle1 = (i / fragmentCount) * Math.PI * 2;
        const angle2 = ((i + 1) / fragmentCount) * Math.PI * 2;

        const centerX = 50 + (Math.random() - 0.5) * 16;
        const centerY = 50 + (Math.random() - 0.5) * 16;

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
        const force = 180 + Math.random() * 260;

        const tx = `${Math.cos(trajAngle) * force}px`;
        const ty = `${Math.sin(trajAngle) * force + (120 + Math.random() * 180)}px`;
        const tz = `${(Math.random() - 0.3) * 450}px`;

        const rx = `${(Math.random() - 0.5) * 720}deg`;
        const ry = `${(Math.random() - 0.5) * 720}deg`;
        const rz = `${(Math.random() - 0.5) * 540}deg`;

        const duration = `${0.8 + Math.random() * 0.5}s`;
        const delay = `${Math.random() * 0.05}s`;

        shardList.push({
          id: i,
          clipPath,
          tx,
          ty,
          tz,
          rx,
          ry,
          rz,
          duration,
          delay,
        });
      }
      setShards(shardList);

      // Generate tiny wax particles
      const particleCount = 24;
      const particleList: Particle[] = [];
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const force = 100 + Math.random() * 220;
        const tx = `${Math.cos(angle) * force}px`;
        const ty = `${Math.sin(angle) * force + (150 + Math.random() * 150)}px`;
        const tz = `${(Math.random() - 0.5) * 300}px`;

        const size = 3 + Math.random() * 5;
        const duration = `${0.5 + Math.random() * 0.5}s`;

        particleList.push({
          id: i,
          tx,
          ty,
          tz,
          size,
          duration,
        });
      }
      setParticles(particleList);
    }, 280);

    setTimeout(() => {
      unroll();
    }, 850);
  };

  // Scroll back up and close/roll the scroll
  const reroll = () => {
    if (sheetWrapRef.current) {
      sheetWrapRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    setIsOpeningRig(false);
    setShowScrollPrompt(false);

    // Briefly wait for scroll back to top before collapsing
    setTimeout(() => {
      setSheetMaxHeight("0px");
    }, 300);

    setTimeout(() => {
      setIsOpened(false);
      setSealVisible(true);
      setSealCracked(false);
      setShards([]);
      setParticles([]);
      triggerThud("both");
    }, 3900);
  };

  // Roller physical dragging events (Pointer Down)
  const onRollerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on left-click for mouse
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Ignore if clicking interactive items inside rollers
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;

    if (!isOpened) {
      // ---- Closed State: Pull down to Unroll ----
      isUnrollDraggingRef.current = true;
      unrollStartYRef.current = e.clientY;
      currentUnrollHeightRef.current = 0;

      if (sheetWrapRef.current) {
        sheetWrapRef.current.style.transition = "none";
      }

      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      document.body.style.cursor = "grabbing";
    } else {
      // ---- Opened State: Drag to Scroll ----
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      lastYRef.current = e.clientY;
      lastTimeRef.current = performance.now();
      velocityRef.current = 0;
      startScrollYRef.current = sheetWrapRef.current ? sheetWrapRef.current.scrollTop : 0;

      if (inertiaFrameRef.current) {
        cancelAnimationFrame(inertiaFrameRef.current);
      }

      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      document.body.style.cursor = "grabbing";
    }
  };

  // Scoped window-level pointer move, up and cancel event bindings
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        // ---- Scroll Dragging ----
        const currentY = e.clientY;
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
        // ---- Unroll Pulling ----
        const deltaY = e.clientY - unrollStartYRef.current;
        if (deltaY > 0) {
          currentUnrollHeightRef.current = Math.min(deltaY, 150);
          setSheetMaxHeight(`${currentUnrollHeightRef.current}px`);

          const sealSceneEl = document.getElementById("sealScene");
          if (sealSceneEl) {
            sealSceneEl.style.transform = `translateY(${currentUnrollHeightRef.current * 0.4}px)`;
          }
        } else {
          setSheetMaxHeight("0px");
        }
      }
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
      velocityRef.current *= 0.95; // Apply physics friction
      inertiaFrameRef.current = requestAnimationFrame(animateInertia);
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        if (Math.abs(velocityRef.current) > 0.05) {
          animateInertia();
        } else {
          triggerThud("both");
        }
      } else if (isUnrollDraggingRef.current) {
        isUnrollDraggingRef.current = false;

        if (sheetWrapRef.current) {
          sheetWrapRef.current.style.transition = "max-height 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
        }

        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";
        document.body.style.cursor = "";

        const sealSceneEl = document.getElementById("sealScene");
        if (sealSceneEl) {
          sealSceneEl.style.transform = "";
        }

        if (currentUnrollHeightRef.current >= 60) {
          if (sheetWrapRef.current) {
            sheetWrapRef.current.style.transition = "max-height 3.4s cubic-bezier(.65,.02,.28,1)";
          }
          if (sealSceneEl) {
            breakSeal();
          } else {
            unroll();
          }
        } else {
          setSheetMaxHeight("0px");
          setTimeout(() => {
            triggerThud("both");
          }, 350);
        }
        currentUnrollHeightRef.current = 0;
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("mouseleave", handlePointerUp);
    window.addEventListener("blur", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("mouseleave", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
      if (inertiaFrameRef.current) {
        cancelAnimationFrame(inertiaFrameRef.current);
      }
    };
  }, [isOpened, sealCracked]);

  // Window-level wheel capture to scroll the parchment from anywhere
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isOpened && !isUnrolling && sheetWrapRef.current) {
        sheetWrapRef.current.scrollTop += e.deltaY;
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isOpened, isUnrolling]);

  // Window-level cursor tracking to compute candlelight position on the scroll
  useEffect(() => {
    if (!isOpened) return;

    const handlePointerMove = (e: PointerEvent) => {
      const sheet = document.getElementById("sheet");
      if (!sheet) return;
      const rect = sheet.getBoundingClientRect();
      
      // Calculate cursor position relative to the sheet in percentage
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      sheet.style.setProperty("--candle-x", `${x}%`);
      sheet.style.setProperty("--candle-y", `${y}%`);
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [isOpened]);

  return (
    <div className="min-h-full selection:bg-[#7a1f12] selection:text-[#f2e2b8]">
      {/* Forest Parallax Background */}
      <ForestBackground />

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
      {sealVisible && (
        <div
          id="sealScene"
          className="transition-opacity duration-700"
          style={{
            opacity: sealCracked ? 0 : 1,
            pointerEvents: sealCracked ? "none" : "auto",
          }}
        >
          <div
            id="seal"
            className={`clickable-seal ${sealCracked ? "seal-crack" : ""}`}
            title="Break the seal"
            onClick={breakSeal}
          >
            <span>E</span>
          </div>
        </div>
      )}

      {/* Shatter fragments in 3D perspective during fracture animation */}
      {!sealVisible && shards.length > 0 && (
        <div
          id="shatterContainer"
          style={{
            position: "fixed",
            width: "200px",
            height: "200px",
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
                // Pass target offsets to standard CSS custom variables for standard keyframes
                WebkitClipPath: shard.clipPath,
                ["--tx" as any]: shard.tx,
                ["--ty" as any]: shard.ty,
                ["--tz" as any]: shard.tz,
                ["--rx" as any]: shard.rx,
                ["--ry" as any]: shard.ry,
                ["--rz" as any]: shard.rz,
              }}
            >
              <span className="blackletter text-[56px] text-[#f3c9b0] select-none pointer-events-none">E</span>
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
        className={`transition-all duration-700 tool-${currentTool} ${
          isOpened ? "opacity-100" : "opacity-0"
        } ${isOpeningRig ? "open" : ""}`}
        style={{
          transform: `translate(-50%, -50%) scale(${rigScale})`,
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
        <div id="sheetContainer">
          {/* Stationary roller shadows */}
          <div className="curl-top" style={{ zIndex: 20 }}></div>
          <div className="curl-bottom" style={{ zIndex: 20 }}></div>

          {/* Subtle medieval scroll prompt */}
          {showScrollPrompt && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none animate-pulse">
              <span className="cinzel text-[10px] tracking-[0.25em] text-[#7a5a2e] uppercase opacity-75">
                Scroll to explore
              </span>
              <span className="text-[#7a1f12] text-xs">▼</span>
            </div>
          )}

          <div
            ref={sheetWrapRef}
            id="sheetWrap"
            style={{ maxHeight: sheetMaxHeight }}
            onScroll={(e) => {
              if (e.currentTarget.scrollTop > 10) {
                setShowScrollPrompt(false);
              }
            }}
          >
            <div
              id="sheet"
              className={`relative tool-${currentTool}`}
              style={{ minHeight: `${dynamicSheetHeight}px` }}
              onDragStart={(e) => e.preventDefault()}
            >
              {/* Beautiful visual tattered parchment background distorted by the SVG filter */}
              <div 
                className="absolute inset-0 pointer-events-none parchment-bg-container"
                style={{ zIndex: -1 }}
              >
                <div className="absolute inset-0 parchment-tex torn" />
                <div className="absolute inset-0 candle-glow torn" />
                <div className="absolute inset-0 candle-shadow torn" />
                <div className="absolute inset-0 edge-burn torn" />
              </div>

              <div 
                id="content" 
                ref={contentRef} 
                className="relative z-0 flex flex-col justify-between"
                style={{ minHeight: `${dynamicSheetHeight}px` }}
              >
                {/* Flex spacer to push the footer down to the very bottom of the sheet */}
                <div className="flex-1 w-full pointer-events-none" />

                {/* Signature / colophon */}
                <footer className="reveal mt-6 text-center pb-4 relative z-20 pointer-events-auto">
                  <div className="mt-2 flex justify-center">
                    <button
                      onClick={reroll}
                      className="group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8a1f14] rounded-full transition-transform active:scale-95 hover:scale-105 relative z-30"
                      aria-label="Roll the scroll again"
                    >
                      <img
                        src="/stamp.png"
                        alt="Wax Seal"
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)] transition-all group-hover:brightness-110"
                      />
                    </button>
                  </div>
                </footer>
              </div>

            {/* Interactive Writing Canvas covering the whole sheet, perfectly bounded within the parchment margins and between headers/footers */}
            <div 
              className="absolute top-[40px] bottom-[140px] z-10 pointer-events-auto touch-none select-none overflow-hidden"
              style={{
                left: "var(--sheet-padding-x)",
                right: "var(--sheet-padding-x)"
              }}
            >
              <WritingCanvas 
                onEditorReady={setEditor} 
                isMagnifierActive={isMagnifierActive}
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
          isMagnifierActive={isMagnifierActive}
          setIsMagnifierActive={setIsMagnifierActive}
        />
      )}

      {/* SVG filter for realistic tattered edges */}
      <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
        <defs>
          <filter id="medieval-tears">
            <feTurbulence 
              type="fractalNoise" 
              baseFrequency="0.035" 
              numOctaves="4" 
              result="noise" 
            />
            <feDisplacementMap 
              in="SourceGraphic" 
              in2="noise" 
              scale="15" 
              xChannelSelector="R" 
              yChannelSelector="G" 
            />
          </filter>
        </defs>
      </svg>
      <Analytics />
    </div>
  );
}
