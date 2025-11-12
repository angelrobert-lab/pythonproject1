# smart/serializers.py

from django.db.models import Q
from rest_framework import serializers
from .models import SmartUser, Feedback, Questionnaire, Question, Answer

# ==============================================================================
# 1. 统一的用户模型序列化器
# ==============================================================================
class SmartUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmartUser
        # 列出所有需要通过API暴露的用户字段
        fields = [
            'id', 'username', 'nickname', 'email', 'user_type', 'gender', 'age', 
            'position', 'specialty', 'avatar', 'first_name', 'last_name'
        ]
        extra_kwargs = {
            'password': {'write_only': True} # 密码只用于写入，不通过API读出
        }
    
    def create(self, validated_data):
        # 重写 create 方法以正确处理密码加密
        user = SmartUser.objects.create_user(**validated_data)
        return user

# ==============================================================================
# 2. 统一的登录序列化器
# ==============================================================================
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField() # 登录时可以用 username 或 nickname
    password = serializers.CharField(write_only=True)
    role = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        # 使用 SmartUser 模型，并同时支持用 username 或 nickname 登录
        user = SmartUser.objects.filter(Q(username=username) | Q(nickname=username)).first()
        
        if user and user.check_password(password):
            data['user'] = user
            return data
        
        raise serializers.ValidationError("用户名或密码错误")

# ==============================================================================
# 3. 其他模型的序列化器
# ==============================================================================
class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['id', 'user', 'content', 'created_at']
        read_only_fields = ['user', 'created_at']

class QuestionSerializer(serializers.ModelSerializer):
    options = serializers.JSONField(required=False, allow_null=True)
    matrix_data = serializers.JSONField(required=False, allow_null=True)
    blanks = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Question
        fields = '__all__'
        read_only_fields = ['id', 'questionnaire', 'created_at']

class QuestionnaireSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Questionnaire
        fields = [
            'id', 'title', 'description', 'status', 'created_by', 
            'created_by_name', 'created_at', 'updated_at', 'questions'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'created_by_name']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        
        questions_data = validated_data.pop('questions', [])
        questionnaire = Questionnaire.objects.create(**validated_data)

        for question_data in questions_data:
            Question.objects.create(questionnaire=questionnaire, **question_data)

        return questionnaire

class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'user', 'questionnaire', 'question', 'answer_content', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']

# 【注意】不再需要 SimplifiedQuestionnaireSerializer，因为 QuestionnaireSerializer 已经足够
# 并且原来的 get_created_by_name 和 get_question_count 逻辑已经通过外键和序列化器优化