// ===== 外交系统：关系、宣战、战争分数、和谈、同盟、傀儡 =====
// 乌托邦 · 一期改造
import {
  aohRes, nations, wars, relations, alliances, truces, justifying, gameCtx,
  warIdCounter, provinceAdj, addRelation, getRelation, hasTruce, setTruce, relKey,
  clearObj, clearArray, onDay, UI, registerSave,
} from './state.js';
import { transferProvince, endAllBattlesBetween } from './nations.js';

// ---- 战争参与判定（含宗主连带）----
function sideOf(war, name) {
  if (war.attackers.includes(name)) return 'atk';
  if (war.defenders.includes(name)) return 'def';
  // 傀儡跟随宗主
  const n = nations[name];
  if (n && n.overlord) {
    const os = sideOf(war, n.overlord);
    if (os) return os === 'atk' ? 'atk' : 'def';
  }
  return null;
}
export function isAtWar(a, b) {
  if (!a || !b || a === b) return false;
  for (const w of wars) {
    const sa = sideOf(w, a), sb = sideOf(w, b);
    if (sa && sb && sa !== sb) return true;
  }
  return false;
}
export function warsOf(name) {
  const out = [];
  for (const w of wars) if (sideOf(w, name)) out.push(w);
  return out;
}
export { sideOf };

// ---- 宣战 ----
export function declareWar(aggressor, defender, opts = {}) {
  if (aggressor === defender) return { ok: false, msg: '不能对自己宣战' };
  const a = nations[aggressor], d = nations[defender];
  if (!a || !d || !a.alive || !d.alive) return { ok: false, msg: '国家不存在或已灭亡' };
  if (isAtWar(aggressor, defender)) return { ok: false, msg: '已经处于战争状态' };
  const today = opts.today || { y: 2026, m: 1, d: 1 };
  if (hasTruce(aggressor, defender, today)) return { ok: false, msg: '停战期未过' };

  const war = {
    id: warIdCounter.n++,
    attackers: [aggressor],
    defenders: [defender],
    start: { ...today },
    daysActive: 0,
    score: { atk: 0, def: 0 },
    casualties: { atk: 0, def: 0 },
    capitalTaken: false,
  };
  wars.push(war);

  // 盟友参战：防守方盟友加入防御；进攻方盟友不自动加入（简化）
  if (alliances.length) {
    for (const [x, y] of alliances) {
      if (y === defender && nations[x] && nations[x].alive && !sideOf(war, x)) war.defenders.push(x);
      if (x === defender && nations[y] && nations[y].alive && !sideOf(war, y)) war.defenders.push(y);
    }
  }

  // 关系与支持度
  addRelation(aggressor, defender, -60);
  for (const other of Object.keys(nations)) {
    if (other !== aggressor && other !== defender) addRelation(aggressor, other, opts.justified ? -6 : -12);
  }
  d.warSupport = Math.min(100, d.warSupport + 10);
  a.warSupport = Math.max(0, a.warSupport - (opts.justified ? 4 : 15));
  gameCtx.worldTension = Math.min(100, gameCtx.worldTension + (a.greatPower || d.greatPower ? 15 : 6));

  const who = aggressor === window.__ownCountry ? '你' : UI.cn(aggressor);
  const whom = defender === window.__ownCountry ? '你' : UI.cn(defender);
  UI.notify(`📢 ${who} 对 ${whom} 宣战！${opts.justified ? '' : '（无战争借口，声望受损）'}`);
  UI.refreshDiploPanel();
  UI.refreshWarPanel();
  return { ok: true, war };
}

// ---- 战争事件（战斗系统上报）----
export function warEvent(evt) {
  if (evt.type === 'occupied') {
    for (const w of wars) {
      const sw = sideOf(w, evt.winner), sl = sideOf(w, evt.loser);
      if (sw && sl && sw !== sl) {
        w.score[sw] += 10;
        const ln = nations[evt.loser];
        if (ln) ln.warSupport = Math.max(0, ln.warSupport - 4);
        // 占领敌首都
        const defNat = nations[evt.loser];
        if (defNat && defNat.capital === evt.province && w.capitalTaken !== evt.winner) {
          w.capitalTaken = evt.winner;
          w.score[sw] += 15;
          UI.notify(`🏛️ ${UI.cn(evt.winner)} 攻占 ${UI.cn(evt.loser)} 的首都！`);
        }
      }
    }
  } else if (evt.type === 'casualties') {
    for (const w of wars) {
      const sa = sideOf(w, evt.attacker), sd = sideOf(w, evt.defender);
      if (sa && sd && sa !== sd) {
        w.casualties[sa] += evt.atkLoss;
        w.casualties[sd] += evt.defLoss;
        w.score[sd] += evt.atkLoss / 50;   // 每 50 伤亡 1 分（浮点累计）
        w.score[sa] += evt.defLoss / 50;
      }
    }
  } else if (evt.type === 'battleWon') {
    for (const w of wars) {
      const sw = sideOf(w, evt.winner), sl = sideOf(w, evt.loser);
      if (sw && sl && sw !== sl) w.score[sw] += 5;
    }
  }
}

// ---- 和平 ----
export function peaceOptions(war, forSide) {
  const my = war.score[forSide], their = war.score[forSide === 'atk' ? 'def' : 'atk'];
  const opts = [];
  const enemySide = forSide === 'atk' ? 'def' : 'atk';
  const enemyNations = (forSide === 'atk' ? war.defenders : war.attackers).map(n => nations[n]).filter(n => n && n.alive);
  const enemyCapTaken = war.capitalTaken && sideOf(war, war.capitalTaken) === forSide;
  opts.push({ id: 'white', name: '白和平（维持现状）', need: my >= -30 });
  opts.push({ id: 'annex', name: '割让边境省份', need: my >= 30 && my - their >= 20 });
  opts.push({ id: 'puppet', name: '扶植傀儡政权', need: my >= 80 && enemyCapTaken && enemyNations.length > 0 });
  return opts;
}

export function aiAcceptPeace(war, forSide, deal) {
  // AI 按战争分数与厌战度评估
  const my = war.score[forSide === 'atk' ? 'def' : 'atk']; // AI 是对面
  const their = war.score[forSide];
  const aiNations = (forSide === 'atk' ? war.defenders : war.attackers).map(n => nations[n]).filter(n => n && n.alive);
  if (!aiNations.length) return true;
  let willingness = 0.5 + (their - my) / 150;
  const avgSupport = aiNations.reduce((s, n) => s + n.warSupport, 0) / aiNations.length;
  willingness += (55 - avgSupport) / 120;
  if (deal === 'puppet') willingness -= 0.35;
  if (deal === 'annex') willingness -= 0.15;
  return Math.random() < Math.max(0.05, Math.min(0.95, willingness));
}

export function makePeace(war, winnerSide, deal, today) {
  const winnerNames = winnerSide === 'atk' ? war.attackers : war.defenders;
  const loserNames = winnerSide === 'atk' ? war.defenders : war.attackers;
  const idx = wars.indexOf(war);
  if (idx >= 0) wars.splice(idx, 1);
  // 清理战斗
  for (const a of winnerNames) for (const b of loserNames) endAllBattlesBetween(a, b);

  if (deal === 'annex') {
    // 胜方从败方身上割 score/12 个边境省
    const count = Math.min(8, Math.floor(war.score[winnerSide] / 12));
    let taken = 0;
    for (const loser of loserNames.slice()) {
      const ln = nations[loser];
      if (!ln || !ln.alive) continue;
      const border = [...ln.provinces].filter(p => {
        const pd = window.__territoryOwner[p];
        return pd === loser;
      });
      // 优先与胜方接壤的省
      border.sort((x, y) => {
        const ax = adjacencyToSet(x, winnerNames), ay = adjacencyToSet(y, winnerNames);
        return (ay ? 1 : 0) - (ax ? 1 : 0);
      });
      for (const p of border) {
        if (taken >= count) break;
        const newOwner = pickAnnexer(winnerNames, p);
        if (newOwner) { transferProvince(p, newOwner); taken++; }
      }
    }
    UI.notify(`🕊️ 和约签订：败方割让 ${taken} 个省份`);
  } else if (deal === 'puppet') {
    const mainLoser = loserNames.find(n => nations[n] && nations[n].alive && !nations[n].overlord);
    const mainWinner = winnerNames.find(n => n === window.__ownCountry) || winnerNames[0];
    if (mainLoser && mainWinner && nations[mainLoser]) {
      nations[mainLoser].overlord = mainWinner;
      addRelation(mainLoser, mainWinner, 80);
      UI.notify(`👑 ${UI.cn(mainLoser)} 成为 ${UI.cn(mainWinner)} 的傀儡国`);
    }
  } else {
    UI.notify('🕊️ 和约签订：白和平');
  }
  // 停战 2 年 + 关系恢复一些 + 厌战回落
  for (const a of winnerNames) {
    for (const b of loserNames) {
      setTruce(a, b, today || { y: 2026, m: 1, d: 1 }, 2);
      addRelation(a, b, 15);
      const na = nations[a], nb = nations[b];
      if (na) na.warSupport = Math.min(100, na.warSupport + 25);
      if (nb) nb.warSupport = Math.min(100, nb.warSupport + 25);
    }
  }
  gameCtx.worldTension = Math.max(0, gameCtx.worldTension - 10);
  UI.refreshWarPanel();
  UI.refreshDiploPanel();
  return true;
}

function adjacencyToSet(province, names) {
  const adj = provinceAdj[province];
  if (!adj) return false;
  for (const n of adj) if (names.includes(window.__territoryOwner[n])) return true;
  return false;
}
function pickAnnexer(winners, province) {
  for (const w of winners) {
    if (window.__territoryOwner[province] === w) return null;
  }
  return winners.find(w => adjacencyToSet(province, [w])) || winners[0];
}

// ---- 同盟 ----
export function canAlly(a, b) {
  return getRelation(a, b) >= 55 && !isAtWar(a, b) &&
    alliances.filter(([x, y]) => x === a || y === a).length < 2 &&
    alliances.filter(([x, y]) => x === b || y === b).length < 2;
}
export function formAlliance(a, b) {
  if (!canAlly(a, b)) return false;
  alliances.push([a, b]);
  addRelation(a, b, 25);
  UI.notify(`🤝 ${UI.cn(a)} 与 ${UI.cn(b)} 结成同盟`);
  return true;
}
export function breakAlliance(a, b) {
  const i = alliances.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (i >= 0) alliances.splice(i, 1);
  addRelation(a, b, -20);
}

// ---- 玩家造借口 ----
export function startJustify(target) {
  if (aohRes.diplomacy < 20) { UI.notify('外交点不足（需要20）'); return false; }
  if (justifying[target]) { UI.notify('正在制造借口中'); return false; }
  aohRes.diplomacy -= 20;
  justifying[target] = { daysLeft: 5 };
  UI.notify(`📜 开始对 ${UI.cn(target)} 制造战争借口（约5天）`);
  return true;
}
export function isJustified(target) { return justifying[target] && justifying[target].ready; }

// ---- 每日：战争计时/借口进度/关系漂移/AI自动和谈 ----
function dailyDiplomacy(today) {
  // 借口
  for (const t of Object.keys(justifying)) {
    const j = justifying[t];
    if (j.ready) continue;
    j.daysLeft--;
    if (j.daysLeft <= 0) {
      j.ready = true;
      if (nations[t] && nations[t].alive) UI.notify(`📜 对 ${UI.cn(t)} 的战争借口已就绪，可无惩罚宣战`);
    }
  }
  // 关系缓慢回归
  const keys = Object.keys(relations);
  for (let i = 0; i < keys.length; i += 3) { // 每日抽 1/3 漂移，省性能
    const k = keys[i];
    const v = relations[k];
    relations[k] = v > 0 ? Math.max(0, v - 0.2) : Math.min(0, v + 0.2);
  }
  // 战争天数 + AI 间自动和谈 + 灭国清战
  for (const w of wars.slice()) {
    w.daysActive++;
    const atkAlive = w.attackers.some(n => nations[n] && nations[n].alive);
    const defAlive = w.defenders.some(n => nations[n] && nations[n].alive);
    if (!atkAlive || !defAlive) {
      const winnerSide = atkAlive ? 'atk' : 'def';
      makePeace(w, winnerSide, 'white', today);
      continue;
    }
    // 玩家参与的战争不自动和谈（由玩家/AI求和）
    const playerIn = sideOf(w, window.__ownCountry);
    if (!playerIn || !window.__ownCountry) {
      const atkWeariness = avgWeariness(w.attackers), defWeariness = avgWeariness(w.defenders);
      const scoreDiff = w.score.atk - w.score.def;
      if (atkWeariness < 25 || defWeariness < 25 || w.daysActive > 720) {
        let winnerSide = scoreDiff >= 0 ? 'atk' : 'def';
        let deal = 'white';
        const ws = Math.abs(scoreDiff);
        if (ws >= 80) deal = 'puppet';
        else if (ws >= 30) deal = 'annex';
        makePeace(w, winnerSide, deal, today);
      }
    } else if (playerIn) {
      // AI 一方厌战 → 主动向玩家求和（弹窗）
      const enemySide = playerIn === 'atk' ? 'def' : 'atk';
      const enemies = (playerIn === 'atk' ? w.defenders : w.attackers).filter(n => nations[n] && nations[n].alive && !nations[n].isPlayer);
      if (enemies.length && avgWeariness(enemies) < 20 && !w.playerOffered) {
        w.playerOffered = true;
        UI.openPeaceOffer(w);
      }
    }
  }
  // 世界紧张度衰减
  gameCtx.worldTension = Math.max(0, gameCtx.worldTension - 0.15);
}
function avgWeariness(names) {
  const live = names.filter(n => nations[n] && nations[n].alive);
  if (!live.length) return 0;
  return live.reduce((s, n) => s + nations[n].warSupport, 0) / live.length;
}
onDay(dailyDiplomacy);

// ---- 存档 ----
registerSave('diplomacy',
  () => ({
    wars, alliances, truces,
    justifying,
    warId: warIdCounter.n,
    worldTension: gameCtx.worldTension,
  }),
  (data) => {
    clearArray(wars); clearArray(alliances);
    clearObj(truces); clearObj(justifying);
    if (!data) return;
    (data.wars || []).forEach(w => {
      wars.push({ ...w, playerOffered: false });
    });
    (data.alliances || []).forEach(a => alliances.push(a));
    Object.assign(truces, data.truces || {});
    Object.assign(justifying, data.justifying || {});
    warIdCounter.n = data.warId || wars.length + 1;
    gameCtx.worldTension = data.worldTension || 0;
  });
