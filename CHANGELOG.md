# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-21

Initial public release of **Platinum UI** — a cross-project Mac OS 9 Platinum design system, CSS primitive library, interactive gallery, automated gate suite, and global AI Agent Skill.

### Added

- **W3C DTCG design tokens (`tokens/platinum.tokens.json`)**: Zero-cast neutral light and dark metallic chassis (`R = G = B`), official `gray` default accent variant (monochrome silver scrollbars, charcoal menu highlights, slate blue focus/links), opt-in `lavender` variant (`data-platinum-accent="lavender"`), and `compact` (`26px` / `20px`) plus `comfortable` (`32px` / `24px`) density scales.
- **Zero-dependency layered CSS bundles (`dist/`)**: `platinum.css` (global + bare HTML element styling), `platinum-scoped.css` (`[data-platinum]` container-isolated), `platinum-core.css` (explicit `.pt-*` classes + `.pt-prose`), and `platinum-tokens.css` (tokens only).
- **Interactive Kitchen Sink gallery (`gallery/index.html`)**: Live switcher for Light/Dark scheme, Gray/Lavender accent, Compact/Comfortable density, and Active/Inactive window states, deployed via GitHub Pages.
- **Dual consumption and audit CLIs (`bin/`)**: `bin/build.mjs` (`--check` byte-exact drift gate), `bin/sync-vendor.mjs` (version + SHA-256 stamped single-file sync for zero-build projects), and `bin/platinum-check.mjs` (136-pair 4-quadrant WCAG AA audit, static CSS anti-trap scanner, doc/asset parity check, and optional headless Chromium 8-state geometry/centering probe).
- **Global AI Agent Skill (`skills/platinum-ui/`)**: Self-contained `SKILL.md` with platform reference guides for Electron frameless windows/top-most menus, `16px` pixel app icons, and CSS anti-patterns.
- **Bilingual documentation and reproducible `2×` screenshots**: English default `README.md`, Simplified Chinese `README.zh-CN.md`, `DESIGN.md`, and lossless WebP stage shot generator (`scripts/readme-shots.mjs`).

[Unreleased]: https://github.com/pine2D/platinum-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pine2D/platinum-ui/releases/tag/v0.1.0
