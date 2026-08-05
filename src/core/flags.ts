export type FlagValue = boolean | number | string;

/**
 * Narrative flag registry.
 *
 * Flags are the ONLY channel through which story state reaches engine systems
 * (GERTY line gating, log fragment triggers, ending hooks). Engine code never
 * branches on story *meaning* — only on flag names — so both open narrative
 * questions can resolve either way as pure content edits:
 *
 *  OPEN QUESTION A — GERTY's relationship to the rogue AI.
 *    (a) unrelated companion limited by authority orders, or
 *    (b) shared architectural lineage with the rogue AI.
 *    Reserved flags: `gerty.lineage.*` — nothing reads them except script
 *    content conditions; resolving A means writing lines/fragments, not code.
 *
 *  OPEN QUESTION B — the collaborators' true nature (biological vs AI agents).
 *    The encounter is driven by a data-defined constraint/gesture set
 *    (see src/encounter/) with no biology/AI assumption. Reserved flags:
 *    `collaborator.nature.*`.
 */
export const FLAGS = {
  // meta
  DEV_MODE: 'dev.mode',

  // progression
  INTRO_DONE: 'intro.done',
  /** Landing Zone: the shipyard is gated behind an earned, built Foundry.
   * Unset on a fresh game; BaseSim sets it the moment a Foundry structure
   * finishes construction (Phase 16). Saves that predate this gate are
   * grandfathered in by a one-time main.ts migration. */
  FOUNDRY_BUILT: 'landingZone.foundryBuilt',
  FIRST_SCAN: 'progress.firstScan',
  FIRST_MINE: 'progress.firstMine',
  FIRST_REFINE: 'progress.firstRefine',
  FIRST_BUILD: 'progress.firstBuild',
  ANOMALY_SCANNED: 'progress.anomalyScanned',
  ANOMALY_VISITED: 'progress.anomalyVisited',
  /** Landing Zone mission: the high-grade ore quota has been met (Phase 28/29),
   * firing the one-time accidental-discovery event that reveals a new site */
  QUOTA_MET: 'mission.quotaMet',
  /** the Comms Relay satellite is in orbit — GERTY's orbital role is active (Phase 32) */
  COMMS_ONLINE: 'satellite.commsOnline',
  /** every infrastructure mission objective is met (Phase 35) */
  MISSION_ESTABLISHED: 'mission.established',
  /** the whole mission is complete — greenhouse harvest included (Phase 40) */
  MISSION_COMPLETE: 'mission.complete',
  /** total-wipe game over — the base was lost entirely (Phase 45) */
  GAME_OVER: 'mission.gameOver',
  SIGNAL_SCANNED: 'progress.signalScanned',
  ENCOUNTER_STARTED: 'encounter.started',
  ENCOUNTER_SOLVED: 'encounter.solved',
  ARCHIVE_ENTERED: 'archive.entered',
  CUSTODIAN_SEEN: 'archive.custodianSeen',
  ARCHIVE_TAKEN: 'archive.taken',

  // narrative — settled direction (content still placeholder)
  MISSION_DOUBT: 'narrative.missionDoubt', // player has evidence the briefing was incomplete
  SEED_EVIDENCE: 'narrative.seedEvidence', // found trace of the seed device's work

  // narrative — OPEN QUESTION A (GERTY lineage); reserved, unset in v1
  GERTY_LINEAGE_HINTED: 'gerty.lineage.hinted',
  GERTY_LINEAGE_REVEALED: 'gerty.lineage.revealed',

  // narrative — OPEN QUESTION B (collaborator nature); reserved, unset in v1
  COLLAB_NATURE_HINTED: 'collaborator.nature.hinted',
  COLLAB_NATURE_REVEALED: 'collaborator.nature.revealed',
} as const;

export type KnownFlag = (typeof FLAGS)[keyof typeof FLAGS];
