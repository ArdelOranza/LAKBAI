import { useEffect, useRef, useState } from 'react';
import { useAiActivity } from './useAiActivity.js';

// White → pale blue → primary → deep blue, so the motion reads as light moving
// across a white page rather than a dark banner.
const GRADIENT = ['#FFFFFF', '#EAF2FF', '#1667D9', '#0A3D8F'];
const SHOW_DELAY = 150;   // skip the effect entirely for near-instant cached answers
const MIN_VISIBLE = 700;  // when it does show, keep it up long enough to read
const FADE_MS = 380;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fluid Kawarp wash behind the app while any AI request is in flight.
 * Lives in the shell, driven by the shared activity counter, so every AI
 * feature (chat, recommendations, itinerary generation) lights it up.
 */
export default function AiBackdrop(){
  const active = useAiActivity();
  const canvasRef = useRef(null);
  const kawarpRef = useRef(null);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const printedAt = useRef(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);

    const dispose = () => {
      const k = kawarpRef.current;
      kawarpRef.current = null;
      if (!k) return;
      try { k.stop(); k.dispose(); } catch { /* already gone */ }
    };

    if (active) {
      if (reducedMotion()) return undefined;
      showTimer.current = setTimeout(async () => {
        if (cancelled || kawarpRef.current || !canvasRef.current) return;
        try {
          const { Kawarp } = await import('@kawarp/core');
          if (cancelled || !canvasRef.current) return;
          const k = new Kawarp(canvasRef.current, {
            warpIntensity: 0.9,
            blurPasses: 6,
            animationSpeed: 1.3,
            saturation: 1.25,
            tintColor: [0.06, 0.22, 0.45],
            tintIntensity: 0.12,
            scale: 1.05,
          });
          k.loadGradient(GRADIENT, 135);
          k.start();
          kawarpRef.current = k;
          printedAt.current = Date.now();
          setVisible(true);
        } catch { /* no WebGL: the backdrop stays silent, AI features keep working */ }
      }, SHOW_DELAY);
    } else {
      const shownFor = Date.now() - printedAt.current;
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        hideTimer.current = setTimeout(dispose, FADE_MS);
      }, Math.max(0, MIN_VISIBLE - shownFor));
    }

    return () => {
      cancelled = true;
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, [active]);

  useEffect(() => {
    const onResize = () => { try { kawarpRef.current && kawarpRef.current.resize(); } catch { /* ignore */ } };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      const k = kawarpRef.current;
      kawarpRef.current = null;
      if (k) { try { k.stop(); k.dispose(); } catch { /* ignore */ } }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="ai-backdrop"
      style={{
        position:'absolute', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden',
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <canvas ref={canvasRef} style={{ display:'block', width:'100%', height:'100%' }}/>
      <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.45)' }}/>
    </div>
  );
}