---
name: Angular runtime compatibility
description: Angular and package-firewall constraints for the l4ht app toolchain.
---

l4ht uses Angular 20 because the managed Node.js runtime is 24.13.0, below Angular 22's minimum of 24.15.0. Angular 20's build package pins Piscina 5.2.0, which the package firewall rejected; a workspace-scoped override selects 5.3.2 instead.

**Why:** The latest Angular setup failed on the managed Node version and its dependency firewall. Preserve a compatible toolchain unless the runtime and package availability change.

**How to apply:** Check the active Node.js version before an Angular major upgrade. If the build package's exact Piscina pin is blocked, use a scoped override only after confirming a compatible, available patch release.