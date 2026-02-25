import { useEffect, useRef, useState } from 'react'
import * as posedetection from '@tensorflow-models/pose-detection'
import { createMoveNetDetector } from './pose/movenet'
import { drawPose } from './ui/draw'
import { analyzeSquatDepth, type Frame } from './analysis/squatDepth'

function fmtTime(t: number) {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [detector, setDetector] = useState<posedetection.PoseDetector | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [findings, setFindings] = useState<{ t: number; title: string; detail: string }[]>([])

  useEffect(() => {
    createMoveNetDetector().then(setDetector)
  }, [])

  async function onPickFile(file: File) {
    const url = URL.createObjectURL(file)
    setFindings([])
    setStatus('影片載入中…')
    if (videoRef.current) {
      videoRef.current.src = url
      await videoRef.current.play().catch(() => {})
      videoRef.current.pause()
      setStatus('就緒。按「開始分析」。')
    }
  }

  async function analyze() {
    if (!detector) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setBusy(true)
    setFindings([])
    setStatus('分析中（完全本機）…')

    const targetW = 640
    const rawW = video.videoWidth || targetW
    const rawH = video.videoHeight || 360
    const scale = targetW / rawW
    canvas.width = targetW
    canvas.height = Math.round(rawH * scale)

    const fps = 5
    const step = 1 / fps
    const duration = Math.min(video.duration || 0, 20)

    const frames: Frame[] = []

    for (let t = 0; t <= duration; t += step) {
      video.currentTime = t
      await new Promise<void>((res) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          res()
        }
        video.addEventListener('seeked', onSeeked)
      })

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const poses = await detector.estimatePoses(canvas, { maxPoses: 1, flipHorizontal: false })
      const pose = poses[0]
      if (pose?.keypoints?.length) {
        const kps: Record<string, { x: number; y: number; score?: number }> = {}
        for (const kp of pose.keypoints) {
          if (!kp.name) continue
          kps[kp.name] = { x: kp.x * scale, y: kp.y * scale, score: kp.score }
        }
        drawPose(ctx, kps)
        frames.push({ t, kps })
      }

      setStatus(`分析中… ${Math.round((t / duration) * 100)}%`)
    }

    const results = analyzeSquatDepth(frames)
    setFindings(results)
    setStatus(`完成。樣本點：${frames.length}（${fps}fps，≤20秒）`)
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: 980, margin: '20px auto', fontFamily: 'system-ui' }}>
      <h2>Powerlifting Analysis（本機）</h2>
      <p style={{ opacity: 0.85 }}>
        模式：<strong>深蹲—深度（嚴格競技）</strong>。側面、全身入鏡、光線足。影片不會上傳。
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
        <button disabled={!detector || busy} onClick={analyze}>
          {busy ? '分析中…' : '開始分析'}
        </button>
        <span style={{ opacity: 0.8 }}>{detector ? '模型就緒' : '模型載入中…'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
        <div>
          <video ref={videoRef} controls style={{ width: '100%' }} />
          <p style={{ marginTop: 8 }}>{status}</p>
        </div>

        <div>
          <canvas ref={canvasRef} style={{ width: '100%', border: '1px solid #ddd' }} />
          <h3>判定/建議</h3>
          {findings.length === 0 ? (
            <p style={{ opacity: 0.7 }}>尚無結果</p>
          ) : (
            <ul>
              {findings.map((f, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  <strong>[{fmtTime(f.t)}] {f.title}</strong>
                  <div style={{ opacity: 0.9 }}>{f.detail}</div>
                  <button onClick={() => videoRef.current && (videoRef.current.currentTime = f.t)}>跳到時間點</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}