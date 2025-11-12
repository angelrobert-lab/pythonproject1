# smart/views.py

import json
import logging
import uuid
from django.utils import timezone
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
from django.http import JsonResponse

from rest_framework import viewsets, permissions, status, exceptions
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny # 【修改】新增导入 AllowAny
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import Feedback, Questionnaire, Question, LoginLog, SmartUser, Answer
from .serializers import (
    FeedbackSerializer, QuestionnaireSerializer, QuestionSerializer, 
    SmartUserSerializer, LoginSerializer, AnswerSerializer
)

logger = logging.getLogger(__name__)

# ==============================================================================
# 核心API视图 - 基于 Django REST Framework
# ==============================================================================

# --- 用户认证与个人资料 API ---

@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny]) # 【核心修改】允许任何人访问此接口进行注册
def register(request):
    """用户注册API"""
    if request.method == 'POST':
        try:
            data = request.data
            serializer = SmartUserSerializer(data=data)
            if serializer.is_valid(raise_exception=True):
                user = serializer.save()
                return Response({
                    'status': 'success', 
                    'message': '注册成功',
                    'user_id': user.id
                }, status=status.HTTP_201_CREATED)
        except exceptions.ValidationError as e:
             error_messages = []
             for field, messages in e.detail.items():
                 error_messages.append(f"{field}: {messages[0]}")
             return Response({'status': 'error', 'message': " ".join(error_messages)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f'注册时发生错误: {str(e)}', exc_info=True)
            return Response({'status': 'error', 'message': '服务器内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({'status': 'error', 'message': '仅支持POST请求'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny]) # 【核心修改】允许任何人访问此接口进行登录
def login(request):
    """用户登录API"""
    if request.method == 'POST':
        try:
            data = request.data
            serializer = LoginSerializer(data=data)
            
            if serializer.is_valid(raise_exception=True):
                user = serializer.validated_data['user']
                role_from_request = data.get('role')

                role_alias = {
                    'user': 'ordinary_user',
                    'admin': 'system_admin',
                    'researcher': 'medical_researcher',
                    'surveyor': 'questionnaire_entrant',
                    'ordinary_user': 'ordinary_user',
                    'system_admin': 'system_admin',
                    'medical_researcher': 'medical_researcher',
                    'questionnaire_entrant': 'questionnaire_entrant'
                }
                role_from_request = role_alias.get(role_from_request, role_from_request)

                if user.user_type != role_from_request and user.user_type != 'system_admin':
                    logger.warning(
                        f"登录角色不匹配: 用户 {user.username} (数据库={user.user_type}, 请求={role_from_request})"
                    )
                    return Response(
                        {'status': 'error',
                         'message': f'用户角色权限不足（当前: {user.user_type}, 请求: {role_from_request}）'},
                        status=status.HTTP_403_FORBIDDEN
                    )

                token, created = Token.objects.get_or_create(user=user)
                LoginLog.objects.create(user=user, role=role_from_request)
                
                user.last_login = timezone.now()
                user.save(update_fields=['last_login'])

                return Response({
                    'status': 'success',
                    'message': '登录成功',
                    'data': {
                        'token': token.key,
                        'user_id': user.id,
                        'nickname': user.nickname,
                        'username': user.username,
                        'user_type': user.user_type,
                    }
                })
        except exceptions.ValidationError:
            return Response({'status': 'error', 'message': '用户名或密码错误'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f'登录时发生错误: {str(e)}', exc_info=True)
            return Response({'status': 'error', 'message': '服务器内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({'status': 'error', 'message': '仅支持 POST 请求'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny]) # 【核心修改】允许任何人访问此接口重置密码
def reset_password(request):
    """重置密码API"""
    if request.method == 'POST':
        try:
            data = request.data
            nickname = data.get('nickname')
            email = data.get('email')
            new_password = data.get('newPassword')

            if not any([nickname, email]) or not new_password:
                return Response({'status': 'error', 'message': '昵称/邮箱和新密码均为必填项'}, status=status.HTTP_400_BAD_REQUEST)

            user_query = SmartUser.objects.filter(Q(nickname=nickname) | Q(email=email))
            if not user_query.exists():
                return Response({'status': 'error', 'message': '该用户未注册'}, status=status.HTTP_404_NOT_FOUND)

            user = user_query.first()
            user.set_password(new_password)
            user.save()

            return Response({'status': 'success', 'message': '密码重置成功'})
        except Exception as e:
            logger.error(f'重置密码时发生错误: {str(e)}', exc_info=True)
            return Response({'status': 'error', 'message': '服务器内部错误'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({'status': 'error', 'message': '仅支持 POST 请求'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_user_info(request):
    """获取当前登录用户的基本信息"""
    user = request.user
    serializer = SmartUserSerializer(user)
    return Response({'success': True, 'user': serializer.data})


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    """获取用户详细个人资料"""
    user = request.user
    serializer = SmartUserSerializer(user)
    return Response({'success': True, 'profile': serializer.data})


@api_view(['POST', 'PUT', 'PATCH'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_user_profile(request):
    """更新用户个人资料"""
    user = request.user
    serializer = SmartUserSerializer(user, data=request.data, partial=True)
    if serializer.is_valid(raise_exception=True):
        serializer.save()
        return Response({'success': True, 'message': '个人资料更新成功', 'profile': serializer.data})
    return Response({'success': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# --- 问卷与题目 API (通过ViewSet实现) ---

class QuestionnaireViewSet(viewsets.ModelViewSet):
    """问卷视图集，自动处理增删改查"""
    serializer_class = QuestionnaireSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Questionnaire.objects.filter(created_by=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # 新增自定义 update 方法
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # 让 PUT 也支持部分更新（不会要求所有字段必传）
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if not serializer.is_valid():
            # 打印具体错误到控制台
            print("PUT 验证失败：", serializer.errors)
            # 返回详细错误信息给前端
            return Response({
                "status": "error",
                "message": "问卷数据校验失败",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        # 成功后返回最新数据
        return Response({
            "status": "success",
            "message": "问卷更新成功",
            "data": serializer.data
        }, status=status.HTTP_200_OK)



class QuestionViewSet(viewsets.ModelViewSet):
    """问题视图集"""
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Question.objects.filter(questionnaire__created_by=self.request.user).order_by('order')


# --- 反馈 API (通过ViewSet实现) ---

class FeedbackViewSet(viewsets.ModelViewSet):
    """反馈视图集"""
    queryset = Feedback.objects.all()
    serializer_class = FeedbackSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# --- 小程序专用 API ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mini_program_questionnaires(request):
    """获取小程序端可用的已发布问卷列表"""
    questionnaires = Questionnaire.objects.filter(status='published', is_active=True).order_by('-created_at')
    serializer = QuestionnaireSerializer(questionnaires, many=True)
    return Response({'success': True, 'questionnaires': serializer.data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_public_questionnaire_detail(request, pk):
    """获取单个已发布问卷的详情（供小程序答题页使用）"""
    try:
        questionnaire = Questionnaire.objects.get(pk=pk, status='published', is_active=True)
        serializer = QuestionnaireSerializer(questionnaire)
        return Response({'status': 'success', 'data': serializer.data})
    except Questionnaire.DoesNotExist:
        return Response({'status': 'error', 'message': '问卷不存在或未发布'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_mini_program_answer(request):
    """提交小程序问卷答案"""
    try:
        data = request.data
        questionnaire_id = data.get('questionnaire_id')
        answers_data = data.get('answers', [])
        
        answers_to_create = [
            Answer(
                user=request.user,
                questionnaire_id=questionnaire_id,
                question_id=answer.get('question_id'),
                answer_content=answer.get('answer_content', {})
            )
            for answer in answers_data
        ]
        
        if answers_to_create:
            Answer.objects.bulk_create(answers_to_create)

        return Response({'status': 'success', 'message': '答案提交成功'})
    except Exception as e:
        logger.error(f'提交答案失败: {str(e)}', exc_info=True)
        return Response({'status': 'error', 'message': '提交答案失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- 旧的或用于渲染HTML模板的视图 (建议清理) ---

def user_list(request):
    """渲染一个显示所有用户的HTML页面"""
    users = SmartUser.objects.all()
    return render(request, 'user_list.html', {'users': users})


def test_api(request):
    """一个简单的API连通性测试视图"""
    return JsonResponse({'status': 'success', 'message': 'API连接正常'})