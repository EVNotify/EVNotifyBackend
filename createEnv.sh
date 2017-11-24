#! /bin/bash -
# create the config from template
if [[ ! -e srv_config.json ]]; then
    cat srv_config.template.json > srv_config.json
fi
# database setup
mysql -u root < db/db_template.sql
