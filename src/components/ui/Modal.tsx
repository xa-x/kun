"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "@phosphor-icons/react";

/**
 * Accessible dialog shell: role="dialog", labelled by its title, closes on
 * Escape or a scrim click, and returns focus to whatever opened it.
 */
export function Modal({
  title,
  description,
  onClose,
  dismissible = true,
  footer,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  /** False for blocking dialogs such as first-run onboarding. */
  dismissible?: boolean;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([data-modal-close])",
    );
    (first ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
    // Focus handling should run once per mount, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={() => dismissible && onClose()}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="kun-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-line2 bg-card shadow-2xl shadow-black/50 outline-none"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div>
            <h2 id={titleId} className="text-[18px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              data-modal-close
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink"
            >
              <X size={14} weight="bold" aria-hidden />
            </button>
          )}
        </div>
        {children && <div className="px-6 py-3">{children}</div>}
        {footer && (
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-line bg-sunken/50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
