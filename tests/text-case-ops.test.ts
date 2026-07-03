import { describe, it, expect } from 'vitest'
import { toLowerCase, toUpperCase, toSentenceCase, toTitleCase } from '../src/utils/text-case-ops'

describe('toLowerCase', () => {
  it('returns empty string unchanged', () => {
    expect(toLowerCase('')).toBe('')
  })

  it('lowercases a single char', () => {
    expect(toLowerCase('A')).toBe('a')
  })

  it('lowercases a multi-word string', () => {
    expect(toLowerCase('Hello WORLD')).toBe('hello world')
  })

  it('leaves already-lowercase input unchanged', () => {
    expect(toLowerCase('hello world')).toBe('hello world')
  })

  it('lowercases cyrillic', () => {
    expect(toLowerCase('ПРИВЕТ')).toBe('привет')
  })
})

describe('toUpperCase', () => {
  it('returns empty string unchanged', () => {
    expect(toUpperCase('')).toBe('')
  })

  it('uppercases a single char', () => {
    expect(toUpperCase('a')).toBe('A')
  })

  it('uppercases a multi-word string', () => {
    expect(toUpperCase('Hello World')).toBe('HELLO WORLD')
  })

  it('leaves already-uppercase input unchanged', () => {
    expect(toUpperCase('HELLO WORLD')).toBe('HELLO WORLD')
  })

  it('uppercases cyrillic', () => {
    expect(toUpperCase('привет')).toBe('ПРИВЕТ')
  })
})

describe('toSentenceCase', () => {
  it('returns empty string unchanged', () => {
    expect(toSentenceCase('')).toBe('')
  })

  it('capitalizes a single char', () => {
    expect(toSentenceCase('a')).toBe('A')
  })

  it('capitalizes first letter and lowercases rest', () => {
    expect(toSentenceCase('hello world')).toBe('Hello world')
  })

  it('lowercases all-uppercase after first char', () => {
    expect(toSentenceCase('HELLO WORLD')).toBe('Hello world')
  })

  it('leaves already-sentence-case input unchanged', () => {
    expect(toSentenceCase('Hello world')).toBe('Hello world')
  })

  it('works with cyrillic', () => {
    expect(toSentenceCase('привет мир')).toBe('Привет мир')
  })

  it('capitalizes each sentence after . ! ?', () => {
    expect(toSentenceCase('hello. world! how are you? fine')).toBe('Hello. World! How are you? Fine')
  })

  it('capitalizes the start of each line', () => {
    expect(toSentenceCase('first line\nsecond line')).toBe('First line\nSecond line')
  })

  it('capitalizes paragraphs separated by blank lines', () => {
    expect(toSentenceCase('First para.\n\nsecond Para With Names.')).toBe('First para.\n\nSecond para with names.')
  })

  it('does not capitalize after a period without following space', () => {
    expect(toSentenceCase('example.com is a site')).toBe('Example.com is a site')
  })

  it('preserves leading whitespace', () => {
    expect(toSentenceCase('  hello. world')).toBe('  Hello. World')
  })
})

describe('toTitleCase', () => {
  it('returns empty string unchanged', () => {
    expect(toTitleCase('')).toBe('')
  })

  it('capitalizes a single char', () => {
    expect(toTitleCase('a')).toBe('A')
  })

  it('capitalizes a single word', () => {
    expect(toTitleCase('hello')).toBe('Hello')
  })

  it('capitalizes first letter of each word', () => {
    expect(toTitleCase('hello world')).toBe('Hello World')
  })

  it('lowercases rest of each word in all-uppercase input', () => {
    expect(toTitleCase('HELLO WORLD EXAMPLE')).toBe('Hello World Example')
  })

  it('leaves already-title-case input unchanged', () => {
    expect(toTitleCase('Hello World')).toBe('Hello World')
  })

  it('collapses multiple spaces', () => {
    expect(toTitleCase('hello   world')).toBe('Hello World')
  })

  it('works with cyrillic', () => {
    expect(toTitleCase('привет мир')).toBe('Привет Мир')
  })
})
