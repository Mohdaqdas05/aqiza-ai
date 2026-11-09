"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("aqizaai-theme");
    const nextTheme = saved === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    const onShortcut = () => {
      setTheme((current) => {
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        window.localStorage.setItem("aqizaai-theme", next);
        return next;
      });
    };
    window.addEventListener("aqiza-toggle-theme", onShortcut);
    return () => window.removeEventListener("aqiza-toggle-theme", onShortcut);
  }, []);

  function toggleTheme() {
    window.dispatchEvent(new Event("aqiza-toggle-theme"));
  }

  return (
    <button className="sidebar-utility" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span>
      <kbd>Ctrl ⇧ D</kbd>
    </button>
  );
}
