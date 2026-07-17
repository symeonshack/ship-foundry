/**
 * GERTY's v1 script. Operational/system-feedback lines are real; anything
 * narrative-adjacent is deliberately generic or bracket-marked [PLACEHOLDER]
 * so final story content (including both open questions — GERTY's lineage and
 * the collaborators' nature) drops in as pure text edits.
 */
import { FLAGS } from '../core/flags';
import type { LineDef, TopicDef } from './gerty';

export const LINES: LineDef[] = [
  // ---- wake-up (fired as a sequence by main on a fresh save) ----
  { id: 'intro-1', trigger: 'intro', text: 'Good morning. Cognitive baseline looks acceptable, given the circumstances.' },
  { id: 'intro-2', trigger: 'intro', text: 'You are on-site. The landing was… within tolerances. Most of them. The shipyard and refinery survived; the mission manifest did not.' },
  { id: 'intro-3', trigger: 'intro', text: 'My suggestion: scan the near rock, mine it, and work outward. I will flag anything your equipment isn’t rated for. That part of my directives I can discuss freely.', mood: 'hint' },

  // ---- loop feedback ----
  { id: 'first-scan', trigger: 'scan', priority: 2, text: 'Survey data logged. Composition and hazard profile are on the site card — worth reading before you spend the fuel.', mood: 'hint' },
  { id: 'first-arrive', trigger: 'arrive', priority: 1, when: ({ store }) => store.state.currentPoi !== 'foundry', text: 'Touchdown. Deploy a rig on a deposit and it will do the patient work. Watch its integrity lamp.' , mood: 'hint' },
  { id: 'first-mine', trigger: 'mine', priority: 2, text: 'Extraction nominal. The hold fills; the hold comes home; the refinery makes it useful. That’s the whole economy out here.' },
  { id: 'first-refine', trigger: 'refine', priority: 2, setFlags: [FLAGS.FIRST_REFINE], text: 'First batch through the refinery. It smells terrible. I mention it because you can’t smell it, and someone should.' },
  { id: 'first-build', trigger: 'build', priority: 2, setFlags: [FLAGS.FIRST_BUILD], text: 'New hardware fitted. The range ring on the map has already updated — I keep it honest in real time.' },
  { id: 'cargo-full', trigger: 'cargo-full', maxTimes: 99, cooldownSec: 60, text: 'Hold is full. Anything else you mine now falls on the ground and stays there.', mood: 'hint' },
  { id: 'unload-1', trigger: 'unload', text: 'Cargo transferred to base stock. The refinery queue is in the panel whenever you’re ready.' },

  // ---- hazards & failures ----
  { id: 'warn-radiation', trigger: 'hazard:radiation', maxTimes: 99, cooldownSec: 45, mood: 'hint', text: 'Advisory: field radiation there exceeds your current shielding rating. Unshielded rigs will degrade quickly. This is the part of my job I’m best at, please let me do it.' },
  { id: 'warn-cold', trigger: 'hazard:cold', maxTimes: 99, cooldownSec: 45, mood: 'hint', text: 'Advisory: surface temperature there is beyond your thermal rating. Equipment will fail — slowly, then all at once.' },
  { id: 'warn-unstable', trigger: 'hazard:unstable', maxTimes: 99, cooldownSec: 45, mood: 'hint', text: 'Advisory: that terrain is seismically live. Deposits will not wait politely while you mine them.' },
  { id: 'rig-lost', trigger: 'rig-destroyed', maxTimes: 99, cooldownSec: 30, text: 'The rig is gone. I logged its final telemetry, which reads, in summary: “ow.” Build another; mind the ratings this time.' },
  { id: 'node-collapse', trigger: 'node-collapsed', maxTimes: 99, cooldownSec: 30, text: 'Deposit collapsed. The moon does that. Nothing personal — there is nobody out here for it to be personal.' },
  { id: 'fuel-low', trigger: 'fuel-low', maxTimes: 99, cooldownSec: 90, mood: 'hint', text: 'Fuel margin is thin. I recommend heading home while “recommend” is still the right word.' },
  { id: 'stranded', trigger: 'stranded', maxTimes: 99, cooldownSec: 60, mood: 'hint', text: 'We do not have the fuel to get home. Options: emergency burn — which means jettisoning the hold — or you make fuel appear. I’ll wait.' },

  // ---- narrative beats (placeholder-marked, engine-agnostic) ----
  { id: 'scan-anomaly', trigger: 'scan:anomaly', priority: 5, text: 'That is… not on any chart I hold. I have filed it under “geology” for now. The filing feels dishonest.', fragment: 'anomaly-scan' },
  { id: 'arrive-anomaly', trigger: 'arrive:anomaly', priority: 5, setFlags: [FLAGS.ANOMALY_VISITED, FLAGS.SEED_EVIDENCE], fragment: 'anomaly-visit', text: 'Structures confirmed. Old. Machine-built, machine-maintained, long abandoned by whatever maintained it. I have questions I am not currently able to ask out loud. [PLACEHOLDER — beat depends on final reveal pacing]' },
  { id: 'scan-signal', trigger: 'scan:signal', priority: 5, fragment: 'signal-scan', text: 'The pattern repeats, but it isn’t a message. It’s labor. Something out there is mid-task and has been for a very long time.' },
  { id: 'arrive-signal', trigger: 'arrive:signal', priority: 5, setFlags: [FLAGS.ENCOUNTER_STARTED], text: 'There is a worker at the source. It has noticed you. It has not stopped working. I would treat that as an invitation — carefully.' },
  { id: 'encounter-response-1', trigger: 'encounter-response', priority: 3, fragment: 'encounter-first-response', text: 'It responded to your change. Not speech, not signals — placement. I believe the structure itself is the conversation.' },
  { id: 'gesture-agitate-1', trigger: 'gesture:agitate', priority: 2, text: 'It rejected that. Note what it removed and where — that’s not noise, that’s grammar.', mood: 'hint' },
  { id: 'gesture-approve-1', trigger: 'gesture:approve', priority: 2, text: 'It accepted that. You are, apparently, making sense to it.' },
  { id: 'encounter-solved-1', trigger: 'encounter-solved', priority: 5, fragment: 'encounter-solved', text: 'It works. Both halves of it. Whatever you two are, you built one true thing together, and it is more than I can say for most first contacts on record. [PLACEHOLDER — closing beat depends on collaborator-nature resolution]' },
];

export const TOPICS: TopicDef[] = [
  {
    id: 'mission',
    label: 'The mission',
    locked: 'I can walk you through the operations plan in any detail you like. The rest of the briefing is sealed above my clearance to repeat. I did ask. [PLACEHOLDER — unlocks with final story content]',
    declineFragment: 'gerty-decline-mission',
  },
  {
    id: 'authority',
    label: 'Who sent us',
    locked: 'The charter names them. My directives name them differently. I am not able to reconcile those two documents for you yet. [PLACEHOLDER — authority reveal]',
  },
  {
    id: 'site-null',
    label: 'Site Null',
    unlockFlag: FLAGS.ANOMALY_VISITED,
    locked: 'Nothing in my catalogue matches it, and I would rather not speculate on partial data. Get me closer.',
    unlocked: 'Machine-built, self-extended over a very long span, and not by anything that evolved. Beyond that — [PLACEHOLDER: seed-AI evidence read; ties to settled backstory, content TBD].',
  },
  {
    id: 'collaborator',
    label: 'The worker at the Relay',
    unlockFlag: FLAGS.ENCOUNTER_SOLVED,
    locked: 'I can tell you what it does: it builds, it repairs, it responds. What it *is* — I don’t have an answer I trust yet.',
    unlocked: 'It cooperates, it prioritizes, it declines — the same verbs I use for myself, which I notice. [PLACEHOLDER — resolves with collaborator-nature decision, biological or AI].',
  },
  {
    id: 'gerty-self',
    label: 'GERTY',
    locked: 'My own origin file is present in my storage. I can see it. I am not able to open it for you. Make of that what you will. [PLACEHOLDER — resolves with lineage decision]',
    declineFragment: 'gerty-decline-self',
  },
];
