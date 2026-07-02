import React, { useEffect, useRef } from "react";

export default function ForestBackground() {
  const oneRef = useRef<HTMLDivElement>(null);
  const twoRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<HTMLDivElement>(null);
  const fourRef = useRef<HTMLDivElement>(null);
  const fiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scrollY = 0;
    let mouseX = 0; // -1 to 1
    let mouseY = 0; // -1 to 1

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.id === "sheetWrap") {
        scrollY = target.scrollTop;
      } else {
        scrollY = window.scrollY;
      }
      updateParallax();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Normalize to [-1, 1]
      mouseX = (e.clientX - w / 2) / (w / 2);
      mouseY = (e.clientY - h / 2) / (h / 2);
      updateParallax();
    };

    const updateParallax = () => {
      // Limit background vertical movement to 120px so trees always stay in frame
      const dampedScroll = Math.min(scrollY * 0.15, 120);

      // Parallax ratios for depth layers
      // Layer 5 (furthest): scrolls 70% speed, mouse moves +25px
      // Layer 4 (mid): scrolls 55% speed, mouse moves -18px
      // Layer 3 (mid mist): scrolls 40% speed, mouse moves +8px
      // Layer 2 (top trees): scrolls 25% speed, mouse moves +12px
      // Layer 1 (front mist): scrolls 10% speed, mouse moves +5px
      const t1 = `translate(${mouseX * 5}px, ${-dampedScroll * 0.1 + mouseY * 5}px)`;
      const t2 = `translate(${mouseX * 12}px, ${-dampedScroll * 0.25 + mouseY * 12}px)`;
      const t3 = `translate(${mouseX * 8}px, ${-dampedScroll * 0.4 + mouseY * 8}px)`;
      const t4 = `translate(${-mouseX * 18}px, ${-dampedScroll * 0.55 + mouseY * 18}px)`;
      const t5 = `translate(${mouseX * 25}px, ${-dampedScroll * 0.7 + -mouseY * 25}px)`;

      if (oneRef.current) oneRef.current.style.transform = t1;
      if (twoRef.current) twoRef.current.style.transform = t2;
      if (threeRef.current) threeRef.current.style.transform = t3;
      if (fourRef.current) fourRef.current.style.transform = t4;
      if (fiveRef.current) fiveRef.current.style.transform = t5;
    };

    // Use capturing to listen to scroll events inside sheetWrap as well
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Initial positioning
    updateParallax();

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="forest-container">
      <div className="forest-parallax">
        {/* Layer 5 (Base Trees / Background) */}
        <div
          ref={fiveRef}
          className="forest-layer"
          style={{
            backgroundImage: `url("https://tornis.robbowen.digital/img/tree_base.jpg")`,
            zIndex: 0,
          }}
        />
        {/* Layer 4 (Mid Trees) */}
        <div
          ref={fourRef}
          className="forest-layer"
          style={{
            backgroundImage: `url("https://tornis.robbowen.digital/img/tree_mid.png")`,
            zIndex: 1,
          }}
        />
        {/* Layer 3 (Middle Mist) */}
        <div
          ref={threeRef}
          className="forest-layer"
          style={{ zIndex: 2 }}
        >
          <div
            className="mist-sway animate-mist-slow"
            style={{
              backgroundImage: `url("https://tornis.robbowen.digital/img/mist.png")`,
            }}
          />
        </div>
        {/* Layer 2 (Top Trees) */}
        <div
          ref={twoRef}
          className="forest-layer"
          style={{
            backgroundImage: `url("https://tornis.robbowen.digital/img/tree_top.png")`,
            zIndex: 3,
          }}
        />
        {/* Layer 1 (Front Mist) */}
        <div
          ref={oneRef}
          className="forest-layer"
          style={{ zIndex: 4 }}
        >
          <div
            className="mist-sway animate-mist-fast"
            style={{
              backgroundImage: `url("https://tornis.robbowen.digital/img/mist.png")`,
            }}
          />
        </div>
      </div>
      <div className="forest-vignette" />
    </div>
  );
}
