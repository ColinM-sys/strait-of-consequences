// Five preset transit routes through the Strait of Hormuz.
// Each route has a polyline + an IRGC engagement profile that sets aggressiveness.
const TRANSIT_ROUTES = [
  {
    id: 'tss',
    name: 'TSS LANE',
    color: '#88ccff',
    summary: 'Westbound traffic separation scheme — south of Larak Island. Standard commercial route. Low IRGC engagement.',
    redProfile: { facEngagementKm: 8, missileChance: 0.05, swarmSpawn: false, deltas:{ warRiskInsurance:+0, oilPrice:+0 } },
    path: [
      [24.50, 60.00],
      [25.20, 58.20],
      [25.80, 57.20],
      [26.20, 56.60],
      [26.45, 56.20],
      [26.50, 55.30],
      [26.40, 54.20],
      [26.20, 53.20],
      [26.30, 52.40],
    ],
  },
  {
    id: 'northern',
    name: 'NORTHERN PUSH',
    color: '#ff6666',
    summary: 'Aggressive route close to Iranian coast. Cuts ~80nm but enters IRGC engagement envelope. FAC swarm probable.',
    redProfile: { facEngagementKm: 25, missileChance: 0.35, swarmSpawn: true, deltas:{ warRiskInsurance:+45, iranCoercion:+5, escalationRung:+1 } },
    path: [
      [24.637, 59.821],
      [25.195, 58.381],
      [25.582, 57.546],
      [25.958, 56.997],
      [26.579, 56.821],
      [26.687, 56.305],
      [26.628, 55.876],
      [26.480, 55.305],
      [26.303, 54.503],
      [26.284, 53.394],
      [26.303, 52.526],
    ],
  },
  {
    id: 'omani',
    name: 'OMANI HUG',
    color: '#66ff99',
    summary: 'Stays in Omani territorial water. Longest route. IRGC will not engage in Omani waters. Insurance unaffected.',
    redProfile: { facEngagementKm: 0, missileChance: 0, swarmSpawn: false, deltas:{ warRiskInsurance:-15, allianceCohesion:+2 } },
    path: [
      [24.117, 60.172],
      [24.357, 59.271],
      [24.807, 57.909],
      [25.423, 56.722],
      [25.800, 56.470],
      [26.313, 56.580],
      [26.244, 55.964],
      [25.830, 54.998],
      [25.493, 53.503],
      [25.642, 52.471],
      [26.293, 51.987],
    ],
  },
  {
    id: 'highspeed',
    name: 'HIGH-SPEED RUN',
    color: '#ffaa44',
    summary: 'Formation moves 2× speed. Reduced ISR. Mines harder to sweep. Higher random-hit probability.',
    redProfile: { facEngagementKm: 12, missileChance: 0.20, swarmSpawn: false, mineHitChance: 0.35, deltas:{ warRiskInsurance:+25, oilPrice:+2 } },
    path: [
      [24.50, 60.00],
      [25.30, 58.00],
      [25.95, 56.95],
      [26.35, 56.30],
      [26.50, 55.40],
      [26.45, 54.40],
      [26.30, 53.30],
      [26.30, 52.40],
    ],
  },
  {
    id: 'night',
    name: 'NIGHT TRANSIT',
    color: '#aa66ff',
    summary: 'Reduced IRGC ISR coverage. 1-2 FACs may engage from rear (long trail intercept). Insurance moderately reduced.',
    redProfile: { facEngagementKm: 14, missileChance: 0.10, swarmSpawn: false, rearIntercept: true, deltas:{ warRiskInsurance:-5, attributionConfidence:-3 } },
    path: [
      [24.40, 60.10],
      [25.10, 58.40],
      [25.75, 57.30],
      [26.15, 56.65],
      [26.40, 56.25],
      [26.45, 55.40],
      [26.35, 54.30],
      [26.20, 53.30],
      [26.30, 52.40],
    ],
  },
];

if (typeof window !== 'undefined') {
  window.TRANSIT_ROUTES = TRANSIT_ROUTES;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRANSIT_ROUTES };
}
