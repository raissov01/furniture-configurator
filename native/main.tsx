import { createRoot } from 'react-dom/client'
import '../app/globals.css'
import { NativeMeasurementApp } from './NativeMeasurementApp'

const root = document.getElementById('root')
if (!root) throw new Error('Native app root is missing')
createRoot(root).render(<NativeMeasurementApp />)
