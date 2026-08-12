#!/bin/bash

# chmod u+rwx /scripts/init.template.sql
cp /scripts/init.template.sql /scripts/init.sql

# Replace environment variables in SQL files with their values
if [ -n "$MYSQL_USER" ]; then
    sed -i "s/{MYSQL_USER}/$MYSQL_USER/g" /scripts/init.sql
fi
if [ -n "$MYSQL_PASSWORD" ]; then
    sed -i "s/{MYSQL_PASSWORD}/$MYSQL_PASSWORD/g" /scripts/init.sql
fi
if [ -n "$MYSQL_DATABASE" ]; then
    sed -i "s/{MYSQL_DATABASE}/$MYSQL_DATABASE/g" /scripts/init.sql
fi
if [ -n "$TENANT_DB_PREFIX" ]; then
    # Escape underscores so they match literally in the GRANT wildcard.
    ESCAPED_PREFIX=$(echo "$TENANT_DB_PREFIX" | sed 's/_/\\\\_/g')
    sed -i "s/{TENANT_DB_PREFIX}/$ESCAPED_PREFIX/g" /scripts/init.sql
fi

# Execute SQL file
mariadb -u root -p$MYSQL_ROOT_PASSWORD < /scripts/init.sql