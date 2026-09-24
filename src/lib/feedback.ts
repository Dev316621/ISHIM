"use client";

import { toast } from "@/hooks/use-toast";

export function toastError(e: unknown, title = "Something went wrong") {
  toast({
    title,
    description: e instanceof Error ? e.message : String(e),
    variant: "destructive",
  });
}

export function toastSuccess(title: string, description?: string) {
  toast({ title, description });
}

export function toastInfo(title: string, description?: string) {
  toast({ title, description });
}
