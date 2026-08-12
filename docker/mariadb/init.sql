-- Application user. Idempotent: the image entrypoint already creates
-- MYSQL_USER/MYSQL_PASSWORD before this script runs.
CREATE USER IF NOT EXISTS '{MYSQL_USER}'@'%' IDENTIFIED BY '{MYSQL_PASSWORD}';

-- System database (exact name).
GRANT ALL PRIVILEGES ON `{MYSQL_DATABASE}`.* TO '{MYSQL_USER}'@'%';

-- Tenant databases (prefix wildcard; underscores are escaped by the
-- entrypoint script so they match literally, '%' stays a wildcard).
GRANT ALL PRIVILEGES ON `{TENANT_DB_PREFIX}%`.* TO '{MYSQL_USER}'@'%';

FLUSH PRIVILEGES;
