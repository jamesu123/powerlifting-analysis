type KP = { x: number; y: number; score?: number }

const EDGES: [string, string][] = [
  ['left_shoulder','right_shoulder'],
  ['left_shoulder','left_elbow'],
  ['left_elbow','left_wrist'],
  ['right_shoulder','right_elbow'],
  ['right_elbow','right_wrist'],
  ['left_shoulder','left_hip'],
  ['right_shoulder','right_hip'],
  ['left_hip','right_hip'],
  ['left_hip','left_knee'],
  ['left_knee','left_ankle'],
  ['right_hip','right_knee'],
  ['right_knee','right_ankle'],
]

export function drawPose(
  ctx: CanvasRenderingContext2D,
  kps: Record<string, KP>,
  minScore = 0.3
) {
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,255,0,0.9)'
  ctx.fillStyle = 'rgba(0,255,0,0.9)'

  for (const [a,b] of EDGES) {
    const ka = kps[a], kb = kps[b]
    if (!ka || !kb) continue
    if ((ka.score ?? 1) < minScore || (kb.score ?? 1) < minScore) continue
    ctx.beginPath()
    ctx.moveTo(ka.x, ka.y)
    ctx.lineTo(kb.x, kb.y)
    ctx.stroke()
  }

  for (const key in kps) {
    const p = kps[key]
    if ((p.score ?? 1) < minScore) continue
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}