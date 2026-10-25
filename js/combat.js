// ===== 战斗系统：多日战斗解算、邻接图（陆+海）、占领与撤退 =====
// 乌托邦 · 一期改造
import { lonLatDist, nameHash, coastalCountries } from './data.js';
import {
  armies, battles, nations, wars, provinceData, provinceAdj, seaAdj, provinceCenter,
  officerPool, playerMods, clearObj, onDay, UI, registerSave,
} from './state.js';
import { transferProvince, endBattle } from './nations.js';
import { isAtWar, warEvent } from './diplomacy.js';

// ---------- 邻接图 ----------
let adminIndex = null;
function adminOfProvince(provinceName) {
  if (!adminIndex && window.__provincesGeoJSON) {
    adminIndex = {};
    for (const f of window.__provincesGeoJSON.features) {
      if (f.properties.name) adminIndex[f.properties.name] = f.properties.admin || '';
    }
  }
  return adminIndex ? adminIndex[provinceName] : '';
}

export function buildAdjacency() {
  const geo = window.__provincesGeoJSON;
  if (!geo) return;
  clearObj(provinceAdj); clearObj(seaAdj); clearObj(provinceCenter);

  const items = [];
  for (const f of geo.features) {
    const name = f.properties.name;
    if (!name || !f.geometry) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let cx = 0, cy = 0, cn = 0;
    const scan = (coords) => {
      for (const c of coords) {
        if (Array.isArray(c[0])) scan(c);
        else {
          minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
          minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
          cx += c[0]; cy += c[1]; cn++;
        }
      }
    };
    scan(f.geometry.coordinates);
    if (cn === 0) continue;
    provinceCenter[name] = { lon: cx / cn, lat: cy / cn };
    items.push({ name, box: { minX, maxX, minY, maxY }, coastal: false });
  }

  // 陆路：bbox 贴近 + 中心距 < 8°（过滤跨大区误连）
  const byName = {};
  items.forEach(it => byName[it.name] = it);
  const overlap = (a, b, m) => !(a.maxX < b.minX - m || b.maxX < a.minX - m || a.maxY < b.minY - m || b.maxY < a.minY - m);
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (!provinceAdj[a.name]) provinceAdj[a.name] = new Set();
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (!overlap(a.box, b.box, 0.25)) continue;
      const d = lonLatDist(provinceCenter[a.name], provinceCenter[b.name]);
      if (d > 8) continue;
      if (!provinceAdj[b.name]) provinceAdj[b.name] = new Set();
      provinceAdj[a.name].add(b.name);
      provinceAdj[b.name].add(a.name);
    }
  }

  // 海路：沿海省中心距 < 15°，取最近 4 条
  for (const it of items) {
    const pd = provinceData[it.name];
    it.coastal = !!(pd && pd.isCoastal);
    if (!it.coastal && !pd) {
      // 省份数据未初始化时用国家沿海表兜底
      const admin = adminOfProvince(it.name);
      if (admin && coastalCountries.has(admin)) it.coastal = true;
    }
  }
  const coastalItems = items.filter(it => it.coastal);
  for (const a of coastalItems) {
    const cand = [];
    for (const b of coastalItems) {
      if (a.name === b.name) continue;
      if (provinceAdj[a.name] && provinceAdj[a.name].has(b.name)) continue;
      const d = lonLatDist(provinceCenter[a.name], provinceCenter[b.name]);
      if (d < 15) cand.push([b.name, d]);
    }
    cand.sort((x, y) => x[1] - y[1]);
    seaAdj[a.name] = new Set(cand.slice(0, 4).map(c => c[0]));
  }
}

// ---------- 寻路（陆 1 天/跳，海 2 天/跳）----------
export function findPathDays(from, to) {
  if (from === to) return { path: [from], days: [0] };
  const dist = { [from]: 0 };
  const prev = {};
  const visited = new Set();
  const queue = new Set([from]);
  while (queue.size > 0) {
    let cur = null, best = Infinity;
    for (const q of queue) { if (dist[q] < best) { best = dist[q]; cur = q; } }
    queue.delete(cur);
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (cur === to) break;
    const push = (next, w) => {
      if (visited.has(next)) return;
      const nd = dist[cur] + w;
      if (nd < (dist[next] ?? Infinity)) { dist[next] = nd; prev[next] = cur; queue.add(next); }
    };
    if (provinceAdj[cur]) for (const n of provinceAdj[cur]) push(n, 1);
    if (seaAdj[cur]) for (const n of seaAdj[cur]) push(n, 2);
  }
  if (!(to in dist)) return null;
  const path = [to]; let p = to;
  while (prev[p] !== undefined) { p = prev[p]; path.unshift(p); }
  const days = [];
  for (let i = 1; i < path.length; i++) {
    const sea = seaAdj[path[i - 1]] && seaAdj[path[i - 1]].has(path[i]);
    days.push(sea ? 2 : 1);
  }
  return { path, days };
}

// ---------- 战斗 ----------
export function startBattle(province, attacker) {
  const defOwner = window.__territoryOwner[province];
  const def = armies[province];
  // 空城：一日占领
  if (!def || def.troops <= 0) {
    arriveOccupy(province, attacker);
    return;
  }
  if (def.owner === attacker.owner) { // 同方：合并
    mergeArmy(province, attacker);
    return;
  }
  const existing = battles[province];
  if (existing) {
    // 同一方增援
    if (existing.attacker.owner === attacker.owner || sameSide(existing.attacker.owner, attacker.owner)) {
      existing.attacker.troops += attacker.troops;
      if (attacker.officerId && !existing.attacker.officerId) existing.attacker.officerId = attacker.officerId;
      updateBattleMarker(existing);
    } else {
      // 第三方乱入：简化为加入防守方（攻击防守方）
      def.troops += attacker.troops;
      UI.updateArmyMarker(province, def.troops, def.owner);
    }
    return;
  }
  battles[province] = {
    province,
    attacker: { owner: attacker.owner, troops: attacker.troops, origin: attacker.origin || '', officerId: attacker.officerId || null, startTroops: attacker.troops },
    day: 0,
    marker: null,
  };
  updateBattleMarker(battles[province]);
  const atkCn = UI.cn(attacker.owner), defCn = UI.cn(defOwner);
  UI.notify(`⚔ ${atkCn} 进攻 ${UI.cn(province)}（${defCn}）`);
  UI.battleFx(province);
  UI.refreshWarPanel();
}

function sameSide(a, b) {
  const wa = [], wb = [];
  for (const w of currentWars()) {
    if (w.attackers.includes(a)) wa.push(w.defenders);
    if (w.defenders.includes(a)) wa.push(w.attackers);
    if (w.attackers.includes(b)) wb.push(w.defenders);
    if (w.defenders.includes(b)) wb.push(w.attackers);
  }
  return wa.length > 0 && wb.length > 0 && wa.some(x => x === wb[0]);
}
function currentWars() { return wars; }

function mergeArmy(province, arriving) {
  const g = armies[province];
  if (g) {
    g.troops += arriving.troops;
    if (!g.officerId && arriving.officerId) g.officerId = arriving.officerId;
    UI.updateArmyMarker(province, g.troops, g.owner);
  } else {
    armies[province] = { owner: arriving.owner, troops: arriving.troops, officerId: arriving.officerId };
    UI.updateArmyMarker(province, arriving.troops, arriving.owner);
  }
}

function arriveOccupy(province, attacker) {
  const prevOwner = window.__territoryOwner[province];
  transferProvince(province, attacker.owner);
  armies[province] = { owner: attacker.owner, troops: attacker.troops, officerId: attacker.officerId || null };
  UI.updateArmyMarker(province, attacker.troops, attacker.owner);
  warEvent({ type: 'occupied', province, winner: attacker.owner, loser: prevOwner });
  if (attacker.owner === window.__ownCountry) {
    UI.notify(`🏁 占领 ${UI.cn(province)}！`);
  }
  UI.refreshWarPanel();
}

// 军队到达入口（index.html 行军动画结束/空投时调用）
export function onArmyArrive(anim) {
  const { province, owner, troops, origin, officerId } = anim;
  const provOwner = window.__territoryOwner[province] || '';
  if (provOwner === owner) {
    mergeArmy(province, { owner, troops, officerId });
    return;
  }
  // 敌境或第三国：需处于战争状态（UI 层已拦截玩家；AI 保证先宣战）
  if (!isAtWar(owner, provOwner)) {
    // 误入：退回出发地
    if (origin && window.__territoryOwner[origin] === owner) {
      mergeArmy(origin, { owner, troops, officerId });
    }
    return;
  }
  startBattle(province, { owner, troops, origin, officerId });
}

// ---------- 每日战斗解算 ----------
function officerBonus(officerId, stat) {
  if (!officerId) return 0;
  const off = officerPool.find(o => o.id === officerId);
  return off ? (off.stats[stat] || 0) * 0.02 : 0;
}

function dailyBattles() {
  for (const prov of Object.keys(battles)) {
    const b = battles[prov];
    const defOwner = window.__territoryOwner[prov];
    const def = armies[prov];
    const atkNat = nations[b.attacker.owner];
    const defNat = nations[defOwner];

    // 防守方被抽走/灭国 → 直接占领
    if (!def || def.troops <= 0 || def.owner === b.attacker.owner || !defNat || !defNat.alive) {
      arriveOccupy(prov, b.attacker);
      endBattle(prov);
      continue;
    }
    // 攻击方国家灭亡 → 战斗终止
    if (!atkNat || !atkNat.alive) { endBattle(prov); continue; }
    // 已停战 → 撤军
    if (!isAtWar(b.attacker.owner, defOwner)) { endBattle(prov); retreat(b, b.attacker.troops); continue; }

    b.day++;
    const isPlayerAtk = b.attacker.owner === window.__ownCountry;
    const isPlayerDef = defOwner === window.__ownCountry;
    const provDef = provinceData[prov];

    const atkPower = b.attacker.troops
      * (1 + atkNat.milTech * 0.05 + officerBonus(b.attacker.officerId, 'attack') + (isPlayerAtk ? playerMods.atk : 0))
      * (0.85 + Math.random() * 0.3);
    const defPower = def.troops
      * (1.25 + defNat.milTech * 0.05 + officerBonus(def.officerId, 'defense') + ((provDef ? provDef.barrackLv : 0) * 0.04) + (isPlayerDef ? playerMods.def : 0))
      * (0.85 + Math.random() * 0.3);

    // 按比例日损耗：优势越大，结束越快（悬殊 2~3 天，势均力敌 ~6 天）
    const ratio = atkPower / (atkPower + defPower); // 攻方优势度 0~1
    const atkLoss = Math.max(1, Math.round(b.attacker.troops * 0.35 * (1 - ratio)));
    const defLoss = Math.max(1, Math.round(def.troops * 0.35 * ratio) + Math.round(60 * ratio));
    b.attacker.troops = Math.max(0, b.attacker.troops - atkLoss);
    def.troops = Math.max(0, def.troops - defLoss);

    warEvent({ type: 'casualties', province: prov, attacker: b.attacker.owner, defender: defOwner, atkLoss, defLoss });
    if (isPlayerDef || isPlayerAtk) {
      const ps = nations[window.__ownCountry];
      if (ps) ps.warSupport = Math.max(0, ps.warSupport - 0.2);
    }
    UI.updateArmyMarker(prov, def.troops, def.owner);

    // 胜负判定
    if (def.troops <= 0) {
      const survivors = b.attacker.troops;
      arriveOccupy(prov, { ...b.attacker, troops: survivors });
      if (def.officerId) killOfficer(def.officerId);
      warEvent({ type: 'battleWon', province: prov, winner: b.attacker.owner, loser: defOwner });
      endBattle(prov);
      continue;
    }
    if (b.attacker.troops < Math.max(80, b.attacker.startTroops * 0.35) || b.day >= 10) {
      const survivors = b.attacker.troops;
      if (b.attacker.officerId && Math.random() < 0.3) killOfficer(b.attacker.officerId);
      warEvent({ type: 'battleWon', province: prov, winner: defOwner, loser: b.attacker.owner });
      if (isPlayerAtk) {
        UI.notify(`💔 对 ${UI.cn(prov)} 的攻势失败（第${b.day}天），残部 ${survivors} 人撤退`);
      } else if (isPlayerDef) {
        UI.notify(`🛡️ 击退了 ${UI.cn(b.attacker.owner)} 对 ${UI.cn(prov)} 的进攻！`);
      }
      retreat(b, survivors);
      endBattle(prov);
      continue;
    }
    updateBattleMarker(b);
  }
  UI.refreshWarPanel();
}
onDay(dailyBattles);

function killOfficer(officerId) {
  const idx = officerPool.findIndex(o => o.id === officerId);
  if (idx >= 0) {
    UI.notify(`☠️ 军官 ${officerPool[idx].name} 阵亡`);
    officerPool.splice(idx, 1);
  }
}

function retreat(b, survivors) {
  const { origin, owner } = b.attacker;
  if (survivors <= 0) return;
  // 撤回出发地；失守则找相邻己方省；再无则全军覆没
  let target = '';
  if (origin && window.__territoryOwner[origin] === owner) target = origin;
  if (!target) {
    const adj = provinceAdj[b.province] || new Set();
    for (const n of adj) {
      if (window.__territoryOwner[n] === owner && !battles[n]) { target = n; break; }
    }
  }
  if (!target && owner === window.__ownCountry) {
    UI.notify(`💔 ${UI.cn(b.province)} 攻势失败，退路被断，部队溃散`);
    return;
  }
  if (!target) return;
  UI.moveArmy({
    from: b.province, to: target, owner, troops: survivors, invade: false,
    officerId: b.attacker.officerId, silent: true,
  });
}

// ---------- 战斗标记 ----------
function updateBattleMarker(b) {
  const def = armies[b.province];
  const defOwner = window.__territoryOwner[b.province];
  const txt = `⚔${Math.round(b.attacker.troops / 100) / 10}k vs ${def ? (Math.round(def.troops / 100) / 10) + 'k' : '0'}`;
  if (b.marker && b.marker.update) {
    b.marker.update(txt, b.attacker.owner, defOwner);
  } else if (UI.makeBattleMarker) {
    b.marker = UI.makeBattleMarker(b.province, txt, b.attacker.owner, defOwner);
  }
}

// ---------- 存档 ----------
registerSave('battles',
  () => {
    const out = {};
    for (const [p, b] of Object.entries(battles)) {
      out[p] = { province: p, attacker: { ...b.attacker }, day: b.day };
    }
    return out;
  },
  (data) => {
    clearObj(battles);
    if (!data) return;
    for (const [p, b] of Object.entries(data)) {
      battles[p] = { ...b, marker: null };
      updateBattleMarker(battles[p]);
    }
  });
