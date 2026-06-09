"use client";

import { useState } from "react";

interface Props {
  images: string[];
  alt: string;
}

export function ImageCarousel({ images, alt }: Props) {
  const [current, setCurrent] = useState(0);

  function prev() {
    setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  }

  function next() {
    setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));
  }

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="relative h-full w-full select-none">
      {/* Images */}
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`${alt} — photo ${i + 1}`}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            i === current ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
      ))}

      {/* Prev / Next */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous image"
        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next image"
        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to image ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === current
                ? "w-6 bg-white"
                : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute right-3 bottom-4 z-10 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
        {current + 1} / {images.length}
      </div>
    </div>
  );
}
