# smart/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class SmartUser(AbstractUser):
    """
    项目中唯一的、统一的用户模型。
    继承自 AbstractUser，因此自动包含: 
    username, password, email, first_name, last_name, is_staff, 
    is_superuser, last_login, date_joined 等核心字段。
    我们只需要在这里定义我们自己扩展的字段即可。
    """
    
    # 1. 定义角色/用户类型
    USER_TYPE_CHOICES = [
        ('ordinary_user', '普通用户'),
        ('system_admin', '系统管理员'),
        ('medical_researcher', '医学研究员'),
        ('questionnaire_entrant', '问卷录入员'),
    ]
    user_type = models.CharField(
        max_length=30, 
        choices=USER_TYPE_CHOICES, 
        verbose_name='用户类型',
        default='ordinary_user'
    )

    # 2. 扩展的个人资料字段
    nickname = models.CharField(max_length=50, unique=True, null=True, blank=True, verbose_name='昵称')
    
    GENDER_CHOICES = [
        ('male', '男'),
        ('female', '女'),
        ('other', '其他'),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True, verbose_name='性别')
    age = models.IntegerField(null=True, blank=True, verbose_name='年龄')
    position = models.CharField(max_length=100, blank=True, verbose_name='职位')
    specialty = models.CharField(max_length=100, blank=True, verbose_name='专业领域')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name='头像')
    phone = models.CharField(max_length=20, blank=True, verbose_name='手机号')
    department = models.CharField(max_length=100, blank=True, verbose_name='部门')
    
    # 3. 覆盖 AbstractUser 的 email 字段，使其必须唯一
    email = models.EmailField(unique=True, verbose_name='电子邮箱')

    # 【注意】所有重复的字段定义，如 username, password, name, created_at 等都已删除，
    # 因为 AbstractUser 已经为我们提供了这些字段 (或等效字段如 date_joined)。

    class Meta:
        verbose_name = '平台用户'
        verbose_name_plural = '平台用户'
        ordering = ['-date_joined']

    def __str__(self):
        return self.nickname or self.username

# --- 其他模型的外键已经正确，保持不变 ---

class Feedback(models.Model):
    user = models.ForeignKey(SmartUser, on_delete=models.CASCADE, verbose_name='反馈用户')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        verbose_name = '反馈'
        verbose_name_plural = '反馈'
    def __str__(self):
        return f"来自 {self.user.username} 的反馈"

class Questionnaire(models.Model):
    STATUS_CHOICES = [('draft', '草稿'), ('published', '已发布'), ('archived', '已归档')]
    created_by = models.ForeignKey(SmartUser, on_delete=models.CASCADE, verbose_name='创建者')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    class Meta:
        verbose_name = '问卷'
        verbose_name_plural = '问卷'
        ordering = ['-created_at']

class Question(models.Model):
    QUESTION_TYPES = [('single', '单选题'), ('multiple', '多选题'), ('text', '问答题'), ('draw', '绘图题')]
    DRAW_SUB_TYPES = [('pattern', '画图案'), ('3d', '3D绘图'), ('clock', '画钟表'), ('connect', '连线题')]
    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.CASCADE, related_name='questions')
    type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    sub_type = models.CharField(max_length=20, choices=DRAW_SUB_TYPES, null=True, blank=True)
    title = models.CharField(max_length=200)
    example_image = models.ImageField(upload_to='question_images/', null=True, blank=True)
    drawing_data = models.TextField(null=True, blank=True)
    canvas_width = models.IntegerField(default=300)
    canvas_height = models.IntegerField(default=300)
    canvas_scale = models.FloatField(default=1.0)
    order = models.IntegerField(default=0)
    options = models.JSONField(default=list, blank=True, null=True)
    matrix_data = models.JSONField(default=dict, blank=True, null=True)
    blanks = models.JSONField(default=list, blank=True, null=True)
    hour = models.CharField(max_length=10, blank=True)
    minute = models.CharField(max_length=10, blank=True)
    time_relation = models.CharField(max_length=10, blank=True)
    show_outline = models.BooleanField(default=True)
    show_numbers = models.BooleanField(default=True)
    show_hands = models.BooleanField(default=True)
    prompt_text = models.TextField(blank=True)
    class Meta:
        verbose_name = '问题'
        verbose_name_plural = '问题'
        ordering = ['order']

class LoginLog(models.Model):
    user = models.ForeignKey(SmartUser, on_delete=models.CASCADE)
    role = models.CharField(max_length=50)
    login_time = models.DateTimeField(default=timezone.now)
    def __str__(self):
        return f'{self.user.username} - {self.role} - {self.login_time}'

class Answer(models.Model):
    user = models.ForeignKey(SmartUser, on_delete=models.CASCADE)
    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer_content = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        verbose_name = '问卷答案'
        verbose_name_plural = '问卷答案'
        ordering = ['-submitted_at']