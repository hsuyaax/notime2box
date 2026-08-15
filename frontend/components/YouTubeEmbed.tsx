"use client";
// Click-to-play YouTube embed: thumbnail + PLAY affordance, iframe only loads on
// click (lighter, no forced autoplay/third-party requests until the visitor opts in).
import { useState } from "react";
import { motion } from "framer-motion";

export default function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="cut aspect-video overflow-hidden">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <motion.button
      onClick={() => setPlaying(true)}
      data-cursor="play"
      whileHover={{ scale: 1.01 }}
      className="cut aspect-video relative overflow-hidden group w-full"
    >
      <img
        src={`https://img.youtube.com/vi/${id}/maxresdefault.jpg`}
        alt={title}
        className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
      />
      <div className="absolute inset-0 bg-bg/40 flex items-center justify-center">
        <span className="w-16 h-16 rounded-full border-2 border-race-white flex items-center justify-center">
          <span className="w-0 h-0 border-y-8 border-y-transparent border-l-[14px] border-l-race-white ml-1" />
        </span>
      </div>
      <p className="absolute bottom-3 left-4 right-4 font-mono text-xs text-race-white/90 text-left">{title}</p>
    </motion.button>
  );
}
