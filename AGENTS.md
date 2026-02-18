THE HTML PROJECT (THP) — OFFICIAL PROJECT CONTEXT AND ENGINEERING PHILOSOPHY FOR AI AGENTS

This repository contains the source code for a website and platform called:

The HTML Project (THP)
Primary site: https://thehtmlproject.com

This file provides full background context, architectural intent, design standards, asset references, reliability strategy, and security expectations so that AI agents (including Codex CLI) can generate changes that align with the real-world engineering goals of the project.

This file is intended to guide high-quality implementation.
It is not intended to artificially restrict engineering complexity.

================================================================

PROJECT IDENTITY AND GOALS

THP is a modern, security-first, reliability-focused, performance-optimized website platform built using:

HTML

CSS

JavaScript

Primary goals:

High reliability 

Strong security by default

Predictable performance

Consistent UI/UX across all pages and subprojects

Minimal reliance on large third-party frameworks

Long-term maintainability

Dark/light mode support

Reusable UI components

SEO and analytics compatibility

Predictable behavior under failure conditions

================================================================

ENGINEERING COMPLEXITY AND REDUNDANCY PHILOSOPHY

THP explicitly allows and encourages code complexity when that complexity serves one or more of the following purposes:

Redundancy (not the bad type, the type that makes it more reliable)

Fault tolerance

Graceful degradation

Defensive programming

Cross-browser reliability

Data integrity protection

State validation

Network failure recovery

Fallback rendering logic

Asset delivery failover

Client-side verification

Complexity is not viewed as a negative trait when it improves system reliability.

Examples of acceptable intentional complexity include:

Multiple fallback execution paths

Parallel state verification systems

Duplicate validation layers

Multi-stage error recovery

Redundant rendering logic for edge cases

Defensive DOM guards

Network retry logic with backoff

Asset fallback chains

Dual-mode theme synchronization systems

Fail-safe analytics loading

Code should favor:

Predictability over minimalism

Correctness over brevity

Reliability over elegance

Defensive safeguards over optimistic assumptions

Simplification is NOT a goal unless it demonstrably improves reliability, security, or performance.

================================================================

DESIGN SYSTEM — COLOR PALETTES

THP uses two main color palettes:

BOULDER (neutral UI greys)

50 #f6f6f6
100 #e7e7e7
200 #d1d1d1
300 #b0b0b0
400 #888888
500 #787878
600 #5d5d5d
700 #4f4f4f
800 #454545
900 #3d3d3d
950 #262626

SALEM (brand / accent greens)

50 #f2fbf5
100 #e1f7e9
200 #c5edd2
300 #97deb0
400 #62c685
500 #3cab64
600 #2a844a
700 #266f40
800 #235836
900 #1e492e
950 #0c2717

These palettes define the visual identity of THP and should be preferred for all UI coloring.

================================================================

GLOBAL PAGE STRUCTURE (STANDARD NON-REDIRECT PAGES)

Most THP pages follow this general structure:

<!DOCTYPE html> <html lang="en" data-theme="auto"> <head> <meta charset="UTF-8" /> <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/> <title>TITLE OF PAGE</title> <link rel="icon" href="https://assets.thehtmlproject.com/icon.jpeg" /> <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,300..900;1,300..900&display=swap" /> <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" /> <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin> <link rel="preconnect" href="https://www.google-analytics.com" crossorigin> <script defer src="https://assets.thehtmlproject.com/script/analytics/script.js" data-ga-id="G-4VCCFETV10"></script> <script defer src="https://assets.thehtmlproject.com/script/theme.js"></script> <meta name="color-scheme" content="light dark" /> <meta name="referrer" content="strict-origin-when-cross-origin" /> <meta http-equiv="X-Content-Type-Options" content="nosniff" /> <meta http-equiv="Permissions-Policy" content="geolocation=(), microphone=()" /> <link rel="stylesheet" href="LINK TO CSS SOURCE" /> </head> <body> PAGE CONTENT <script src="SCRIPT SOURCE" defer></script> </body> </html>

================================================================

FILE AND FOLDER CONVENTIONS

THP commonly uses a per-page folder structure such as:

/PageName/index.html
/PageName/style.css
/PageName/script.js

Examples:
/Links/index.html
/Links/style.css
/Links/script.js

/Homepage/index.html
/Homepage/style.css
/Homepage/script.js

This structure is preferred for separation of concerns and maintainability.

================================================================

PRIMARY BUTTON & LINK SYSTEM

THP uses a standardized button grid layout for navigation:

<nav class="main-links-grid" aria-label="Primary links"> <a href="LINK" class="link-button" target="_blank" rel="noopener noreferrer"> <span class="material-symbols-outlined">ICON_NAME</span> <span class="btn-text">BUTTON NAME</span> </a> </nav>

This system is designed for:

Structural consistency

Predictable spacing

Responsive behavior

Reuse across many pages

Supporting CSS exists in the project and should be reused unless a deliberate redesign is required.

================================================================

THEME SYSTEM (GLOBAL)

Theme control is handled by:

https://assets.thehtmlproject.com/script/theme.js

This system:

Syncs with OS dark/light preference

Allows manual override

Automatically updates the site logo

Updates the color-scheme meta tag

Stores user preference in localStorage under the key "theme"

Public API:
window.THPTheme.get()
window.THPTheme.set()
window.THPTheme.system()
window.THPTheme.refresh()

This is part of the core global site behavior.

================================================================

ANALYTICS SYSTEM

Analytics is handled by:

https://assets.thehtmlproject.com/script/analytics/script.js

This system:

Uses Google Analytics 4

Respects Do Not Track

Disables itself on localhost

Honors user consent stored under "thp-consent"

Provides an internal API:

window.THPAnalytics.setConsent()
window.THPAnalytics.event()
window.THPAnalytics.pageview()

This system is designed to be privacy-conscious while still useful for metrics.

================================================================

SECURITY PHILOSOPHY

THP follows a security-first design philosophy:

Strict referrer policy

No-sniff protection

Explicit permissions policy

Enforced rel="noopener noreferrer" on external links

Avoidance of inline JavaScript where possible

Preference for defer-loaded scripts

Avoidance of mixed HTTP/HTTPS

Conservative use of third-party scripts

Defense against XSS, CSRF, injection, and logic abuse

Security always outranks convenience or visual polish.

================================================================

PERFORMANCE PHILOSOPHY

Performance is a first-class engineering constraint:

Fast first paint is prioritized

Scripts are deferred or async

Blocking CSS is minimized

Preconnect is used where justified

Low memory pressure is favored

Animation timing is tuned

Asset delivery is optimized

Caching is used aggressively where safe

Any feature that negatively impacts performance must justify its existence.

================================================================

WORKFLOW CONTEXT

Typical workflow:

AI (Codex or Copilot) edits files locally

Human reviews in VS Code

Git is used for version control

Changes are pushed to a staging repository named "codeprivate"

Production deployment is handled manually and separately

================================================================

INTENT OF THIS FILE

This file exists to:

Provide deep project context

Align AI output with engineering goals

Improve reliability-focused code generation

Maintain visual and architectural consistency

Provide security and performance expectations

Improve the applicability of generated output

This file does not prohibit complexity.
It defines WHY complexity is allowed when it improves system reliability.
Do NOT use code comments.
Avoid M dashes, use - instead