"""Phase 3.4 + 3.6: Soft delete fields + additional indexes."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_optimize_constraints_indexes_and_fields"),
    ]

    operations = [
        # Soft delete fields for MoodEntry
        migrations.AddField(
            model_name="moodentry",
            name="is_deleted",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="moodentry",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Soft delete fields for ChatMessage
        migrations.AddField(
            model_name="chatmessage",
            name="is_deleted",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="chatmessage",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Soft delete fields for CrisisAlert
        migrations.AddField(
            model_name="crisisalert",
            name="is_deleted",
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name="crisisalert",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Phase 3.4: Additional indexes
        migrations.AddIndex(
            model_name="crisisalert",
            index=models.Index(fields=["user", "status"], name="idx_crisis_user_status"),
        ),
        migrations.AddIndex(
            model_name="encouragementmessage",
            index=models.Index(
                fields=["sender", "created_at"], name="idx_encourage_sender_created"
            ),
        ),
        migrations.AddIndex(
            model_name="recoverytask",
            index=models.Index(
                fields=["user", "is_completed", "date"],
                name="idx_recovery_user_comp_date",
            ),
        ),
    ]
