import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ===== DaoFlow 设计令牌 =====
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 核心色板
        'cloud-white': '#F6F4F1',   // 云白（背景基底·宣纸暖感）
        'mist-gray': '#C9CDC8',     // 雾灰（分隔线/次级背景）
        'shadow-gray': '#7A8079',   // 山影灰（辅助文字）
        'ridge-blue': '#5B6670',    // 远山灰蓝（边框/图标默认色）
        'ink': '#23262A',           // 墨色（正文文字）
        'dawn-gold': '#D4B896',     // 晨光金（唯一点缀色，全站≤2%）
        'taiji-yin': '#1A1B1E',     // 太极阴
        'taiji-yang': '#F4F5F3',    // 太极阳
        // InkView 补充点缀色（仅限需要红/绿时使用）
        'cinnabar': '#b64232',      // 朱砂（印章/高亮）
        'jade': '#5c7f67',          // 玉色（自然/深度）
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'serif'],
      },
      letterSpacing: {
        'wide-title': '0.15em',
        'wider-title': '0.2em',
      },
      lineHeight: {
        'body': '2.2',              // 正文行高 = 字号×2.2
      },
      spacing: {
        'section-gap': '100px',     // 屏间留白缓冲区
      },
    },
  },
  plugins: [],
}
export default config
