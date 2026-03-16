from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_add_recovery_plan"),
    ]

    operations = [
        migrations.CreateModel(
            name="Article",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("summary", models.TextField(blank=True, default="")),
                ("content", models.TextField()),
                ("category", models.CharField(
                    choices=[
                        ("depression", "抑郁症"),
                        ("anxiety", "焦虑症"),
                        ("sleep", "睡眠"),
                        ("stress", "压力管理"),
                        ("relationship", "人际关系"),
                        ("self_care", "自我关怀"),
                        ("general", "综合"),
                    ],
                    default="general",
                    max_length=30,
                )),
                ("author", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="articles",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("is_published", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "articles",
                "ordering": ["-created_at"],
            },
        ),
    ]
