'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onScan: (text: string) => void
  paused?: boolean
}

export function QRScanner({ onScan, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)

  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return

    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    const reader = new BrowserMultiFormatReader()

    controlsRef.current = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoRef.current,
      (result) => {
        if (result) onScanRef.current(result.getText())
      }
    )
  }, [])

  useEffect(() => {
    if (!paused) {
      startScanner()
    } else {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [paused, startScanner])

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: '4/3' }}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      {/* scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-56 h-56">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-sm" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-sm" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-sm" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-sm" />
        </div>
      </div>
      <p className="absolute bottom-3 left-0 right-0 text-center text-white text-sm font-medium drop-shadow">
        {paused ? 'Scanned!' : 'Point at a club\'s QR code'}
      </p>
    </div>
  )
}
