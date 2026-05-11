// The orange sliver at the very top: a fake "OPS // CONTEXTUAL // SESSION
// ACTIVE" classification marking that signals the Hangar worldview. Pure
// decoration, deliberately above all chrome.
export function ClassificationBand({ text = "OPS // CONTEXTUAL // SESSION ACTIVE" }: { text?: string }) {
  return <div className="hg-class-band">{text}</div>;
}
