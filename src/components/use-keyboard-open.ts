"use client";

import { useEffect, useState } from "react";

const textInputTypes = new Set(["text", "search", "email", "number", "tel", "url", "password"]);

function isTextField(element: Element | null) {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return textInputTypes.has(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * Indica se o teclado virtual está aberto: a área visível encolheu (visualViewport) ou,
 * em telas de toque, um campo de texto recebeu foco.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const viewport = window.visualViewport;
    const update = () => {
      const shrunk = viewport ? window.innerHeight - viewport.height > 150 : false;
      setOpen(shrunk || (touch && isTextField(document.activeElement)));
    };
    const onFocusChange = () => window.setTimeout(update, 50);
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    viewport?.addEventListener("resize", update);
    return () => {
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
      viewport?.removeEventListener("resize", update);
    };
  }, []);

  return open;
}
