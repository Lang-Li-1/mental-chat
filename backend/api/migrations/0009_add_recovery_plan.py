from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_add_supporter_and_encouragement"),
    ]

    operations = [
        migrations.CreateModel(
            name="RecoveryTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("task_type", models.CharField(choices=[("mood_log", "情绪记录"), ("mindfulness", "正念练习"), ("reading", "科普阅读"), ("exercise", "运动锻炼"), ("social", "社交互动"), ("gratitude", "感恩日记")], max_length=20)),
                ("title", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("is_completed", models.BooleanField(default=False)),
                ("date", models.DateField()),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recovery_tasks", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "recovery_tasks",
                "ordering": ["date", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="RecoveryBadge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("badge_type", models.CharField(choices=[("streak_3", "连续3天"), ("streak_7", "连续7天"), ("streak_30", "连续30天"), ("first_mood", "首次记录"), ("first_chat", "首次对话"), ("first_assessment", "首次评估"), ("tasks_10", "完成10个任务"), ("tasks_50", "完成50个任务"), ("mood_improve", "情绪改善")], max_length=30)),
                ("earned_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recovery_badges", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "recovery_badges",
                "ordering": ["-earned_at"],
                "unique_together": {("user", "badge_type")},
            },
        ),
    ]
