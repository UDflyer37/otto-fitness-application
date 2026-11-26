import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, restoreBackupData } from "./state";
import type { AppData, Program } from "./types";

function program(id: string, name: string): Program {
  return {
    id,
    name,
    tags: ["Custom"],
    exercises: [
      {
        id: `${id}-0`,
        name: "Back Squat",
        sets: "5",
        reps: "5",
        percent: 80,
        lift: "squat",
        superset: false,
      },
    ],
  };
}

const current: AppData = {
  version: 2,
  settings: DEFAULT_SETTINGS,
  programs: [program("current", "Current Program")],
  library: [],
  session: null,
  history: [
    {
      id: "current-history",
      programId: "current",
      programName: "Current Program",
      finishedAt: 1,
      durationMs: 1000,
      completedCount: 1,
      totalCount: 1,
    },
  ],
};

describe("backup restore", () => {
  it("restores workout history from exported app backups", () => {
    const restored = restoreBackupData(current, {
      settings: {
        ...DEFAULT_SETTINGS,
        maxes: { ...DEFAULT_SETTINGS.maxes, squat: 405 },
      },
      programs: [program("backup", "Backup Program")],
      history: [
        {
          id: "backup-history",
          programId: "backup",
          programName: "Backup Program",
          finishedAt: 2,
          durationMs: 3600000,
          completedCount: 3,
          totalCount: 4,
          skippedCount: 1,
        },
      ],
    });

    expect(restored.programs.map((item) => item.id)).toEqual(["backup"]);
    expect(restored.settings.maxes.squat).toBe(405);
    expect(restored.history).toEqual([
      {
        id: "backup-history",
        programId: "backup",
        programName: "Backup Program",
        finishedAt: 2,
        durationMs: 3600000,
        completedCount: 3,
        totalCount: 4,
        skippedCount: 1,
      },
    ]);
  });
});
