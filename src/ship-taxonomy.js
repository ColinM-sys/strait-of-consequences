const ACTOR_CATEGORIES = [
  { id:1,  name:'U.S. military vessel',
    consequences:'Military escalation, U.S. domestic pressure',
    redCell:'Maximum pressure on U.S. deterrence',
    blueCell:'Immediate national-security crisis' },
  { id:2,  name:'Allied / coalition military vessel',
    consequences:'Alliance credibility, coalition cohesion',
    redCell:'Way to fracture or test coalition resolve',
    blueCell:'Alliance credibility test' },
  { id:3,  name:'Coalition support / logistics vessel',
    consequences:'Sustainment pressure, escalation ambiguity',
    redCell:'Lower-threshold attack on Blue sustainment',
    blueCell:'Operational and escalation concern' },
  { id:4,  name:'Saudi crude tanker',
    consequences:'Oil-price shock, U.S.-Saudi coordination',
    redCell:'Oil-price shock and pressure on Riyadh',
    blueCell:'Energy and Gulf-partner crisis' },
  { id:5,  name:'UAE crude or refined-products tanker',
    consequences:'Fuel-price shock, logistics disruption',
    redCell:'Fuel-market and UAE pressure point',
    blueCell:'Refined-fuel and logistics concern' },
  { id:6,  name:'Qatari LNG carrier',
    consequences:'LNG-price shock, Qatar reassurance',
    redCell:'LNG-market disruption and Qatar pressure',
    blueCell:'Gas-market and ally reassurance issue' },
  { id:7,  name:'Kuwaiti / Iraqi oil tanker',
    consequences:'Oil supply shock, Iraq/Kuwait security pressure',
    redCell:'Regional oil instability',
    blueCell:'Northern Gulf export-security issue' },
  { id:8,  name:'Chinese-owned or China-bound tanker',
    consequences:'U.S.-China-Iran diplomacy, attribution sensitivity',
    redCell:'Way to pull China into crisis politics',
    blueCell:'High-risk diplomatic attribution problem' },
  { id:9,  name:'Indian-owned or India-bound tanker',
    consequences:'India pressure, coalition-framing challenge',
    redCell:'Way to pressure non-aligned importers',
    blueCell:'India crisis-management challenge' },
  { id:10, name:'Japanese / South Korean energy vessel',
    consequences:'U.S. alliance reassurance, LNG/oil concern',
    redCell:'Indirect pressure on U.S. treaty allies',
    blueCell:'Japan / Korea reassurance problem' },
  { id:11, name:'European commercial vessel',
    consequences:'NATO/EU cohesion, insurance shock',
    redCell:'European coalition-fracture target',
    blueCell:'EU / NATO political coordination issue' },
  { id:12, name:'Neutral-flag commercial tanker',
    consequences:'Attribution ambiguity, insurance shock',
    redCell:'Broad commercial fear generator',
    blueCell:'Shipping-confidence and insurance issue' },
  { id:13, name:'Global container ship',
    consequences:'Supply-chain disruption, freight-rate shock',
    redCell:'Supply-chain disruption lever',
    blueCell:'Inflation and freight-rate concern' },
  { id:14, name:'Humanitarian / food / medical cargo vessel',
    consequences:'Legitimacy crisis, UN pressure',
    redCell:'Spoiler or false-flag opportunity',
    blueCell:'Humanitarian legitimacy crisis' },
  { id:15, name:'Omani coastal / service vessel',
    consequences:'Mediation-channel risk, de-escalation pressure',
    redCell:'Mediation-channel spoiler',
    blueCell:'Oman / de-escalation-channel priority' },
  { id:16, name:'Port, tug, pilot, or maritime-service vessel',
    consequences:'Port disruption, shipping confidence loss',
    redCell:'Low-visibility way to disrupt shipping',
    blueCell:'Port-function and transit-confidence issue' },
  { id:17, name:'Energy-infrastructure support vessel',
    consequences:'Infrastructure-risk perception, market fear',
    redCell:'Infrastructure-risk signal',
    blueCell:'Energy-system resilience concern' },
  { id:18, name:'Insurer-sensitive high-value commercial vessel',
    consequences:'War-risk premium spike, shipping slowdown',
    redCell:'Insurance-market shock lever',
    blueCell:'War-risk premium crisis' },
  { id:19, name:'Ambiguous ownership / flag-of-convenience vessel',
    consequences:'Attribution confusion, disinformation opportunity',
    redCell:'Attribution fog generator',
    blueCell:'Intelligence and messaging challenge' },
  { id:20, name:'Media-symbolic civilian vessel',
    consequences:'Information-war shock, public outrage',
    redCell:'Information-war amplifier',
    blueCell:'Public-opinion and media-management crisis' },
];

function getCategory(id) {
  return ACTOR_CATEGORIES.find(c => c.id === id);
}

// US priority for ensuring safe passage (0-100). Higher = US has stronger
// economic / strategic / treaty-ally interest in this ship transiting freely.
// Used by ship sidebar to surface "should the convoy escort this one first?"
const US_PRIORITY_BY_CATEGORY = {
   1: { score: 100, why: 'US Navy / US-flagged force-protection asset. Maximum priority — domestic political + strategic.' },
   2: { score:  95, why: 'NATO/treaty-ally military vessel. Coalition credibility; mutual-defense obligations.' },
   3: { score:  92, why: 'Coalition logistics/sustainment. Sustains Blue forward posture in theater.' },
   4: { score:  72, why: 'Saudi crude. Aramco supply stability matters for global oil price floor; Saudi is energy-security partner.' },
   5: { score:  76, why: 'UAE refined products. UAE is treaty partner; refined-fuel chains matter for Gulf bases.' },
   6: { score:  82, why: 'Qatari LNG. Qatar hosts Al Udeid; Asian LNG market stability is top US economic priority.' },
   7: { score:  68, why: 'Kuwait/Iraq oil. Iraqi revenue feeds counter-ISIS partnership; Kuwait is treaty partner.' },
   8: { score:  28, why: 'China-bound tanker. Limited US interest in ensuring China gets cheap oil; partial diplomatic leverage by allowing/restricting.' },
   9: { score:  62, why: 'India-bound. India is QUAD partner but non-aligned on Iran. Moderate priority.' },
  10: { score:  90, why: 'Japan/Korea energy. Both are US treaty allies; LNG/oil security is alliance commitment.' },
  11: { score:  78, why: 'European commercial. NATO ally cargo; insurance + supply-chain stability.' },
  12: { score:  52, why: 'Neutral commercial. Standard freedom-of-navigation interest; not high-priority.' },
  13: { score:  66, why: 'Container ship. Supply-chain inflation pass-through; moderate US consumer impact.' },
  14: { score:  90, why: 'Humanitarian / aid. Strong US legitimacy interest — UN obligations, public messaging.' },
  15: { score:  72, why: 'Omani vessel. Oman is mediation-channel host; preserve relationship.' },
  16: { score:  56, why: 'Port service. Disruption affects shipping confidence; moderate priority.' },
  17: { score:  72, why: 'Energy infrastructure support. Critical for restoring offshore platform/pipeline operations.' },
  18: { score:  58, why: 'Insurance-sensitive high-value. Loss spikes Lloyd\'s premiums — affects ALL strait transits.' },
  19: { score:  32, why: 'Flag-of-convenience / ambiguous ownership. Often Iran-linked; limited US interest in protection.' },
  20: { score:  62, why: 'Media-symbolic civilian. Loss = information-war cost; moderate priority.' },
};
function getUsPriority(actorCategory) {
  return US_PRIORITY_BY_CATEGORY[actorCategory] || { score: 50, why: 'Unknown category — default mid-priority.' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ACTOR_CATEGORIES, getCategory, US_PRIORITY_BY_CATEGORY, getUsPriority };
}
if (typeof window !== 'undefined') {
  window.ACTOR_CATEGORIES = ACTOR_CATEGORIES;
  window.getCategory = getCategory;
  window.US_PRIORITY_BY_CATEGORY = US_PRIORITY_BY_CATEGORY;
  window.getUsPriority = getUsPriority;
}
