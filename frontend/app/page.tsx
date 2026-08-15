"use client";
// THE SILENT CO-DRIVER — one continuous scroll narrative, six chapters.
import { useState } from "react";
import ChaptersNav from "@/components/ChaptersNav";
import RadioCue from "@/components/RadioCue";
import Interstitial from "@/components/Interstitial";
import Chapter01Hero from "@/components/chapters/Chapter01Hero";
import Chapter02Garage from "@/components/chapters/Chapter02Garage";
import Chapter03RadioRewind from "@/components/chapters/Chapter03RadioRewind";
import ChapterHardPart from "@/components/chapters/ChapterHardPart";
import Chapter04Debrief from "@/components/chapters/Chapter04Debrief";
import Chapter05Cockpit from "@/components/chapters/Chapter05Cockpit";
import { SessionMeta } from "@/lib/api";

export default function Home() {
  const [session, setSession] = useState<SessionMeta | null>(null);

  return (
    <main className="flex-1">
      <ChaptersNav />
      <RadioCue />

      <Chapter01Hero />
      <Interstitial>"It's the mind that makes the difference."</Interstitial>

      <Chapter02Garage onSelect={setSession} activeKey={session?.key} />

      <Chapter03RadioRewind session={session} />
      <Interstitial>"Fatigue is a regime, not a moment."</Interstitial>

      <ChapterHardPart />

      <Chapter04Debrief session={session} />

      <Chapter05Cockpit />
      <Interstitial mark>"The signal was always in the audio. Nobody was decoding it."</Interstitial>

      <footer className="px-6 py-8 font-mono text-[10px] text-dim flex justify-between max-w-7xl mx-auto w-full">
        <span>THE SILENT CO-DRIVER</span>
        <span>DATA VIA OPENF1 (UNOFFICIAL) &amp; FASTF1</span>
      </footer>
    </main>
  );
}
