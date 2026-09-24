"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { waHref } from "@/lib/wa-templates";

export interface WaTemplateRow {
  key: string;
  label: string;
  text: string;
}

/**
 * WaTemplateDialog — pick a ready follow-up message, tweak it if needed,
 * then jump to WhatsApp with it prefilled. Shared by agent & admin lead
 * and enquiry cards so every staff message starts warm, never blank.
 * Mount conditionally (only while open) so state resets per conversation.
 */
export function WaTemplateDialog({
  open,
  onOpenChange,
  phone,
  name,
  templates,
  defaultKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  name: string;
  templates: WaTemplateRow[];
  defaultKey?: string;
}) {
  const initial = templates.find((t) => t.key === defaultKey) ?? templates[0];
  const [selectedKey, setSelectedKey] = useState(initial?.key ?? "");
  const [text, setText] = useState(initial?.text ?? "");

  const pick = (key: string) => {
    setSelectedKey(key);
    const t = templates.find((x) => x.key === key);
    if (t) setText(t.text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">WhatsApp {name}</DialogTitle>
          <DialogDescription>
            Pick a ready message, edit it if you like, then send — the text
            opens prefilled in WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Message templates">
          {templates.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={selectedKey === t.key}
              onClick={() => pick(t.key)}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedKey === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Textarea
          aria-label="WhatsApp message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-32 rounded-2xl text-sm leading-relaxed"
        />

        <Button
          asChild
          size="sm"
          className="min-h-10 w-full rounded-full"
          disabled={!text.trim()}
        >
          <a
            href={waHref(phone, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpenChange(false)}
          >
            {text.trim() ? <MessageCircle aria-hidden /> : <Loader2 className="animate-spin" aria-hidden />}
            Open WhatsApp with this message
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
