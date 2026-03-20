import { useLayoutEffect, useState, type RefObject } from 'react';

export interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width?: number;
  maxHeight?: number;
  maxWidth?: number;
}

interface UseDropdownPositionOptions {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  preferAbove?: boolean;
  alignRight?: boolean;
  matchWidth?: boolean;
  dropdownWidth?: number;
  minWidth?: number;
  offset?: number;
  padding?: number;
  desiredHeight?: number;
}

export function useDropdownPosition({
  open,
  triggerRef,
  preferAbove = false,
  alignRight = false,
  matchWidth = false,
  dropdownWidth,
  minWidth,
  offset = 6,
  padding = 16,
  desiredHeight = 256,
}: UseDropdownPositionOptions): DropdownPosition | null {
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - padding - rect.bottom;
      const spaceAbove = rect.top - padding;

      const showAbove = preferAbove
        ? spaceAbove >= Math.min(desiredHeight, Math.max(120, spaceBelow))
        : (spaceBelow < desiredHeight && spaceAbove > spaceBelow);

      let top: number | undefined;
      let bottom: number | undefined;
      let maxHeight: number | undefined;

      if (showAbove) {
        bottom = vh - rect.top + offset;
        maxHeight = Math.max(120, rect.top - padding - offset);
      } else {
        top = rect.bottom + offset;
        maxHeight = Math.max(120, vh - padding - top);
      }

      const baseWidth = dropdownWidth ?? (matchWidth ? rect.width : undefined);
      const effectiveWidth = Math.max(baseWidth ?? 0, minWidth ?? 0);

      let left = alignRight
        ? rect.right - (effectiveWidth || rect.width)
        : rect.left;

      left = Math.max(padding, left);

      if (effectiveWidth > 0) {
        left = Math.min(left, vw - padding - effectiveWidth);
      }

      const maxWidth = Math.max(120, vw - padding - left);

      setPosition({
        top,
        bottom,
        left,
        width: baseWidth,
        maxHeight,
        maxWidth,
      });
    };

    updatePosition();
    document.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [
    alignRight,
    desiredHeight,
    dropdownWidth,
    matchWidth,
    minWidth,
    offset,
    open,
    padding,
    preferAbove,
    triggerRef,
  ]);

  return position;
}
