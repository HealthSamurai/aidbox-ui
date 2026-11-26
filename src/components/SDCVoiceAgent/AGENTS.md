# SDCVoiceAgent

Editor and test console for the `SDCVoiceAgent` resource, shown as the Builder tab of ResourceEditor (`/resource/SDCVoiceAgent/edit/:id`). Wired in `ResourceEditor/page.tsx` through `VoiceAgentBuilderContent`.

| File | Description |
|------|-------------|
| `agent-editor-page.tsx` | Builder tab: form on the left, conversation on the right, save and unsaved-changes guard |
| `agent-form.tsx`, `model-field.tsx`, `context-picker.tsx`, `grouped-combobox.tsx`, `prompt-review.tsx` | Agent settings form, prompt review |
| `use-agent-draft.ts` | Draft state of the agent |
| `conversation-panel.tsx`, `transcript.tsx`, `use-conversation.ts`, `browser-audio.ts` | Test conversation in the browser |
| `use-agent-run.ts`, `call-confirm-dialog.tsx`, `call-results.tsx` | Test run or a real call, and the answers extracted from it |
| `test-settings-dialog.tsx` | Test provider settings kept in local storage |
| `api.ts` | Requests to the box |
