# Operation Site #1 — Template

This is the concrete, mechanics-only design target for the first buildable operation map. It uses a placeholder identity (no story weight) so it can be built now and reskinned once the story locks later, without touching any underlying system. It's meant to be the reference pattern future maps follow — not a one-off.

## Identity (placeholder — reskin later)

- **Working name:** Site Designate: Ashcroft-1 (placeholder only)
- **Site type:** Operation site (Tier 2)
- **Setting:** a small rocky/icy moon with a thin-to-absent atmosphere — chosen specifically because it's a natural, unforced reason for solar exposure to be a real threat (see Threat, below).

## Goal — Resource Quota

- **Target resource:** high-grade ore deposit — a richer, harder-to-reach vein of ordinary material (metal-tier, not exotic), gated by depth/hazard rather than rarity of substance. Framed as "a better vein of what you already know how to mine," not something mysterious — consistent with the early-game rule that nothing exotic appears until the player has actual evidence of intelligence in the system.
- **Secondary/support resources:** metal + ceramic (grind-tier, already implemented) are also present on-site, used for building the operation's own structures rather than as the quota target.
- **Win condition:** extract the target quantity of high-grade ore and successfully extract/return with it before the environmental threat forces evacuation.
- **Fail/partial condition:** if the flare hits before quota is met, operation ends — banked partial resources are kept, quota reward is not.

*(Proposed default — adjust the target resource or quantity if you want something different; nothing below depends on the specific resource chosen, just on there being one clear quota target.)*

## Threat — Environmental Escalation

- **Type:** incoming solar flare, consistent with the site's thin atmosphere.
- **Behavior:** not known at operation start — scanning gives the site's baseline hazard profile only. Partway through the operation, a warning triggers with a countdown (e.g., "flare in 6 minutes").
- **Consequence if caught by it:** forced evacuation, any unbanked resources lost, no permanent damage/death — consistent with the no-combat, no-lethal-stakes rule.
- **Player response options:** rush to finish the quota, evacuate early with partial resources, or (later feature, not this map) temporary hardening.

## Structures & Units In Scope For This Map

Deliberately bounded to what a resource-quota + environmental-threat site actually needs — not every system from the full mining spec:

- Mining rig(s) — target the rare crystal deposit(s).
- Refinery module — process crystals on-site.
- Storage silo — buffer against the rushed-evacuation pressure.
- Power relay — basic supply cap, even at small scale.
- Fabrication structure — producing worker and hauler drones only for this first map (scout/repair/decoy/hero units aren't needed here — no fog-of-war-critical exploration and no agent threat on this map).

**Explicitly not needed for this map:** excavator, synthesizer, jammer/decoy, repair station/drones, hero units, agent-personality systems. Those get their own template maps later, each exercising the systems relevant to them.

## Resource Output → Foundry/Ship Mapping

**General framework** (applies beyond just this site):
- **Grind-tier resources** (metal, ceramic, fuel, electronics) → baseline ship parts and baseline base structures (already implemented for ship parts; base structures are part of the phased build).
- **Operation-tier rare resources** (rare crystals, exotic gases, isotopes, salvage) → top-tier ship parts and top-tier base structures — the things that make the ship/base meaningfully better, not just bigger.
- **Ancient-tech resources** (computational, energy, tool artifacts) → GERTY upgrades, new blueprints/tool unlocks, and (energy specifically) fuel for the synthesizer.

**Concrete mapping for Site #1's output:**
- High-grade ore (quota target) → unlocks a top-tier ship part category (proposed default: advanced hull plating or an upgraded sensor array — pick whichever you want this site to be "known for" once you reskin it).
- Metal/ceramic surplus (whatever's left after on-site structure costs) → feeds normal ship-part and base-structure construction back at the foundry, same as today.

*(This mapping is deliberately concrete for Site #1 so Claude Code has a real target — expand the general framework's specificity as more sites get built.)*
