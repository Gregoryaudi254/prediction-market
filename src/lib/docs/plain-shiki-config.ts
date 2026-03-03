import type { Root } from 'hast'
import type { HighlighterCore } from 'shiki'
import { defineShikiConfig } from 'fumadocs-core/highlight/config'

function createPlainHast(code: string): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {
          className: ['shiki', 'shiki-plain'],
        },
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: {},
            children: [
              {
                type: 'text',
                value: code,
              },
            ],
          },
        ],
      },
    ],
  }
}

function createPlainHighlighter(): HighlighterCore {
  const highlighter = {
    getBundledLanguages() {
      return {}
    },
    getLoadedLanguages() {
      return ['text']
    },
    getTheme() {
      return {}
    },
    getLanguage() {
      return {}
    },
    async loadTheme() {
    },
    async loadLanguage() {
    },
    codeToHast(code: string) {
      return createPlainHast(code)
    },
  }

  return highlighter as unknown as HighlighterCore
}

export const plainShikiConfig = defineShikiConfig({
  defaultThemes: {
    themes: {
      light: 'none',
      dark: 'none',
    },
  } as never,
  createHighlighter: async () => createPlainHighlighter(),
})
