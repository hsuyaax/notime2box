"use client";
// Plays the F1 radio notification chirp once, on the visitor's first interaction.
// Browsers block unmuted autoplay before any interaction, so "on load" in practice
// means "on the first click/scroll/keypress" — still feels instant in the flow that
// already opens with "SCROLL TO EXPLORE".
import { useEffect, useRef } from "react";

export default function RadioCue() {
  const played = useRef(false);

  useEffect(() => {
    const play = () => {
      if (played.current) return;
      played.current = true;
      new Audio("/radio-notification.mp3").play().catch(() => {});
      events.forEach((ev) => window.removeEventListener(ev, play));
    };
    const events = ["pointerdown", "wheel", "keydown", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, play, { once: true, passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, play));
  }, []);

  return null;
}
