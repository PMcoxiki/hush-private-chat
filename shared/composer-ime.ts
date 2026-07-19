export type ComposerKeyState = {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  which?: number;
};

export function shouldSubmitComposerKey(
  event: ComposerKeyState,
  compositionActive: boolean,
) {
  if (event.key !== "Enter" || event.shiftKey) return false;
  if (compositionActive || event.isComposing) return false;
  return event.keyCode !== 229 && event.which !== 229;
}
