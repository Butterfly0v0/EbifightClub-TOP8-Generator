import { createRoot } from 'react-dom/client'
import './index.css'
import ExportApiApp from './ExportApiApp.tsx'
import { initImportedFonts } from './lib/fonts'

initImportedFonts()

createRoot(document.getElementById('root')!).render(<ExportApiApp />)
