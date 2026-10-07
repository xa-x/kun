"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

/** Labelled input. The label is always visible; placeholders are never labels. */
export function AuthField({
  label,
  type = "text",
  ...rest
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          className={`kun-input ${isPassword ? "pr-11" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/5 hover:text-ink"
          >
            {shown ? (
              <EyeSlash size={16} aria-hidden />
            ) : (
              <Eye size={16} aria-hidden />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
