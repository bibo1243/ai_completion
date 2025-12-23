import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // 移除 StrictMode 以避免某些拖曳功能的重複觸發問題 (可選)
  <App />
)
