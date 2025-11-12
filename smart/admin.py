from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import SmartUser, LoginLog, Questionnaire, Question, Answer, Feedback

@admin.register(SmartUser)
class SmartUserAdmin(UserAdmin):
    list_display = ('username', 'nickname', 'email', 'user_type', 'is_staff', 'date_joined')
    list_filter = ('user_type', 'is_staff', 'is_superuser')
    search_fields = ('username', 'nickname', 'email')
    
    fieldsets = UserAdmin.fieldsets + (
        ('自定义资料', {'fields': ('user_type', 'nickname', 'gender', 'age', 'avatar', 'phone', 'department', 'position', 'specialty')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('自定义资料', {'fields': ('user_type', 'nickname', 'email')}),
    )

@admin.register(LoginLog)
class LoginLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'login_time')
    list_filter = ('role', 'login_time')
    readonly_fields = ('login_time',)
admin.site.register(Questionnaire)
admin.site.register(Question)
admin.site.register(Answer)
admin.site.register(Feedback)