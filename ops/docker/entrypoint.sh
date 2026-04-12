#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Starting daphne server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
