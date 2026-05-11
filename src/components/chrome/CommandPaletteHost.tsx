// Owns the open/closed state for ⌘K and binds the keyboard shortcut globally.
// The actual UI comes from hudsonkit/overlays.

import { useEffect, useState } from "react";
import { CommandPalette, type CommandOption } from "hudsonkit/overlays";

interface CommandPaletteHostProps {
  commands: CommandOption[];
}

export function CommandPaletteHost({ commands }: CommandPaletteHostProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <CommandPalette isOpen={open} onClose={() => setOpen(false)} commands={commands} />;
}
