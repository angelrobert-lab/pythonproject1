from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from smart.models import AdminUser

class Command(BaseCommand):
    help = 'Initialize admin user'

    def handle(self, *args, **options):
        # 创建默认管理员
        if not AdminUser.objects.filter(username='admin').exists():
            admin = AdminUser.objects.create_user(
                username='admin',
                password='admin123',
                name='系统管理员',
                position='系统管理员',
                email='admin@example.com',
                is_staff=True,
                is_superuser=True
            )
            self.stdout.write(self.style.SUCCESS('成功创建管理员账号: admin/admin123'))
        else:
            self.stdout.write(self.style.WARNING('管理员账号已存在'))