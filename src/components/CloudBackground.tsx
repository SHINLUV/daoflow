'use client'
import { motion, type MotionValue } from 'framer-motion'
export default function CloudBackground({ fogIntensity }: { fogIntensity?: MotionValue<number> }) {
  return <div className="dao-reading-background" aria-hidden="true"><div /><motion.div style={{ opacity: fogIntensity }} /></div>
}
