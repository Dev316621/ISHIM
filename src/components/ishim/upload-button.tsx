"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/api";
import { toastError } from "@/lib/feedback";

/**
 * Small button that opens a file picker and POSTs the chosen image to
 * /api/upload, handing the returned url to `onUploaded`. Used by the
 * listing photo picker, ad banners and CMS content banners.
 */
export function UploadButton({
  onUploaded,
  label = "Upload",
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  variant?: "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } catch (err) {
      toastError(err, "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onChange(e)}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <Upload aria-hidden />
        )}
        {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}
