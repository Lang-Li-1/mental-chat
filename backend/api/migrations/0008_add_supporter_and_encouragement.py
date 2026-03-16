from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_add_assessment_result"),
    ]

    operations = [
        migrations.CreateModel(
            name="SupporterLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("supporter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="linked_patients", to=settings.AUTH_USER_MODEL)),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="linked_supporters", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "supporter_links",
                "unique_together": {("supporter", "patient")},
            },
        ),
        migrations.CreateModel(
            name="EncouragementMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content", models.TextField()),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sent_encouragements", to=settings.AUTH_USER_MODEL)),
                ("receiver", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_encouragements", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "encouragement_messages",
                "ordering": ["-created_at"],
            },
        ),
    ]
