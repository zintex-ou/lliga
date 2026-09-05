import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const seasons = sqliteTable("season", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  yellowsForBan: integer("yellows_for_ban").notNull().default(5),
  assistsEnabled: integer("assists_enabled", { mode: "boolean" }).notNull().default(true),
});

export const groups = sqliteTable("grp", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seasonId: integer("season_id").notNull().references(() => seasons.id),
  name: text("name").notNull(), // "A" | "B"
  topSlots: integer("top_slots").notNull().default(1),
  relegSlots: integer("releg_slots").notNull().default(2),
  topLabel: text("top_label").notNull().default("campio"), // campio | ascens
});

export const teams = sqliteTable("team", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  short: text("short"),
  logo: text("logo"),
  photo: text("photo"),
  colors: text("colors"),
  field: text("field"),
  town: text("town"),
  founded: text("founded"),
  info: text("info"),
});

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull().default("delegat"), // delegat | entrenador | delegat-entrenador
  phone: text("phone"),
  email: text("email"),
  phoneVisible: integer("phone_visible", { mode: "boolean" }).notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const players = sqliteTable("player", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  surname: text("surname").notNull(),
  name: text("name").notNull(),
  dob: text("dob"), // ISO date
  position: text("position").notNull().default("MIG"), // POR | DEF | MIG | DAV
  dorsal: integer("dorsal"),
  photo: text("photo"),
  registeredAt: text("registered_at"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (t) => [index("player_team_idx").on(t.teamId)]);

export const rounds = sqliteTable("round", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  number: integer("number").notNull(),
  date: text("date").notNull(), // ISO date
  altDate: text("alt_date"),
});

export const matches = sqliteTable("match", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roundId: integer("round_id").notNull().references(() => rounds.id),
  homeId: integer("home_id").notNull().references(() => teams.id),
  awayId: integer("away_id").notNull().references(() => teams.id),
  date: text("date"), // ISO date override
  time: text("time"), // "17:00"
  field: text("field"),
  status: text("status").notNull().default("scheduled"), // scheduled | played | postponed | walkover
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  referee: text("referee"),
  refereeId: integer("referee_id"),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  updatedBy: integer("updated_by"),
  updatedAt: text("updated_at"),
}, (t) => [index("match_round_idx").on(t.roundId)]);

export const appearances = sqliteTable("appearance", {
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("titular"), // titular | suplent
  entered: integer("entered", { mode: "boolean" }).notNull().default(true),
  conceded: integer("conceded"), // for goalkeepers
}, (t) => [primaryKey({ columns: [t.matchId, t.playerId] })]);

export const events = sqliteTable("event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // gol | gol_pen | groga | vermella | segona_groga
  minute: integer("minute"),
  assistId: integer("assist_id"),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("event_match_idx").on(t.matchId), index("event_player_idx").on(t.playerId)]);

export const sanctions = sqliteTable("sanction", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  eventId: integer("event_id"),
  matchId: integer("match_id"), // match after which the sanction starts
  roundNumber: integer("round_number"), // for manual sanctions
  matches: integer("matches").notNull().default(1),
  servedOverride: integer("served_override"),
  reason: text("reason").notNull().default("falta_joc"), // falta_joc | joc_violent | antiesportiva | agressio | acumulacio | comite
  notes: text("notes"),
  createdAt: text("created_at"),
});

export const posts = sqliteTable("post", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  kind: text("kind").notNull().default("noticia"), // noticia | circular
  publishedAt: text("published_at").notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
});

export const documents = sqliteTable("document", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull().default("documentacio"), // normativa | reglament | arbitratges | documentacio | circulars
  file: text("file"),
  body: text("body"),
  sort: integer("sort").notNull().default(0),
});

export const pages = sqliteTable("page", {
  slug: text("slug").primaryKey(), // normativa | reglament | arbitratges | contacte
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
});

export const users = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("delegat"), // admin | president_lliga | president_arbitres | delegat | visitant
  teamId: integer("team_id"),
  refereeId: integer("referee_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at"),
});

export const settings = sqliteTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(),
  at: text("at").notNull(),
});

/** Team photo gallery across seasons; keyed by team name so it survives season copies. */
export const teamPhotos = sqliteTable("team_photo", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamKey: text("team_key").notNull(),
  season: text("season").notNull(), // e.g. "2026-27"
  file: text("file").notNull(),
  caption: text("caption"),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("team_photo_key_idx").on(t.teamKey)]);

export const referees = sqliteTable("referee", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
});

export const pushSubscriptions = sqliteTable("push_subscription", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  teamKey: text("team_key"), // follow one team (by name key) …
  groupName: text("group_name"), // … or a whole group
  lang: text("lang").notNull().default("ca"),
  createdAt: text("created_at"),
});

/** Page views, aggregated per day and path (no cookies, no third parties). */
export const visits = sqliteTable("visit", {
  day: text("day").notNull(),
  path: text("path").notNull(),
  views: integer("views").notNull().default(0),
  visitors: integer("visitors").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.day, t.path] })]);

/** "There is an error in this acta" reports from visitors/delegates. */
export const reports = sqliteTable("report", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id"),
  message: text("message").notNull(),
  contact: text("contact"),
  createdAt: text("created_at").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
});

/** Delegates rate the referee of their team's match (one rating per team and match). */
export const refereeRatings = sqliteTable("referee_rating", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  refereeId: integer("referee_id").notNull(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id"),
  score: integer("score").notNull(), // 1..5
  protest: integer("protest", { mode: "boolean" }).notNull().default(false),
  comment: text("comment"), // protest text (only when protest = true)
  createdAt: text("created_at").notNull(),
}, (t) => [index("rr_match_team").on(t.matchId, t.teamId), index("rr_ref").on(t.refereeId)]);
