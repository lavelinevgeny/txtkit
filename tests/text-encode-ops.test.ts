import { describe, it, expect } from 'vitest'
import { htmlEscape, htmlUnescape, urlEncode, urlDecode } from '../src/utils/text-encode-ops'

describe('htmlEscape', () => {
  it('returns empty string unchanged', () => {
    expect(htmlEscape('')).toBe('')
  })

  it('escapes < to &lt;', () => {
    expect(htmlEscape('<')).toBe('&lt;')
  })

  it('escapes > to &gt;', () => {
    expect(htmlEscape('>')).toBe('&gt;')
  })

  it('escapes & to &amp;', () => {
    expect(htmlEscape('&')).toBe('&amp;')
  })

  it('escapes " to &quot;', () => {
    expect(htmlEscape('"')).toBe('&quot;')
  })

  it('escapes an HTML tag', () => {
    expect(htmlEscape('<div>hello</div>')).toBe('&lt;div&gt;hello&lt;/div&gt;')
  })

  it('escapes multiple special chars in correct order', () => {
    expect(htmlEscape('<a href="test">&</a>')).toBe(
      '&lt;a href=&quot;test&quot;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('leaves plain text unchanged', () => {
    expect(htmlEscape('hello world')).toBe('hello world')
  })

  it('handles cyrillic', () => {
    expect(htmlEscape('привет')).toBe('привет')
  })
})

describe('htmlUnescape', () => {
  it('returns empty string unchanged', () => {
    expect(htmlUnescape('')).toBe('')
  })

  it('unescapes &lt; to <', () => {
    expect(htmlUnescape('&lt;')).toBe('<')
  })

  it('unescapes &gt; to >', () => {
    expect(htmlUnescape('&gt;')).toBe('>')
  })

  it('unescapes &amp; to &', () => {
    expect(htmlUnescape('&amp;')).toBe('&')
  })

  it('unescapes &quot; to "', () => {
    expect(htmlUnescape('&quot;')).toBe('"')
  })

  it('unescapes an HTML tag', () => {
    expect(htmlUnescape('&lt;div&gt;hello&lt;/div&gt;')).toBe('<div>hello</div>')
  })

  it('unescapes multiple entities', () => {
    expect(
      htmlUnescape('&lt;a href=&quot;test&quot;&gt;&amp;&lt;/a&gt;'),
    ).toBe('<a href="test">&</a>')
  })

  it('leaves plain text unchanged', () => {
    expect(htmlUnescape('hello world')).toBe('hello world')
  })

  it('round-trips with htmlEscape', () => {
    const original = '<script>alert("&")</script>'
    expect(htmlUnescape(htmlEscape(original))).toBe(original)
  })
})

describe('urlEncode', () => {
  it('encodes a space as %20', () => {
    expect(urlEncode(' ')).toBe('%20')
  })

  it('encodes "hello world"', () => {
    expect(urlEncode('hello world')).toBe('hello%20world')
  })

  it('encodes special characters', () => {
    expect(urlEncode('a&b=c')).toBe('a%26b%3Dc')
  })

  it('encodes cyrillic', () => {
    expect(urlEncode('привет')).toBe(
      '%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82',
    )
  })

  it('leaves alphanumeric and unreserved chars unchanged', () => {
    expect(urlEncode('abc123-_.~')).toBe('abc123-_.~')
  })

  it('returns empty string unchanged', () => {
    expect(urlEncode('')).toBe('')
  })
})

describe('urlDecode', () => {
  it('decodes %20 to space', () => {
    expect(urlDecode('%20')).toBe(' ')
  })

  it('decodes "hello%20world"', () => {
    expect(urlDecode('hello%20world')).toBe('hello world')
  })

  it('decodes special characters', () => {
    expect(urlDecode('a%26b%3Dc')).toBe('a&b=c')
  })

  it('decodes cyrillic', () => {
    expect(urlDecode('%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82')).toBe(
      'привет',
    )
  })

  it('returns empty string unchanged', () => {
    expect(urlDecode('')).toBe('')
  })

  it('round-trips with urlEncode', () => {
    const original = 'hello world! @#$%^&*()'
    expect(urlDecode(urlEncode(original))).toBe(original)
  })

  it('throws on invalid percent-encoding', () => {
    expect(() => urlDecode('%ZZ')).toThrow()
  })
})
