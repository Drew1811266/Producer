# Producer Phase 0 + Module A Backend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Tauri v2-compatible Rust backend under `src-tauri/` that can load a declaration-based template manifest, bootstrap a project, open an existing project, summarize a project session, and persist the required SQLite schema and seed data.

**Architecture:** Keep the Tauri command surface thin and implement the actual behavior in pure Rust domain modules so tests do not depend on a running Tauri app. Embed migrations and the `ecommerce_ad_v1` template manifest as backend resources, validate the manifest on load, and use a small path abstraction layer to keep project roots and asset-relative paths deterministic across platforms.

**Tech Stack:** Rust, Tauri v2, `rusqlite`, `serde`, `serde_json`, `uuid`, `tempfile`

---

### Task 1: Scaffold The Backend Crate

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

Create crate-level tests that import the library crate and assert the backend exposes template and project APIs expected by the commands.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backend::tests::lists_embedded_template`
Expected: FAIL because the crate and API do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the Tauri crate skeleton and a library entrypoint that can host domain modules and commands.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backend::tests::lists_embedded_template`
Expected: PASS

### Task 2: Add Template Resource Loading And Validation

**Files:**
- Create: `src-tauri/resources/templates/ecommerce_ad_v1.json`
- Create: `src-tauri/src/domain/template.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

Add tests for:
- loading `ecommerce_ad_v1`
- validating layer whitelist entries
- rejecting invalid manifest shapes in isolated validation tests

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml template`
Expected: FAIL because loading and validation are not implemented.

- [ ] **Step 3: Write minimal implementation**

Implement typed manifest structs, a loader that embeds JSON with `include_str!`, and validation that enforces allowed layer type names and root graph seed presence.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml template`
Expected: PASS

### Task 3: Add SQLite Storage, Migrations, And Project Bootstrap

**Files:**
- Create: `src-tauri/resources/migrations/0001_init.sql`
- Create: `src-tauri/src/domain/storage.rs`
- Create: `src-tauri/src/domain/project.rs`
- Create: `src-tauri/src/domain/pathing.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

Add tests for:
- create/open project success
- invalid project detection
- migration idempotency
- root Brief graph seeding only
- relative asset path handling

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml project`
Expected: FAIL because the project services, migrations, and path helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement:
- project directory creation: `.producer/`, `.producer/project.db`, `.producer/settings.json`, `assets/`, `exports/`
- schema migrations for `project_meta`, `graphs`, `nodes`, `edges`, `assets`, `asset_derivatives`, `node_assets`, `jobs`, `app_events`, and `search_documents`
- project meta persistence and root graph seed insertion
- path normalization and asset-relative path calculation

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml project`
Expected: PASS

### Task 4: Expose Tauri Commands And Final Verification

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

Add tests that exercise the same command-facing request/response functions used by:
- `list_available_templates`
- `create_project`
- `open_project`
- `get_project_session`

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml commands`
Expected: FAIL because the command wrappers are not wired.

- [ ] **Step 3: Write minimal implementation**

Add serializable request/response contracts, thin command wrappers, and a `run()` entrypoint that registers the commands with Tauri v2.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS
