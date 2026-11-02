# Hiking 网站全面优化 — 审计与交付报告

> 日期：2026-11-02 · 部署：GitHub Pages（`coros_sync.yml` 未改动 · 部署分支 `main`）
> 仓库：github.com/zhubao315/hiking · 基线提交 `afc4a52`

## 一、当前项目审计结果

### 项目源码审计

- 项目是 running_page（yihong0618）模板 fork，Vite + React + TS + Tailwind，构建入口 `vite build`，`PATH_PREFIX=/hiking` 由 CI 注入；`RunMap` / `RunTable` / `TerrainCard` / `JourneyStats` 沿用模板结构。
- **审计起点：hiking 站根本不存在 dashboard 层。** `src/pages/index.tsx` 是模板原始的自由堆叠（`SiteHero` → `YearsStat` → `SVGStat` → `LocationStat` → `JourneyStats` → `RunMap` + `RunTable` → `TerrainCard`），无编号、无双语标题规则、无统一统计口径文件，日历模块不存在。
- 与 running / cycling 两站相比，hiking 缺的是「同一套设计语言」：六个编号模块、英文 kicker 在上中文标题在下、日历收尾、`run_id` 全链路联动。
- 统计逻辑原本散落在组件内部，`JourneyStats` 直接吃跑步逻辑（马拉松场次、配速 `formatPace`），对徒步站会产出错误文案。
- 仓库工作区在 `main` 上干净（`afc4a52`），`src/static/activities.json` 与 `public/scenes/` 均为历史真实数据。

### 首页重复信息和不合理布局（旧版问题清单）

1. 同一组总里程 / 总次数被 `SiteHero`、`YearsStat`、`SVGStat`、`LocationStat` 重复展示 3–4 次。
2. 「最高海拔」与「累计爬升」在视觉上被混为一谈，没有任何覆盖率标注。
3. 跑步专属指标（配速 /km、马拉松、半马）渗入徒步页面。
4. 模块无编号、无双语标题，日历缺失，桌面与移动端排版顺序不一致。
5. 年份热力图（`YearsStat`）与日历职责重叠，但没有单日下钻。
6. 表格无排序、无 `run_id` 联动、`Climb` 列缺失，点击行与地图无关联。

## 二、历史数据规模及统计口径

### 审计十问答复

| # | 问题 | 结果 |
|---|------|------|
| 1 | 历史徒步数据有多少条？ | `src/static/activities.json` 中 `type: hiking` **344 条**（唯一 `run_id`，0 重复，0 丢弃）。 |
| 2 | 最早和最近一次徒步日期？ | 最早 **2013-01-03**，最近 **2026-10-27**（随每日 COROS 同步滚动）。 |
| 3 | 总徒步次数和总里程？ | **344 次 / 2,693.8 km**（平均 7.83 km/次）。徒步站不设最小距离门槛，`type: hiking` 与 `distance > 0`、`moving_time > 0` 为唯一准入条件。 |
| 4 | 总徒步时长和累计爬升？ | 移动时间 **2,669,810 s = 741 h 37 m**；累计爬升 **52,811 m，覆盖 230 / 344 次（66.9%）**。 |
| 5 | 有效 GPS 轨迹？ | `summary_polyline` **244 / 344（70.9%）**；`public/scenes/` 烘焙地形 **232 条**（3D 与剖面的唯一来源）。 |
| 6 | 海拔 / 心率 / 速度覆盖？ | `altitude_max` 232（67.4%）、`climb_terrain` 231（67.2%）、`elevation_gain` 180（52.3%）、`average_heartrate` 26（7.6%）。**无 elapsed_time、无功率、无踏频、无热量、无最高速度、无室内标记** —— 这些字段在徒步页一律不出现，不推算、不补零。 |
| 7 | 是否存在室内徒步？ | 源数据无 `indoor` / 室内 `subtype` 字段，徒步站不做室内外切换。 |
| 8 | 是否存在重复记录？ | `run_id` 唯一；`buildDataset` 以 `Set<run_id>` 去重，实测 **dropped = 0**。 |
| 9 | 数据源字段和统计口径一致性？ | `distance` 为米（页面 ÷1000 → km）；`moving_time` 是 **`H:MM:SS` 字符串**，经 `convertMovingTime2Sec` 转秒；`moving_time` 与 `elapsed_time` 严格区分，徒步站只有 `moving_time`，不做混算；`altitude_max` / `climb_terrain` / `elevation_gain` 均为米。 |
| 10 | 当前页面重复信息与不合理布局？ | 见「一 · 旧版问题清单」，全部在本次重建中修复。 |

### 统计口径声明（站点内可见）

- 展示数据一律来自 `src/static/activities.json`，统计单源 **`src/utils/hikingStats.ts`**，组件不再各自计算。
- **移动时间**：所有时长只用 `moving_time`（源数据本就没有可用 `elapsed_time`）。
- **累计爬升算法（显式、单一实现 `climbOf`）**：优先取 `climb_terrain`，缺失时回退 `elevation_gain`；随后做**合理性过滤**，不合理的值视为 `null` 而非 0：
  - 有 `altitude_max` 时，`gain ≤ 2.5 × altitude_max`，否则判为 GPS 噪声剔除；
  - 无 `altitude_max` 时，`gain ≤ 100 m/km × 里程`，否则剔除。
  - 原始数据不修改、不删除，只在统计层拒收，因此被剔除的记录仍在表格、地图、日历中可见。
- **累计爬升 ≠ 最高到达海拔**：前者是 `Σ climbOf(run)`，后者是 `MAX(altitude_max)`，两个独立指标、两张独立卡片，各自标注覆盖率。
- **覆盖率必须同屏**：任何爬升 / 海拔数字旁边都带 `覆盖 N / M 次（x%）`，缺数据的年份在趋势图里画 `–` 无数据点，绝不画 0。
- **地理**：只用 `location_country` 解析出的结构化省 / 市，**从未根据坐标反推地名**；覆盖 75 / 344（21.8%），页面直接写明覆盖率。
- **速度 / 配速**：徒步站不展示，`RunTable` 无 Pace 列。

## 三、最终首页模块结构

| 编号 | 英文 | 中文 | 渲染位置（真实 DOM 顺序） |
|------|------|------|--------------------------|
| 01 | Hiking Profile | 个人徒步档案 | `#profile` |
| 02 | Core Metrics | 核心徒步数据 | `#core` |
| 03 | Yearly Trend | 年度徒步趋势 | `#trend` |
| 04 | Total Journey | 徒步旅程 | `#journey` |
| 05 | Trail Explorer | 徒步探索（地图 + 全部记录 + 3D 地形） | `#explore` |
| 06 | Hiking Calendar | 徒步日历 | `#calendar`（**首页最后**） |

浏览器实测 `h2` 顺序：`个人徒步档案 → 核心徒步数据 → 年度徒步趋势 → 徒步旅程 → 徒步探索 → 徒步日历`；页面全站仅 **1 个 `h1`**（`zhubao315 的徒步与山野`，在 Profile 内），kicker `01–06` 与中文标题无重复。桌面与移动端 DOM 顺序完全一致（无 CSS `order` 伪装）。

## 四、每个模块的功能变化

### 01 Hiking Profile / 个人徒步档案

- 新建 `Profile.tsx`，复用 `site-metadata` 的站名 / 标语 / 头像，**取代原 `SiteHero` 避免重复 H1**。
- 内容：`2013—2026` 年跨度、`344 次徒步 · 2,693.8 km · 最高到达 1,424 m`、首次徒步 `2013.01.03`、最近一次（实时）、徒步活跃日 **297 天**、最长连续 **6 天**。
- 全部数字来自 `computeTotals`；无「大概」「约」类文案。

### 02 Core Metrics / 核心徒步数据

- 新建 `CoreMetrics.tsx`，一级卡片 ×4：**累计徒步里程 / 累计徒步时长 / 累计爬升 / 最高到达海拔**（刻意把「爬升」与「海拔」分成两张卡，避免混读）。
- 二级脚注：次数与平均距离、平均每次时长、爬升覆盖率、海拔覆盖率。
- 2026 默认范围实测：`111.1 km` / `34 h 14 m` / `5,240 m 覆盖 6/8（75%）` / `1,246 m 覆盖 6/8（75%）`。
- 缺数据一律 `—`，不出现 `0 m`。

### 03 Yearly Trend / 年度徒步趋势

- 新建 `YearTrend.tsx` + `TrendChart.tsx`，指标切换 **里程 / 次数 / 时长 / 爬升**（无配速）。
- 14 个真实年份柱（2013–2026，含 2019=58、2023=29 等真实回落），**2016 年无记录 → 不画 0 柱**；爬升指标下无爬升数据的年份画空心 `–` 点。
- 点击年份 → 直接切换 scope 并下钻该年月度分布；读出区显示该年 `次数 · km · 时长`，空年显示「这一年没有徒步记录」。

### 04 Total Journey / 徒步旅程

- 新建 `Journey.tsx`，六块内容全部来自真实 reduce：
  - **征程概要**：2,693.8 km / 741 h 37 m / 52,811 m / 1,424 m / 344 次 / 2013-01-03 / 297 天 / 连续 6 天。
  - **代表性徒步**：最长 36.51 km（2013-09-15）、最大爬升 1,873 m（2022-09-18 鹫峰）、最高到达 1,424 m（2022-10-01 长峪城）。
  - **地理足迹**：`仅 75 / 344 条记录带结构化地点（21.8%）`，北京市 71 次 · 677.47 km、河北省 / 陕西省 / 吉林省 / 河南省 各 1 次；城市列表 4 条。
  - **季节分布**：春 85 / 夏 70 / 秋 100 / 冬 89（可点击筛选）。
  - **出行时段**：清晨 119 / 午间 106 / 午后 71 / 傍晚 41 / 夜晚 7（可点击筛选）。
  - **山野里程碑**：长线（≥20 km）15 次、千米爬升（≥1,000 m）19 次、山路 61 次。
- **本模块复用页面级 `baseRuns` 数据集**（不走 `useActivities` 的另一套派生），确保与其余五个模块同一份 `run_id`。

### 05 Trail Explorer / 徒步探索

- `RunMap` + `RunTable` + `TerrainCard` 整合进 `#explore`，与 dashboard 共享数据与 ID。
- 地图：按年份 / 省 / 季节 / 时段 / 里程碑筛选后渲染 `geoJsonForRuns`，聚合随缩放变化，**不加载 GPX/FIT 全轨迹**。
- 表格重写为 **活动 / KM / Climb / Alt / Time / Date** 六列（**无 Pace**），支持按距离 / 爬升 / 海拔 / 时长 / 日期排序（空值永远排最后），分页 80（紧凑态 24），行内有 3D 标记。
- 3D 地形：`TerrainCard` 内 `VertTerrain` 懒加载，海拔剖面用 `@geekplux/vert` 的 `ElevationProfile`（高度 120，与 3D 视角 `scrub` 双向同步），**没有引入新依赖**；无烘焙场景的徒步不渲染剖面（不是空白占位）。

### 06 Hiking Calendar / 徒步日历

- 新建 `RunCalendar.tsx`，12 个月网格热力图，指标切换 **里程 / 爬升**；有记录但无爬升的日期**不着色**（不冒充 0）。
- 年份前后翻页 + `全年` 复位；点击某天 → `DayDetail` 列出当天全部徒步（同日多次逐条展示，不合并），每条含时间 / 名称 / 距离 / 爬升 / 海拔 / 时钟 / 3D 标记。
- 位于首页最后，桌面与移动端顺序一致。

## 五、新增的交互方式

1. **scope 初值同步计算**：默认年份取 `availableYears(runs)` 的最新真实年份（2026），**不用 `new Date().getFullYear()`**，不会出现「当前年无数据但被选中」。
2. 年份柱 / 年份胶囊 / 日历翻年 → 统一改 scope，地图、表格、指标、趋势读出同步。
3. 快捷筛选（省 / 季节 / 时段 / 里程碑）→ `QUICK_PREDICATE` 过滤，标题处显示 `quickLabel` 并给「清除筛选」。
4. Journey 纪录点击 → `focusRun(runId)`：从活动自身读出年 / 月 / 日并设 `selectedRunId`，随后滚到地图（一次点击即定位）。
5. 表格行 / 日历天格 → `selectRun` 开关式选中，地图高亮 + 3D 地形联动。
6. 年份胶囊支持**键盘操作**：`role="button"` + `tabIndex=0` + `aria-pressed` + Enter/Space（实测 2013 + Enter → scope「2013 年」，Total + Space → 「全部历史」）。

## 六、纪录数据关联方式

- 全站唯一 `run_id` 主键；纪录 → 详情 → 地图 → 3D 场景全程用 `run_id` **精确关联，不用日期 / 距离模糊匹配**。
- `DayDetail` 的单日聚合保留 `runs[]` 数组，同日多次徒步逐条可点。
- 3D 场景 `sceneHashOf` 由 `run.run_id` 直接映射 `public/scenes/`，无匹配则整块不渲染。
- 所有纪录可回溯到 `src/static/activities.json` 的原始字段，页面未对原始数据做任何写回。

## 七、地图与剖面性能优化方式

- 轨迹源是 `summary_polyline`（低折线），`geoJsonForRuns` 过滤 `points.length < 2` 的空 Feature，避免 MapLibre 空几何报错。
- 分页 80 条 + scope 过滤控制一次渲染的 Feature 数量；GPX/FIT 原始轨迹不进前端。
- `VertTerrain` 与剖面在 **`React.lazy` 独立 chunk**（`VertTerrain-*.js`，651 kB / gzip 173 kB），只在用户选中带场景的徒步时下载。
- 移动端：年份胶囊 ≤640px 改为**单行横向滑动条**（原来 14 个胶囊换成 7 行、遮住地图上部 210 px，现在只遮 46 px）；地图画布不被遮挡。

## 八、修改文件清单

```
新增（11）
src/utils/hikingStats.ts                          862 行  统计单源
src/components/HikingDashboard/index.tsx          207 行  模块编排
src/components/HikingDashboard/SectionHeader.tsx   29 行  编号 + 双语标题
src/components/HikingDashboard/Profile.tsx         69 行
src/components/HikingDashboard/CoreMetrics.tsx    125 行
src/components/HikingDashboard/YearTrend.tsx       61 行
src/components/HikingDashboard/TrendChart.tsx     190 行
src/components/HikingDashboard/Journey.tsx        238 行
src/components/HikingDashboard/RunCalendar.tsx    236 行
src/components/HikingDashboard/DayDetail.tsx      118 行
src/components/HikingDashboard/style.module.css  1487 行  桌面 + 移动断点

修改
src/pages/index.tsx                              六模块 DOM 顺序、scope 状态、focusRun
src/components/RunTable/index.tsx                重写：排序 / 分页 / 3D 标记 / 键盘
src/components/RunTable/RunRow.tsx               列与空值规则
src/components/RunTable/style.module.css         与 cycling 对齐 + 移动隐藏列
src/components/RunMap/index.tsx                  年份 props 对接、筛选后视图保持
src/components/RunMap/RunMapButtons.tsx          键盘 / aria / 移动端滑动条
src/components/RunMap/style.module.css           移动胶囊条 + focus-visible
src/components/TerrainCard/index.tsx             文案 赛道坐标 → 轨迹坐标
src/utils/utils.ts                               类型基线修复（5 行）
```

`dist/` 产物（本次构建）：`index-8064d6ef.js` 138 kB / gzip 44 kB、`index-8663e76a.css` 44.6 kB、`VertTerrain-3523307f.js` 651 kB（懒加载）、`activities-5b65417a.js` 1.04 MB（懒加载）。

## 九、构建和测试结果

| 项目 | 结果 |
|------|------|
| `tsc --noEmit` | ✅ 通过（另修复 5 个基线类型错误，原仓库即有） |
| `PATH_PREFIX=/hiking pnpm build` | ✅ 通过（6.7s） |
| 桌面 1440px | ✅ 1 个 `h1`、kicker 01–06 顺序正确、14 个年份胶囊、表格 6 列、`errors: []` |
| 移动 390px / 320px | ✅ `documentElement.scrollWidth == window.innerWidth`（390/320），无横向溢出 |
| 移动端表格 | ✅ 隐藏 Climb / Alt / Time，保留 KM 与 Date+时钟 |
| 移动端日历 | ✅ ≤520px 单列月历，日格 30 px（320）/ 40 px（390），选中环不再溢出邻格 |
| 移动端年份胶囊 | ✅ 单行可滑动（320：206×36，可用滑动 556 px），仅遮地图 46 px |
| 键盘可达性 | ✅ 胶囊 `role=button/tabIndex=0/aria-pressed`，Enter / Space 实测生效 |
| 3D + 剖面 | ✅ 选中 2013 场景后 canvas + svg 同时挂载，km 轴 0.2→17.0、爬升段 1–4 |
| 控制台 | ✅ 无页面错误（仅 MapLibre `found null instead` 与 WebGL 驱动警告，库级） |

## 十、尚未解决的问题

1. **爬升与海拔的字段级缺口**：`elevation_gain` 在 2017 / 2019 / 2020 / 2021 全为 0，`altitude_max` + `climb_terrain` 在 2019–2021 全为 0 —— 这四年趋势图与日历显示「无数据」而非 0，属真实数据状态。要补只能回头补原始记录，不能推算。
2. **地理覆盖仅 21.8%**：`location_country` 只有 75 条可用。省份计数保守（偏小），城市列表只有 4 条 —— 页面已写明覆盖率，不会根据 GPS 坐标反推地名。
3. **2016 年整年无记录**：年度趋势与年份胶囊都没有 2016，不做补零。
4. **共享组件文案分叉**：`TerrainCard` 的免责声明在 hiking 改为「轨迹坐标」，cycling 仍为「赛道坐标」—— 共享组件按站点微调，属有意分歧，已记录待统一。
5. **`@geekplux/vert` 上游英文串**：3D 区域内的 `Arrow keys rotate the terrain…` / `Elevation: AWS Terrain Tiles / Mapzen…` / `N climbs; steepest: …` 为上游硬编码，hiking 无法本地化；running / cycling 同问题。
6. **`scrollToMap()` 在 hiking 为 no-op**：它仍指向 running 的 `.fl.w-100.w-70-l`，hiking DOM 中不存在，属遗留死代码（不影响功能，点击后不自动滚动）。
7. **死代码保留**：`SiteHero` / `SVGStat` / `LocationStat` / `YearsStat` / `PeriodStat` / `RUN_TITLES` 残留未删除（`useActivities` 仍在派生不可靠的 `cities/provinces`），本次不动以免影响其他入口。
8. **每日 COROS 同步自动滚动**：总次数 / 总里程 / 覆盖率随 `coros_sync.yml`（未改动）每日更新，本报告数字为部署时快照。

---

**最终状态**：Hiking 已从「模板堆叠的徒步页面」升级为与 running / cycling 同一套设计语言的六模块户外档案 —— 以里程、时长、爬升、最高海拔、地理、季节、代表性徒步为主线（刻意弱化配速），累计爬升有显式且统一的口径与覆盖率，日历收尾，`run_id` 全链路联动，缺数据处一律 `—`。
