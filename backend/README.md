# Mental Chat Backend

Django REST API for the depression intervention AI chat system.

## Quick Start

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Start the development server
python manage.py runserver 8000
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login and receive JWT tokens |
| GET | `/api/users/me` | Yes | Current user profile |
| POST | `/api/mood_entries` | Yes (patient) | Create a mood entry |
| GET | `/api/mood_entries` | Yes (patient/professional) | List mood entries |
| POST | `/api/chat/send_message` | Yes | Send message to AI and get reply |
| POST | `/api/crisis_alerts` | No | Create a crisis alert |
| GET | `/api/crisis_alerts/active` | No | List active crisis alerts |
| GET | `/api/patients` | Yes (professional) | List assigned patients |
| GET | `/api/patients/{id}/status_summary` | Yes (professional/supporter) | Patient status summary |
| GET | `/api/docs/` | No | Swagger UI |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | dev key | Django secret key |
| `DJANGO_DEBUG` | `True` | Debug mode |
| `AI_SERVICE_URL` | `http://localhost:5000/respond` | Flask AI service URL |
| `AI_SERVICE_TIMEOUT` | `30` | AI service request timeout (seconds) |
