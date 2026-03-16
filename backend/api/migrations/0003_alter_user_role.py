# Generated migration for adding admin role choice

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_alter_user_phone'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('patient', 'Patient'),
                    ('professional', 'Professional'),
                    ('supporter', 'Supporter'),
                    ('admin', 'Admin'),
                ],
                default='patient',
                max_length=20,
            ),
        ),
    ]
