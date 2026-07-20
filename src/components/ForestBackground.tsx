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
      // Ultra-smooth linear interpolation
      const ease = 0.08; // smooth dampening coefficient

      currentScrollY += (targetScrollY - currentScrollY) * ease;
      currentMouseX += (targetMouseX - currentMouseX) * ease;
      currentMouseY += (targetMouseY - currentMouseY) * ease;

      const diffScroll = Math.abs(targetScrollY - currentScrollY);
      const diffX = Math.abs(targetMouseX - currentMouseX);
      const diffY = Math.abs(targetMouseY - currentMouseY);

      // If the values have converged closely enough, snap and stop animation loop to conserve battery/CPU
      if (diffScroll < 0.05 && diffX < 0.0005 && diffY < 0.0005) {
        currentScrollY = targetScrollY;
        currentMouseX = targetMouseX;
        currentMouseY = targetMouseY;
        isAnimating = false;
      }

      // Limit background vertical movement to 120px so trees always stay in frame
      const dampedScroll = Math.min(currentScrollY * 0.15, 120);

      // Parallax ratios for depth layers
      const t1 = `translate(${currentMouseX * 5}px, ${-dampedScroll * 0.1 + currentMouseY * 5}px)`;
      const t2 = `translate(${currentMouseX * 12}px, ${-dampedScroll * 0.25 + currentMouseY * 12}px)`;
      const t3 = `translate(${currentMouseX * 8}px, ${-dampedScroll * 0.4 + currentMouseY * 8}px)`;
      const t4 = `translate(${-currentMouseX * 18}px, ${-dampedScroll * 0.55 + currentMouseY * 18}px)`;
      const t5 = `translate(${currentMouseX * 25}px, ${-dampedScroll * 0.7 + -currentMouseY * 25}px)`;

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

    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Normalize to [-1, 1]
      targetMouseX = (e.clientX - w / 2) / (w / 2);
      targetMouseY = (e.clientY - h / 2) / (h / 2);
      triggerAnimation();
    };

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      
      // gamma is the left-to-right tilt in degrees, where right is positive (-90 to 90)
      let gamma = e.gamma;
      // beta is the front-to-back tilt in degrees, where front is positive (-180 to 180)
      let beta = e.beta;

      // Restrict gamma to -45 to 45
      gamma = Math.max(-45, Math.min(45, gamma));
      
      // Assume a neutral holding position for beta is around 45 degrees
      // Restrict beta range from 20 to 70 degrees
      beta = Math.max(20, Math.min(70, beta));

      // Normalize to [-1, 1]
      targetMouseX = gamma / 45;
      targetMouseY = (beta - 45) / 25; 
      
      triggerAnimation();
    };

    // Use capturing to listen to scroll events inside sheetWrap as well
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });

    // Initial run to set positions
    updateParallax();

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
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
