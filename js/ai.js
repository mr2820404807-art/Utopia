// ===== AI 决策：招募、建设、进攻、防御、扩张宣战 =====
// 乌托邦 · 一期改造
import { nameHash, GOV_TYPES } from './data.js';
import {
  armies, nations, wars, provinceData, provinceAdj, gameCtx, getRelation, hasTruce,
  onDay, UI,
} from './state.js';
import { nationPower, totalTroops } from './nations.js';
import { isAtWar, warsOf, declareWar } from './diplomacy.js';

const RECRUIT_COST_GOLD = 20, RECRUIT_COST_MP = 500, RECRUIT_TROOPS = 500;

function absDay(today) { return today.y * 360 + today.m * 30 + today.d; }

// 我方在某省可调动的部队（不含已被战斗占用的）
function stackAt(prov, owner) {
  const a = armies[prov];
  return a && a.owner === owner ? a.troops : 0;
}

// 找出与敌国接壤的己方省份
function frontProvinces(n) {
  const out = [];
  for (const p of n.provinces) {
    const adj = provinceAdj[p];
    if (!adj) continue;
    for (const q of adj) {
      const o = window.__territoryOwner[q];
      if (o && o !== n.name && isAtWar(n.name, o)) { out.push(p); break; }
    }
  }
  return out;
}

// 敌方薄弱的相邻目标省
function findTargets(n) {
  const out = [];
  for (const p of n.provinces) {
    const adj = provinceAdj[p];
    if (!adj) continue;
    const myForce = stackAt(p, n.name);
    if (myForce < 800) continue;
    for (const q of adj) {
      const o = window.__territoryOwner[q];
      if (!o || o === n.name || !isAtWar(n.name, o)) continue;
      const def = armies[q];
      const defTroops = def && def.owner === o ? def.troops : 0;
      if (myForce > defTroops * 1.6 + 300) out.push({ from: p, to: q, defTroops, myForce });
    }
  }
  return out;
}

// 邻国集合（和平期扩张用）
function neighborCountries(n) {
  const set = new Set();
  for (const p of n.provinces) {
    const adj = provinceAdj[p];
    if (!adj) continue;
    for (const q of adj) {
      const o = window.__territoryOwner[q];
      if (o && o !== n.name) set.add(o);
    }
  }
  return [...set];
}

function aiRecruit(n) {
  const target = Math.min(30000, Math.round(Math.sqrt(n.population) * 0.8) + (warsOf(n.name).length ? 8000 : 0));
  if (totalTroops(n.name) >= target) return;
  if (n.gold < RECRUIT_COST_GOLD + 100 || n.manpower < RECRUIT_COST_MP) return;
  // 一次最多招 3 支
  for (let i = 0; i < 3; i++) {
    if (n.gold < RECRUIT_COST_GOLD + 100 || n.manpower < RECRUIT_COST_MP) break;
    const g = armies[n.capital];
    n.gold -= RECRUIT_COST_GOLD; n.manpower -= RECRUIT_COST_MP;
    if (g && g.owner === n.name) g.troops += RECRUIT_TROOPS;
    else armies[n.capital] = { owner: n.name, troops: RECRUIT_TROOPS };
  }
  const g = armies[n.capital];
  if (g) UI.updateArmyMarker(n.capital, g.troops, n.name);
}

function aiBuild(n) {
  if (n.gold < 400 || !n.provinces.size) return;
  // 抽一个省份升一级便宜建筑（AI 简化为立即生效，付 1.5 倍价）
  const list = [...n.provinces];
  const p = list[nameHash(n.name + 'b' + absDayCache) % list.length];
  const pd = provinceData[p];
  if (!pd) return;
  const choices = [['farmLv', 30], ['infraLv', 75], ['roadLv', 45], ['barrackLv', 90]];
  const [key, cost] = choices[nameHash(p + n.name) % 4];
  if ((pd[key] || 0) >= 5) return;
  n.gold -= cost * 1.5;
  pd[key] = (pd[key] || 0) + 1;
  pd.economy = Math.min(100, pd.economy + 2);
}

function aiOffense(n) {
  const targets = findTargets(n);
  if (!targets.length) return;
  targets.sort((a, b) => a.defTroops - b.defTroops);
  let launched = 0;
  for (const t of targets) {
    if (launched >= 2) break;
    const send = Math.round(stackAt(t.from, n.name) * 0.75);
    if (send < 300) continue;
    UI.moveArmy({ from: t.from, to: t.to, owner: n.name, troops: send, invade: true, silent: true });
    launched++;
  }
}

function aiDefense(n) {
  // 敌军压境的己方薄弱省 → 从后方调兵
  for (const p of n.provinces) {
    const adj = provinceAdj[p];
    if (!adj) continue;
    let threat = 0;
    for (const q of adj) {
      const a = armies[q];
      const o = window.__territoryOwner[q];
      if (a && o && o !== n.name && isAtWar(n.name, o)) threat += a.troops;
    }
    const mine = stackAt(p, n.name);
    if (threat > mine * 1.4 && threat > 1500) {
      // 找一个远离前线的己方堆叠调 60%
      for (const r of n.provinces) {
        if (r === p) continue;
        const g = armies[r];
        if (!g || g.owner !== n.name || g.troops < 1500) continue;
        const rAdj = provinceAdj[r] || new Set();
        let nearEnemy = false;
        for (const q of rAdj) {
          const o = window.__territoryOwner[q];
          if (o && o !== n.name && isAtWar(n.name, o)) { nearEnemy = true; break; }
        }
        if (nearEnemy) continue;
        UI.moveArmy({ from: r, to: p, owner: n.name, troops: Math.round(g.troops * 0.6), invade: false, silent: true });
        break;
      }
    }
  }
}

function aiConsiderWar(n, today) {
  if (n.personality !== 'expansionist' && n.personality !== 'balanced') return;
  // 开局 90 天冷静期：给玩家发育窗口
  if (absDayCache < 2026 * 360 + 90) return;
  const myWars = warsOf(n.name).length;
  if (myWars >= (n.personality === 'expansionist' ? 2 : 1)) return;
  // 世界同时进行的 AI 战争上限（原5→3，节奏更平和）
  const aiWars = wars.filter(w => !w.attackers.includes(window.__ownCountry) && !w.defenders.includes(window.__ownCountry)).length;
  if (aiWars >= gameCtx.aiWarLimit) return;
  if (gameCtx.worldTension > 50) return;
  const govAggr = 1 + ((GOV_TYPES[n.gov] || GOV_TYPES.repub).aggr || 0);
  if (Math.random() > n.aggression * 0.035 * govAggr) return; // 开战概率调低（原0.10），政体倾向修正
  const neighbors = neighborCountries(n).filter(c => {
    const cn = nations[c];
    // 不主动攻打列强（含玩家所在列强），只欺负弱邻；目标已在别的战争中也不打
    if (!cn || !cn.alive || cn.overlord || cn.greatPower) return false;
    if (warsOf(c).length > 0) return false;
    return getRelation(n.name, c) < -10 && !isAtWar(n.name, c) && !hasTruce(n.name, c, today);
  });
  if (!neighbors.length) return;
  const myPow = nationPower(n);
  let best = null, bestRatio = 2.2;
  for (const c of neighbors) {
    const ratio = myPow / Math.max(1, nationPower(nations[c]));
    if (ratio > bestRatio) { bestRatio = ratio; best = c; }
  }
  if (best) declareWar(n.name, best, { today, justified: false });
}

let absDayCache = 0;
function dailyAI(today) {
  absDayCache = absDay(today);
  const slot = absDayCache % 3;
  for (const n of Object.values(nations)) {
    if (!n.alive || n.isPlayer) continue;
    if (nameHash(n.name) % 3 !== slot) continue; // 错峰
    const atWar = warsOf(n.name).length > 0;
    aiRecruit(n);
    if (absDayCache % 9 === nameHash(n.name) % 9) aiBuild(n);
    if (atWar) {
      aiOffense(n);
      aiDefense(n);
    } else if (n.gold > 150) {
      aiConsiderWar(n, today);
    }
    // 抽象科研：每 2 年升一级
    if (absDayCache % 720 === nameHash(n.name + 't') % 720 && n.gold > 600) {
      n.gold -= 400;
      if (nameHash(n.name + 'tech' + absDayCache) % 2 === 0) n.milTech = Math.min(10, n.milTech + 1);
      else n.ecoTech = Math.min(10, n.ecoTech + 1);
    }
  }
}
onDay(dailyAI);
