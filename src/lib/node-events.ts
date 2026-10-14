/** Canvas events a node card sends up to the editor (see Canvas.tsx). */

export const patchNode = (nodeId: string, patch: Record<string, unknown>) =>
  window.dispatchEvent(
    new CustomEvent("kun:update", { detail: { nodeId, patch } }),
  );

export const emitNode = (name: string, nodeId: string, extra: object = {}) =>
  window.dispatchEvent(new CustomEvent(name, { detail: { nodeId, ...extra } }));
