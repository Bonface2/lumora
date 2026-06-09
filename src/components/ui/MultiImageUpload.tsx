"use client";

import { useRef, useState } from "react";
import { uploadFiles } from "@/lib/uploadthing-client";

const MAX_IMAGES = 8;

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
}

export function MultiImageUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    const remaining = MAX_IMAGES - value.length;
    if (remaining <= 0) return;
    const toUpload = Array.from(files).slice(0, remaining);

    setUploading(true);
    setError("");
    try {
      const results = await uploadFiles("eventImages", { files: toUpload });
      const urls = results.map((r) => r.serverData?.url ?? r.ufsUrl);
      onChange([...value, ...urls]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function moveLeft(index: number) {
    if (index === 0) return;
    const next = [...value];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveRight(index: number) {
    if (index === value.length - 1) return;
    const next = [...value];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {/* Thumbnail grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((url, i) => (
            <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <img src={url} alt={`Image ${i + 1}`} className="h-full w-full object-cover" />

              {/* Cover badge */}
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Cover
                </span>
              )}

              {/* Controls overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => moveLeft(i)}
                    className="rounded-full bg-white/90 p-1.5 text-gray-700 hover:bg-white"
                    title="Move left"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                  title="Remove"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {i < value.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveRight(i)}
                    className="rounded-full bg-white/90 p-1.5 text-gray-700 hover:bg-white"
                    title="Move right"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      {value.length < MAX_IMAGES && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:bg-gray-100 disabled:opacity-60"
          >
            {uploading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            ) : (
              <>
                <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-1.5 text-sm text-gray-500">
                  {value.length === 0 ? "Click to upload images" : "Add more images"}
                </p>
                <p className="text-xs text-gray-400">PNG, JPG, WebP — max 4 MB · up to {MAX_IMAGES} images</p>
              </>
            )}
          </button>
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {value.length > 0 && (
        <p className="text-xs text-gray-400">
          First image is the cover shown on listing cards. Hover to reorder or remove.
        </p>
      )}
    </div>
  );
}
