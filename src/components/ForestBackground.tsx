import React, { useEffect, useRef } from "react";

export default function ForestBackground() {
  const oneRef = useRef<HTMLDivElement>(null);
  const twoRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const fourRef = useRef<HTMLDivElement>(null);
  const fiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let targetScrollY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    let currentScrollY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    let isAnimating = false;
    let frameId: number | null = null;

    const updateParallax = () => {
      const ease = 0.18;

      currentScrollY += (targetScrollY - currentScrollY) * ease;
      currentMouseX += (targetMouseX - currentMouseX) * ease;
      currentMouseY += (targetMouseY - currentMouseY) * ease;

      const diffScroll = Math.abs(targetScrollY - currentScrollY);
      const diffX = Math.abs(targetMouseX - currentMouseX);
      const diffY = Math.abs(targetMouseY - currentMouseY);

      if (diffScroll < 0.08 && diffX < 0.001 && diffY < 0.001) {
        currentScrollY = targetScrollY;
        currentMouseX = targetMouseX;
        currentMouseY = targetMouseY;
        isAnimating = false;
      }

      const dampedScroll = Math.min(currentScrollY * 0.12, 100);

      const t1 = `translate3d(${(currentMouseX * 5).toFixed(1)}px, ${(-dampedScroll * 0.1 + currentMouseY * 5).toFixed(1)}px, 0)`;
      const t2 = `translate3d(${(currentMouseX * 10).toFixed(1)}px, ${(-dampedScroll * 0.22 + currentMouseY * 10).toFixed(1)}px, 0)`;
      const t3 = `translate3d(${(currentMouseX * 7).toFixed(1)}px, ${(-dampedScroll * 0.35 + currentMouseY * 7).toFixed(1)}px, 0)`;
      const t4 = `translate3d(${(-currentMouseX * 14).toFixed(1)}px, ${(-dampedScroll * 0.48 + currentMouseY * 14).toFixed(1)}px, 0)`;
      const t5 = `translate3d(${(currentMouseX * 20).toFixed(1)}px, ${(-dampedScroll * 0.6 - currentMouseY * 20).toFixed(1)}px, 0)`;

      if (oneRef.current) oneRef.current.style.transform = t1;
      if (twoRef.current) twoRef.current.style.transform = t2;
      if (threeRef.current) threeRef.current.style.transform = t3;
      if (fourRef.current) fourRef.current.style.transform = t4;
      if (fiveRef.current) fiveRef.current.style.transform = t5;

      if (isAnimating) {
        frameId = requestAnimationFrame(updateParallax);
      } else {
        frameId = null;
      }
    };

    const triggerAnimation = () => {
      if (!isAnimating) {
        isAnimating = true;
        if (frameId === null) {
          frameId = requestAnimationFrame(updateParallax);
        }
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.id === "sheetWrap") {
        targetScrollY = target.scrollTop;
      } else {
        targetScrollY = window.scrollY;
      }
      triggerAnimation();
    };

    let lastMouseTime = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMouseTime < 32) return;
      lastMouseTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      targetMouseX = (e.clientX - w / 2) / (w / 2);
      targetMouseY = (e.clientY - h / 2) / (h / 2);
      triggerAnimation();
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    updateParallax();

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("mousemove", handleMouseMove);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <div className="forest-container">
      <div className="forest-parallax">
        {/* Layer 5 (Deep Twilight Sky & Distant Canopy) */}
        <div
          ref={fiveRef}
          className="forest-layer"
          style={{
            backgroundImage: `url("https://tornis.robbowen.digital/img/tree_base.jpg"), radial-gradient(ellipse at 50% 25%, #16241d 0%, #09120e 55%, #040806 100%)`,
            zIndex: 0,
          }}
        />
        {/* Layer 4 (Mid Pine Silhouettes) */}
        <div
          ref={fourRef}
          className="forest-layer"
          style={{
            backgroundImage: `url("https://tornis.robbowen.digital/img/tree_mid.png")`,
            zIndex: 1,
          }}
        />
        {/* Layer 3 (Middle Atmospheric Mist) */}
        <div ref={threeRef} className="forest-layer" style={{ zIndex: 2 }}>
          <div
            className="mist-sway animate-mist-slow"
            style={{
              backgroundImage: `url("https://tornis.robbowen.digital/img/mist.png"), radial-gradient(ellipse at 50% 70%, rgba(190, 210, 195, 0.06) 0%, transparent 65%)`,
            }}
          />
        </div>
        {/* Layer 2 (Foreground Ancient Trees) */}
        <div
          ref={twoRef}
          className="forest-layer"
          style={{
            backgroundImage: `url("https://tornis.robbowen.digital/img/tree_top.png")`,
            zIndex: 3,
          }}
        />
        {/* Layer 1 (Front Low Mist) */}
        <div ref={oneRef} className="forest-layer" style={{ zIndex: 4 }}>
          <div
            className="mist-sway animate-mist-fast"
            style={{
              backgroundImage: `url("https://tornis.robbowen.digital/img/mist.png"), radial-gradient(ellipse at 50% 85%, rgba(215, 195, 160, 0.05) 0%, transparent 60%)`,
            }}
          />
        </div>
      </div>
      <div className="forest-vignette" />
    </div>
  );
}
