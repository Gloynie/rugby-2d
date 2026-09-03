import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  favouriteTeam: varchar("favourite_team", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  competition: varchar("competition", { length: 64 }).notNull(),
  homeTeam: varchar("home_team", { length: 64 }).notNull(),
  awayTeam: varchar("away_team", { length: 64 }).notNull(),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  userTeam: varchar("user_team", { length: 64 }).notNull(),
  stadium: varchar("stadium", { length: 64 }).notNull(),
  result: varchar("result", { length: 1 }).notNull(), // W / D / L from the user's perspective
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  competitionId: varchar("competition_id", { length: 64 }).notNull(),
  teamId: varchar("team_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const careers = pgTable("careers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: varchar("team_id", { length: 64 }).notNull(),
  competitionId: varchar("competition_id", { length: 64 }).notNull(),
  mode: varchar("mode", { length: 32 }).notNull(), // tournament | worldcup | friendlies
  week: integer("week").notNull().default(0),
  state: jsonb("state").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerCareers = pgTable("player_careers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  playerName: varchar("player_name", { length: 64 }).notNull(),
  position: integer("position").notNull(), // 1..15 shirt position
  teamId: varchar("team_id", { length: 64 }).notNull(),
  competitionId: varchar("competition_id", { length: 64 }).notNull(),
  rating: integer("rating").notNull().default(60),
  xp: integer("xp").notNull().default(0),
  appearance: jsonb("appearance").notNull(), // { hair, skin, hairColor, etc }
  attributes: jsonb("attributes").notNull(), // { speed, strength, tackling, handling, kicking, evasion }
  state: jsonb("state").notNull(),           // matches, current week, etc.
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type MatchRow = typeof matches.$inferSelect;
export type TournamentRow = typeof tournaments.$inferSelect;
export type PlayerCareerRow = typeof playerCareers.$inferSelect;
