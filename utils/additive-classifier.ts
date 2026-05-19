/**
 * Additive classifier — splits E-numbers into three groups:
 *   harmful      — documented health concerns (red)
 *   preservatives — functional antimicrobials / acidity regulators (blue)
 *   safe         — well-established or unclassified, defaulting to safer bucket (orange)
 *
 * Sources: EFSA opinions, EU Regulation 1333/2008, WHO assessments,
 * bans/restrictions in major food-safety jurisdictions (EU, US, UK, Canada, AU).
 */

const HARMFUL: ReadonlySet<string> = new Set([
  // Artificial azo dyes — EU requires "may affect activity and attention in children" warning
  'E102', 'E104', 'E110', 'E122', 'E123', 'E124', 'E128', 'E129',
  'E131', 'E132', 'E133', 'E142', 'E151', 'E154', 'E155', 'E180',

  // Caramel colours (ammonia/sulphite process) — contain 4-methylimidazole (possible carcinogen)
  'E150C', 'E150D',

  // Titanium dioxide — banned in EU food since 2022; genotoxic potential
  'E171',

  // Sodium benzoate — reacts with Vit C to form benzene; linked to hyperactivity
  'E211',

  // Sulphites — can trigger asthma; restricted for vulnerable groups in most jurisdictions
  'E220', 'E221', 'E222', 'E223', 'E224', 'E225', 'E226', 'E227', 'E228',

  // Nitrites & nitrates — associated with colorectal cancer risk (WHO Group 2A)
  'E249', 'E250', 'E251', 'E252',

  // Gallates — associated with allergic reactions and contact dermatitis
  'E310', 'E311', 'E312',

  // TBHQ, BHA, BHT — possible carcinogens; restricted or banned in several countries
  'E319', 'E320', 'E321',

  // Carrageenan — associated with GI inflammation and ulceration at high intake
  'E407',

  // Potassium bromate — banned in EU, Canada, China, UK; possible carcinogen
  'E924',

  // High-intensity sweeteners with ongoing regulatory scrutiny
  'E950', // Acesulfame K
  'E951', // Aspartame — WHO IARC Group 2B possible carcinogen (2023)
  'E952', // Cyclamates — banned in the US
  'E954', // Saccharin

  // Brominated vegetable oil — linked to organ damage at sustained doses
  'E443',
]);

/**
 * Preservatives — antimicrobial agents and acidity regulators (E200–E299)
 * not already classified as harmful. They extend shelf life but are not
 * considered health hazards at permitted levels in most jurisdictions.
 */
const PRESERVATIVES: ReadonlySet<string> = new Set([
  // Sorbic acid & sorbates — widely considered safe
  'E200', 'E202', 'E203',
  // Benzoic acid & benzoates (E211 is harmful; these are the milder salts)
  'E210', 'E212', 'E213',
  // Surface-treatment preservatives for citrus (restricted use)
  'E230', 'E231', 'E232',
  // Natural antimicrobials
  'E234', // Nisin
  'E235', // Natamycin
  // Other antimicrobials
  'E239', 'E242',
  // Acetic acid & acetates (vinegar family)
  'E260', 'E261', 'E262', 'E263',
  // Lactic acid
  'E270',
  // Propionic acid & propionates (bread preservatives)
  'E280', 'E281', 'E282', 'E283',
  // Carbon dioxide
  'E290',
  // Malic acid & fumaric acid
  'E296', 'E297',
]);

export interface AdditiveGroups {
  harmful: string[];
  preservatives: string[];
  safe: string[];
}

/** Split E-number strings into harmful, preservative, and generally-safe groups. */
export function classifyAdditives(additives: string[]): AdditiveGroups {
  const harmful: string[] = [];
  const preservatives: string[] = [];
  const safe: string[] = [];
  for (const e of additives) {
    if (HARMFUL.has(e)) harmful.push(e);
    else if (PRESERVATIVES.has(e)) preservatives.push(e);
    else safe.push(e);
  }
  return { harmful, preservatives, safe };
}

/**
 * Score modifier based on additive classification.
 *
 * Harmful:      –4 each, capped at –15
 * Preservatives: –1 each, capped at –4   (functional, not benign but not dangerous)
 * Safe:          –0.5 each, capped at –2
 * Total max:    –21
 */
export function computeAdditiveModifier(harmful: string[], preservatives: string[], safe: string[]): number {
  const harmfulPenalty       = Math.min(harmful.length * 4, 15);
  const preservativePenalty  = Math.min(preservatives.length * 1, 4);
  const safePenalty          = Math.min(safe.length * 0.5, 2);
  return -(harmfulPenalty + preservativePenalty + safePenalty);
}
