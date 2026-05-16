import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const openImageZoom = (src: string, alt: string) => {
  const existing = document.getElementById("listing-image-zoom-modal");
  existing?.remove();

  let scale = 1;
  const modal = document.createElement("div");
  modal.id = "listing-image-zoom-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4";

  modal.innerHTML = `
    <div class="absolute right-4 top-4 flex gap-2">
      <button type="button" data-zoom-out class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg" aria-label="Zoom out"><i class="las la-search-minus text-2xl"></i></button>
      <button type="button" data-zoom-in class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg" aria-label="Zoom in"><i class="las la-search-plus text-2xl"></i></button>
      <button type="button" data-zoom-close class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg" aria-label="Close image"><i class="las la-times text-2xl"></i></button>
    </div>
    <div class="max-h-[90vh] max-w-[94vw] overflow-auto rounded-2xl bg-white/5 p-2">
      <img data-zoom-image src="${src}" alt="${alt.replace(/"/g, "&quot;")}" class="max-h-[86vh] max-w-[90vw] object-contain transition-transform duration-200" />
    </div>
  `;

  const updateScale = () => {
    const image = modal.querySelector<HTMLImageElement>("[data-zoom-image]");
    if (image) image.style.transform = `scale(${scale})`;
  };

  modal.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-zoom-close]") || target === modal) modal.remove();
    if (target.closest("[data-zoom-in]")) {
      scale = Math.min(2.5, scale + 0.25);
      updateScale();
    }
    if (target.closest("[data-zoom-out]")) {
      scale = Math.max(1, scale - 0.25);
      updateScale();
    }
  });

  document.body.appendChild(modal);
};

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const zoomButton = target.closest<HTMLButtonElement>('button[aria-label="Open larger image"]');
  if (!zoomButton) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const gallery = zoomButton.closest(".aspect-square");
  const image = gallery?.querySelector<HTMLImageElement>('img[alt]:not([alt=""])');
  if (image?.src) openImageZoom(image.src, image.alt || "Listing image");
}, true);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
