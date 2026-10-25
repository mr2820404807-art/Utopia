// ===== 国家模型：为世界上每个国家建立可运作的状态 =====
// 乌托邦 · 一期改造
import { gdpMap, popMap, nameHash } from './data.js';
import {
  aohRes, armies, nations, wars, battles, relations, alliances, gameCtx, relKey, provinceData,
  clearObj, UI, registerSave,
} from './state.js';

// 玩家资源字段 <-> 国家字段 的映射（warSupport 特例映射到 aohRes.war）
const RES_FIELDS = ['gold', 'economy', 'manpower', 'diplomacy', 'legacy', 'population', 'growth', 'missiles'];

// 玩家国家 = 代理对象：标量资源直接读写 aohRes，顶栏零改动
function makePlayerNation(base) {
  const store = { ...base, isPlayer: true };
  return new Proxy(store, {
    get(t, k) {
      if (k === 'warSupport') return aohRes.war;
      if (RES_FIELDS.includes(k)) return aohRes[k];
      if (k === 'toJSON') return () => playerToJSON(store);
      return t[k];
    },
    set(t, k, v) {
      if (k === 'warSupport') { aohRes.war = v; return true; }
      if (RES_FIELDS.includes(k)) { aohRes[k] = v; return true; }
      t[k] = v; return true;
    },
  });
}

function playerToJSON(store) {
  const out = { ...store };
  for (const f of RES_FIELDS) out[f] = aohRes[f];
  out.warSupport = aohRes.war;
  out.provinces = [...store.provinces];
  return out;
}

function nationToJSON(n) {
  return { ...n, provinces: [...n.provinces], allies: [...(n.allies || [])] };
}

const PERSONALITIES = ['expansionist', 'balanced', 'defensive'];

export function initNations(playerCountry) {
  clearObj(nations);
  const countriesGeo = window.__countriesGeoJSON;
  const provincesGeo = window.__provincesGeoJSON;
  if (!countriesGeo) return;

  // 收集每个国家的省份（含"无省国家"以国名为伪省）
  // 优先用领土归属表（含台湾等特殊处理），保证与实际归属一致
  const provsByCountry = {};
  if (window.__territoryOwner && Object.keys(window.__territoryOwner).length) {
    for (const [pname, admin] of Object.entries(window.__territoryOwner)) {
      if (!pname || !admin) continue;
      (provsByCountry[admin] = provsByCountry[admin] || []).push(pname);
    }
  } else if (provincesGeo) {
    for (const f of provincesGeo.features) {
      const pname = f.properties.name, admin = f.properties.admin;
      if (!pname || !admin) continue;
      (provsByCountry[admin] = provsByCountry[admin] || []).push(pname);
    }
  }

  // GDP 排名前 8 = 列强
  const gdpEntries = [...countriesGeo.features]
    .map(f => f.properties.NAME || f.properties.name)
    .filter(Boolean)
    .map(n => [n, gdpMap[n] || 50]);
  gdpEntries.sort((a, b) => b[1] - a[1]);
  const greatPowers = new Set(gdpEntries.slice(0, 8).map(e => e[0]));

  let totalProv = 0;
  for (const f of countriesGeo.features) {
    const name = f.properties.NAME || f.properties.name;
    if (!name || name === 'Antarctica') continue;
    const h = nameHash(name);
    const gdp = gdpMap[name] || 30 + (h % 120);
    const pop = popMap[name] || 3000000 + (h % 20000000);
    const base = {
      name,
      cn: (window.__chineseNames && window.__chineseNames[name]) || name,
      isPlayer: name === playerCountry,
      greatPower: greatPowers.has(name),
      gold: Math.round(gdp * 0.06 + (h % 300)),
      economy: Math.max(1, Math.min(100, Math.round(gdp / 250))),
      manpower: Math.round(pop * 0.0015),
      population: pop,
      growth: 1.0 + ((h % 15) / 10),
      milTech: greatPowers.has(name) ? 3 : (h % 3),
      ecoTech: greatPowers.has(name) ? 3 : (h % 3),
      personality: PERSONALITIES[h % 3],
      aggression: 0.25 + (h % 70) / 100,
      warSupport: 100,
      alive: true,
      overlord: null,
      allies: [],
      aiLastDecide: 0,
      capital: '',
      provinces: new Set(),
    };
    const list = provsByCountry[name];
    if (list && list.length) {
      base.provinces = new Set(list);
      // 首都：与国家同名的省份，否则取第一个
      base.capital = list.includes(name) ? name : list[0];
    } else {
      base.provinces = new Set([name]);
      base.capital = name;
    }
    totalProv += base.provinces.size;
    nations[name] = base.isPlayer ? makePlayerNation(base) : base;
  }
  gameCtx.totalProvinces = totalProv;

  // 初始关系：哈希基线 + 列强互相竞争（键必须用 relKey 排序，与 getRelation 一致）
  const names = Object.keys(nations);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      let v = (nameHash(names[i] + names[j]) % 41) - 20;
      if (nations[names[i]].greatPower && nations[names[j]].greatPower) v -= 25;
      relations[relKey(names[i], names[j])] = v;
    }
  }

  // 初始驻军（含玩家）：总量 ~ sqrt(人口)，铺在少数重点省份
  for (const n of Object.values(nations)) {
    const total = Math.round(Math.min(25000, Math.max(300, Math.sqrt(n.population) * 0.55)));
    const provList = [...n.provinces];
    const k = Math.max(1, Math.min(provList.length, 3 + Math.floor(Math.sqrt(n.population) / 4500)));
    const per = Math.max(100, Math.round(total / k));
    // 优先首都 + 哈希选省，保证分布稳定
    const picks = [n.capital];
    for (let idx = 1; picks.length < k && provList.length; idx++) {
      const p = provList[(nameHash(n.name + idx) % provList.length)];
      if (!picks.includes(p)) picks.push(p);
    }
    for (const p of picks) if (!armies[p]) armies[p] = { owner: n.name, troops: per };
  }

  UI.notify(`已初始化 ${Object.keys(nations).length} 个国家 · ${totalProv} 个省份`);
  return nations[playerCountry] || null;
}

// ---- 查询工具 ----
export function totalTroops(nationName) {
  let s = 0;
  for (const a of Object.values(armies)) if (a.owner === nationName) s += a.troops;
  return s;
}
export function nationPower(n) {
  if (!n || !n.alive) return 0;
  return totalTroops(n.name) * (1 + n.milTech * 0.12) + n.economy * 30 + n.provinces.size * 20;
}
export function playerNation() { return nations[window.__ownCountry || '']; }

// ---- 领土转移（占领/割让/和约共用）----
export function transferProvince(province, newOwner) {
  const prevOwner = window.__territoryOwner[province];
  if (prevOwner === newOwner) return;
  window.__territoryOwner[province] = newOwner;
  const pn = nations[prevOwner], nn = nations[newOwner];
  if (pn) { pn.provinces.delete(province); }
  if (nn) { nn.provinces.add(province); if (!nn.capital) nn.capital = province; }
  // 战争创伤：经济与人口受损
  const pd = provinceData[province];
  if (pd) { pd.economy = Math.max(5, pd.economy * 0.88); pd.population = Math.round(pd.population * 0.93); }
  UI.repaintTerritory();
  // 灭国检查
  if (pn && pn.provinces.size === 0 && pn.alive) {
    pn.alive = false;
    // 灭国军队清除
    for (const p of Object.keys(armies)) if (armies[p].owner === pn.name) delete armies[p];
    for (const p of Object.keys(battles)) {
      const b = battles[p];
      if (b.attacker.owner === pn.name || window.__territoryOwner[p] === pn.name) endBattle(p);
    }
    UI.notify(`🏳️ ${UI.cn(pn.name)} 已灭亡`);
  }
  if (pn && pn.capital === province && pn.provinces.size > 0) {
    pn.capital = [...pn.provinces][0];
  }
}

// ---- 战斗终止（灭国/和约清理用）----
export function endBattle(province) {
  const b = battles[province];
  if (!b) return;
  if (b.marker) { try { b.marker.parent && b.marker.parent.remove(b.marker); } catch (e) {} }
  delete battles[province];
}

export function endAllBattlesBetween(nameA, nameB) {
  for (const p of Object.keys(battles)) {
    const b = battles[p];
    const defOwner = window.__territoryOwner[p];
    if ((b.attacker.owner === nameA && defOwner === nameB) || (b.attacker.owner === nameB && defOwner === nameA)) {
      endBattle(p);
    }
  }
}

// ---- 存档 ----
registerSave('nations',
  () => {
    const out = {};
    for (const [k, n] of Object.entries(nations)) {
      out[k] = n.isPlayer ? playerToJSON(n) : nationToJSON(n);
    }
    return out;
  },
  (data) => {
    clearObj(nations);
    if (!data) return;
    for (const [k, v] of Object.entries(data)) {
      const restored = { ...v, provinces: new Set(v.provinces || []), allies: v.allies || [] };
      if (restored.isPlayer) nations[k] = makePlayerNation(restored);
      else nations[k] = restored;
    }
  });
