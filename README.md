# Emprendimientos Austral

Panel admin para coordinar la materia de Emprendimientos: proyectos, mentores, jurado y eventos.
Las reglas para construir están en [AGENTS.md](AGENTS.md); tu agente de IA las lee solo.

## Antes de empezar

Hacé un fork del repo (botón **Fork** en GitHub) y cloná tu fork. Los PR van de tu fork a este repo;
solo el profe aprueba y mergea.

## Correrlo en tu compu (una vez)

Necesitás [Node 22+](https://nodejs.org) y [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

```bash
npm install
cp .env.example .env.local
npm run db:start      # levanta la base local con datos de prueba
npm run dev           # abre la app
```

Entrás con `admin@austral.edu.ar` / `austral123`. La base local se ve en http://127.0.0.1:54323

## Flujo de trabajo

1. `git checkout -b <grupo>/<funcionalidad>`
2. Le pedís a la IA lo que necesitás, en términos de negocio
3. `npm run build` tiene que pasar
4. Abrís el PR. El CI chequea que no hayas roto la base ni el código de otro grupo
5. El profe aprueba y mergea → Vercel despliega solo; el profe aplica las migraciones con `npx supabase db push`
