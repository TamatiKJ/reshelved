const SWAP_CONFIRM_BYPASS = 'swapConfirmBypass';
const SWAP_TOAST_ID = 'swap-completion-toast';
const SWAP_MODAL_ID = 'swap-completion-confirm-modal';
let lastToastAt = 0;

const removeElement = (id: string) => document.getElementById(id)?.remove();

const showSwapToast = (message: string) => {
  const now = Date.now();
  if (now - lastToastAt < 1200) return;
  lastToastAt = now;

  removeElement(SWAP_TOAST_ID);

  const toast = document.createElement('div');
  toast.id = SWAP_TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.className = 'fixed right-4 top-24 z-[10000] flex w-[calc(100vw-32px)] max-w-sm items-start gap-3 rounded-2xl border border-primary-200 bg-white p-4 text-stone-900 shadow-2xl sm:right-6';
  toast.innerHTML = `
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
      <i class="las la-check text-2xl"></i>
    </div>
    <div class="min-w-0">
      <p class="text-sm font-extrabold text-stone-950">Swap completed</p>
      <p class="mt-1 text-sm leading-5 text-stone-600">${message}</p>
    </div>
    <button type="button" class="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Close notification"><i class="las la-times text-lg"></i></button>
  `;

  toast.querySelector('button')?.addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2500);
};

const showSwapCompletionModal = (button: HTMLButtonElement) => {
  removeElement(SWAP_MODAL_ID);

  const modal = document.createElement('div');
  modal.id = SWAP_MODAL_ID;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
  modal.innerHTML = `
    <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF4E2] text-primary-600">
        <i class="las la-exchange-alt text-3xl"></i>
      </div>
      <h3 class="mt-5 text-xl font-extrabold tracking-tight text-stone-950">Mark this swap as complete?</h3>
      <p class="mt-2 text-sm leading-6 text-stone-600">This confirms that the swap was completed. You cannot undo this action after confirmation. Once the swap is complete, remember to review the other reader.</p>
      <div class="mt-6 grid grid-cols-2 gap-3">
        <button type="button" data-cancel class="cursor-pointer rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50">Cancel</button>
        <button type="button" data-confirm class="cursor-pointer rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-700">Confirm</button>
      </div>
    </div>
  `;

  const close = () => modal.remove();
  modal.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target === modal || target.closest('[data-cancel]')) close();
    if (target.closest('[data-confirm]')) {
      button.dataset[SWAP_CONFIRM_BYPASS] = 'true';
      close();
      button.click();
      window.setTimeout(() => delete button.dataset[SWAP_CONFIRM_BYPASS], 0);
    }
  });

  document.body.appendChild(modal);
};

const isSwapCompletionButton = (button: HTMLButtonElement) => {
  const label = button.textContent?.trim().toLowerCase() || '';
  return label.includes('swap completion') && !label.includes('saving') && !label.includes('completed') && !button.disabled;
};

const bindSwapCompletionConfirm = () => {
  if (document.body.dataset.swapCompletionConfirmBound === 'true') return;
  document.body.dataset.swapCompletionConfirmBound = 'true';

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button || !isSwapCompletionButton(button)) return;
    if (button.dataset[SWAP_CONFIRM_BYPASS] === 'true') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showSwapCompletionModal(button);
  }, true);
};

const observeSwapCompletionSuccess = () => {
  const text = document.body.textContent || '';
  if (text.includes('Rating is now unlocked for this swap.') || text.includes('Swap completed. Rating is now unlocked.')) {
    showSwapToast('Don’t forget to review the other reader.');
  }
};

export const enableSwapCompletionEnhancements = () => {
  if (typeof window === 'undefined') return;
  bindSwapCompletionConfirm();
  new MutationObserver(observeSwapCompletionSuccess).observe(document.body, { childList: true, subtree: true, characterData: true });
};
