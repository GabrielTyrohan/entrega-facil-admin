/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Geist',
  				'Inter',
  				'system-ui',
  				'Segoe UI',
  				'sans-serif'
  			],
  			mono: [
  				'Geist Mono',
  				'ui-monospace',
  				'Cascadia Mono',
  				'Consolas',
  				'monospace'
  			]
  		},
  		spacing: {
  			'18': '4.5rem'
  		},
      animation: {
        blob: "blob 7s infinite",
      },
      keyframes: {
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// Novo visual (guia de estilo aprovado em 18/11/2026): neutros com leve viés azulado
  			// e um único azul de destaque. Redefinir as escalas muda todas as telas de uma vez.
  			gray: {
  				50: '#f7f8fa',
  				100: '#f0f2f5',
  				200: '#e3e6eb',
  				300: '#cdd2da',
  				400: '#9aa2b0',
  				500: '#6c7585',
  				600: '#4f5868',
  				700: '#2b313d',
  				800: '#171b24',
  				900: '#0f1218',
  				950: '#090b0f'
  			},
  			blue: {
  				50: '#eef2ff',
  				100: '#e0e8ff',
  				200: '#c6d4fe',
  				300: '#a3b8fc',
  				400: '#7493f8',
  				500: '#4a6ff0',
  				600: '#2b59e3',
  				700: '#2149c4',
  				800: '#1f3d9c',
  				900: '#1e377b',
  				950: '#172451'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};