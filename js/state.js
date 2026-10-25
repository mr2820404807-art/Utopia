// ===== 共享游戏状态 + 渲染桥 + 日/刻钩子 =====
// 乌托邦 · 一期改造
// index.html 与各系统模块通过本文件共享状态。
// 所有容器一律"原地变异"，禁止整体重新赋值（保证 live binding 生效）。

// ---- UI 桥：index.html 启动时注入渲染函数，模块只通过它碰渲染层 ----
export const UI = {
  notify: (msg) => console.log('[notify]', msg),
  repaintTerritory: () => {},          // 领土重绘（带脏标记限频）
  updateArmyMarker: () => {},           // (province, troops, ownerCode)
  moveArmy: () => {},                   // ({from, to, owner, troops, invade}) 行军动画
  getProvinceCenter: () => null,
  getFlagUrl: (n) => '',
  cn: (n) => n,                         // 英文名 -> 中文名
  updateResources: () => {},
  openPeaceOffer: () => {},             // AI 求和弹窗 (war)
  battleFx: () => {},                   // 战斗火花特效 (province)
  explosion: () => {},
  screenShake: () => {},
  refreshWarPanel: () => {},
  refreshDiploPanel: () => {},
};

// ---- 玩家资源（沿用原字段名，顶栏直接读它）----
export const aohRes = {
  gold: 500, economy: 50, manpower: 1000, diplomacy: 50, legacy: 0,
  population: 100000, growth: 1.2, war: 0, missiles: 0,
};

// ---- 玩家科技修正（由 tech.js 累积，战斗/经济读取）----
export const playerMods = {
  atk: 0, def: 0, income: 0, build: 0, research: 0, growth: 0, recruit: 0, missile: 0,
  manpowerRegen: 0, diploGain: 0, upkeep: 0,
};

// ---- 军队：省份 -> { owner, troops, officerId? } ----
export const armies = {};

// ---- 省份数据（结构同旧版）----
export const provinceData = {};

// ---- 建造队列 ----
export const buildingQueue = {};

// ---- 科技（新版树）----
export const techProgress = {};   // id -> 'researching' | 'done'
export const aohTechBonuses = {}; // id -> { days }

// ---- 军官池 ----
export const officerPool = [];

// ---- 国家级标记 ----
export const countryFlags = {};

// ---- 预算政策（-1低 / 0中 / 1高，参照文明时代3 GV_Budget 三滑杆）----
export const playerPolicy = { tax: 0, research: 0, military: 0 };
// ---- 贷款（参照 GV_Loan：上限5笔、3.75%利息、10年分期）----
export const playerLoans = [];   // {principal, dailyPay, daysLeft}
// ---- 占领区动荡度（参照 GV_Rebels 的 unrest，满100触发起义）----
export const provinceUnrest = {};   // pname -> 0..100
// ---- 围城（参照 GV_Siege：堡垒等级延长占领时间）----
export const sieges = {};   // pname -> {attacker:{owner,troops,officerId}, daysLeft}
// ---- 法律（ enacted lawId -> true ）----
export const playerLaws = {};

// ---- 新系统状态 ----
export const nations = {};        // name -> nation 对象（玩家为代理对象）
export const wars = [];           // 进行中的战争
export const battles = {};        // 省份 -> 战斗对象
export const relations = {};      // 'A|B' -> -100..100
export const truces = {};         // 'A|B' -> 到期 {y,m,d}
export const alliances = [];      // [A, B]
export const justifying = {};     // targetCountry -> { daysLeft } 玩家造借口进度
export const warIdCounter = { n: 1 };

export const gameCtx = {          // 一局的全局参数
  totalProvinces: 0,
  victoryShare: 0.4,
  ended: false,                   // 已弹出胜利/失败
  playerDead: false,
  worldTension: 0,                // 0-100
  aiWarLimit: 5,
};

// ---- 邻接表（combat.js 构建）----
export const provinceAdj = {};          // name -> Set(name) 陆路
export const seaAdj = {};               // name -> Set(name) 海路
export const provinceCenter = {};       // name -> {lon, lat}

// ---- 钩子注册（模块注册，index.html 的时间循环调用）----
const tickFns = [];
const dayFns = [];
export function onTick(fn) { tickFns.push(fn); }
export function onDay(fn) { dayFns.push(fn); }
export function runTicks() { for (const f of tickFns) f(); }
export function runDay(info) {
  gameCtx.dayCount = (gameCtx.dayCount || 0) + 1;
  const order = dayFns.slice();
  for (const f of order) {
    try { f(info); }
    catch (e) { console.warn('[onDay]', f.name || 'anonymous', e); }
  }
}

// ---- 存档分节注册：各模块挂自己的序列化/反序列化 ----
const saveSections = [];
export function registerSave(name, save, load) { saveSections.push({ name, save, load }); }
export function saveAllSections() {
  const out = {};
  for (const s of saveSections) out[s.name] = s.save();
  return out;
}
export function loadAllSections(data) {
  for (const s of saveSections) {
    try { s.load(data ? data[s.name] : undefined); }
    catch (e) { console.warn('存档分节恢复失败:', s.name, e); }
  }
}

// ---- 通用清空工具 ----
export function clearObj(o) { for (const k of Object.keys(o)) delete o[k]; }
export function clearArray(a) { a.length = 0; }

// ---- 全量重置（新局/读档前）----
export function resetAllState() {
  Object.assign(aohRes, {
    gold: 500, economy: 50, manpower: 1000, diplomacy: 50, legacy: 0,
    population: 100000, growth: 1.2, war: 0, missiles: 0,
  });
  Object.keys(playerMods).forEach(k => playerMods[k] = 0);
  playerPolicy.tax = 0; playerPolicy.research = 0; playerPolicy.military = 0;
  clearArray(playerLoans); clearObj(provinceUnrest); clearObj(sieges); clearObj(playerLaws);
  clearObj(armies); clearObj(provinceData); clearObj(buildingQueue);
  clearObj(techProgress); clearObj(aohTechBonuses);
  clearArray(officerPool); clearObj(countryFlags);
  clearObj(nations); clearArray(wars); clearObj(battles); clearObj(relations);
  clearObj(truces); clearArray(alliances); clearObj(justifying);
  warIdCounter.n = 1;
  gameCtx.totalProvinces = 0; gameCtx.ended = false; gameCtx.playerDead = false; gameCtx.worldTension = 0;
  clearObj(provinceAdj); clearObj(seaAdj); clearObj(provinceCenter);
}

// ---- 预算/贷款/动荡/围城/法律 存档分节 ----
registerSave('policies',
  () => ({
    policy: { ...playerPolicy },
    loans: playerLoans.map(l => ({ ...l })),
    unrest: { ...provinceUnrest },
    laws: { ...playerLaws },
  }),
  (data) => {
    playerPolicy.tax = 0; playerPolicy.research = 0; playerPolicy.military = 0;
    clearArray(playerLoans); clearObj(provinceUnrest); clearObj(sieges); clearObj(playerLaws);
    if (!data) return;
    Object.assign(playerPolicy, data.policy || {});
    (data.loans || []).forEach(l => playerLoans.push(l));
    Object.assign(provinceUnrest, data.unrest || {});
    Object.assign(playerLaws, data.laws || {});
    // 围城状态不存档：读档后围城重置（进攻方部队已在目标省驻扎模型外，直接按占领处理）
  });

// ---- 关系键工具 ----
export function relKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
export function getRelation(a, b) {
  if (a === b) return 100;
  return relations[relKey(a, b)] ?? 0;
}
export function addRelation(a, b, delta) {
  const k = relKey(a, b);
  relations[k] = Math.max(-100, Math.min(100, (relations[k] ?? 0) + delta));
}

// ---- 停战检查 ----
export function dateLess(a, b) { // a < b ?
  if (a.y !== b.y) return a.y < b.y;
  if (a.m !== b.m) return a.m < b.m;
  return a.d < b.d;
}
export function hasTruce(a, b, today) {
  const t = truces[relKey(a, b)];
  return !!(t && dateLess(today, t)); // today < 到期日
}
export function setTruce(a, b, today, years) {
  truces[relKey(a, b)] = { y: today.y + years, m: today.m, d: today.d };
}
