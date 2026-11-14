# IFC company admin recording

Deliverable: `../ifc-demo.mp4`
Narration script: `../ifc-narration.md`

The walkthrough starts after login and covers Unit Management, user creation and bulk onboarding, Approver Management, Business Process Management, the read-only RACM Dashboard, and IFC reports. Example forms are cancelled without saving.

## Reuse the narration

The 18 ElevenLabs clips are retained in `tts-cache/`. `narration-cache.json` records their durations. Final recordings run in cache-only mode: missing clips cause an error rather than another paid generation.

From the repository root, in Git Bash:

```bash
node output/ifc-recording/run.mjs record
```

An authenticated recording session is required. Session credentials used for this recording are removed after delivery. The original browser account is not logged out.

The voice-over was generated once with ElevenLabs v4 and the English Eric voice. Local `.env` values are loaded in memory and are not copied into these scripts.

Browser capture uses the flow-video-recorder skill, Playwright, a 2560 by 1440 viewport, 2x rendering, cursor highlights, step captions, and H.264 CRF 16 encoding with AAC narration. Loading pauses in the control-detail transition are omitted while keeping the cached audio and subsequent screen timing aligned.
