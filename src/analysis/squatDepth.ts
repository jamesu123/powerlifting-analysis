export type KP = { x: number; y: number; score?: number }
export type Frame = { t: number; kps: Record<string, KP> }
export type Finding = { t: number; title: string; detail: string }

function dist(a: KP, b: KP) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function depthStatusAtFrame(kps: Record<string, KP>) {
  const hipL = kps['left_hip'], kneeL = kps['left_knee']
  const hipR = kps['right_hip'], kneeR = kps['right_knee']
  const shL = kps['left_shoulder'], shR = kps['right_shoulder']

  const scoreOk = (p?: KP) => (p?.score ?? 1) >= 0.4

  let torso = NaN
  if (shL && hipL) torso = dist(shL, hipL)
  else if (shR && hipR) torso = dist(shR, hipR)
  if (!Number.isFinite(torso) || torso < 10) return { ok: false as const, reason: 'torso_unknown' as const }

  const margin = 0.03 * torso // strict-ish threshold scaled to body size in pixels

  const evalSide = (hip?: KP, knee?: KP) => {
    if (!hip || !knee) return { valid: false, deep: false, delta: NaN }
    if (!scoreOk(hip) || !scoreOk(knee)) return { valid: false, deep: false, delta: NaN }
    const delta = hip.y - knee.y // >0 means hip lower than knee (good)
    return { valid: true, deep: delta > margin, delta }
  }

  const L = evalSide(hipL, kneeL)
  const R = evalSide(hipR, kneeR)

  if (!L.valid && !R.valid) return { ok: false as const, reason: 'low_confidence' as const }

  // strict: take the worse (shallower) side
  const candidates = [L, R].filter(s => s.valid)
  const worst = candidates.reduce((a, b) => (a.delta < b.delta ? a : b))
  return { ok: true as const, deep: worst.deep, delta: worst.delta, margin }
}

export function analyzeSquatDepth(frames: Frame[]): Finding[] {
  const out: Finding[] = []
  if (frames.length < 5) return out

  // bottom = max hip y (lowest point on screen)
  let bottom = frames[0]
  for (const f of frames) {
    const hip = f.kps['left_hip'] ?? f.kps['right_hip']
    const hipB = bottom.kps['left_hip'] ?? bottom.kps['right_hip']
    if (hip && hipB && hip.y > hipB.y) bottom = f
  }

  const d = depthStatusAtFrame(bottom.kps)

  if (!d.ok) {
    out.push({
      t: bottom.t,
      title: '深度無法可靠判定（置信度/遮擋/角度）',
      detail: '請用側面、全身入鏡、光線足、相機固定；髖與膝不要被護膝/腰帶/槓片遮到。',
    })
    return out
  }

  if (!d.deep) {
    out.push({
      t: bottom.t,
      title: '深度不足（競賽紅燈風險極高）',
      detail: `最低點髖未明顯低於膝（Δy=${d.delta.toFixed(1)}，門檻≈${d.margin.toFixed(1)}）。競技不要擦邊：下一組再多坐下去一點，寧可更深。`,
    })
  } else {
    out.push({
      t: bottom.t,
      title: '深度 OK（以本影片側面判讀）',
      detail: `最低點髖低於膝（Δy=${d.delta.toFixed(1)}，門檻≈${d.margin.toFixed(1)}）。保持每一下深度一致，避免最後幾下變淺。`,
    })
  }

  return out
}