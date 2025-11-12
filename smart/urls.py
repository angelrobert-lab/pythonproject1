# smart/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'questionnaires', views.QuestionnaireViewSet, basename='questionnaire')
router.register(r'questions', views.QuestionViewSet, basename='question')
router.register(r'feedback', views.FeedbackViewSet, basename='feedback')

# 【核心修改】这里定义的路径都是相对于主路由转发过来的 /api/
urlpatterns = [
    # --- ViewSet 路由 ---
    # router 会自动生成:
    # questionnaires/
    # questions/
    # feedback/
    # 等等...
    path('', include(router.urls)),

    # --- 用户认证与个人资料 API ---
    # 最终访问地址会是 /api/auth/login/
    path('auth/login/', views.login, name='login'),
    path('auth/register/', views.register, name='register'),
    path('auth/reset-password/', views.reset_password, name='reset_password'),

    # 最终访问地址会是 /api/user/info/
    path('user/info/', views.get_user_info, name='get_user_info'),
    path('user/profile/', views.get_user_profile, name='get_user_profile'),
    path('user/profile/update/', views.update_user_profile, name='update_user_profile'),
    
    # --- 小程序专用 API ---
    # 最终访问地址会是 /api/mini/questionnaires/
    path('mini/questionnaires/', views.get_mini_program_questionnaires, name='mini_questionnaires'),
    path('mini/questionnaires/<int:pk>/', views.get_public_questionnaire_detail, name='public_questionnaire_detail'),
    path('mini/submit-answer/', views.submit_mini_program_answer, name='mini_submit_answer'),
    
    # --- 测试/旧版路由 (可选) ---
    # 最终访问地址会是 /api/test/user_list/
    path('test/user_list/', views.user_list, name='user_list'), 
    path('test/api-status/', views.test_api, name='test_api'),
]