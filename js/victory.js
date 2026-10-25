// ===== 胜负判定 =====
// 乌托邦 · 一期改造
import { nations, gameCtx, onDay, UI } from './state.js';

export function playerShare() {
  const me = window.__ownCountry;
  if (!me || !nations[me]) return 0;
  return nations[me].provinces.size / Math.max(1, gameCtx.totalProvinces);
}

export function checkEnd() {
  if (gameCtx.ended) return null;
  const me = window.__ownCountry;
  if (!me || !nations[me]) return null;
  const myProvinces = nations[me].provinces.size;
  if (myProvinces === 0) {
    gameCtx.ended = true; gameCtx.playerDead = true;
    return { type: 'defeat', title: '国土尽失', desc: '你的国家已被从地图上抹去。' };
  }
  const share = playerShare();
  if (share >= gameCtx.victoryShare) {
    gameCtx.ended = true;
    return { type: 'victory', title: '世界征服', desc: `你控制了 ${Math.round(share * 100)}% 的世界领土。` };
  }
  const greatAlive = Object.values(nations).filter(n => n.greatPower && n.alive && n.name !== me);
  if (greatAlive.length === 0) {
    gameCtx.ended = true;
    return { type: 'victory', title: '霸权确立', desc: '所有列强均已陨落，世界由你主宰。' };
  }
  return null;
}

function dailyVictory() {
  const r = checkEnd();
  if (r && UI.showEndScreen) UI.showEndScreen(r);
}
onDay(dailyVictory);
