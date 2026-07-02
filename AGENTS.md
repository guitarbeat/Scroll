# Deslop & Clean-Code Architecture Guidelines

This file defines the core visual, architectural, and behavior constraints for this application. These rules are automatically loaded by the AI system to maintain a professional, high-performance, and beautifully crafted codebase.

## 1. Absolute Scope Discipline (The Ceiling Rule)
- **Implement exactly what is requested**: Treat the user's explicit requirements as the maximum functional boundary. Never volunteer secondary screens, extra settings panels, unprompted navigation sidebars, or mock data tabs.
- **Single-View Integrity**: Unless multi-screen navigation or a complex workspace is requested, design the entire app within a single, highly refined viewport.
- **No Unsolicited Integrations**: Do not integrate external APIs, AI models, or cloud databases unless the user specifically initiates that feature.

## 2. Anti-AI-Slop & Architectural Honesty
- **No System-Simulation Clutter**: Do not decorate the UI with synthetic system telemetry, network status indicators (e.g., "● ONLINE", "PING: 14ms"), mock server log lists, port info (e.g., "PORT 3000"), or technical larping widgets.
- **Humble, Human Labeling**: Use standard, clear, literal terms for all buttons and panels. Never use hyperbolic or overly dramatic branding unless explicitly requested.
- **Pristine Outer Backgrounds**: Keep the outer workspace completely clean, empty, and uniform. The focus must remain entirely on the canvas or primary application cards.

## 3. High-Fidelity UI & Typography Pairings
- **Visual Rhythm**: Avoid monotonous margins. Create visual structure through balanced variations in padding, spacious gutters, and deliberate layout weights.
- **Typography Pairing**: 
  - **Display / Headings**: Crisp, modern "Space Grotesk" or clean modern sans-serif.
  - **Body / Controls**: High-legibility "Inter" for UI elements.
  - **Data / Stats**: High-contrast "JetBrains Mono" or "Fira Code" for precise coordinate metrics and status lists.
- **Micro-interactions**: Use subtle scale feedback (`active:scale-95`), clean transitions (`transition-all duration-200`), and elegant hover overlays to make interactions feel responsive and tactile.

## 4. Solid State & Event Handling
- **No Camera Discrepancies**: Maintain the camera locks strictly at origin (`x: 0, y: 0, z: 1`) to ensure perfect alignment between drawing layers and parchment backgrounds.
- **Clean In-Memory Store**: Keep state lightweight, direct, and local to prevent IndexedDB transaction leaks or storage lifecycle crashes during active edits.
