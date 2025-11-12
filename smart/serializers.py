# smart/serializers.py

from django.db.models import Q
from rest_framework import serializers
from .models import SmartUser, Feedback, Questionnaire, Question, Answer
import json

# ==============================================================================
# 1. 统一的用户模型序列化器
# ==============================================================================
class SmartUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=6)

    class Meta:
        model = SmartUser
        fields = [
            'id', 'username', 'password', 'nickname', 'email', 'user_type', 'gender', 'age',
            'position', 'specialty', 'avatar', 'first_name', 'last_name'
        ]
        extra_kwargs = {
            'password': {'write_only': True}  # 密码只用于写入，不通过API读出
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = SmartUser(**validated_data)
        user.set_password(password)
        user.save()
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
    id = serializers.IntegerField(required=False)

    options = serializers.JSONField(required=False, allow_null=True)
    matrix_data = serializers.JSONField(required=False, allow_null=True)
    blanks = serializers.JSONField(required=False, allow_null=True)

    def to_internal_value(self, data):
        for key in ['options', 'matrix_data', 'blanks']:
            if key in data and isinstance(data[key], str):
                try:
                    data[key] = json.loads(data[key])
                except Exception:
                    pass
        return super().to_internal_value(data)

    class Meta:
        model = Question
        fields = '__all__'
        read_only_fields = ['questionnaire', 'created_at']

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

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', None)
        self.partial = True

        # 先更新问卷自身字段
        for attr in ['title', 'description', 'status']:
            if attr in validated_data:
                setattr(instance, attr, validated_data[attr])
        instance.save()

        # 若请求中有 questions，则进行子表更新
        if questions_data is not None:
            existing_questions = {q.id: q for q in instance.questions.all()}
            for q_data in questions_data:
                q_id = q_data.get('id')
                if q_id and q_id in existing_questions:
                    # 更新已有题目
                    question = existing_questions[q_id]
                    for key, value in q_data.items():
                        if key != 'id':
                            setattr(question, key, value)
                    question.save()
                else:
                    Question.objects.create(questionnaire=instance, **q_data)

        return instance


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'user', 'questionnaire', 'question', 'answer_content', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']

# 【注意】不再需要 SimplifiedQuestionnaireSerializer，因为 QuestionnaireSerializer 已经足够
# 并且原来的 get_created_by_name 和 get_question_count 逻辑已经通过外键和序列化器优化