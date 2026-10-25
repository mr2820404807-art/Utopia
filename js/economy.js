// ===== 经济系统：省份经济 -> 国库，维持费，人力，战争支持度，政策/贷款/动荡 =====
// 乌托邦 · 一期改造
import {
  aohRes, armies, nations, provinceData, playerMods, gameCtx, logEvent,
  playerPolicy, playerLoans, provinceUnrest, sieges, playerLaws,
  playerGoldenAge, spyNetwork, spyIntel, addRelation,
  onDay, UI,
} from './state.js';
import { warsOf } from './diplomacy.js';
import { GOV_TYPES } from './data.js';
import { transferProvince } from './nations.js';

// 战争支持度参数（参照文明时代3厌战值：进攻方掉得快，防守方掉得慢，和平恢复）
const WAR_SUPPORT_DRAIN_AGGRESSOR = 0.45;
const WAR_SUPPORT_DRAIN_DEFENDER = 0.25;
const WAR_SUPPORT_RECOVER = 0.8;

// 预算政策效果（参照 GV_Budget：[-1低, 0中, 1高]）
const TAX_INCOME = [-0.10, 0, 0.075];        // 税收等级对收入
const MIL_UPKEEP = [-0.25, 0, 0.25];          // 军费等级对维持费
const MIL_MANPOWER = [-0.50, 0, 0.25];        // 军费等级对人力增长
const TAX_UNREST = [0, 0, 0.15];              // 高税加剧占领区动荡

// 贷款（参照 GV_Loan：3.75% 利息、10 年分期、上限 5 笔）
export function loanOffer() {
  return Math.round(60 + aohRes.economy * 9);
}
export function takeLoan() {
  if (playerLoans.length >= 5) { UI.notify('贷款已达上限（5笔）'); return false; }
  const principal = loanOffer();
  const repay = Math.round(principal * 1.15);
  playerLoans.push({ principal, dailyPay: +(repay / 730).toFixed(2), daysLeft: 730 });
  aohRes.gold += principal;
  UI.updateResources();
  UI.notify(`🏦 贷款 ${principal} 金（两年分期，共还 ${repay}）`);
  return true;
}

// 占领区原属国查询
function origAdminOf(pname) {
  const map = window.__origAdminMap;
  return map ? map[pname] : '';
}

function dailyUnrest() {
  const me = window.__ownCountry;
  if (!me) return;
  for (const pname of Object.keys(provinceUnrest)) {
    const u = provinceUnrest[pname];
    const owner = window.__territoryOwner[pname];
    const orig = origAdminOf(pname);
    if (owner === orig || !owner) {
      // 已收复/同化：动荡消退
      provinceUnrest[pname] = Math.max(0, u - 0.6);
      if (provinceUnrest[pname] === 0) delete provinceUnrest[pname];
      continue;
    }
    // 被占领：动荡累积（高税政策加速），只对玩家占领区显示处理
    provinceUnrest[pname] = Math.min(100, u + 0.35 + (playerPolicy.tax === 1 ? TAX_UNREST[2] : 0));
    if (provinceUnrest[pname] >= 100) {
      // 起义（参照 GV_Rebels）：原属国尚存则复国，否则被镇压
      const origNat = nations[orig];
      if (origNat && origNat.alive) {
        transferProvince(pname, orig);
        armies[pname] = { owner: orig, troops: Math.round(600 + Math.random() * 800) };
        UI.updateArmyMarker(pname, armies[pname].troops, orig);
        provinceUnrest[pname] = 30;
        UI.notify(`🔥 ${UI.cn(pname)} 爆发起义，已复归 ${UI.cn(orig)}！`);
        logEvent(`${UI.cn(pname)}起义，复归${UI.cn(orig)}`, 'revolt');
      } else {
        const pd = provinceData[pname];
        if (pd) pd.economy = Math.max(5, pd.economy - 25);
        const g = armies[pname];
        if (g) { g.troops = Math.round(g.troops * 0.6); UI.updateArmyMarker(pname, g.troops, g.owner); }
        provinceUnrest[pname] = 40;
        UI.notify(`⚔ ${UI.cn(pname)} 起义被镇压（经济受损、驻军折损）`);
      }
    }
  }
}

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

// 玩家政体修正（读 js/data.js GOV_TYPES；无政体视为共和）
function govOf(name) {
  const n = nations[name];
  const key = (name === window.__ownCountry && window.__playerGov) ? window.__playerGov : (n && n.gov) || 'repub';
  return GOV_TYPES[key] || GOV_TYPES.repub;
}

// 雇佣兵：立即成军（参照 GV_Army 佣兵：金币换兵、不耗人力、3倍单价）
export function hireMercenaries(province, count) {
  const me = window.__ownCountry;
  if (!me) return false;
  const troops = count * 1000;
  const cost = Math.round(troops * 0.06);
  if (aohRes.gold < cost) { UI.notify('金币不足（需要' + cost + '）'); return false; }
  aohRes.gold -= cost;
  if (armies[province] && armies[province].owner === me) armies[province].troops += troops;
  else armies[province] = { owner: me, troops };
  UI.updateArmyMarker(province, armies[province].troops, me);
  UI.updateResources();
  UI.notify('💰 雇佣兵 ' + troops + ' 人即刻入编 ' + UI.cn(province) + '（花费 ' + cost + ' 金）');
  return true;
}

// 派遣间谍（参照 GV_Spy：40金/30天，回报情报，可能暴露）
export function sendSpy(target) {
  const me = window.__ownCountry;
  if (!me || spyNetwork[target]) return false;
  if (aohRes.gold < 40) { UI.notify('金币不足（需要40）'); return false; }
  aohRes.gold -= 40;
  spyNetwork[target] = { daysLeft: 30 };
  UI.updateResources();
  UI.notify('🕵️ 间谍已潜入 ' + UI.cn(target) + '（约30天回传情报）');
  return true;
}

function dailySpy() {
  const me = window.__ownCountry;
  if (!me) return;
  for (const t of Object.keys(spyNetwork)) {
    const s = spyNetwork[t];
    s.daysLeft--;
    if (s.daysLeft > 0) continue;
    delete spyNetwork[t];
    const n = nations[t];
    if (!n || !n.alive) { UI.notify('🕵️ 谍报网失效：目标已不存在'); continue; }
    let troops = 0;
    for (const a of Object.values(armies)) if (a.owner === t) troops += a.troops;
    spyIntel[t] = {
      gold: Math.round(n.gold), troops,
      warSupport: Math.round(n.warSupport),
      provinces: n.provinces.size,
      milTech: n.milTech, at: Math.round(window.__gameDate ? window.__gameDate.y * 360 + window.__gameDate.m * 30 + window.__gameDate.d : 0),
    };
    UI.notify('🕵️ ' + UI.cn(t) + ' 情报：金' + spyIntel[t].gold + ' / 军' + troops + ' / 厌战' + (100 - spyIntel[t].warSupport) + ' / 省' + spyIntel[t].provinces);
    if (Math.random() < 0.2) {
      UI.notify('⚠️ 间谍在 ' + UI.cn(t) + ' 暴露！关系恶化');
      addRelation(me, t, -15);
    }
  }
}

// 黄金时代计时（参照 GV_GoldenAges：1095天）
function dailyGoldenAge() {
  if (!playerGoldenAge.kind) return;
  playerGoldenAge.daysLeft--;
  if (playerGoldenAge.daysLeft <= 0) {
    const kind = playerGoldenAge.kind;
    playerGoldenAge.kind = null;
    UI.notify('黄金时代落幕（' + (kind === 'civ' ? '文治' : kind === 'mil' ? '武功' : '科研') + '）');
    logEvent('你的黄金时代落幕', 'world');
  }
}

// 每日经济结算（所有国家）
function dailyEconomy() {
  dailySpy();
  dailyGoldenAge();
  // 贷款日供
  const me0 = window.__ownCountry;
  if (me0 && playerLoans.length) {
    for (let i = playerLoans.length - 1; i >= 0; i--) {
      const loan = playerLoans[i];
      aohRes.gold -= loan.dailyPay;
      loan.daysLeft--;
      if (loan.daysLeft <= 0) {
        playerLoans.splice(i, 1);
        UI.notify('✅ 一笔贷款已还清');
      }
    }
  }
  // 占领区动荡
  dailyUnrest();

  for (const n of Object.values(nations)) {
    if (!n.alive) continue;
    const isPlayer = n.isPlayer;
    let income = nationProvinceIncome(n) * 0.01 * (1 + n.ecoTech * 0.06);
    if (isPlayer) income *= (1 + playerMods.income + TAX_INCOME[playerPolicy.tax + 1] + govOf(n.name).incomeMod + (playerGoldenAge.kind === 'civ' ? 0.25 : 0));
    let upkeep = nationUpkeep(n);
    if (isPlayer) upkeep *= (1 + MIL_UPKEEP[playerPolicy.military + 1] - playerMods.upkeep);
    // 傀儡纳贡（参照 GV_Vassals：5% 收入 + 15% 人力）
    if (n.overlord && nations[n.overlord]) {
      const tribute = income * 0.05;
      const mpTribute = Math.round(n.manpower * 0.15 * 0.01);
      nations[n.overlord].gold += tribute;
      nations[n.overlord].manpower += mpTribute;
      n.manpower = Math.max(0, n.manpower - mpTribute);
      income -= tribute;
    }
    n.gold += income - upkeep;
    // 人力与人口（军费政策+法律影响玩家人力增长）
    let mpGain = Math.round(n.population * 0.000003);
    if (isPlayer) mpGain = Math.round(mpGain * (1 + MIL_MANPOWER[playerPolicy.military + 1] + playerMods.manpowerRegen + govOf(n.name).mpMod));
    n.manpower += mpGain;
    // 法律：每日外交点
    if (isPlayer) aohRes.diplomacy += playerMods.diploGain + govOf(n.name).diploMod;
    if (n.provinces.size > 0) {
      let popSum = 0;
      for (const p of n.provinces) { const pd = provinceData[p]; if (pd) popSum += pd.population; }
      if (popSum > 0) n.population = Math.round(popSum / 30);
    }
    // 战争支持度：和平恢复 / 战争消耗（进攻方消耗更快）
    const myWars = warsOf(n.name);
    if (myWars.length > 0) {
      const isAggressor = myWars.some(w => w.attackers.includes(n.name) && !w.defenders.includes(n.name));
      const govWs = (1 + govOf(n.name).wsDrain);
      n.warSupport = Math.max(0, n.warSupport - (isAggressor ? WAR_SUPPORT_DRAIN_AGGRESSOR : WAR_SUPPORT_DRAIN_DEFENDER) * govWs);
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
