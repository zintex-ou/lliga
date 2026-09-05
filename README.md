# Lliga Veterans Girona — web de la lliga

Next.js 16 + SQLite (Drizzle) + Docker. Una sola base de dades (`data/lliga.db`) i les fotos a `data/uploads/`.
Per moure el web a un altre servidor: copia la carpeta `data/` i torna a arrencar.

## Arrencar en local (Mac, Node 22)

```
npm install
npm run seed      # crea la BD amb els equips, calendaris 2026-27 i l'usuari admin
npm run dev       # http://localhost:3000
```

Admin: http://localhost:3000/admin — `admin@lliga.local` / `admin1234` (canvia-ho a Usuaris).

## Producció amb Docker

```
cp .env.example .env     # posa AUTH_SECRET llarg i aleatori, i la contrasenya d'admin
docker compose up -d --build
```

El web queda a http://localhost:3000. Posa Caddy o Nginx al davant per a HTTPS i el domini.
Còpia de seguretat = copiar `./data`.

## Estructura

- `src/db/schema.ts` — taules (temporada, grups, equips, jugadors, jornades, partits, actes, targetes, sancions, comunicats, documents, usuaris).
- `src/lib/stats.ts` — classificació, estadístiques i sancions calculades a partir de les actes (no s'emmagatzemen).
- `src/lib/actions.ts` — totes les operacions de l'administració (server actions).
- `src/app/(public)` — web públic (ca/es). `src/app/admin` — administració.
- `seed/` — calendaris reals de les dues categories i la plantilla del CF Fogars.
- `public/logo.png` — substitueix-lo pel logotip actual de la lliga.

## Rols

admin · president_lliga · president_arbitres (actes, calendari, equips, sancions, comunicats, documents) · delegat (fotos i delegats del seu equip).

## Regles implementades

- Punts 3/1/0; desempat per diferència de gols i gols a favor.
- Vermella directa / segona groga: partits de sanció i motiu s'indiquen a l'acta.
- Acumulació de grogues: cada N grogues (Configuració, per defecte 5) = 1 partit.
- Els sancionats no es poden triar com a titulars ni suplents fins que compleixen la sanció; la sanció es descompta amb els partits jugats del seu equip.
- Portada: dijous–dissabte mostra la propera jornada; diumenge–dimecres, l'última jugada. Si no s'ha jugat cap jornada, mostra J1 i J2.
