/**
 * GERTY's v1 script. Operational/system-feedback lines are real; anything
 * narrative-adjacent is deliberately generic or bracket-marked [PLACEHOLDER]
 * so final story content (including both open questions — GERTY's lineage and
 * the collaborators' nature) drops in as pure text edits.
 */
import { FLAGS } from '../core/flags';
import { deriveStats } from '../building/shipStats';
import type { LineDef, TopicDef } from './gerty';

export const LINES: LineDef[] = [
  // ---- wake-up (fired as a sequence by main on a fresh save) ----
  { id: 'intro-1', trigger: 'intro', text: 'Good morning. Cognitive baseline looks acceptable, given the circumstances.' },
  { id: 'intro-2', trigger: 'intro', text: 'You are on-site. The landing was… within tolerances. Most of them. The shipyard and refinery survived; the mission manifest did not.' },
  { id: 'intro-3', trigger: 'intro', text: 'My suggestion: scan the near rock, mine it, and work outward. I will flag anything your equipment isn’t rated for. That part of my directives I can discuss freely.', mood: 'hint' },

  // ---- loop feedback ----
  { id: 'first-scan', trigger: 'scan', priority: 2, text: 'Survey data logged. Composition and hazard profile are on the site card — worth reading before you spend the fuel.', mood: 'hint' },
  { id: 'first-arrive', trigger: 'arrive', priority: 1, when: ({ store }) => store.state.currentPoi !== 'foundry', text: 'Touchdown. Deploy a rig on a deposit and it will do the patient work. Watch its integrity lamp.' , mood: 'hint' },
  { id: 'ice-hint', trigger: 'arrive:nearRock', priority: 3, mood: 'hint', when: ({ store }) => deriveStats(store.state.ship).rigCounts.cryo === 0, text: 'There is water ice in the shadowed seams here. Ice becomes fuel, once the refinery has its way with it. A cryo rig would pay for itself in two trips — I mention it because fuel anxiety is bad for your vitals.' },
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
  { id: 'flare-warning', trigger: 'flare-warning', maxTimes: 99, cooldownSec: 20, mood: 'hint', text: 'Solar flare inbound. Anything standing unshielded is about to feel it. An EM Shield turns a flare aside completely — worth building before the next one.' },
  { id: 'flare-strike', trigger: 'flare-strike', maxTimes: 99, cooldownSec: 20, text: 'Flare impact logged. Structural damage across the site — nothing fatal this time. Repair when you can afford to; shield before the next.' },
  { id: 'flare-miss', trigger: 'flare-miss', maxTimes: 99, cooldownSec: 20, mood: 'hint', text: 'Flare deflected — the EM Shield earned its keep. That is what hardening looks like.' },
  { id: 'storm-warning', trigger: 'storm-warning', maxTimes: 99, cooldownSec: 20, mood: 'hint', text: 'Dust storm building on the sensors. Different beast from a flare — it will black out the solar arrays and grind on anything unhardened. A Storm Shield is the answer, not the EM one.' },
  { id: 'storm-strike', trigger: 'storm-strike', maxTimes: 99, cooldownSec: 20, text: 'Storm front hit. Damage logged and the arrays are dark until the dust settles. This is the moment a nuclear generator stops being optional.' },
  { id: 'storm-miss', trigger: 'storm-miss', maxTimes: 99, cooldownSec: 20, mood: 'hint', text: 'Storm rolled through, shielded. Still no solar until it clears — but nothing broke. Good.' },
  { id: 'mission-discovery', trigger: 'mission-discovery', priority: 5, mood: 'hint', setFlags: [FLAGS.MISSION_DOUBT], text: 'The high-grade ore just told me something the briefing did not. There is a signature in it that traces to a location nobody handed us coordinates for. I have logged it. I would very much like to know who left it off the chart. [PLACEHOLDER — discovery beat]' },

  // ---- satellite array (Phase 31-34) ----
  { id: 'sat-comms', trigger: 'satellite:comms', priority: 4, mood: 'hint', text: 'Comms relay is in orbit — and so, functionally, am I now. I can watch the base while you are elsewhere and it will keep running. This is the version of me the briefing actually paid for.' },
  { id: 'sat-weather', trigger: 'satellite:weather', priority: 4, mood: 'hint', text: 'Weather satellite online. I will see flares and storms coming with real lead time now, not a panicked half-minute. Build accordingly — the warnings just got useful.' },
  { id: 'sat-survey', trigger: 'satellite:survey', priority: 4, mood: 'hint', text: 'Survey satellite mapping the system. Points of interest are populating the star chart without you spending a drop of fuel to find them. Some of them I do not recognise. Some of them I think I do.' },
  { id: 'mission-established', trigger: 'mission-established', priority: 6, text: 'That is the operation established: self-sufficient, hardened against both skies, quota met, the array overhead, and a location on the chart that should not exist. The camp is a foothold now. One thing left — the crew has to eat.' },

  // ---- food & greenhouse (Phase 36-40) ----
  { id: 'food-low', trigger: 'food-low', maxTimes: 99, cooldownSec: 60, mood: 'hint', text: 'Food stores are running low. The chain is soil processor to growing medium to greenhouse — build it and keep it fed with regolith and water, or this becomes the problem that ends the others.' },
  { id: 'food-harvest', trigger: 'food-harvest', maxTimes: 3, cooldownSec: 45, text: 'First harvest in. The greenhouse will replant itself as long as it has medium and irrigation. Real food, grown here. I find that disproportionately reassuring.' },
  { id: 'food-contaminated', trigger: 'food-contaminated', maxTimes: 99, cooldownSec: 45, mood: 'hint', text: 'Lost that crop to contamination — the greenhouse is damaged and the seal is compromised. Repair it and the next one should take.' },
  { id: 'mission-complete-full', trigger: 'mission-complete-full', priority: 7, text: 'Every box on the manifest is ticked, including the one about staying alive. The Landing Zone is fully established — powered, fed, hardened, surveyed, self-running. This was the mission they gave us. The one they did not is still out there, off the chart. Ready when you are. [PLACEHOLDER — arc-complete beat]' },

  // ---- garrison & failure (Phase 44/45) ----
  { id: 'drone-lost', trigger: 'drone-lost', maxTimes: 99, cooldownSec: 30, mood: 'hint', text: 'Lost drones out in the open when that hit. When a warning goes up, shelter them — a drone inside a structure rides it out. Cheaper than replacing them.' },
  { id: 'game-over', trigger: 'game-over', priority: 9, text: 'That is everything. No power, nothing standing, and no food. I have kept the checkpoints — roll back to one and we try again from a better moment. I am not built to say this gently, so: we lost. Reload.' },

  // ---- flight ----
  { id: 'first-flight', trigger: 'flight', priority: 2, mood: 'hint', text: 'You have the stick. Drift is your own cargo arrangement talking back — counter it, and mind the throttle. I’ll handle everything except the flying.' },
  { id: 'hard-landing-1', trigger: 'hard-landing', maxTimes: 99, cooldownSec: 30, text: 'Logged as a “firm arrival.” The landing gear disagrees with my phrasing. Hold the retro-burn earlier next time.' },

  // ---- the Archive (Phase 4; custodian nature stays inside the open question — data only) ----
  { id: 'structure-enter', trigger: 'structure-enter', priority: 4, text: 'Interior atmosphere is stale but breathable. Something in here still draws power on a maintenance duty cycle. I would treat everything in this place as owned.' },
  { id: 'custodian-seen', trigger: 'custodian-seen', priority: 5, setFlags: [FLAGS.CUSTODIAN_SEEN, FLAGS.COLLAB_NATURE_HINTED], mood: 'hint', text: 'That unit’s directive is not cooperation — look at what it positions itself between you and. It isn’t angry. It’s thorough. Note what it protects and think about what its orders literally say.' },
  { id: 'custodian-shoved', trigger: 'custodian-shoved', maxTimes: 99, cooldownSec: 25, text: 'Escorted out, firmly, and — note — undamaged. It has rules. Rules can be read. Rules can be satisfied to the letter.' },
  { id: 'custodian-attend', trigger: 'custodian-attend', priority: 4, mood: 'hint', text: 'It dropped everything for the preservation cycle. Of course it did — that IS its job. The archive is currently better protected than you are observed.' },
  { id: 'archive-taken', trigger: 'archive-taken', priority: 5, text: 'You didn’t break a single rule it could parse. I am filing that under “diplomacy.” The fragment is aboard-listed; the unit has gone still. Its directive is complete. I keep re-reading that sentence. [PLACEHOLDER — beat ties to seed-AI reveal]' },

  // ---- meta ----
  { id: 'dev-mode', trigger: 'dev-mode', maxTimes: 99, cooldownSec: 10, text: 'Developer override accepted. Stock replenished, tank sealed full, survey archives unlocked. I saw nothing, and I will be logging that I saw nothing.' },

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
