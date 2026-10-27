import { describe, expect, it } from 'vitest'
import { titleCase } from './format'

describe('titleCase', () => {
  it('keeps abbreviations uppercase and saint/mount readable', () => {
    expect(titleCase('TRAVIS AFB')).toBe('Travis AFB')
    expect(titleCase('ST. MARY MEDICAL CENTER')).toBe('St. Mary Medical Center')
    expect(titleCase('VA MEDICAL CENTER OF THE OZARKS')).toBe('VA Medical Center of the Ozarks')
    expect(titleCase('MT. SINAI HOSPITAL')).toBe('Mt. Sinai Hospital')
  })
})
