// ===== 经济系统：省份经济 -> 国库，维持费，人力，战争支持度 =====
// 乌托邦 · 一期改造
import {
  aohRes, armies, nations, provinceData, playerMods, gameCtx,
  onDay, UI,
} from './state.js';
import { warsOf } from './diplomacy.js';

// 战争支持度参数（参照文明时代3厌战值：进攻方掉得快，防守方掉得慢，和平恢复）
const WAR_SUPPORT_DRAIN_AGGRESSOR = 0.45;
const WAR_SUPPORT_DRAIN_DEFENDER = 0.25;
const WAR_SUPPORT_RECOVER = 0.8;

export function nationProvinceIncome(n) {
  let sum = 0;
  for (const p of n.provinces) {
    const pd = provinceData[p];
    if (pd) sum += pd.economy;
  }
  return sum;
}

export function nationUpkeep(n) {
  let troops = 0;
  for (const a of Object.values(armies)) if (a.owner === n.name) troops += a.troops;
  return troops * 0.0008;
}

// 每日经济结算（所有国家）
function dailyEconomy() {
  for (const n of Object.values(nations)) {
    if (!n.alive) continue;
    const isPlayer = n.isPlayer;
    let income = nationProvinceIncome(n) * 0.01 * (1 + n.ecoTech * 0.06);
    if (isPlayer) income *= (1 + playerMods.income);
    let upkeep = nationUpkeep(n);
    // 傀儡纳贡：上缴宗主 20%
    if (n.overlord && nations[n.overlord]) {
      const tribute = income * 0.2;
      nations[n.overlord].gold += tribute;
      income -= tribute;
    }
    n.gold += income - upkeep;
    // 人力与人口
    n.manpower += Math.round(n.population * 0.000003);
    if (n.provinces.size > 0) {
      let popSum = 0;
      for (const p of n.provinces) { const pd = provinceData[p]; if (pd) popSum += pd.population; }
      if (popSum > 0) n.population = Math.round(popSum / 30);
    }
    // 战争支持度：和平恢复 / 战争消耗（进攻方消耗更快）
    const myWars = warsOf(n.name);
    if (myWars.length > 0) {
      const isAggressor = myWars.some(w => w.attackers.includes(n.name) && !w.defenders.includes(n.name));
      n.warSupport = Math.max(0, n.warSupport - (isAggressor ? WAR_SUPPORT_DRAIN_AGGRESSOR : WAR_SUPPORT_DRAIN_DEFENDER));
    } else {
      n.warSupport = Math.min(100, n.warSupport + WAR_SUPPORT_RECOVER);
    }
    // 国家经济指数 = 省份均值（影响战力/外交）
    if (n.provinces.size > 0) {
      const avg = nationProvinceIncome(n) / n.provinces.size;
      n.economy = Math.max(1, Math.min(100, Math.round(avg)));
    }
    // AI 赤字保护：破产时强制裁军
    if (!isPlayer && n.gold < -200) {
      let cut = 0;
      for (const p of Object.keys(armies)) {
        if (cut > 3000) break;
        if (armies[p].owner === n.name) {
          const t = Math.max(0, armies[p].troops - 500);
          cut += armies[p].troops - t;
          armies[p].troops = t;
          if (t <= 0) { UI.updateArmyMarker(p, 0, n.name); delete armies[p]; }
          else UI.updateArmyMarker(p, t, n.name);
        }
      }
      n.gold = Math.max(n.gold, -50);
    }
  }
  if (window.__ownCountry && nations[window.__ownCountry]) UI.updateResources();
}

onDay(dailyEconomy);
