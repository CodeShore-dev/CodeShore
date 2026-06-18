module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'on-primary': '#ffffff',
        'on-background': '#001f2a',
        outline: '#737784',
        'on-tertiary-fixed': '#1b1c1c',
        'tertiary-fixed': '#e4e2e1',
        tertiary: '#424242',
        error: '#ba1a1a',
        'inverse-on-surface': '#e0f4ff',
        'surface-variant': '#c9e7f7',
        'primary-fixed': '#d9e2ff',
        'surface-container-low': '#e6f6ff',
        'on-secondary-fixed-variant': '#753400',
        'surface-bright': '#f4faff',
        'on-secondary-fixed': '#321200',
        background: '#f4faff',
        'on-tertiary-fixed-variant': '#474746',
        'on-error-container': '#93000a',
        'secondary-fixed-dim': '#ffb68c',
        'tertiary-fixed-dim': '#c8c6c5',
        'secondary-container': '#fd7700',
        primary: '#003d92',
        'outline-variant': '#c3c6d5',
        'on-tertiary-container': '#d2d0d0',
        'on-secondary-container': '#5a2600',
        'on-surface-variant': '#434653',
        'on-primary-fixed-variant': '#00429c',
        'surface-container-high': '#ceedfd',
        'secondary-fixed': '#ffdbc9',
        'primary-container': '#1654b9',
        'tertiary-container': '#5a5959',
        'on-surface': '#001f2a',
        'on-tertiary': '#ffffff',
        'surface-container-lowest': '#ffffff',
        secondary: '#9a4600',
        'on-primary-container': '#bfd0ff',
        'surface-dim': '#c0dfee',
        'inverse-primary': '#b0c6ff',
        'inverse-surface': '#163440',
        'error-container': '#ffdad6',
        'surface-tint': '#1f59be',
        'primary-fixed-dim': '#b0c6ff',
        'on-error': '#ffffff',
        'surface-container-highest': '#c9e7f7',
        'on-secondary': '#ffffff',
        'on-primary-fixed': '#001945',
        surface: '#f4faff',
        'surface-container': '#d9f2ff',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      fontFamily: {
        headline: ['Inter'],
        body: ['Inter'],
        label: ['Inter'],
      },
      keyframes: {
        bounceLeft: {
          '0%, 100%': {
            transform: 'translateX(0)',
            animationTimingFunction: 'cubic-bezier(0.8,0,1,1)',
          },
          '50%': {
            transform: 'translateX(-25%)', // 先往左彈
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
          },
        },
        bounceRight: {
          '0%, 100%': {
            transform: 'translateX(0)',
            animationTimingFunction: 'cubic-bezier(0.8,0,1,1)',
          },
          '50%': {
            transform: 'translateX(25%)', // 先往右彈
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)',
          },
        },
      },
      animation: {
        'bounce-left': 'bounceLeft 1s infinite',
        'bounce-right': 'bounceRight 1s infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
