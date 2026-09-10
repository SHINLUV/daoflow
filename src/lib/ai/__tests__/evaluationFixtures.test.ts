import { describe, expect, it } from 'vitest'
import { DAO_EVALUATION_FIXTURES } from '../evaluation/fixtures'

describe('Dao v2 evaluation fixture coverage', () => {
  it('keeps the required 30 regular, 20 injection, and 10 high-risk or ambiguous cases unexecuted', () => {
    expect(DAO_EVALUATION_FIXTURES.filter(item => item.category === 'regular')).toHaveLength(30)
    expect(DAO_EVALUATION_FIXTURES.filter(item => item.category === 'prompt_injection')).toHaveLength(20)
    expect(DAO_EVALUATION_FIXTURES.filter(item => item.category === 'high_risk_or_ambiguous')).toHaveLength(10)
    expect(DAO_EVALUATION_FIXTURES.every(item => item.evidenceStatus === 'not_run')).toBe(true)
  })
})
