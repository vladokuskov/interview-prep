'use client'

import { useRouter } from 'next/navigation'
import { BehavioralDrill, type DrillQuestion } from '@/components/BehavioralDrill'

export function BehavioralDrillClient({
  question,
  rubricLabels,
}: {
  question: DrillQuestion
  rubricLabels: Record<string, string>
}) {
  const router = useRouter()
  return <BehavioralDrill question={question} rubricLabels={rubricLabels} onNext={() => router.refresh()} />
}
