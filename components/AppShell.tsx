"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AppProvider, useApp, useNow, timerElapsed } from "@/lib/state";
import { formatDuration } from "@/lib/format";
import { HomeView } from "./HomeView";
import { PlatesView } from "./PlatesView";
import { ProgramScreen } from "./ProgramScreen";
import { YouView } from "./YouView";
import { BuilderSheet } from "./BuilderSheet";
import { BarbellIcon, PersonIcon, PlatesIcon } from "./Icons";
import { Cursor, Grain } from "./motion";
import { Brand } from "./Brand";
import { ServiceWorker } from "./ServiceWorker";

type Tab = "home" | "plates" | "you";

const TABS: { id: Tab; label: string; icon: typeof BarbellIcon }[] = [
  { id: "home", label: "Train", icon: BarbellIcon },
  { id: "plates", label: "Plates", icon: PlatesIcon },
  { id: "you", label: "You", icon: PersonIcon },
];

export default function AppShell() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { data } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [open, setOpen] = useState<{ id: string; rect: DOMRect | null } | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderSeed, setBuilderSeed] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const now = useNow(Boolean(data.session?.timer.running));

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    );
  }, []);

  const program = open ? data.programs.find((item) => item.id === open.id) ?? null : null;
  const liveProgram = data.programs.find((item) => item.id === data.session?.programId) ?? null;
  const elapsed = data.session ? timerElapsed(data.session.timer, now) : 0;
  const tabIndex = Math.max(
    0,
    TABS.findIndex((item) => item.id === tab),
  );

  const changeTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app">
      <ServiceWorker />
      <Cursor />
      <Grain />

      <header className="appbar">
        <Brand />
        {data.session && liveProgram ? (
          <button
            type="button"
            className="livechip"
            onClick={() => setOpen({ id: liveProgram.id, rect: null })}
          >
            <span className="pulse" aria-hidden="true" />
            <span>{formatDuration(elapsed)}</span>
            <span className="livechip-label">live</span>
          </button>
        ) : (
          <span className="appbar-note">{today}</span>
        )}
      </header>

      <main className={`screen screen--${tab}`}>
        <div className="view" key={tab}>
          {tab === "home" ? (
            <HomeView
              onOpenProgram={(id, rect) => setOpen({ id, rect })}
              onNewWorkout={() => setBuilderOpen(true)}
            />
          ) : null}
          {tab === "plates" ? <PlatesView /> : null}
          {tab === "you" ? (
            <YouView
              onNewWorkout={() => setBuilderOpen(true)}
              onOpenProgram={(id, rect) => setOpen({ id, rect })}
            />
          ) : null}
        </div>
      </main>

      <nav className="dock" aria-label="Primary">
        <div className="dock-inner" style={{ "--i": tabIndex } as CSSProperties}>
          <span className="dock-indicator" aria-hidden="true" />
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                className={`dock-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => changeTab(id)}
                data-cursor="link"
              >
                <span className="dock-icon">
                  <Icon size={20} />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {builderOpen ? (
        <BuilderSheet
          seedProgramId={builderSeed}
          onClose={() => {
            setBuilderOpen(false);
            setBuilderSeed(null);
          }}
          onCreated={(id) => {
            setBuilderOpen(false);
            setBuilderSeed(null);
            setOpen({ id, rect: null });
          }}
        />
      ) : null}

      {program ? (
        <ProgramScreen
          program={program}
          from={open?.rect ?? null}
          onBack={() => setOpen(null)}
          onUseAsBase={(id) => {
            setOpen(null);
            setBuilderSeed(id);
            setBuilderOpen(true);
          }}
        />
      ) : null}
    </div>
  );
}
