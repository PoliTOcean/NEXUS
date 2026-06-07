// Sincronizza l'output cachato da Turbo (apps/<app>/dist) verso frontend_dist/<app>,
// la cartella servita dal backend in produzione (modules/index.py).
//
// Turbo non può mettere in cache output che escono dalla dir del package (path con "..").
// Per questo Vite scrive in dist/ DENTRO il package (cacheabile da Turbo) e qui copiamo
// il risultato in frontend_dist/. La copia è veloce e viene eseguita sempre — anche su
// cache HIT — così frontend_dist/ è SEMPRE allineato all'ultimo build, senza dipendere
// dai timestamp. È questo che rende il "salta build se non serve" affidabile.

import { cpSync, rmSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(frontendDir, "..")
const apps = ["eva", "float"]

for (const appName of apps) {
  const src = path.join(frontendDir, "apps", appName, "dist")
  const dest = path.join(repoRoot, "frontend_dist", appName)

  if (!existsSync(src)) {
    console.error(`sync-dist: output mancante per "${appName}" (${src}). Build fallita?`)
    process.exit(1)
  }

  // Rimuove la destinazione e ricopia, così file rimossi dal build spariscono anche qui.
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  console.log(`sync-dist: ${appName} -> frontend_dist/${appName}`)
}
