/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 預設字體 - 中黑體
        sans: ['SF Pro Text', 'PingFang TC', 'Hiragino Sans GB', 'Helvetica Neue', 'Microsoft YaHei', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // 極細體
        things: ['SF Pro Text', 'PingFang TC', 'Hiragino Sans GB', 'Helvetica Neue', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

