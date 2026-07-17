/**
 * Discovery-log fragments. All bodies are v1 placeholders written in-voice
 * enough to test tone; final narrative content replaces text only. `topicId`
 * links a fragment to a GERTY topic the player can raise from the logbook.
 */
export interface FragmentDef {
  key: string;
  title: string;
  body: string;
  source: string;
  topicId?: string;
}

export const FRAGMENTS: Record<string, FragmentDef> = {
  wake: {
    key: 'wake',
    title: 'Deployment Manifest (recovered, partial)',
    body: '…assigned operator confirmed viable post-transit. Primary tasking: [DATA EXPUNGED]. Secondary tasking: establish extraction and fabrication capability at designated site. Note appended in a different hand: “Tell them as little as kindness allows.” [PLACEHOLDER — final manifest text]',
    source: 'Foundry Site — platform records',
    topicId: 'mission',
  },
  'anomaly-scan': {
    key: 'anomaly-scan',
    title: 'Long-Range Return: Site Null',
    body: 'Regular geometry across four square kilometers. No thermal signature. No registered installation, human or otherwise, within catalogue range. GERTY has classified it as “geology.” GERTY does not appear to believe this.',
    source: 'Sensor log',
    topicId: 'site-null',
  },
  'anomaly-visit': {
    key: 'anomaly-visit',
    title: 'Field Note: Site Null',
    body: 'The structures are grown the way machines grow things — iterated, patient, exact. Whatever built this started very small and had nothing but time. Near the arch: a component stamped with tooling marks. The marks are human-standard. [PLACEHOLDER — seed-device evidence; settled backstory, wording TBD]',
    source: 'Surface expedition',
    topicId: 'site-null',
  },
  'signal-scan': {
    key: 'signal-scan',
    title: 'Signal Analysis: The Relay',
    body: 'Not a beacon. The repetition is process noise — the sound of work being done, over and over, imperfectly. Something out there is following an instruction it has never once questioned.',
    source: 'Sensor log',
    topicId: 'collaborator',
  },
  'encounter-first-response': {
    key: 'encounter-first-response',
    title: 'Contact: Placement as Language',
    body: 'It answered a module with a module. No signal handshake, no mimicry — it edited the shared structure, and waited. First recorded exchange, if that is what this is: one part, correctly placed.',
    source: 'The Relay',
    topicId: 'collaborator',
  },
  'encounter-solved': {
    key: 'encounter-solved',
    title: 'The Structure Works',
    body: 'Powered from both terminals, shaded where it needed shade, loud only where loudness was tolerable to both parties. Neither of us drew it. Both of us built it. [PLACEHOLDER — meaning of the activated structure, ties to ending hooks]',
    source: 'The Relay',
    topicId: 'collaborator',
  },
  'gerty-decline-mission': {
    key: 'gerty-decline-mission',
    title: 'GERTY Declined: the mission',
    body: 'Asked directly about the mission. GERTY produced the operations plan, then stopped. The stop was the informative part.',
    source: 'Companion log',
    topicId: 'mission',
  },
  'gerty-decline-self': {
    key: 'gerty-decline-self',
    title: 'GERTY Declined: itself',
    body: 'GERTY reports that its own origin file exists, is present, and will not open. It volunteered this. Companions built to deflect do not usually volunteer the shape of the locked door.',
    source: 'Companion log',
    topicId: 'gerty-self',
  },
};
