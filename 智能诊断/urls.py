# 智能诊断/urls.py

from django.contrib import admin
from django.urls import path, include # 确保 include 被导入
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django Admin 后台
    path('admin/', admin.site.urls),

    # 【核心修改】
    # 告诉 Django: 所有以 'api/' 开头的 URL 请求，
    # 都交给 'smart.urls' 这个文件去处理。
    path('api/', include('smart.urls')),
]

# 开发环境下处理媒体文件
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)