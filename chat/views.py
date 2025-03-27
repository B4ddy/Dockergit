import json
from django.shortcuts import render, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import authentication_classes
from .serialziers import SessionSerializer, UserSerializer, protoDataSerializer
from .models import protodata, baseuser, motorsession
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import status



class HomeView(APIView):
    permission_classes = (IsAuthenticated,)


def motor(request):
    return render(request, "chat/motor.html")


def token_default(request):
    User = get_user_model()
    default_user, _ = User.objects.get_or_create(username="default_user")
    refresh = RefreshToken.for_user(default_user)
    return JsonResponse({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })

def userkeys(request):
    baseuser = get_user_model()
    username = request.GET.get('username')
    if not username:
        return JsonResponse({'error': 'Username is required'}, status=400)
    currentuser= get_object_or_404(baseuser, username=username)
    refresh = RefreshToken.for_user(currentuser)
    username= currentuser.get_username()
    return JsonResponse({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        "username": str(username),
    })


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def createuser(request):
    serializer = UserSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)

    print(f"Serializer Errors: {serializer.errors}")  # Add this line
    logger.info(f"Serializer Errors: {serializer.errors}")  # Add this line
    return Response(serializer.errors, status=400)
            


@csrf_exempt            
def create_proto_data(request):
    if request.method == 'POST':
        try:
            # Extract data from POST request
            actual_position = int(request.GET.get('actual_position'))
            actual_velocity = int(request.GET.get('actual_velocity'))
            phase_current = int(request.GET.get('phase_current'))
            voltage_logic = int(request.GET.get('voltage_logic'))
            
            # Create a new protodata instance
            proto_data = protodata(
                actual_position=actual_position,
                actual_velocity=actual_velocity,
                phase_current=phase_current,
                voltage_logic=voltage_logic
            )
            
            # Save to database
            proto_data.save()
            
            # Return success response
            return JsonResponse({
                'status': 'success',
                'message': 'Data recorded successfully',
                'id': proto_data.id
            })
            
        except Exception as e:
            # Return error response
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=400)       
    else:
        return HttpResponse("not a Post")
    
# '    
# @api_view(["GET"])    
# @csrf_exempt
# @permission_classes([AllowAny])       
# def get_users(request):
#     users = baseuser.objects.all()
#     serializer = UserSerializer(users, many=True)  # Konvertiert QuerySet in JSON
#     return Response(serializer.data)'

import logging
logger = logging.getLogger(__name__)
    
class Get_User(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        logger.info("Get_User endpoint called")
        try:
            users = baseuser.objects.all()
            logger.info(f"Retrieved {users.count()} users")
            serializer = UserSerializer(users, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error in Get_User: {str(e)}")
            return Response({"error": str(e)}, status=500)
        
        #session = motorsession.objects.filter(user=request.user, is_active=True).first()
       # if not session:
          #  session = motorsession.objects.create(user=request.user)
         #   return Response({"session_id": session.id}, status=status.HTTP_201_CREATED)
       # else:
    #      session = motorsession.objects.create(user=request.user)
           # return Response({"session_id": session.id,"message": "closed old session(s)"}, status=status.HTTP_201_CREATED)  



class StartSessionView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        
        session = motorsession.objects.filter(user=request.user, is_active=True).first()
        if not session:
            session = motorsession.objects.create(user=request.user)
            return Response({"session_id": session.id}, status=status.HTTP_201_CREATED)
        else:
            session = motorsession.objects.create(user=request.user)
            return Response({"session_id": session.id,"message": "closed old session(s)"}, status=status.HTTP_201_CREATED)  
        
class StopSessionView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = motorsession.objects.filter(id=session_id, user=request.user, is_active=True).first()
        if not session:
            return Response({"error": "Session not found or already ended"}, status=status.HTTP_400_BAD_REQUEST)

        session.end_session()
        return Response({"message": "Session ended"}, status=status.HTTP_200_OK)

class GetUserView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data)
    

class GetActiveSessionView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        session = motorsession.objects.filter(user=request.user, is_active=True).first()
        serializer = SessionSerializer(session)
        if session:
            return Response(serializer.data)
        if not session:
            return Response({"error": "No active session"}, status=status.HTTP_400_BAD_REQUEST)

class GetSessionView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        sessions = motorsession.objects.filter(user=request.user)
        serializer = SessionSerializer(sessions, many=True)
        return Response(serializer.data)
    


class MotorDataView(APIView):  #creates protodata
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        session = motorsession.objects.filter(id=session_id, user=request.user, is_active=True).first()
        if not session:
            return Response({"error": "Invalid session"}, status=status.HTTP_400_BAD_REQUEST)

        data_value = request.data.get("value")
        protodata.objects.create(session=session, value=data_value)

        return Response({"message": "Data recorded"}, status=status.HTTP_201_CREATED)
    


class GetSessionDataView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id):
        session = motorsession.objects.filter(id=session_id, user=request.user).first()
        if not session:
            return Response({"error": "Invalid session"}, status=status.HTTP_400_BAD_REQUEST)
        
        data = protodata.objects.filter(session=session)
        serializer = protoDataSerializer(data, many=True)
        return Response(serializer.data)
    


class UpdateUserView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]


    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data)

    
    def put(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class DeleteUserView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def delete(self, request):
        user = request.user
        user.delete()
        return Response({"message": "User deleted"}, status=status.HTTP_204_NO_CONTENT)