# 乌托邦 3D战略游戏 - 上下文恢复文档
最后更新：2026-06-26（会话2）

## 项目概述
基于 Three.js 的 3D 地球战略游戏，模仿 AOH3 的**UI风格、游戏机制和玩法**。
单文件 HTML（`index.html`，~3100行），包含所有 CSS/JS/HTML。
GitHub仓库：https://github.com/mr2820404807-art/3d-Earth-game

## ⚠️ 本次会话的惨痛教训

### 绝对不能做的事
1. **永远不要用 `git checkout` 覆盖工作目录**——除非100%确认不需要恢复
2. **永远不要用 `git stash` 后做 `Copy-Item` 备份**——stash会把修改版藏起来
3. **永远不要用正则 `[\s\S]*?` 做大范围替换**——会吃掉多个函数定义
4. **每次编辑前先 `Copy-Item` 备份当前版本**
5. **edit工具的 old_string 匹配会吃掉相邻代码**
6. **批量编辑后立即检查重复函数定义**——模块严格模式，重复声明报语法错误
7. **从备份恢复代码要用完整提取**——substring 必须包含闭合括号
8. **actor工具重写整个文件时会丢失关键函数**——永远保留备份，不要信任actor的完整重写
9. **函数重复声明是最常见的报错**——`function xxx` 在同一作用域出现两次会 SyntaxError

### 正确的备份流程
```powershell
Copy-Item "index.html" "index_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').html"
```

## 文件版本管理
- **index_backup_v4.html**（最新备份）
- **index.html**：当前工作版本（~3100行）
- **GitHub main分支**：已push到 ce1b9a8

## 游戏名称
- 标题：**乌托邦**（Utopia · 3D Strategy）

## 已实现的功能

### UI布局（AOH3风格）
- **顶栏(#aoh-top-bar)**：国旗+国名 | 💰金币/📊经济/👥人力/🤝外交/🏛威望/🏘人口/📈增长率/⚔战争/🚀弹道导弹 | 时间控制
  - 悬浮资源图标显示 .tip 提示框（自定义CSS，非浏览器title）
  - 点击国旗弹出暂停菜单
  - 点击外交资源弹出外交关系弹窗
  - 时间暂停时屏幕中间显示"已 暂 停"
- **左侧边栏(#aoh-left-sidebar)**：10个地图模式按钮（目前只弹通知）
- **底部军事栏(#aoh-bottom-panel)**：🎖军官/⚒重组 + 军团数/上限/军官数
- **右侧信息面板(#aoh-right-panel)**：点击**自己国家的省份**时显示
  - 省份经济、人口、增长率
  - 建筑列表（可建造/升级，非沿海省份不显示港口）
  - 航天科技公司（全国唯一）→ 解锁航天科技工厂
  - 征兵按钮（20金+500人力）
  - **其他国家省份只显示基础信息，没有建筑和征兵**
- **右侧功能按钮(#aoh-side-btns)**：科技树/任务/法律/宫廷/战争
  - 无右侧面板时贴屏幕最右边
  - 有右侧面板时自动左移288px紧贴面板
- **科技树弹窗**：20个科技，带研究天数和独特加成
- **军官弹窗**：招募/刷新候选军官
- **军团管理弹窗**：指派/卸任军官
- **外交弹窗**：点击顶栏外交弹出
- **暂停菜单**：继续游戏/返回主菜单
- **暂停指示器**：时间暂停时屏幕中央显示"已 暂 停"

### 游戏系统

#### 经济系统
- `countryEconomyData`：60+国家真实GDP分配(0-100)
- `aohTickEconomy()` 每个时间刻度结算
  - 金币收入 = (经济-30) × 1.5 × (1 + 科技加成goldIncome)
  - 人力增长 = 经济 × 0.5
  - 威望：经济>60时+1，<40时-1
  - 外交点 = 经济×0.04 + 科技加成diploTick
  - 经济变化：经济>60时12%概率+1，<40时12%概率-1，中间8%随机

#### 人口增长率系统
- `countryPopulationData`：60+国家真实人口（万人单位）
- `countryGrowthRateData`：各国基础年增长率（%）
- `aohCalcGrowthRate(eco, baseRate)`：
  - 经济≥80：+0.06/经济点
  - 经济50-79：+0.03/经济点
  - 经济30-49：-0.02/经济点差
  - 经济<30：-0.04/经济点差
  - 限制在 [-2%, +5%]
- `aohTickPopulation()`：每24个时间单位更新一次
  - 密度制约：人口接近50万时增长趋缓
  - 人力上限 = 人口 × 5%

#### 省份建筑系统
- `provinceData`：按 `国家::省份` 存储，每个省份独立经济值（名称hash随机变异±20）
- `buildingDefs`：7种建筑
  | 建筑 | 图标 | 基础费用 | 效果 | 上限 |
  |------|------|----------|------|------|
  | 陆上交通 | 🛤 | 30金 | 军队移速+15%/级 | Lv.5 |
  | 海上运输 | 🚢 | 80金 | 经济+8/级（仅沿海） | Lv.5 |
  | 基础设施 | 🏗 | 50金 | 经济+5/级 | Lv.5 |
  | 农业开发 | 🌾 | 20金 | 经济+2/级 | Lv.5 |
  | 军营 | 🏕 | 60金 | 军团上限+3/级 | Lv.5 |
  | 航天科技公司 | 🛰 | 500金 | 全国唯一 | Lv.1 |
  | 航天科技工厂 | 🏭 | 1000金 | 解锁导弹生产 | Lv.1 |
- **建造有时间成本**：farm 1天、road 2天、infra/barrack 3天、port 4天、工厂8天、公司10天
- 每天（8个tick）倒计时一次，建筑中显示"建造中 X天"
- **沿海判断**：`coastalCountries` 国家列表（非 `inlandExceptions` 省份）
- `aohTickProvinceBuildings()`：每刻度自动提升省份经济

#### 科技树系统
- 20个科技，每个有：名称、图标、费用、研究天数、加成描述、apply函数
- 研究机制：同一时间只能研究一个，每刻度推进一天
- 全局加成 `aohTechBonuses`：armyAtk/armyDef/goldIncome/diploTick/popGrowth/infraCost/roadCost/navalMaint/allCost

#### 军官系统
- 5种专长：攻击(⚔)/防御(🛡)/机动(🐎)/围城🏰/指挥(🎖)
- 每个军官有：名称、等级(Lv.1-3)、基础攻击/防御、专长加成、招募费用
- 军团有：baseAttack、baseDefense、officer（可指派/卸任）
- 军官加成叠加到军团上

#### 弹道导弹系统
- 航天科技公司（全国唯一）→ 解锁航天科技工厂
- 每个航天科技工厂每8个时间单位（1天）生产1枚导弹
- 导弹无上限，显示在顶栏🚀图标旁

#### 军队移动系统
- 点击军队国旗 → 左下角弹出操作面板（移动/重组/解散/合并）
- **移动**：进入移动模式 → 点击目标省份 → 军队沿路径移动
- **路径寻路**：BFS在邻接图上找最短路径
- **邻接检测**：包围盒重叠+0.3度容差
- **移动动画**：Catmull-Rom曲线平滑移动，沿路径经过所有中间省份
- **路线绘制**：红色曲线显示移动路径
- **移动速度**：与游戏时间联动，暂停时停止，加速时加快
- **解散**：回收人力到人力池

#### 军队显示
- 省份上的军队显示为小国旗+兵力数字sprite
- 仅缩放距离 < 2.5 时显示
- 点击军队国旗选中 → 弹出操作面板

#### 暂停系统
- 按钮||/空格键切换暂停
- 暂停时屏幕中央显示"已 暂 停"
- 暂停菜单：点击国旗或Escape打开

#### 时间系统
- 每日8个时段（00:00-21:00），每月自动进位
- 速度等级：x0/x1/x2/x4/x8/x16
- advanceTime/tickTime 被包装，每刻度调用：
  aohTickEconomy → aohTickPopulation → aohTickProvinceBuildings → aohTickTech → aohTickMissiles → aohTickConstruction → aohTickArmyMovement

#### 国家选择
- 点击地球→射线检测→省份/国家级选择→预览国旗→确认→资源初始化→进入游戏
- 没有省级区划的国家：放大时按province级别处理，弹出右侧面板

#### 框选系统
- 鼠标中键拖拽→蓝色矩形→松开→投影省份中心到屏幕→高亮选中
- 显示框选结果面板

#### 星空跟随
- 每帧强制同步：`sg.rotation.y = earthGroup.rotation.y`

#### 地球创建
- `createAtmosphere()`：内外两层大气光晕
- `createBumpMap()`：程序化凹凸贴图
- 贴图加载：earth_hd.jpg → 亮度平衡处理 → 创建MeshStandardMaterial
- `createBorderOverlay()`：加载GeoJSON → 国境线+省界线+国名标签+首都星+国家颜色填充
- 需要加载两个GeoJSON：ne_50m_admin_0_countries + ne_50m_admin_1_states_provinces

### 按键
- **Space**：暂停/继续时间
- **Escape**：取消选择 / 关闭弹窗 / 关闭暂停菜单
- **滚轮缩放**：仅游戏阶段可用
- **鼠标中键**：框选省份
- **左键拖拽**：旋转地球

## 关键架构决策

### 事件监听必须在 document 上
所有 `renderer.domElement.addEventListener` 改为 `document.addEventListener`，handler内检查 `e.target !== renderer.domElement` 过滤。

### advanceTime 被包装
```js
const advanceTime = function() { _origAdvanceTime(); aohTickEconomy(); aohTickPopulation(); aohTickProvinceBuildings(); aohTickTech(); aohTickMissiles(); aohTickConstruction(); aohTickArmyMovement(); };
```

### ID命名约定
- HTML按钮用 `btn-xxx` 格式（btn-slower, btn-faster, btn-pause）
- AOH3面板元素用 `aoh-xxx` 格式
- 值显示用 `val-xxx` 格式
- 注意：**不要混用** `btn-xxx` 和 `aoh-xxx` 作为同一元素的ID

### armyMarkers 和 armyTrailGroup 必须在 earthGroup 之后声明
它们是 earthGroup 的子对象，声明位置必须在 `const earthGroup = new THREE.Group()` 之后。

### `getProvinceCenter` 用最大环的顶点平均值
对于凹形省份（如甘肃），重心可能偏到边缘。直接用最大环的顶点平均值更居中。

## 编辑注意事项

1. **earthGroup 不能丢**
2. **mouseNormY / mouseScreenX / mouseScreenY 不能删**
3. **`opacity: 0` 不等于 `pointer-events: none`**
4. **单文件3000+行，必须外科手术式编辑**
5. **edit工具的正则替换极度危险**
6. **编辑前必须备份**
7. **批量编辑后检查重复函数**——严格模式不允许重复声明
8. **actor重写整个文件会丢失关键函数**——永远保留备份

## 本次会话丢失/恢复过什么
- 早期修改版被 `git checkout` 覆盖 → 从GitHub恢复
- actor重写丢失 createBorderOverlay（34KB）→ 从backup_v2提取恢复
- actor重写丢失 earth creation 代码 → 手动补回
- 多次出现重复函数声明导致 SyntaxError → 手动查找删除

## 文件路径
- 项目主文件：`c:\Users\28204\MIMO code\3d-earth\index.html`
- 备份文件：`index_backup_v4.html`（最新）
- 地球贴图：`earth_hd.jpg`
- AOH3游戏参考：`d:\DOWNLOAD\aoh\历史时代三 虚革 电脑版 1.4.1\`
  - FAQ文档：`game/_FAQ/`（Buildings.txt、Laws.txt、Technology.txt、Units.txt等）
  - 游戏数据：`game/gameValues/GV_Move.json`、`GV_Army.json`、`GV_GameUpdate.json`
- GitHub仓库：https://github.com/mr2820404807-art/3d-Earth-game

## 待实现功能
- 地图模式实际切换
- 任务/法律/宫廷/战争系统
- 重组/合并功能（军队面板中）
- 外交关系影响游戏数值
- 军官攻击/防御/机动加成实际应用到战斗
- 航天科技工厂导弹生产的实际用途（宣战/攻击）
- 更多国家完整数据
- **邻接检测可能仍需调优**——包围盒重叠法对某些省份可能仍不准确
