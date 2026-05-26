import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@politocean/ui/globals.css"
import "./styles/globals.css"
import { App } from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="eva-theme">
      <App />
    </ThemeProvider>
  </StrictMode>
)
