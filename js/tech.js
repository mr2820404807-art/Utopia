// ===== 科技树：4 方向 26 项，前置解锁，效果进入 playerMods =====
// 乌托邦 · 一期改造
import { aohRes, techProgress, aohTechBonuses, playerMods, onDay, UI } from './state.js';

export const TECH_BRANCHES = [
  { id: 'eco', name: '经济', icon: '💰', color: '#7fd488' },
  { id: 'ind', name: '工业', icon: '🏭', color: '#8db4d8' },
  { id: 'mil', name: '军事', icon: '⚔', color: '#d88d8d' },
  { id: 'frt', name: '前沿', icon: '🔬', color: '#c9a8e0' },
];

export const techDefs = [
  // 经济
  { id: 'agri1', branch: 'eco', tier: 1, name: '农业改良', cost: 100, days: 20, req: [], desc: '税收 +3%', fx: { income: 0.03 } },
  { id: 'trade1', branch: 'eco', tier: 1, name: '商路开拓', cost: 120, days: 22, req: [], desc: '税收 +4%', fx: { income: 0.04 } },
  { id: 'agri2', branch: 'eco', tier: 2, name: '集约农业', cost: 180, days: 28, req: ['agri1'], desc: '税收 +4%', fx: { income: 0.04 } },
  { id: 'bank1', branch: 'eco', tier: 3, name: '现代银行', cost: 260, days: 34, req: ['trade1'], desc: '税收 +6%，立即获得 300 金', fx: { income: 0.06, gold: 300 } },
  { id: 'industry', branch: 'eco', tier: 3, name: '工业化', cost: 350, days: 40, req: ['agri2'], desc: '税收 +10%', fx: { income: 0.10 } },
  { id: 'rail', branch: 'eco', tier: 4, name: '铁路网', cost: 420, days: 46, req: ['industry'], desc: '税收 +8%，建造 +10%', fx: { income: 0.08, build: 0.10 } },
  // 工业
  { id: 'mining1', branch: 'ind', tier: 1, name: '采矿业', cost: 100, days: 20, req: [], desc: '立即获得 200 金', fx: { gold: 200 } },
  { id: 'edu1', branch: 'ind', tier: 1, name: '义务教育', cost: 150, days: 26, req: [], desc: '研究速度 +15%，解锁第2研究槽', fx: { research: 0.15 }, unlockSlot: true },
  { id: 'iron1', branch: 'ind', tier: 2, name: '冶炼工艺', cost: 170, days: 26, req: ['mining1'], desc: '建造速度 +5%', fx: { build: 0.05 } },
  { id: 'electric', branch: 'ind', tier: 3, name: '电气化', cost: 320, days: 38, req: ['iron1'], desc: '税收 +8%', fx: { income: 0.08 } },
  { id: 'assembly', branch: 'ind', tier: 4, name: '流水线生产', cost: 400, days: 44, req: ['electric'], desc: '建造速度 +15%', fx: { build: 0.15 } },
  { id: 'computer', branch: 'ind', tier: 5, name: '计算机', cost: 550, days: 55, req: ['assembly', 'edu1'], desc: '研究 +25%，税收 +5%，解锁第3研究槽', fx: { research: 0.25, income: 0.05 }, unlockSlot: true },
  // 军事
  { id: 'drill1', branch: 'mil', tier: 1, name: '常备军操练', cost: 120, days: 22, req: [], desc: '攻击 +5%，防御 +5%', fx: { atk: 0.05, def: 0.05 } },
  { id: 'gunpowder', branch: 'mil', tier: 2, name: '火药武器', cost: 200, days: 30, req: ['drill1'], desc: '攻击 +10%', fx: { atk: 0.10 } },
  { id: 'conscription', branch: 'mil', tier: 2, name: '总动员体制', cost: 220, days: 32, req: ['drill1'], desc: '征兵消耗 -20%', fx: { recruit: 0.20 } },
  { id: 'staff', branch: 'mil', tier: 3, name: '总参谋部', cost: 300, days: 36, req: ['gunpowder'], desc: '攻击 +8%', fx: { atk: 0.08 } },
  { id: 'trench', branch: 'mil', tier: 3, name: '堑壕体系', cost: 280, days: 34, req: ['conscription'], desc: '防御 +12%', fx: { def: 0.12 } },
  { id: 'armor', branch: 'mil', tier: 4, name: '装甲部队', cost: 450, days: 48, req: ['staff'], desc: '攻击 +15%', fx: { atk: 0.15 } },
  { id: 'airforce', branch: 'mil', tier: 5, name: '空中力量', cost: 520, days: 52, req: ['armor'], desc: '攻击 +12%', fx: { atk: 0.12 } },
  { id: 'blitz', branch: 'mil', tier: 5, name: '闪击学说', cost: 500, days: 50, req: ['armor', 'trench'], desc: '攻击 +18%', fx: { atk: 0.18 } },
  // 前沿
  { id: 'medicine', branch: 'frt', tier: 1, name: '现代医学', cost: 160, days: 26, req: [], desc: '人口增长 +0.2，人力 +1000', fx: { growth: 0.2, manpower: 1000 } },
  { id: 'printing', branch: 'frt', tier: 1, name: '印刷传播', cost: 130, days: 22, req: [], desc: '外交点 +15', fx: { diplomacy: 15 } },
  { id: 'compass', branch: 'frt', tier: 2, name: '航海罗盘', cost: 180, days: 28, req: [], desc: '税收 +3%', fx: { income: 0.03 } },
  { id: 'rocket', branch: 'frt', tier: 3, name: '火箭技术', cost: 340, days: 40, req: ['staff'], desc: '导弹产量 +1/日', fx: { missile: 1 } },
  { id: 'nuclear', branch: 'frt', tier: 4, name: '核能工程', cost: 480, days: 50, req: ['electric'], desc: '威望 +20', fx: { legacy: 20 } },
  { id: 'space', branch: 'frt', tier: 5, name: '航天计划', cost: 600, days: 60, req: ['rocket', 'nuclear'], desc: '威望 +40，税收 +5%', fx: { legacy: 40, income: 0.05 } },
];

export function techById(id) { return techDefs.find(t => t.id === id); }
export function techState(id) { return techProgress[id] || 'locked'; }
export function techUnlocked(t) { return t.req.every(r => techProgress[r] === 'done'); }
export function researchSlots() {
  let n = 1;
  if (techProgress.edu1 === 'done') n++;
  if (techProgress.computer === 'done') n++;
  return n;
}
export function researchingCount() {
  return Object.values(techProgress).filter(v => v === 'researching').length;
}

export function startResearch(id) {
  const t = techById(id);
  if (!t) return { ok: false, msg: '科技不存在' };
  if (techProgress[id] === 'done' || techProgress[id] === 'researching') return { ok: false, msg: '不可重复研究' };
  if (!techUnlocked(t)) return { ok: false, msg: '前置科技未完成' };
  if (researchingCount() >= researchSlots()) return { ok: false, msg: '研究槽已满' };
  if (aohRes.gold < t.cost) return { ok: false, msg: '金币不足' };
  aohRes.gold -= t.cost;
  techProgress[id] = 'researching';
  aohTechBonuses[id] = { days: 0 };
  UI.notify(`🔬 开始研究：${t.name}`);
  UI.updateResources();
  return { ok: true };
}

function applyTech(t) {
  const fx = t.fx || {};
  for (const k of ['atk', 'def', 'income', 'build', 'research', 'growth', 'missile']) {
    if (fx[k]) playerMods[k] += fx[k];
  }
  if (fx.recruit) playerMods.recruit += fx.recruit;
  if (fx.gold) aohRes.gold += fx.gold;
  if (fx.manpower) aohRes.manpower += fx.manpower;
  if (fx.diplomacy) aohRes.diplomacy += fx.diplomacy;
  if (fx.legacy) aohRes.legacy += fx.legacy;
}

// 供读档后重建 playerMods
export function reapplyAllTechs() {
  Object.keys(playerMods).forEach(k => playerMods[k] = 0);
  for (const t of techDefs) if (techProgress[t.id] === 'done') applyTech(t);
}

function dailyTech() {
  let finished = false;
  for (const t of techDefs) {
    if (techProgress[t.id] !== 'researching') continue;
    const b = aohTechBonuses[t.id] || (aohTechBonuses[t.id] = { days: 0 });
    b.days += 1 + playerMods.research; // 研究速度加成
    if (b.days >= t.days) {
      techProgress[t.id] = 'done';
      delete aohTechBonuses[t.id];
      applyTech(t);
      finished = true;
      UI.notify(`🎉 科技完成：${t.name}`);
    }
  }
  if (finished) {
    UI.updateResources();
    const btn = document.getElementById('sb-tech');
    if (btn) btn.classList.toggle('researching', researchingCount() > 0);
  }
}
onDay(dailyTech);
