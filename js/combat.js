// ===== 战斗系统：多日战斗解算、邻接图（陆+海）、占领与撤退 =====
// 乌托邦 · 一期改造
import { lonLatDist, nameHash, coastalCountries } from './data.js';
import {
  armies, battles, nations, wars, provinceData, provinceAdj, seaAdj, provinceCenter,
  officerPool, playerMods, sieges, logEvent, clearObj, onDay, UI, registerSave,
} from './state.js';
import { transferProvince, endBattle } from './nations.js';
import { isAtWar, warEvent } from './diplomacy.js';

// 军官战斗经验（参照 GV_Generals：参战+经验、胜战加成，每100点随机涨一项属性）
function grantOfficerXP(officerId, xp) {
  if (!officerId) return;
  const off = officerPool.find(o => o.id === officerId);
  if (!off) return;
  off.xp = (off.xp || 0) + xp;
  while (off.xp >= 100) {
    off.xp -= 100;
    const stats = Object.keys(off.stats);
    const pick = stats[Math.floor(Math.random() * stats.length)];
    if (off.stats[pick] < 15) {
      off.stats[pick]++;
      if (off.name) UI.notify(`🎖️ ${off.name} 历战成长：${ { attack: '进攻', defense: '防御', mobility: '机动', siege: '围攻', command: '指挥' }[pick] } +1`);
    }
  }
}

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

// 分帧构建：3000+ 省的坐标扫描与配对如果同步做会阻塞主线程半秒以上，
// 开局动画会冻住一瞬。这里按每片 ≤40ms 拆到多帧执行，期间寻路会暂时
// 走不到（findPathDays 返回 null → 进攻转空投/移动回原地的兜底已存在）。
export function buildAdjacency() {
  return new Promise((resolve) => {
    const geo = window.__provincesGeoJSON;
    if (!geo) { resolve(); return; }
    // 邻接表只取决于地理数据，纯静态：已构建则直接复用（引导页期间预构建一次）
    if (Object.keys(provinceCenter).length > 0) { resolve(); return; }

    // 阶段1：逐省扫描坐标（分帧）
    const items = [];
    const feats = geo.features;
    let fi = 0;
    const scanOne = (f) => {
      const name = f.properties.name;
      if (!name || !f.geometry) return;
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
      if (cn === 0) return;
      provinceCenter[name] = { lon: cx / cn, lat: cy / cn };
      items.push({ name, box: { minX, maxX, minY, maxY }, coastal: false });
    };
    const phase1 = () => {
      const t0 = performance.now();
      while (fi < feats.length && performance.now() - t0 < 12) scanOne(feats[fi++]);
      if (fi < feats.length) { setTimeout(phase1, 16); return; }
      phase2();
    };

    // 阶段2：空间网格配对（分帧；网格必须在 phase1 填完 items 后才建）
    const MARGIN = 0.25, CELL = 4;
    let grid = null;
    const cellsOf = (box) => {
      const out = [];
      const x0 = Math.floor((box.minX - MARGIN) / CELL), x1 = Math.floor((box.maxX + MARGIN) / CELL);
      const y0 = Math.floor((box.minY - MARGIN) / CELL), y1 = Math.floor((box.maxY + MARGIN) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) out.push(cx + ',' + cy);
      return out;
    };
    const overlap = (a, b, m) => !(a.maxX < b.minX - m || b.maxX < a.minX - m || a.maxY < b.minY - m || b.maxY < a.minY - m);
    let ii = 0;
    const phase2 = () => {
      if (!grid) {
        grid = new Map();
        items.forEach((it) => {
          for (const k of cellsOf(it.box)) {
            let arr = grid.get(k);
            if (!arr) grid.set(k, arr = []);
            arr.push(it);
          }
        });
      }
      const t0 = performance.now();
      while (ii < items.length && performance.now() - t0 < 12) {
        const a = items[ii++];
        if (!provinceAdj[a.name]) provinceAdj[a.name] = new Set();
        for (const k of cellsOf(a.box)) {
          const arr = grid.get(k);
          if (!arr) continue;
          for (const b of arr) {
            if (b === a) continue;
            if (!overlap(a.box, b.box, MARGIN)) continue;
            if (lonLatDist(provinceCenter[a.name], provinceCenter[b.name]) > 8) continue;
            provinceAdj[a.name].add(b.name);
            provinceAdj[b.name] = provinceAdj[b.name] || new Set();
            provinceAdj[b.name].add(a.name);
          }
        }
      }
      if (ii < items.length) { setTimeout(phase2, 16); return; }
      phase3();
    };

    // 阶段3：海路（沿海子集，分帧）
    const phase3 = () => {
      const t0 = performance.now();
      // 沿海标记
      for (const it of items) {
        const pd = provinceData[it.name];
        it.coastal = !!(pd && pd.isCoastal);
        if (!it.coastal && !pd) {
          const admin = adminOfProvince(it.name);
          if (admin && coastalCountries.has(admin)) it.coastal = true;
        }
      }
      const coastal = items.filter(it => it.coastal);
      for (let ci = 0; ci < coastal.length; ci++) {
        if (performance.now() - t0 > 12) {
          setTimeout(() => phase3From(ci), 16);
          return;
        }
        const a = coastal[ci];
        const cand = [];
        for (const b of coastal) {
          if (a === b) continue;
          if (provinceAdj[a.name] && provinceAdj[a.name].has(b.name)) continue;
          const d = lonLatDist(provinceCenter[a.name], provinceCenter[b.name]);
          if (d < 15) cand.push([b.name, d]);
        }
        cand.sort((x, y) => x[1] - y[1]);
        seaAdj[a.name] = new Set(cand.slice(0, 4).map(c => c[0]));
      }
      resolve();
    };
    const phase3From = (start) => {
      const t0 = performance.now();
      const coastal = items.filter(it => it.coastal);
      for (let ci = start; ci < coastal.length; ci++) {
        if (performance.now() - t0 > 12) { setTimeout(() => phase3From(ci), 16); return; }
        const a = coastal[ci];
        const cand = [];
        for (const b of coastal) {
          if (a === b) continue;
          if (provinceAdj[a.name] && provinceAdj[a.name].has(b.name)) continue;
          const d = lonLatDist(provinceCenter[a.name], provinceCenter[b.name]);
          if (d < 15) cand.push([b.name, d]);
        }
        cand.sort((x, y) => x[1] - y[1]);
        seaAdj[a.name] = new Set(cand.slice(0, 4).map(c => c[0]));
      }
      resolve();
    };
    phase1();
  });
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
  // 要塞未破需先围城（参照 GV_Siege：堡垒等级延长占领）
  const pd = provinceData[province];
  const fortLv = pd ? (pd.fortLv || 0) : 0;
  if (fortLv > 0) {
    sieges[province] = {
      attacker: { ...attacker },
      daysLeft: 2 + fortLv * 2,
    };
    if (attacker.owner === window.__ownCountry) {
      UI.notify(`🏰 ${UI.cn(province)} 堡垒未克，转入围城（约 ${sieges[province].daysLeft} 天）`);
    }
    return;
  }
  finishOccupy(province, attacker, prevOwner);
}

function finishOccupy(province, attacker, prevOwner) {
  transferProvince(province, attacker.owner);
  armies[province] = { owner: attacker.owner, troops: attacker.troops, officerId: attacker.officerId || null };
  UI.updateArmyMarker(province, attacker.troops, attacker.owner);
  warEvent({ type: 'occupied', province, winner: attacker.owner, loser: prevOwner });
  grantOfficerXP(attacker.officerId, 40 + Math.round(Math.random() * 40));
  if (attacker.owner === window.__ownCountry) {
    UI.notify(`🏁 占领 ${UI.cn(province)}！`);
    logEvent(`${UI.cn(prevOwner)}的${UI.cn(province)}被你占领`, 'war');
  } else if (nations[prevOwner] && nations[prevOwner].greatPower) {
    logEvent(`${UI.cn(prevOwner)}的${UI.cn(province)}被${UI.cn(attacker.owner)}攻占`, 'war');
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
    const fortDef = (provDef ? (provDef.fortLv || 0) * 0.10 : 0);
    const defPower = def.troops
      * (1.25 + defNat.milTech * 0.05 + officerBonus(def.officerId, 'defense') + ((provDef ? provDef.barrackLv : 0) * 0.04) + fortDef + (isPlayerDef ? playerMods.def : 0))
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
      grantOfficerXP(b.attacker.officerId, 25 + b.day * 6);
      grantOfficerXP(def.officerId, 12);
      endBattle(prov);
      continue;
    }
    if (b.attacker.troops < Math.max(80, b.attacker.startTroops * 0.35) || b.day >= 10) {
      const survivors = b.attacker.troops;
      if (b.attacker.officerId && Math.random() < 0.3) killOfficer(b.attacker.officerId);
      warEvent({ type: 'battleWon', province: prov, winner: defOwner, loser: b.attacker.owner });
      grantOfficerXP(def.officerId, 25 + b.day * 6);
      grantOfficerXP(b.attacker.officerId, 12);
      if (isPlayerAtk) {
        UI.notify(`💔 对 ${UI.cn(prov)} 的攻势失败（第${b.day}天），残部 ${survivors} 人撤退`);
      } else if (isPlayerDef) {
        UI.notify(`🛡️ 击退了 ${UI.cn(b.attacker.owner)} 对 ${UI.cn(prov)} 的进攻！`);
      }
      retreat(b, survivors);
      endBattle(prov);
      continue;
    }
    // 参战军官日常经验
    grantOfficerXP(b.attacker.officerId, 4);
    grantOfficerXP(def.officerId, 4);
    updateBattleMarker(b);
  }

  // ---- 围城结算（要塞）----
  for (const prov of Object.keys(sieges)) {
    const s = sieges[prov];
    const def = armies[prov];
    const provOwner = window.__territoryOwner[prov];
    // 守军回防：围城转为野战
    if (def && def.troops > 0 && def.owner !== s.attacker.owner) {
      delete sieges[prov];
      startBattle(prov, s.attacker);
      continue;
    }
    // 已停战/攻方灭亡：围城解除
    if (!isAtWar(s.attacker.owner, provOwner) || !nations[s.attacker.owner] || !nations[s.attacker.owner].alive) {
      retreat({ attacker: s.attacker, province: prov }, s.attacker.troops);
      delete sieges[prov];
      continue;
    }
    s.daysLeft--;
    if ((s.attacker.owner === window.__ownCountry || provOwner === window.__ownCountry) && s.daysLeft % 5 === 0) {
      UI.notify(`🏰 ${UI.cn(prov)} 围城中，还剩 ${s.daysLeft} 天`);
    }
    if (s.daysLeft <= 0) {
      delete sieges[prov];
      finishOccupy(prov, s.attacker, provOwner);
    }
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
