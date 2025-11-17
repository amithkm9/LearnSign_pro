
"""
FastAPI backend for sign language recognition.
This server processes webcam frames and returns sign predictions.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import base64
import cv2
import numpy as np
import os
import mediapipe as mp
from model import SignLanguageModel
import logging
import uvicorn
import traceback

# Configure detailed logging for debugging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Sign Language Recognition API")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Initialize the model
try:
    model = SignLanguageModel()
    # Print model details for debugging
    logger.info(f"Sign language model initialized successfully with classes: {model.classes}")
    logger.info(f"Model path: {model.model_path}")
    logger.info(f"Scaler path: {model.scaler_path}")
    logger.info(f"Model loaded: {model.model is not None}")
except Exception as e:
    logger.error(f"Error initializing model: {e}")
    logger.error(traceback.format_exc())
    model = None

# Data models
class FrameData(BaseModel):
    frames: List[str]  # Base64 encoded frames
    expectedSign: str  # Expected sign

class RecognitionResult(BaseModel):
    isCorrect: bool
    predictedSign: str
    confidence: float
    message: Optional[str] = None

# Increase the maximum size for requests
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    # Increase the maximum size limit for the request body
    # This is needed for large base64 encoded images
    request._body_size_limit = 100 * 1024 * 1024  # 100 MB
    response = await call_next(request)
    return response

def base64_to_image(base64_string):
    """Convert base64 string to OpenCV image"""
    try:
        # Remove the data URL prefix if present
        if "data:image" in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        img_data = base64.b64decode(base64_string)
        np_arr = np.frombuffer(img_data, np.uint8)
        
        # Convert to OpenCV image
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        logger.error(traceback.format_exc())
        return None

def extract_hand_landmarks(frame):
    """Extract hand landmarks from frame using MediaPipe"""
    try:
        # Convert to RGB (MediaPipe requires RGB)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process with MediaPipe
        results = hands.process(rgb_frame)
        
        # Check for hand landmarks
        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]  # First hand
            
            # Extract landmarks
            landmarks = []
            for landmark in hand_landmarks.landmark:
                landmarks.append([landmark.x, landmark.y, landmark.z])
            
            return landmarks
        
        return None
    except Exception as e:
        logger.error(f"Error extracting hand landmarks: {e}")
        logger.error(traceback.format_exc())
        return None

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Sign Language Recognition API"}

@app.post("/api/quiz", response_model=RecognitionResult)
async def recognize_sign(data: FrameData):
    """
    Recognize sign language from a sequence of frames
    """
    # Check if model is initialized
    if model is None:
        logger.error("Model not initialized, returning error response")
        raise HTTPException(status_code=500, detail="Model not initialized")
    
    # Check for frames
    if not data.frames or len(data.frames) == 0:
        logger.warning("No frames provided in request")
        raise HTTPException(status_code=400, detail="No frames provided")
    
    logger.info(f"Received {len(data.frames)} frames for recognition, expected sign: {data.expectedSign}")
    
    # Process frames
    all_landmarks = []
    frames_processed = 0
    frames_with_hands = 0
    
    try:
        for base64_frame in data.frames:
            # Convert base64 to image
            frame = base64_to_image(base64_frame)
            frames_processed += 1
            
            if frame is None:
                logger.warning(f"Frame {frames_processed} conversion failed")
                continue
            
            # Extract landmarks
            landmarks = extract_hand_landmarks(frame)
            
            if landmarks is not None:
                all_landmarks.append(landmarks)
                frames_with_hands += 1
        
        logger.info(f"Processed {frames_processed} frames, found hands in {frames_with_hands} frames")
        
        # Check if we have enough landmarks
        if len(all_landmarks) == 0:
            logger.warning("No hand landmarks detected in any frame")
            return RecognitionResult(
                isCorrect=False,
                predictedSign="unknown",
                confidence=0.0,
                message="No hand landmarks detected in any frame"
            )
        
        # Predict sign
        logger.debug("Calling model.predict() with landmarks")
        predicted_sign, confidence = model.predict(all_landmarks)
        logger.info(f"Prediction: {predicted_sign} with confidence {confidence:.2f}")
        
        # Check correctness
        is_correct = predicted_sign.lower() == data.expectedSign.lower()
        
        # Add more detailed logging information
        logger.info(f"Recognition details - Expected: {data.expectedSign}, Predicted: {predicted_sign}, Confidence: {confidence:.4f}, Correct: {is_correct}")
        logger.info(f"Class mapping: {model.classes}")
        
        return RecognitionResult(
            isCorrect=is_correct,
            predictedSign=predicted_sign,
            confidence=confidence,
            message=f"Hand detected in {frames_with_hands}/{frames_processed} frames"
        )
    
    except Exception as e:
        logger.error(f"Error in recognition: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error in recognition: {str(e)}")

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload_flag = os.getenv("RELOAD", "true").lower() == "true"
    uvicorn.run("main:app", host=host, port=port, reload=reload_flag)