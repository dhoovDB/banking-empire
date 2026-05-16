# Banking Empire — Developer Guide

A browser-based banking simulation game built to teach real financial concepts 
through play. Players manage a community bank across 20 quarters, setting 
interest rates, hiring staff, and navigating crises. Built with React 18, 
HTML5 Canvas, and Vite. No backend — everything runs in the browser.

The game is intentionally whimsical — chibi characters, isometric branch, 
coins flying across the canvas. That whimsy is not decoration. It's what 
makes the education land. A player who is charmed sticks around long enough 
to learn. A player who is bored does not.

## Before you do anything

Run `/globalrules` for general context that applies to all repositories. 
It contains the delegation rules, approval gates, status reporting format, 
and architecture principles that govern every session. The rest of this 
file assumes those rules are active.

## Architecture

The codebase is split into four layers. Each layer only imports from 
layers to its left.
