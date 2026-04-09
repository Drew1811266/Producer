# Producer

Producer is a local-first desktop workspace for AI-era visual creators. It organizes briefs, storyboard shots, prompts, references, reviews, and outputs as a layered graph-of-graphs instead of a generic whiteboard or task board.

Producer 是一个面向 AI 时代视觉创作者的本地优先桌面工作台。它把 brief、storyboard、prompt、reference、review 与 result 组织成分层语义图，而不是通用白板、看板或可执行节点流。

## Current Scope / 当前能力

- Create or open a local Producer project with `.producer/`, `assets/`, and `exports/`.
- Load the `ecommerce_ad_v1` template manifest with strict layer and node whitelist validation.
- Seed the root `Brief Canvas` and enter a canvas-first workspace shell.
- Persist project metadata in SQLite through a Rust domain core exposed by a thin Tauri bridge.

## Tech Stack / 技术栈

- Desktop shell: Tauri v2
- Core domain: Rust
- Storage: SQLite via `rusqlite`
- UI shell: React 19 + TypeScript + Vite
- Canvas/UI libraries: PixiJS, React Flow
- Tests: Vitest, Testing Library, Cargo test

## Quick Start / 快速开始

### Requirements / 环境要求

- Node.js 20+
- npm 10+
- Rust stable toolchain

### Install / 安装依赖

```bash
npm ci
```

### Frontend dev / 前端开发

```bash
npm run dev
```

### Desktop app / 桌面应用

```bash
npm run tauri:dev
```

### Production build / 生产构建

```bash
npm run build
```

The frontend build is emitted to `src-tauri/frontend-dist/` for Tauri packaging and is intentionally not checked into Git.

## Quality Checks / 质量检查

```bash
npm run lint
npm test
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features
```

## Project Structure / 目录结构

```text
.
├── docs/                 # Product, architecture, and internal planning docs
├── public/               # Static public assets
├── src/                  # React renderer and interaction layer
└── src-tauri/            # Rust domain core, migrations, and Tauri shell
```

## Docs / 文档入口

- [Documentation index](./docs/README.md)
- [Product vision / 产品愿景](./docs/product/product_vision.md)
- [V1 roadmap / V1 路线图](./docs/product/roadmap_v1.md)
- [Architecture draft / 架构草案](./docs/architecture/architecture.md)
- [Data model / 数据模型](./docs/architecture/data_model.md)

## Roadmap / 路线图

The current baseline covers the Phase 0 + Module A bootstrap. The near-term goal is a usable `brief -> storyboard -> shot lab` local workflow with stable graph navigation, node editing, fast creation, and persistence.

当前仓库实现的是 Phase 0 + Module A 的启动基线。近期目标是跑通 `brief -> storyboard -> shot lab` 的本地创作闭环，补齐图中图导航、节点编辑、快速加点和持久化能力。

## License / 许可证

Released under the [MIT License](./LICENSE).
