import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroSlide } from '../lib/types';

const INTERVAL_MS = 6000;

/** Site pages go through the router; full web addresses open in a new tab. */
function SlideButton({ slide }: { slide: HeroSlide }) {
  if (!slide.link) return null;
  const label = slide.button_text || 'Shop now';
  const className = 'btn-marigold mt-5';
  return /^https?:\/\//i.test(slide.link)
    ? <a href={slide.link} target="_blank" rel="noopener noreferrer" className={className}>{label} <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
    : <Link to={slide.link} className={className}>{label} <ArrowUpRight size={16} aria-hidden="true" /></Link>;
}

/**
 * The admin's banner slides beside the hero headline. Advances every few seconds, pauses while the
 * pointer or keyboard focus is on it, and never moves on its own for visitors who prefer reduced motion.
 */
export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const count = slides.length;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Slides removed in the admin while this page was open: stay in range.
  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const t = setInterval(() => setIndex(i => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(t);
  }, [count, paused, reducedMotion]);

  if (count === 0) return null;
  const go = (i: number) => setIndex((i + count) % count);

  return (
    <div
      ref={box}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node)) setPaused(false); }}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-ink shadow-[0_30px_60px_-25px_rgb(0_0_0/0.7)] ring-1 ring-white/10"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={!active}
            inert={!active}
            className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}
          >
            {slide.image_url && (
              <img src={slide.image_url} alt="" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'}
                className={`h-full w-full object-cover transition-transform duration-[7000ms] ease-out ${active ? 'scale-105' : 'scale-100'}`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-deep via-ink-deep/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="font-display text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">{slide.title}</p>
              {slide.subtitle && <p className="mt-2 max-w-md text-white/80">{slide.subtitle}</p>}
              <SlideButton slide={slide} />
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          {/* A soft shade behind the controls so they read on light photos too. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ink-deep/55 to-transparent" aria-hidden="true" />
          <div className="absolute right-4 top-4 flex gap-2">
            <button onClick={() => go(index - 1)} aria-label="Previous slide" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-deep/50 text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white hover:text-ink">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => go(index + 1)} aria-label="Next slide" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-deep/50 text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white hover:text-ink">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="absolute left-6 top-[1.6rem] flex gap-1.5 sm:left-8">
            {slides.map((_, i) => (
              <button key={i} onClick={() => go(i)} aria-label={`Show slide ${i + 1}`} aria-current={i === index}
                className={`h-1.5 rounded-full shadow-sm transition-all ${i === index ? 'w-8 bg-white' : 'w-4 bg-white/45 hover:bg-white/75'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
