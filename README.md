# 全国城市地铁可视化系统

全国地铁线路概览 + 单城市深度探索的交互式 Web 仪表板。

## 技术栈

- 前端：React 18 + Parcel + React Router + ECharts
- 数据：Python 脚本抓取高德地铁公开页面数据，清洗为前端 JSON（`data/`）

> 说明：原计划使用 Vite，但当前开发环境的沙箱禁止 esbuild 遍历用户目录，
> 导致 Vite 无法构建，故改用零配置且能力等价的 Parcel（开发服务器 + HMR + 代码分割）。

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5173
```

## 构建与预览

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地静态预览构建产物（SPA 回退已内置）
npm run start      # 构建并启动内网服务器（自动打印局域网地址）
```

## 部署

- **本地/内网**：`npm run start`，按启动日志中的局域网地址访问；
- **GitHub Pages**：`npm run deploy:pages`（需先设置 `GH_TOKEN`，详见 `outputs/07-本地与内网部署指南.md`）；
- **其他静态托管**：上传 `dist/`（应用为 Hash 路由，无需服务器配置）。

## 目录结构

```text
scripts/            Python 数据管线（抓取/清洗）+ Node 数据同步
data/               Python 管线生成的 JSON 数据集
  maps/china.json   中国地图 GeoJSON（阿里 DataV 公开数据，构建时懒加载）
src/
  data/             cityLoaders.js（自动生成：按城市懒加载 JSON）
  components/       通用组件（页头、数据面板、统计卡片）
  pages/            路由页面（全国概览 / 单城市详情）
  styles/           全局样式与设计变量
outputs/            阶段性交付报告
```

## 数据更新

```bash
python scripts/fetch_subway_data.py   # 抓取最新原始数据
python scripts/build_dataset.py       # 重新清洗生成 JSON
```
