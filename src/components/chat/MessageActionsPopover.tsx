import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '../../types';

type MenuPosition = {
  left: number;
  top: number;
};

type MessageActionsPopoverProps = {
  anchor: HTMLElement;
  boundary: HTMLElement | null;
  message: Message;
  canDeleteForEveryone: boolean;
  onClose: () => void;
  onCopy: (message: Message) => void;
  onDeleteForMe: (message: Message) => void;
  onDeleteForEveryone: (message: Message) => void;
};

const GAP = 8;
const INSET = 8;

const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
);

const MessageActionsPopover: React.FC<MessageActionsPopoverProps> = ({
  anchor,
  boundary,
  message,
  canDeleteForEveryone,
  onClose,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !anchor.isConnected) {
      onClose();
      return undefined;
    }

    const calculatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const bounds = boundary?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight
      };
      const minLeft = bounds.left + INSET;
      const maxLeft = bounds.right - menuRect.width - INSET;
      const left = clamp(anchorRect.right - menuRect.width, minLeft, maxLeft);
      const roomBelow = bounds.bottom - anchorRect.bottom;
      const opensAbove = roomBelow < menuRect.height + GAP + INSET;
      const preferredTop = opensAbove
        ? anchorRect.top - menuRect.height - GAP
        : anchorRect.bottom + GAP;
      const maxTop = bounds.bottom - menuRect.height - INSET;
      const top = clamp(preferredTop, bounds.top + INSET, maxTop);

      setPosition({ left, top });
    };

    calculatePosition();
    const closeOnViewportChange = () => onClose();
    boundary?.addEventListener('scroll', closeOnViewportChange, { passive: true });
    window.addEventListener('resize', closeOnViewportChange);

    return () => {
      boundary?.removeEventListener('scroll', closeOnViewportChange);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, [anchor, boundary, canDeleteForEveryone, onClose]);

  useLayoutEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999
      }}
      className="fixed z-[100] w-48 overflow-hidden rounded-xl border
        border-stone-200 bg-white py-1 text-stone-700 shadow-xl"
    >
      {!message.deleted && message.text !== 'Image' && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onCopy(message)}
          className="block w-full cursor-pointer px-3 py-2 text-left text-sm
            transition hover:bg-stone-50"
        >
          Copy
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => onDeleteForMe(message)}
        className="block w-full cursor-pointer px-3 py-2 text-left text-sm
          text-red-600 transition hover:bg-stone-50"
      >
        Delete for me
      </button>
      {canDeleteForEveryone && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onDeleteForEveryone(message)}
          className="block w-full cursor-pointer px-3 py-2 text-left text-sm
            text-red-600 transition hover:bg-stone-50"
        >
          Delete for everyone
        </button>
      )}
    </div>,
    document.body
  );
};

export default MessageActionsPopover;
