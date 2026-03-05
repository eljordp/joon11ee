'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const handleMouseMove = (e: MouseEvent) => {
      const offset = hovering.current ? 8 : 4;
      dot.style.transform = `translate(${e.clientX - offset}px, ${e.clientY - offset}px)`;
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, button, [data-hover]')) {
        hovering.current = true;
        dot.classList.add('hovering');
      }
    };

    const handleMouseOut = () => {
      hovering.current = false;
      dot.classList.remove('hovering');
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  return <div ref={dotRef} className="cursor-dot hidden md:block" />;
}
