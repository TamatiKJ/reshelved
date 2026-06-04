import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./index.css";
import "./global-controls.css";
import "./reshelved-overrides.css";
import "./navbar.css";
import "./listing-detail.css";
import "./profile.css";
import "./create-listing.css";
import "./messages.css";
import "./admin.css";
import "./admin-actions.css";
import "./chat-dock-overrides.css";
import "./responsive.css";
import App from "./App";
import { enforceWebpUploadCompression } from "./utils/enforceWebpUploadCompression";
import { enableSwapCompletionEnhancements } from "./utils/swapCompletionEnhancements";
import { enableMobileErrorAutoScroll } from "./utils/mobileErrorAutoScroll";
import { initializeRuntimeUiEnhancements } from "./utils/runtimeUiEnhancements";
import { enableConversationWarmup } from "./utils/conversationWarmup";

enforceWebpUploadCompression();
enableSwapCompletionEnhancements();
enableMobileErrorAutoScroll();
initializeRuntimeUiEnhancements();
enableConversationWarmup();

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

const addBlogEditorHistoryControls = () => {
  const imageButton = document.querySelector<HTMLButtonElement>('button[title="Image"]');
  if (!imageButton || document.querySelector('[data-editor-history-controls="true"]')) return;

  const controls = document.createElement("div");
  controls.dataset.editorHistoryControls = "true";
  controls.className = "ml-auto flex gap-2";
  controls.innerHTML = `
    <button type="button" title="Undo" class="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-semibold hover:bg-stone-50"><i class="las la-undo text-lg"></i></button>
    <button type="button" title="Redo" class="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-semibold hover:bg-stone-50"><i class="las la-redo text-lg"></i></button>
  `;

  imageButton.parentElement?.appendChild(controls);
};

const observeBlogEditorControls = () => {
  addBlogEditorHistoryControls();
  const observer = new MutationObserver(addBlogEditorHistoryControls);
  observer.observe(document.body, { childList: true, subtree: true });
};

observeBlogEditorControls();

window.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const image = target.closest<HTMLImageElement>('[data-zoomable-image="true"]');
  if (image?.src) openImageZoom(image.src, image.alt || "Listing image");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
