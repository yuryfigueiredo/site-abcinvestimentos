CREATE TABLE IF NOT EXISTS ia_daily_usage (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, visitor)
);
