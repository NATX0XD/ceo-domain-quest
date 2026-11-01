'use client'

import { animate, stagger } from 'animejs'
import { useEffect, useRef } from 'react'

type DecoProps = { scene?: 'sky' | 'island' | 'night'; tone?: 'bright' | 'purple' }

export function DecoLayer({ scene = 'sky', tone = 'bright' }: DecoProps) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = root.current
    if (!node) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const floats = Array.from(node.querySelectorAll<HTMLElement>('[data-deco-float]'))
    const reveals = Array.from(node.querySelectorAll<HTMLElement>('[data-deco-reveal]'))
    const animations = reduce ? [] : floats.map((el, i) => animate(el, {
      translateY: i % 2 ? [-8, 8] : [8, -8],
      rotate: i % 2 ? [-2, 2] : [2, -2],
      duration: 2600 + i * 340,
      ease: 'inOutSine',
      loop: true,
      alternate: true,
    }))
    if (reduce) reveals.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none' })
    else {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        animate(reveals, { opacity: [0, 1], translateY: [18, 0], delay: stagger(90), duration: 650, ease: 'out(4)' })
        observer.disconnect()
      }, { rootMargin: '0px 0px -12% 0px' })
      reveals.forEach((el) => observer.observe(el))
      return () => { observer.disconnect(); animations.forEach((animation) => animation.pause()) }
    }
    return () => animations.forEach((animation) => animation.pause())
  }, [])

  return <div ref={root} className={`ld-deco ld-deco--${scene} ld-deco--${tone}`} aria-hidden="true">
    <div className="ld-deco-scene" />
    <img className="ld-deco-props ld-deco-props--one" data-deco-float src="/landing/deco/props-coins-boat.webp" alt="" loading="lazy" />
    <img className="ld-deco-props ld-deco-props--two" data-deco-float src="/landing/deco/props-signs-palms.webp" alt="" loading="lazy" />
    <span className="ld-deco-orb ld-deco-orb--a" data-deco-float data-deco-reveal />
    <span className="ld-deco-orb ld-deco-orb--b" data-deco-float data-deco-reveal />
  </div>
}
