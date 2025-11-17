"""
FastAPI backend for sign language translation.
This server processes webcam frames and returns sign translations.
Modified to support 3 basic signs only.
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import base64
import cv2
import numpy as np
import os
import mediapipe as mp
import tensorflow as tf
import pickle
import logging
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Sign Language Translation API")

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

# Load translation model
model_dir = 'translation_models'
model_path = os.path.join(model_dir, 'gesture_model.h5')
labels_path = os.path.join(model_dir, 'gesture_labels.pkl')

# Check if model exists
if os.path.exists(model_path) and os.path.exists(labels_path):
    try:
        model = tf.keras.models.load_model(model_path)
        with open(labels_path, 'rb') as f:
            gesture_labels = pickle.load(f)
        logger.info(f"Model loaded successfully with {len(gesture_labels)} gestures")
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        model = None
        gesture_labels = None
else:
    logger.warning("Model files not found. Use train_gesture_model.py to train first.")
    model = None
    gesture_labels = ['hello', 'thanks', 'yes']  # Default labels

# Simple translation dictionary - reduced to 3 signs
translations = {
    "hello": {
        "en": "Hello",
        "hi": "नमस्ते",
        "kn": "ನಮಸ್ಕಾರ",
        "te": "హలో"
    },
    "thanks": {
        "en": "Thank you",
        "hi": "धन्यवाद",
        "kn": "ಧನ್ಯವಾದಗಳು",
        "te": "ధన్యవాదాలు"
    },
    "yes": {
        "en": "Yes",
        "hi": "हां",
        "kn": "ಹೌದು",
        "te": "అవును"
    }
}

# Sequence parameters
sequence_length = 30
num_landmarks = 21
num_coords = 3

# Data models
class FrameData(BaseModel):
    frames: List[str]  # Base64 encoded frames
    language: str = "en"  # Target language code

class TranslationResult(BaseModel):
    detected_sign: str
    confidence: float
    translation: str
    language: str
    all_predictions: Optional[Dict[str, float]] = None
    message: Optional[str] = None

# Increase the maximum size for requests
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
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
        return None

def preprocess_landmarks(landmarks_sequence):
    """Normalize and preprocess hand landmarks for model input"""
    # Ensure we have the right number of frames
    if len(landmarks_sequence) < sequence_length:
        # Pad with the last frame
        last_frame = landmarks_sequence[-1]
        landmarks_sequence = landmarks_sequence + [last_frame] * (sequence_length - len(landmarks_sequence))
    elif len(landmarks_sequence) > sequence_length:
        # Truncate
        landmarks_sequence = landmarks_sequence[:sequence_length]
    
    # Flatten landmarks for each frame
    flattened_sequence = []
    for landmarks in landmarks_sequence:
        # Convert to numpy array if not already
        landmarks = np.array(landmarks)
        
        # Center the landmarks around the wrist
        wrist = landmarks[0]  # Wrist is the first landmark in MediaPipe
        centered = landmarks - wrist
        
        # Normalize for scale
        max_dist = np.max(np.abs(centered))
        if max_dist > 0:
            normalized = centered / max_dist
        else:
            normalized = centered
        
        # Flatten to 1D array
        flattened = normalized.flatten()
        flattened_sequence.append(flattened)
    
    return np.array(flattened_sequence)

def translate_text(text, target_language):
    """Translate text to target language using dictionary"""
    if text in translations and target_language in translations[text]:
        return translations[text][target_language]
    
    # Fallback to English if translation not available
    return translations.get(text, {}).get('en', text)

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Sign Language Translation API"}

@app.post("/api/translate", response_model=TranslationResult)
async def translate_sign(data: FrameData):
    """
    Recognize sign language from a sequence of frames and translate to selected language
    """
    # Check if model is initialized
    if model is None:
        # For demonstration purposes, use a mock response if model isn't available
        mock_sign = "hello"  # Default to hello
        mock_confidence = 0.8
        mock_translation = translate_text(mock_sign, data.language)
        
        return TranslationResult(
            detected_sign=mock_sign,
            confidence=mock_confidence,
            translation=mock_translation,
            language=data.language,
            message="Using mock response (model not loaded)"
        )
    
    # Check for frames
    if not data.frames or len(data.frames) == 0:
        raise HTTPException(status_code=400, detail="No frames provided")
    
    logger.info(f"Received {len(data.frames)} frames for translation to {data.language}")
    
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
                continue
            
            # Extract landmarks
            landmarks = extract_hand_landmarks(frame)
            
            if landmarks is not None:
                all_landmarks.append(landmarks)
                frames_with_hands += 1
        
        logger.info(f"Processed {frames_processed} frames, found hands in {frames_with_hands} frames")
        
        # Check if we have enough landmarks
        if len(all_landmarks) == 0:
            return TranslationResult(
                detected_sign="unknown",
                confidence=0.0,
                translation="No sign detected",
                language=data.language,
                message="No hand landmarks detected in any frame"
            )
        
        # Preprocess landmarks for model input
        processed_sequence = preprocess_landmarks(all_landmarks)
        
        # Add batch dimension
        input_data = np.expand_dims(processed_sequence, axis=0)
        
        # Get prediction
        prediction = model.predict(input_data)[0]
        
        # Get top prediction
        predicted_idx = np.argmax(prediction)
        confidence = float(prediction[predicted_idx])
        
        if predicted_idx < len(gesture_labels):
            detected_sign = gesture_labels[predicted_idx]
        else:
            detected_sign = "unknown"
            
        # Get translation
        translation = translate_text(detected_sign, data.language)
        
        # Prepare all predictions for debugging
        all_predictions = {
            gesture_labels[i]: float(prediction[i]) 
            for i in range(len(gesture_labels))
        }
        
        logger.info(f"Detected: {detected_sign} ({confidence:.2f}), Translated to {data.language}: {translation}")
        
        return TranslationResult(
            detected_sign=detected_sign,
            confidence=confidence,
            translation=translation,
            language=data.language,
            all_predictions=all_predictions,
            message=f"Hand detected in {frames_with_hands}/{frames_processed} frames"
        )
    
    except Exception as e:
        logger.error(f"Error in translation: {e}")
        raise HTTPException(status_code=500, detail=f"Error in translation: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("translate_api:app", host="0.0.0.0", port=8001, reload=True)